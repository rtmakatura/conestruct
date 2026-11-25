// #568 — the search `1437 Bannock St, Denver` placed a pin and the road
// lookup listed no roads.  Mapbox answers that address at the centre of
// the City and County Building (39.739247, -104.99097, "accuracy":
// "rooftop"); the nearest road open to traffic is Cherokee Street, 57.8 m
// away (Bannock Street there is `highway=pedestrian`), and the lookup kept
// only roads within 30 m.  A pin an address search placed now says so
// (`reach: "address"`), and with no road within 30 m the route answers the
// roads within 100 m, flagged `nearest_only`.
//
// Real route, Overpass played from a recording of both round trips at that
// point (2026-11-24, overpass-api.de; the fixture holds the two queries).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rate-limit", () => ({
  rateLimitOr429: vi.fn(async () => null),
}));

import { OVERPASS_MIRRORS } from "@/lib/road-detection/overpass";
import { POST } from "./route";

const RECORDED = JSON.parse(
  readFileSync(join(__dirname, "__fixtures__", "bannock-1437-568.json"), "utf8"),
) as { pin: { lat: number; lng: number }; roads: unknown[]; pool: unknown[] };
const PIN = RECORDED.pin;

function request(body: unknown): NextRequest {
  const text = JSON.stringify(body);
  return new NextRequest("http://localhost/api/road-bearing", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(text)),
    },
    body: text,
  });
}

let queue: unknown[][];
let queries: string[];

beforeEach(() => {
  queue = [RECORDED.roads, RECORDED.pool];
  queries = [];
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: { body?: unknown }) => {
      if (url !== OVERPASS_MIRRORS[0]) throw new TypeError("fetch failed");
      queries.push(decodeURIComponent(String(init?.body ?? "")));
      const elements = queue.shift();
      if (!elements) throw new TypeError("fetch failed");
      return { ok: true, status: 200, json: async () => ({ elements }) };
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Row = Record<string, unknown>;
type Answer = { scan_status: string; candidates: Row[]; nearest_only?: boolean };

async function answer(body: unknown): Promise<Answer> {
  const res = await POST(request(body));
  expect(res.status).toBe(200);
  return (await res.json()) as Answer;
}

describe("#568 1437 Bannock St: an address pin with no road within 30 m", () => {
  it("lists the nearest roads, Cherokee Street first, and says they are only the nearest", async () => {
    const a = await answer({ ...PIN, reach: "address" });
    expect(a.scan_status).toBe("ok");
    expect(a.nearest_only).toBe(true);
    expect(a.candidates.map((c) => c.name)).toEqual([
      "Cherokee Street",
      "West Colfax Avenue",
      "West 14th Avenue",
    ]);
    // Every one is past the 30 m a tapped pin is held to, and inside 100 m.
    const dists = a.candidates.map((c) => c.snap_distance_m as number);
    expect(dists[0]).toBeCloseTo(57.8, 0);
    expect(dists[1]).toBeCloseTo(84.1, 0);
    expect(dists[2]).toBeCloseTo(87.3, 0);
    for (const d of dists) {
      expect(d).toBeGreaterThan(30);
      expect(d).toBeLessThanOrEqual(100);
    }
  });

  it("asks Overpass for ways within 100 m, and for signals within 50 m as before", async () => {
    await answer({ ...PIN, reach: "address" });
    expect(queries[0]).toContain(`way(around:100,${PIN.lat},${PIN.lng})`);
    expect(queries[0]).toContain(`node(around:50,${PIN.lat},${PIN.lng})["highway"="traffic_signals"]`);
  });

  it("the same point as a tapped pin still answers no road, with no flag", async () => {
    const a = await answer(PIN);
    expect(queries[0]).toContain(`way(around:50,${PIN.lat},${PIN.lng})`);
    expect(a.scan_status).toBe("ok");
    expect(a.candidates).toEqual([]);
    expect("nearest_only" in a).toBe(false);
  });

  it("only the word \"address\" widens the reach", async () => {
    const a = await answer({ ...PIN, reach: true });
    expect(a.candidates).toEqual([]);
  });
});

describe("#568: an address pin with a road within 30 m answers as any pin does", () => {
  // The #525 recording: Colfax and Pennsylvania, two roads at the pin.
  const COLFAX = JSON.parse(
    readFileSync(join(__dirname, "__fixtures__", "colfax-pennsylvania-525.json"), "utf8"),
  ) as { roads: unknown[]; pool: unknown[] };
  const AT = { lat: 39.7401, lng: -104.9811 };

  it("the same candidates, byte for byte, and no flag", async () => {
    queue = [COLFAX.roads, COLFAX.pool];
    const tapped = await answer(AT);
    queue = [COLFAX.roads, COLFAX.pool];
    const searched = await answer({ ...AT, reach: "address" });
    expect(JSON.stringify(searched)).toBe(JSON.stringify(tapped));
    expect(tapped.candidates).toHaveLength(2);
    expect("nearest_only" in searched).toBe(false);
  });
});
