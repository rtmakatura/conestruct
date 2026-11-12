// #525 — at Colfax and Pennsylvania (39.7401, -104.9811) the road list
// named "Pennsylvania Street" twice: OSM way 812978772 is drawn north to
// south and the street's other pieces south to north, so the octant dedup
// kept it as its own row, at its south end ~22 m up the street.  Ryan's
// ruling (cc-prompt-ux-group7b-guesses-hours.md item 2): one entry per
// street, at its nearest way's distance, with "at <cross street>" when
// the pin is at an intersection.  Real route, Overpass played from a
// recording of both round trips (2026-11-11, overpass-api.de).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rate-limit", () => ({
  rateLimitOr429: vi.fn(async () => null),
}));

import { OVERPASS_MIRRORS } from "@/lib/road-detection/overpass";
import { POST } from "./route";

const PIN = { lat: 39.7401, lng: -104.9811 };
const RECORDED = JSON.parse(
  readFileSync(join(__dirname, "__fixtures__", "colfax-pennsylvania-525.json"), "utf8"),
) as { roads: unknown[]; pool: unknown[] };

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

beforeEach(() => {
  queue = [RECORDED.roads, RECORDED.pool];
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      if (url !== OVERPASS_MIRRORS[0]) throw new TypeError("fetch failed");
      const elements = queue.shift();
      if (!elements) throw new TypeError("fetch failed");
      return { ok: true, status: 200, json: async () => ({ elements }) };
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type Row = Record<string, unknown> & { twin?: Record<string, unknown> };

async function rows(): Promise<Row[]> {
  const res = await POST(request(PIN));
  return ((await res.json()) as { candidates: Row[] }).candidates;
}

describe("#525 Colfax and Pennsylvania: one entry per street", () => {
  it("lists Pennsylvania Street once, at its nearest way's distance", async () => {
    const list = await rows();
    const penn = list.filter((c) => c.name === "Pennsylvania Street");
    expect(penn).toHaveLength(1);
    // Way 1548629055 runs past the pin 1.7 m to its west; the dropped
    // piece (812978772) starts 21.8 m north of it.
    expect(penn[0].way_id).toBe("1548629055");
    expect(penn[0].snap_distance_m as number).toBeCloseTo(1.69, 1);
  });

  it("keeps East Colfax Avenue one grouped entry (#507 unchanged)", async () => {
    const list = await rows();
    const colfax = list.filter((c) => c.name === "East Colfax Avenue");
    expect(colfax).toHaveLength(1);
    expect(colfax[0].twin?.name).toBe("East Colfax Avenue");
    expect(list).toHaveLength(2);
  });

  it("names the cross street on each entry", async () => {
    const list = await rows();
    const byName = Object.fromEntries(list.map((c) => [c.name, c]));
    expect(byName["Pennsylvania Street"].cross_street).toBe("East Colfax Avenue");
    expect(byName["East Colfax Avenue"].cross_street).toBe("Pennsylvania Street");
  });

  it("reads Pennsylvania's OSM tags as two-way (Rule 12)", async () => {
    const [penn] = (await rows()).filter((c) => c.name === "Pennsylvania Street");
    expect((penn.tags as Record<string, unknown>).oneway).toBe("no");
    expect((penn.tags as Record<string, unknown>).lanes).toBe("2");
  });
});
