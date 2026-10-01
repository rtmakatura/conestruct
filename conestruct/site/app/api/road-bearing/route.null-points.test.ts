/**
 * #305 — the picker's road lookup never throws on an Overpass way with a
 * point that has no coordinates.
 *
 * The real case (#304): for N Federal Blvd the fallback mirror
 * overpass.openstreetmap.fr answers with one extra way, 42125193 — a street in
 * Pavlodar, Kazakhstan — whose geometry holds `null` at 15 and 39.  The route
 * projected every segment with `a.lat` unchecked and threw, so Next.js sent a
 * non-JSON 500 and the picker offered no road.
 *
 * Both captures are the real answers (tests/fixtures/site_scan/,
 * federal.meta.json says where each came from).  Global fetch is stubbed to
 * serve one capture for every Overpass call, so no network is touched.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "./route";

const FIXTURES = resolve(__dirname, "../../../../../tests/fixtures/site_scan");
const FALLBACK = readFileSync(resolve(FIXTURES, "federal_fallback_null_points.json"), "utf-8");
const PRIMARY = readFileSync(resolve(FIXTURES, "federal_primary.json"), "utf-8");
const PIN = { lat: 39.7342642691076, lng: -105.02504468168067 };

function serve(payload: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(payload, { status: 200, headers: { "content-type": "application/json" } })),
  );
}

async function lookup(payload: string): Promise<Response> {
  serve(payload);
  return POST(
    new NextRequest("http://localhost/api/road-bearing", {
      method: "POST",
      body: JSON.stringify(PIN),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("#305 the fallback mirror's null points", () => {
  it("the fixtures are what they say", () => {
    const nulls = (raw: string) =>
      Object.fromEntries(
        (JSON.parse(raw).elements as Array<{ id: number; geometry?: unknown[] }>)
          .filter((e) => e.geometry?.some((p) => p === null))
          .map((e) => [e.id, e.geometry!.flatMap((p, i) => (p === null ? [i] : []))]),
      );
    expect(nulls(FALLBACK)).toEqual({ 42125193: [15, 39] });
    expect(nulls(PRIMARY)).toEqual({});
  });

  it("answers 200 JSON on the fallback capture", async () => {
    const res = await lookup(FALLBACK);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scan_status).toBe("ok");
    expect(body.candidates[0].name).toBe("North Federal Boulevard");
  });

  it("gives the same candidates as the primary mirror's capture", async () => {
    const fallback = await (await lookup(FALLBACK)).json();
    const primary = await (await lookup(PRIMARY)).json();
    expect(fallback).toEqual(primary);
  });
});
