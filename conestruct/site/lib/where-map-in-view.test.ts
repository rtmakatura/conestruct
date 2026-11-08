// @vitest-environment happy-dom
//
// #456 — the WHERE map in view, no waiting between answers, and the two
// status strings (validation-artifacts/committed/ux-map-in-view/rulings.md,
// rulings 3-4, M10-M14).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { DEFAULT_SHOULDER, type ShoulderScenario } from "@/lib/scenarios";
import { deriveBands } from "@/lib/scenarios/band-facts";
import { deriveRail, KIND_BLOCKER, WHERE_BLOCKER } from "@/lib/scenarios/rail";
import {
  aerialCacheKey,
  forgetAerials,
  prefetchAerial,
  useCorridorAerial,
} from "@/lib/corridor-aerial";
import { forgetGeometries, prefetchGeometry, useCorridorGeometry } from "@/lib/corridor-geometry";
import { TEST_PIN } from "@/components/test-fixtures";

const LOCATED: ShoulderScenario = {
  ...DEFAULT_SHOULDER,
  meta: { ...DEFAULT_SHOULDER.meta, ...TEST_PIN, pinModel: "work_start" },
};
const NO_HOLD = { pending: false, reason: null };

describe("ruling 4: the WHAT row and the Generate hint, every state", () => {
  const what = (kindConfirmed: boolean, kindPicked: boolean, s = LOCATED) =>
    deriveBands({ scenario: s, jurisdictionName: null, openOverride: null, kindConfirmed, kindPicked })
      .facts.find((f) => f.id === "what")!.pending;
  const hint = (kindConfirmed: boolean, kindPicked: boolean) =>
    deriveRail({
      scenario: LOCATED,
      approachConfirm: NO_HOLD,
      refusal: null,
      refusalPending: false,
      kindConfirmed,
      kindPicked,
    }).blocker?.message ?? null;

  it("no pin: the row says it opens after the work is found", () => {
    expect(what(false, false, DEFAULT_SHOULDER)).toBe("Opens after you find the work");
  });
  it("a pin, no kind chosen: the kind is the blocker, in both", () => {
    expect(what(false, false)).toBe("pending: kind of work not chosen");
    expect(hint(false, false)).toBe(KIND_BLOCKER);
  });
  it("a kind chosen, WHERE not confirmed: both name WHERE", () => {
    expect(what(false, true)).toBe("Opens after you confirm where");
    expect(hint(false, true)).toBe("Confirm where the work is first");
    expect(WHERE_BLOCKER).toBe("Confirm where the work is first");
  });
  it("WHERE confirmed: the row has its value and the hint moves on", () => {
    expect(what(true, true)).toBeNull();
    expect(hint(true, true)).not.toBe(KIND_BLOCKER);
    expect(hint(true, true)).not.toBe(WHERE_BLOCKER);
  });
});

const fetches: { url: string; body: string }[] = [];
beforeEach(() => {
  forgetAerials();
  forgetGeometries();
  fetches.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      fetches.push({ url, body: String(init.body) });
      if (url === "/api/corridor-map") {
        return new Response(new Blob(["png"], { type: "image/png" }), { status: 200 });
      }
      return new Response(JSON.stringify({ status: "side_not_confirmed", side_options: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:aerial-${++n}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

async function settle(ms = 450) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe("ruling 3: remember and load ahead", () => {
  const FLAGGER = { ...LOCATED, kind: "flagger_lane_closure" } as unknown as ShoulderScenario;

  it("M11: the pin picture is the pin and the frame, whatever the kind", () => {
    const a = aerialCacheKey({ scenario: LOCATED, stage: "pin", width: 400, height: 300 });
    const b = aerialCacheKey({ scenario: FLAGGER, stage: "pin", width: 400, height: 300 });
    expect(a).toBe(b);
    const w1 = aerialCacheKey({ scenario: LOCATED, stage: "work", width: 400, height: 300 });
    const w2 = aerialCacheKey({ scenario: FLAGGER, stage: "work", width: 400, height: 300 });
    expect(w1).not.toBe(w2);
  });

  it("a kind answered before the side asks for no new pin picture", async () => {
    const { result, rerender } = renderHook(
      ({ s }) => useCorridorAerial({ scenario: s, stage: "pin", width: 400, height: 300 }),
      { initialProps: { s: LOCATED } },
    );
    await settle();
    expect(result.current.state).toBe("ready");
    rerender({ s: FLAGGER });
    expect(result.current.state).toBe("ready");
    await settle();
    expect(fetches.filter((f) => f.url === "/api/corridor-map")).toHaveLength(1);
  });

  it("a picture loaded ahead is the answer's picture: the answer asks for nothing", async () => {
    const req = { scenario: LOCATED, stage: "work" as const, width: 400, height: 300 };
    prefetchAerial(req);
    prefetchAerial(req); // at most one per choice
    await settle(50);
    expect(fetches).toHaveLength(1);
    const { result } = renderHook(() => useCorridorAerial(req));
    expect(result.current.state).toBe("ready");
    await settle();
    expect(fetches).toHaveLength(1);
  });

  it("M12: a geometry answer loaded ahead or seen before is served without a read", async () => {
    await prefetchGeometry(LOCATED);
    expect(fetches).toHaveLength(1);
    const { result } = renderHook(() => useCorridorGeometry(LOCATED));
    await settle(20);
    expect(result.current.state).toBe("ready");
    await settle();
    expect(fetches).toHaveLength(1);
  });
});
