// #257 — the bundle relays the confirmed road's centerline (Rule 11:
// tested at the proxy layer, where the omission lived).  Every
// single-file POST in render-proxy materializes ``meta.centerline`` from
// ``meta.confirmedRoad`` at the wire boundary (#140); the zip's part
// fetches shipped the raw scenario, so the zipped plan sheet drew the
// straight frame while the direct download followed the road.  Measured
// on prod 196c116 before the fix: direct p.2 carries the "Centerline"
// row, the zipped p.2 does not (s2-arc24 README).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({}) }));
vi.mock("@/db", () => ({ getDb: () => ({}), plans: {} }));

import { fetchAllRenderParts } from "./render-proxy";
import { BUNDLE_PART_KINDS } from "@/lib/render-types";
import { DEFAULT_QUOTE_SETTINGS } from "@/lib/quote-settings";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios";

const GEOMETRY: Array<[number, number]> = [
  [39.7275, -104.9873],
  [39.7269, -104.9873],
  [39.7262, -104.9874],
];

function pinned(pinLat: number, pinLng: number): Scenario {
  return {
    ...DEFAULT_SHOULDER,
    meta: {
      ...DEFAULT_SHOULDER.meta,
      lat: 39.7269,
      lng: -104.9873,
      bearingDeg: 180,
      confirmedRoad: {
        candidate: { geometry: GEOMETRY },
        pinLat,
        pinLng,
      },
    },
  } as unknown as Scenario;
}

describe("bundle parts relay the confirmed road's centerline (#257)", () => {
  const posted: Array<{ url: string; body: Record<string, unknown> }> = [];

  beforeEach(() => {
    posted.length = 0;
    process.env.MODAL_RENDER_URL = "https://modal.test";
    process.env.MODAL_RENDER_SECRET = "s";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        posted.push({ url, body: JSON.parse(String(init?.body)) });
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("every zipped part posts meta.centerline from the confirmed road", async () => {
    const parts = await fetchAllRenderParts(pinned(39.7269, -104.9873), DEFAULT_QUOTE_SETTINGS);
    expect(parts.map((p) => p.kind)).toEqual([...BUNDLE_PART_KINDS]);
    expect(posted).toHaveLength(BUNDLE_PART_KINDS.length);
    for (const { url, body } of posted) {
      // The quote part wraps the scenario with its settings; the rest post it bare.
      const scenario = (url.endsWith("/render/quote") ? body.scenario : body) as {
        meta: { centerline?: unknown };
      };
      expect(scenario.meta.centerline, url).toEqual(GEOMETRY);
    }
  });

  it("a moved pin relays no centerline — the same staleness key as every single-file POST", async () => {
    await fetchAllRenderParts(pinned(39.75, -105.0), DEFAULT_QUOTE_SETTINGS);
    for (const { url, body } of posted) {
      const scenario = (url.endsWith("/render/quote") ? body.scenario : body) as {
        meta: { centerline?: unknown };
      };
      expect(scenario.meta.centerline, url).toBeUndefined();
    }
  });
});
