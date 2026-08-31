// #213 — the road-bearing route distinguishes "the scan never ran"
// from "the scan ran and found nothing".
//
// Rule 11: the defect lives at this hop — an all-mirrors Overpass
// failure used to serialize byte-identical to a measured empty result
// (`{candidates: [], isUrban: false, placeName: null}` at HTTP 200),
// so a transient outage became a false absence claim plus a silent
// rural default.  Measured live at the 2026-08-17 triage: the E Bayaud
// pin (39.71466, -104.94071) returned zero candidates, then five on
// the identical request seconds later (the "0-then-5" capture, quoted
// in #213).  These tests pin the wire itself: real NextRequest in,
// mirror-by-mirror Overpass behavior stubbed at global fetch.
//
// First test file on this route — it had zero coverage before #213.

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rate-limit", () => ({
  rateLimitOr429: vi.fn(async () => null),
}));

import { POST } from "./route";

// The #213 pin: E Bayaud Ave / S Colorado Blvd (the recorded
// bayaud_colorado_pool.json coordinate).
const PIN = { lat: 39.71466, lng: -104.94071 };

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

// An OSM way whose segment passes through the pin (snap distance ~0),
// so buildResponse always accepts it.  Unnamed by default: a candidate
// with neither name nor ref never triggers the second (extension)
// Overpass round trip, which keeps fetch-call counting exact where a
// test asserts it.
function way(
  id: number,
  tags: Record<string, string>,
  dLat = 0,
): Record<string, unknown> {
  return {
    type: "way",
    id,
    geometry: [
      { lat: PIN.lat + dLat, lon: PIN.lng - 0.0004 },
      { lat: PIN.lat + dLat, lon: PIN.lng + 0.0004 },
    ],
    tags,
  };
}

const PLACE_NODE = {
  type: "node",
  id: 900,
  lat: PIN.lat + 0.001,
  lon: PIN.lng + 0.001,
  tags: { place: "suburb", name: "Glendale" },
};

// Queue-driven Overpass stub.  The route awaits mirrors strictly in
// order, so a FIFO of scripted outcomes models "mirror 1 down, mirror
// 2 answers" exactly.  An exhausted queue rejects (network error) —
// the safe default for round trips a test doesn't care about (the
// best-effort extension query degrades silently by design).
type Scripted =
  | { kind: "reject" }
  | { kind: "status"; status: number }
  | { kind: "ok"; elements: unknown[] };

let queue: Scripted[];
let fetchMock: ReturnType<typeof vi.fn>;

function stubOverpass() {
  fetchMock = vi.fn(async () => {
    const next = queue.shift() ?? { kind: "reject" as const };
    if (next.kind === "reject") throw new TypeError("fetch failed");
    if (next.kind === "status") {
      return { ok: false, status: next.status, json: async () => ({}) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ elements: next.elements }),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  queue = [];
  stubOverpass();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("scan failure vs measured absence (#213)", () => {
  it("all-mirrors outage → scan_status 'unavailable', claiming nothing", async () => {
    queue = [{ kind: "reject" }, { kind: "reject" }, { kind: "reject" }];
    const res = await POST(request(PIN));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scan_status).toBe("unavailable");
    expect(body.candidates).toEqual([]);
    // The bug's payload was a claim: isUrban:false (the silent rural
    // default) and placeName:null presented as measurements.  The
    // unavailable body asserts nothing.
    expect(body.isUrban).toBeNull();
    expect(body.placeName).toBeNull();
  });

  it("the 0-then-5 capture: outage, then the identical request succeeds", async () => {
    // Request 1 — every mirror down (the triage's zero-candidate blip).
    queue = [{ kind: "reject" }, { kind: "reject" }, { kind: "reject" }];
    const first = await (await POST(request(PIN))).json();
    expect(first.scan_status).toBe("unavailable");
    expect(first.candidates).toEqual([]);

    // Request 2, seconds later — Overpass answers with five distinct
    // roads and the place node.  The main query succeeds on mirror 1;
    // the follow-up extension query is left to the default (rejecting)
    // queue and degrades silently, as designed.
    queue = [
      {
        kind: "ok",
        elements: [
          way(1, { highway: "residential", name: "East Bayaud Avenue" }),
          way(2, { highway: "primary", name: "South Colorado Boulevard" }, 0.0001),
          way(3, { highway: "residential", name: "East Dakota Avenue" }, -0.0001),
          way(4, { highway: "tertiary", name: "South Birch Street" }, 0.00015),
          way(5, { highway: "residential", name: "East Alameda Avenue" }, -0.00015),
          PLACE_NODE,
        ],
      },
    ];
    const second = await (await POST(request(PIN))).json();
    expect(second.scan_status).toBe("ok");
    expect(second.candidates).toHaveLength(5);
    expect(second.isUrban).toBe(true);
    expect(second.placeName).toBe("Glendale");
  });

  it("a genuine empty scan stays a measurement: ok + zero candidates + place facts", async () => {
    // Overpass answered — there simply is no road within reach.  The
    // place context is real measured data and stays on the response;
    // only the never-ran path is barred from claiming it.
    queue = [{ kind: "ok", elements: [PLACE_NODE] }];
    const body = await (await POST(request(PIN))).json();
    expect(body.scan_status).toBe("ok");
    expect(body.candidates).toEqual([]);
    expect(body.isUrban).toBe(true);
    expect(body.placeName).toBe("Glendale");
  });

  it("a 4xx is unavailable, and a hard stop (no second mirror)", async () => {
    queue = [{ kind: "status", status: 400 }];
    const body = await (await POST(request(PIN))).json();
    expect(body.scan_status).toBe("unavailable");
    // 4xx means the query itself was rejected — retrying another
    // mirror would repeat it, so exactly one fetch fires.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a 5xx falls through to the next mirror and still completes", async () => {
    queue = [
      { kind: "status", status: 504 },
      { kind: "ok", elements: [way(7, { highway: "residential" })] },
    ];
    const body = await (await POST(request(PIN))).json();
    expect(body.scan_status).toBe("ok");
    expect(body.candidates).toHaveLength(1);
    // Unnamed candidate → no extension round trip → exactly the two
    // main-query attempts.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("extension-failure fallback (the Colfax transient, pinned)", () => {
  it("a failed extension query keeps own-way geometry silently", async () => {
    // Behavior pin, green at baseline: the s2-arc5 README records one
    // Colfax probe serving a 17-pt own-way-only chain because the
    // best-effort extension query transiently failed (two immediate
    // re-probes served the full 191 pts).  Surfacing that degradation
    // on the wire is phase-1+ scope of #224; until then this test
    // pins the fallback so it can't drift into an error or an empty.
    const own = way(11, { highway: "residential", name: "East Bayaud Avenue" });
    queue = [{ kind: "ok", elements: [own, PLACE_NODE] }];
    // Extension round trip (fires because the candidate is named)
    // draws on the exhausted queue → every mirror rejects.
    const body = await (await POST(request(PIN))).json();
    expect(body.scan_status).toBe("ok");
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0].geometry).toEqual(
      (own.geometry as Array<{ lat: number; lon: number }>).map((n) => [
        n.lat,
        n.lon,
      ]),
    );
  });
});
