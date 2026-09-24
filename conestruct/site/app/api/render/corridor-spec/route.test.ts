// #267 — the corridor-spec proxy rebuilds its body field by field, so a
// fact it does not name is DROPPED before it reaches the backend.  The
// picker now relays laneWidth and divided ("preview must equal applied");
// these cases pin that the proxy forwards them, typed, and still forwards
// nothing it was not given.

import { beforeEach, describe, expect, it, vi } from "vitest";

const forwarded: unknown[] = [];

vi.mock("@/lib/rate-limit", () => ({ rateLimitOr429: async () => null }));
vi.mock("@/lib/render-proxy", () => ({
  fetchCorridorSpec: async (body: unknown) => {
    forwarded.push(body);
    return new Response("{}", { status: 200 });
  },
}));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(
    new Request("http://x/api/render/corridor-spec", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
  );

beforeEach(() => {
  forwarded.length = 0;
});

describe("#267 — the proxy forwards the relayed width facts", () => {
  it("laneWidth and divided reach the backend", async () => {
    const res = await post({
      kind: "shoulder",
      speed: 55,
      roadType: "rural_undivided",
      laneWidth: 11,
      divided: false,
    });
    expect(res.status).toBe(200);
    expect(forwarded).toEqual([
      { kind: "shoulder", speed: 55, roadType: "rural_undivided", laneWidth: 11, divided: false },
    ]);
  });

  it("absent facts stay absent — the backend's default is the plan's for that kind", async () => {
    await post({ kind: "flagger_lane_closure", speed: 45 });
    expect(forwarded).toEqual([{ kind: "flagger_lane_closure", speed: 45, roadType: undefined }]);
  });

  it("a mistyped fact is refused, not forwarded", async () => {
    expect((await post({ kind: "shoulder", speed: 55, laneWidth: "11" })).status).toBe(400);
    expect((await post({ kind: "shoulder", speed: 55, divided: "no" })).status).toBe(400);
    expect(forwarded).toEqual([]);
  });

  it("a shoulder width is not a fact the proxy relays — the backend derives it", async () => {
    await post({ kind: "shoulder", speed: 55, shoulderWidth: 12 });
    expect(forwarded[0]).not.toHaveProperty("shoulderWidth");
  });
});
