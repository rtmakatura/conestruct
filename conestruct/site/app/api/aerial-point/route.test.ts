// #440 X3 — the tap's proxy.  The route checks the body's shape and
// forwards exactly the pin, the frame, the step and the tap; it computes no
// coordinate (Rule 3) and forwards nothing malformed.

import { beforeEach, describe, expect, it, vi } from "vitest";

const forwarded: unknown[] = [];

vi.mock("@/lib/rate-limit", () => ({ rateLimitOr429: async () => null }));
vi.mock("@/lib/render-proxy", () => ({
  fetchAerialPoint: async (body: unknown) => {
    forwarded.push(body);
    return new Response(JSON.stringify({ lat: 39.74, lng: -104.966 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  },
}));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(
    new Request("http://x/api/aerial-point", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
  );

const TAP = { lat: 39.73997, lng: -104.96632, width: 600, height: 340, x: 412.5, y: 96 };

beforeEach(() => {
  forwarded.length = 0;
});

describe("the aerial-point proxy", () => {
  it("forwards the pin, the frame and the tap, and relays the coordinate", async () => {
    const res = await post(TAP);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ lat: 39.74, lng: -104.966 });
    expect(forwarded).toEqual([TAP]);
  });

  it("forwards a zoom step when there is one, and none at step 0", async () => {
    await post({ ...TAP, zoom: 1 });
    await post({ ...TAP, zoom: 0 });
    expect(forwarded).toEqual([{ ...TAP, zoom: 1 }, TAP]);
  });

  it("refuses a malformed tap without forwarding it", async () => {
    const bad = [
      { ...TAP, lat: "39.7" },
      { ...TAP, lat: 91 },
      { ...TAP, lng: Number.NaN },
      { ...TAP, width: 2000 },
      { ...TAP, height: 60.5 },
      { ...TAP, x: 601 },
      { ...TAP, y: -1 },
      { ...TAP, zoom: 4 },
      { ...TAP, zoom: 0.5 },
      { lat: TAP.lat, lng: TAP.lng, width: 600, height: 340 },
    ];
    for (const body of bad) expect((await post(body)).status).toBe(400);
    expect(forwarded).toEqual([]);
  });
});
