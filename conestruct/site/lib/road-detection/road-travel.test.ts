// #512: the route relays each entry's raw facts to the backend and attaches
// its answer verbatim; any failure leaves every entry without words.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachRoadTravel } from "./road-travel";
import type { RoadCandidate } from "./types";

function cand(oneway: string | null, extra: Partial<RoadCandidate> = {}): RoadCandidate {
  return {
    way_id: "1",
    highway_class: "primary",
    name: "East Colfax Avenue",
    ref: null,
    bearing: 90,
    snap_distance_m: 9,
    snapped_lat: 39.74,
    snapped_lng: -104.97,
    tags: {
      oneway,
      maxspeed: null,
      lanes: null,
      lanes_forward: null,
      lanes_backward: null,
      lanes_both_ways: null,
      turn_lanes: null,
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
    signal_distance_m: null,
    ...extra,
  };
}

const ANSWER = {
  roads: [
    { travel: "both_ways", carriageway: "undecided" },
    { travel: "changes_by_time", carriageway: "not_applicable" },
  ],
};

describe("attachRoadTravel", () => {
  beforeEach(() => {
    vi.stubEnv("MODAL_RENDER_URL", "https://backend.example/");
    vi.stubEnv("MODAL_RENDER_SECRET", "s3cret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends each entry's raw facts (the twin's tag too) and attaches the answer verbatim", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(ANSWER), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const twin = cand("yes", { way_id: "2", bearing: 270 });
    const cs = [cand("yes", { twin, twin_searched: false }), cand("reversible", { highway_class: "motorway" })];
    await attachRoadTravel(cs);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://backend.example/render/road-travel");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer s3cret");
    expect(JSON.parse(init.body as string)).toEqual({
      roads: [
        { oneway: "yes", highway_class: "primary", twin_oneway: "yes", twin_distance_m: null, twin_searched: false },
        { oneway: "reversible", highway_class: "motorway", twin_oneway: null, twin_distance_m: null, twin_searched: false },
      ],
    });
    expect(cs.map((c) => c.travel)).toEqual(ANSWER.roads);
  });

  it.each([
    ["a 503", async () => new Response("down", { status: 503 })],
    ["a network error", async () => { throw new TypeError("fetch failed"); }],
    ["a timeout", async () => { throw new DOMException("timed out", "TimeoutError"); }],
    ["the wrong count", async () => new Response(JSON.stringify({ roads: [ANSWER.roads[0]] }), { status: 200 })],
    ["an unknown word", async () => new Response(JSON.stringify({ roads: [{ travel: "two_way", carriageway: "divided" }, ANSWER.roads[1]] }), { status: 200 })],
  ])("%s leaves every entry without words (Rule 10)", async (_name, impl) => {
    vi.stubGlobal("fetch", vi.fn(impl));
    const cs = [cand("yes"), cand(null)];
    await attachRoadTravel(cs);
    expect(cs.map((c) => c.travel)).toEqual([undefined, undefined]);
  });

  it("calls nothing when the backend isn't configured", async () => {
    vi.stubEnv("MODAL_RENDER_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const cs = [cand("yes")];
    await attachRoadTravel(cs);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cs[0].travel).toBeUndefined();
  });
});
