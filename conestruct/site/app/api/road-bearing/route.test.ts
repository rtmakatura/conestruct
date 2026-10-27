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

import { OVERPASS_MIRRORS, resetMirrorRest } from "@/lib/road-detection/overpass";
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

// Queue-driven Overpass stub, one FIFO per mirror (#405: the mirrors are
// asked at once, so call order no longer says which mirror a call was).
// `queue` scripts the first mirror (overpass-api.de), round trip by round
// trip; `frQueue` scripts the second (overpass.openstreetmap.fr).  An
// exhausted queue rejects (network error) — the safe default for round
// trips a test doesn't care about (the best-effort extension query
// degrades silently by design).  `hang` never answers until the request
// is aborted.
type Scripted =
  | { kind: "reject" }
  | { kind: "hang" }
  | { kind: "status"; status: number }
  | { kind: "remark"; remark: string }
  | { kind: "ok"; elements: unknown[] };

let queue: Scripted[];
let frQueue: Scripted[];
let fetchMock: ReturnType<typeof vi.fn>;
// Every Overpass query body the route actually sent, decoded from the
// `data=` form encoding.  The radius constants are observable ONLY here:
// `around:` filtering happens on the Overpass side, so a stubbed response
// cannot show whether the route asked for the right radius.
let sentQueries: string[];

