// #207 — the detect-site PROXY passes the centerline through.
//
// Rule 11: the s2-arc3 defect lived in this hop — the frontend sent the
// geometry and the Modal service accepted it, but this route's 1 KB
// body cap 413'd every relay-bearing detect, and its allowlist
// re-constructor dropped the field even under the cap.  Neither the
// mounted form test (fetch mocked) nor the Modal payload test could see
// it, so this file pins the proxy itself: real NextRequest in, the
// upstream payload out (fetchSiteDetection mocked at the module seam).

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DetectSiteRequestBody } from "@/lib/render-proxy";

const seen: DetectSiteRequestBody[] = [];
vi.mock("@/lib/render-proxy", () => ({
  fetchSiteDetection: vi.fn(async (payload: DetectSiteRequestBody) => {
    seen.push(payload);
    return new Response(JSON.stringify({ mode: "corridor" }), {
      headers: { "content-type": "application/json" },
    });
  }),
}));

import { POST } from "./route";

const CORRIDOR_FIELDS = {
  lat: 39.7113,
  lng: -105.0815,
  radius_m: 500,
  bearing_deg: 176.0,
  speed_mph: 40,
  work_zone_ft: 800,
  closure_type: "shoulder",
  road_type: "rural_undivided",
  lane_width_ft: 12,
};

// A realistic relay: ~166 vertices, the committed Lookout fixture's
// size class (~6 KB as JSON — over the old 1 KB cap, far under 32 KB).
const GEOMETRY: Array<[number, number]> = Array.from({ length: 166 }, (_, i) => [
  39.7113 + i * 0.0002,
  -105.0815 - i * 0.0001,
]);

function request(body: unknown): NextRequest {
  const text = JSON.stringify(body);
  return new NextRequest("http://localhost/api/render/detect-site", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(text)),
    },
    body: text,
  });
}

beforeEach(() => {
  seen.length = 0;
});

describe("detect-site proxy centerline relay (#207)", () => {
  it("passes a realistic centerline through to the upstream payload", async () => {
    const res = await POST(request({ ...CORRIDOR_FIELDS, centerline: GEOMETRY }));
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0].centerline).toEqual(GEOMETRY);
    // The corridor quintet rides alongside, unchanged.
    expect(seen[0].bearing_deg).toBe(176.0);
    expect(seen[0].closure_type).toBe("shoulder");
  });

  it("omits a malformed or too-short centerline (degrade-not-400)", async () => {
    for (const bad of [
      [[39.7, -105.1]], // one vertex
      [[39.7, -105.1], [999, -105.1]], // lat out of range
      [[39.7, -105.1], [39.8]], // not a pair
      "not-an-array",
      [[39.7, -105.1], ["39.8", "-105.2"]], // strings
    ]) {
      seen.length = 0;
      const res = await POST(request({ ...CORRIDOR_FIELDS, centerline: bad }));
      expect(res.status).toBe(200);
      expect(seen[0].centerline).toBeUndefined();
    }
  });

  it("still rejects a body over the 32 KB render-family bound", async () => {
    const huge = Array.from({ length: 3000 }, (_, i) => [
      39.7113 + i * 1e-6,
      -105.0815 - i * 1e-6,
    ]);
    const res = await POST(request({ ...CORRIDOR_FIELDS, centerline: huge }));
    expect(res.status).toBe(413);
    expect(seen).toHaveLength(0);
  });

  it("a plain pre-#207 body is untouched", async () => {
    const res = await POST(request(CORRIDOR_FIELDS));
    expect(res.status).toBe(200);
    expect(seen[0]).toEqual(CORRIDOR_FIELDS);
    expect("centerline" in seen[0]).toBe(false);
  });
});
