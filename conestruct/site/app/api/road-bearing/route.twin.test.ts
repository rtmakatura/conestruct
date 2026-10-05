// #308 — the road-bearing route relays each one-way candidate's twin
// evidence: the distance to the nearest same-name way running the opposite
// direction, measured from the same-name pool the route already fetches to
// stitch the centerline.  When that best-effort round trip fails, the
// candidate says the search did not run — the backend then asks the
// operator (ruling R83) instead of guessing.  Real NextRequest in, Overpass
// stubbed at global fetch (the route.test.ts harness).

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rate-limit", () => ({
  rateLimitOr429: vi.fn(async () => null),
}));

import { POST } from "./route";

const PIN = { lat: 39.7337, lng: -104.98753 };
const M_LAT = 1 / 111_320;

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

/** An east-west way `northM` metres north of the pin, drawn west → east
 *  unless `westbound`. */
function way(
  id: number,
  tags: Record<string, string>,
  northM = 0,
  westbound = false,
): Record<string, unknown> {
  const w = { lat: PIN.lat + northM * M_LAT, lon: PIN.lng - 0.0006 };
  const e = { lat: PIN.lat + northM * M_LAT, lon: PIN.lng + 0.0006 };
  return { type: "way", id, geometry: westbound ? [e, w] : [w, e], tags };
}

type Scripted = { kind: "reject" } | { kind: "ok"; elements: unknown[] };
let queue: Scripted[];

beforeEach(() => {
  queue = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const next = queue.shift() ?? { kind: "reject" as const };
      if (next.kind === "reject") throw new TypeError("fetch failed");
      return { ok: true, status: 200, json: async () => ({ elements: next.elements }) };
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function candidates(): Promise<Array<Record<string, unknown>>> {
  const res = await POST(request(PIN));
  const body = (await res.json()) as { candidates: Array<Record<string, unknown>> };
  return body.candidates;
}

const EASTBOUND = { highway: "primary", name: "East 8th Avenue", oneway: "yes" };

describe("twin evidence on the wire", () => {
  it("measures the same-name way running the other way", async () => {
    const own = way(1, EASTBOUND);
    const twin = way(2, EASTBOUND, 21.7, true);
    queue.push({ kind: "ok", elements: [own] });
    queue.push({ kind: "ok", elements: [own, twin] });
    const [c] = await candidates();
    expect(c.twin_searched).toBe(true);
    expect(c.twin_distance_m as number).toBeCloseTo(21.7, 0);
  });

  it("finds none when the pool holds no opposite same-name way", async () => {
    const own = way(1, EASTBOUND);
    queue.push({ kind: "ok", elements: [own] });
    queue.push({ kind: "ok", elements: [own] });
    const [c] = await candidates();
    expect(c.twin_searched).toBe(true);
    expect(c.twin_distance_m).toBeNull();
  });

  it("says the search did not run when the second round trip fails", async () => {
    queue.push({ kind: "ok", elements: [way(1, EASTBOUND)] });
    // every mirror rejects the same-name round trip
    const [c] = await candidates();
    expect(c.twin_searched).toBe(false);
    expect(c.twin_distance_m).toBeNull();
  });

  it("says the search did not run for a one-way with no name or ref", async () => {
    queue.push({ kind: "ok", elements: [way(1, { highway: "primary", oneway: "yes" })] });
    const [c] = await candidates();
    expect(c.twin_searched).toBe(false);
    expect(c.twin_distance_m).toBeNull();
  });

  it("adds nothing to a two-way candidate", async () => {
    const own = way(1, { highway: "primary", name: "East Colfax Avenue" });
    queue.push({ kind: "ok", elements: [own] });
    queue.push({ kind: "ok", elements: [own] });
    const [c] = await candidates();
    expect("twin_searched" in c).toBe(false);
    expect("twin_distance_m" in c).toBe(false);
  });
});