function stubOverpass() {
  fetchMock = vi.fn(async (url: unknown, init?: { body?: string; signal?: AbortSignal }) => {
    if (typeof init?.body === "string" && init.body.startsWith("data=")) {
      sentQueries.push(decodeURIComponent(init.body.slice("data=".length)));
    }
    const q = url === OVERPASS_MIRRORS[0] ? queue : frQueue;
    const next = q.shift() ?? { kind: "reject" as const };
    if (next.kind === "reject") throw new TypeError("fetch failed");
    if (next.kind === "hang") {
      return new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () =>
          reject(Object.assign(new Error("Aborted"), { name: "AbortError" })),
        ),
      );
    }
    if (next.kind === "status") {
      return { ok: false, status: next.status, json: async () => ({}) };
    }
    if (next.kind === "remark") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ elements: [], remark: next.remark }),
      };
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
  frQueue = [];
  sentQueries = [];
  resetMirrorRest();
  vi.spyOn(console, "info").mockImplementation(() => {});
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

  // #405 (Rule 5, stated): a 4xx is that mirror's failure, not the
  // chain's (the backend's R74).  It used to be a hard stop, so one 429
  // from overpass-api.de read as "Detection service unavailable" with
  // overpass.openstreetmap.fr never asked.
  it("a 4xx from both mirrors is unavailable, and both were asked", async () => {
    queue = [{ kind: "status", status: 400 }];
    frQueue = [{ kind: "status", status: 400 }];
    const body = await (await POST(request(PIN))).json();
    expect(body.scan_status).toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([400, 406, 429])(
    "a %i from the first mirror leaves the second mirror's answer in play (#405)",
    async (status) => {
      queue = [{ kind: "status", status }];
      frQueue = [{ kind: "ok", elements: [way(7, { highway: "residential" })] }];
      const body = await (await POST(request(PIN))).json();
      expect(body.scan_status).toBe("ok");
      expect(body.candidates).toHaveLength(1);
    },
  );

  it("a 5xx from one mirror and an answer from the other completes", async () => {
    queue = [{ kind: "status", status: 504 }];
    frQueue = [{ kind: "ok", elements: [way(7, { highway: "residential" })] }];
    const body = await (await POST(request(PIN))).json();
    expect(body.scan_status).toBe("ok");
    expect(body.candidates).toHaveLength(1);
    // Unnamed candidate → no extension round trip → one call per mirror.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // #405: the measured stall.  overpass-api.de answered nothing in 25 s on
  // 6 of 10 probes; the old chain waited out its 6 s (and kumi's) before
  // asking .fr.  Now .fr is asked at the same moment, and the stalled
  // request is aborted once .fr answers.
  it("a stalled first mirror doesn't hold the second mirror's answer", async () => {
    queue = [{ kind: "hang" }];
    frQueue = [{ kind: "ok", elements: [way(7, { highway: "residential" })] }];
    const t0 = Date.now();
    const body = await (await POST(request(PIN))).json();
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(body.scan_status).toBe("ok");
    expect(body.candidates).toHaveLength(1);
    const deCall = fetchMock.mock.calls.find((c) => c[0] === OVERPASS_MIRRORS[0]);
    expect((deCall?.[1] as { signal: AbortSignal }).signal.aborted).toBe(true);
  });

  // #405 (#251's rule, ported): a 200 whose body carries a `remark` didn't
  // complete.  Before, it was read as a payload, so a timed-out query came
  // back as a measured "no road within 30 m" (Rule 10).
  it("a remark is that mirror's failure, never a measured empty", async () => {
    queue = [{ kind: "remark", remark: "runtime error: Query timed out" }];
    const body = await (await POST(request(PIN))).json();
    expect(body.scan_status).toBe("unavailable");
    expect(body.isUrban).toBeNull();
  });

  it("a remark from one mirror leaves the other's answer in play", async () => {
    queue = [{ kind: "remark", remark: "runtime error: out of memory" }];
    frQueue = [{ kind: "ok", elements: [way(7, { highway: "residential" })] }];
    const body = await (await POST(request(PIN))).json();
    expect(body.scan_status).toBe("ok");
    expect(body.candidates).toHaveLength(1);
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

// ---------------------------------------------------------------------------
// #279 — isUrban: any urban place within the radius, not the closest place
// ---------------------------------------------------------------------------
//
// The reported symptom was an OSM `primary` in central Denver classifying
// as "Rural — undivided".  Two defects produced it, and these tests pin
// both.  The masking case is the one that mattered: the query fetches six
// place classes while the predicate accepts four, and the predicate tested
// only the CLOSEST node — so a nearer `village`/`hamlet` hid a `place=city`
// further out.  The route's own comment already said the rule was "the
// presence of ANY urban-class place within PLACE_RADIUS_M".

function placeNode(
  id: number,
  place: string,
  dLat: number,
  name = `p${id}`,
): Record<string, unknown> {
  return {
    type: "node",
    id,
    lat: PIN.lat + dLat,
    lon: PIN.lng,
    tags: { place, name },
  };
}

describe("#279 isUrban", () => {
  it("a nearer non-urban place does NOT mask a city further out", async () => {
    queue = [
      {
        kind: "ok",
        elements: [
          way(21, { highway: "primary" }),
          placeNode(901, "hamlet", 0.001, "Nearer Hamlet"),
          placeNode(902, "city", 0.018, "Denver"),
        ],
      },
    ];
    const body = await (await POST(request(PIN))).json();
    expect(body.scan_status).toBe("ok");
    expect(body.isUrban).toBe(true);
  });

  it("stays rural when no urban-class place is in range", async () => {
    queue = [
      {
        kind: "ok",
        elements: [
          way(22, { highway: "primary" }),
          placeNode(903, "hamlet", 0.001, "Hamlet"),
          placeNode(904, "village", 0.004, "Village"),
        ],
      },
    ];
    const body = await (await POST(request(PIN))).json();
    expect(body.scan_status).toBe("ok");
    expect(body.isUrban).toBe(false);
  });

  it("placeName stays the CLOSEST place, urban or not", async () => {
    queue = [
      {
        kind: "ok",
        elements: [
          way(23, { highway: "primary" }),
          placeNode(905, "hamlet", 0.001, "Nearer Hamlet"),
          placeNode(906, "city", 0.018, "Denver"),
        ],
      },
    ];
    const body = await (await POST(request(PIN))).json();
    expect(body.isUrban).toBe(true);
    expect(body.placeName).toBe("Nearer Hamlet");
  });

  // The radius itself, pinned.  #279's reported pin (E Bayaud) sits
  // 3,056 m from the nearest `neighbourhood` node — 56 m outside the old
  // 3,000 m radius — so the wrong classification turned on the constant,
  // not on the predicate above.  5,000 m is CHOSEN from the 2026-09-17
  // tiebreaker sample (validation-artifacts/committed/issue-279-classifier/):
  // 3,000 misses e-bayaud, 5,000 classifies 7/7 urban with 0/11 rural
  // flips, and 8,000 flipped a rural control urban in the earlier
  // candidates run.  Nothing else in this file can
  // observe the value — the stub returns whatever elements it is handed,
  // whatever their distance — so without this test the constant is
  // untested and an edit back to 3,000 stays green.
  it("asks Overpass for place nodes within 5,000 m (#279)", async () => {
    queue = [{ kind: "ok", elements: [way(24, { highway: "primary" })] }];
    await POST(request(PIN));
    expect(sentQueries.length).toBeGreaterThan(0);
    expect(sentQueries[0]).toContain(
      `node(around:5000,${PIN.lat},${PIN.lng})["place"~`,
    );
  });

});
