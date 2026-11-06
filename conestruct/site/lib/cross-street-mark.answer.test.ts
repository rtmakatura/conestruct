// @vitest-environment happy-dom
//
// #446 T20 (Rule 10): a tap's failed answer is about one pin and one crossing.
// The mark's own state, where the bug lived.  The picker's Save is mounted in
// GeneratorShell.cross-street-tap.test.tsx; a moved pin is here, because that
// file's picker stub doesn't carry a road the band accepts at a new pin.

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import type { Scenario } from "./scenarios";
import { useCrossStreetMark, type CrossTap } from "./cross-street-mark";

const scenarioAt = (lat: number) =>
  ({ kind: "near_intersection", meta: { lat, lng: -104.96 } }) as unknown as Scenario;
const TAP: CrossTap = { x: 10, y: 10, width: 100, height: 100, zoom: 0, frameKey: "f" };

function mount(start: Scenario) {
  return renderHook(
    ({ scenario }: { scenario: Scenario }) =>
      useCrossStreetMark({
        scenario,
        getScenario: () => scenario,
        setScenario: () => {},
        applyCandidate: (s) => s,
        memory: () => ({ hold: { pending: false, reason: null }, appliedJson: null }),
        restoreMemory: () => {},
      }),
    { initialProps: { scenario: start } },
  );
}

async function failedTap(h: ReturnType<typeof mount>) {
  await act(async () => {
    h.result.current.tap(TAP);
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(h.result.current.phase).toBe("error");
  expect(h.result.current.ring).not.toBeNull();
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("#446 T20: a failed tap's answer", () => {
  it("goes when the pin moves, and doesn't come back when the pin returns", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 502 }) as Response));
    const here = scenarioAt(39.74);
    const h = mount(here);
    await failedTap(h);

    h.rerender({ scenario: scenarioAt(39.741) });
    expect(h.result.current.phase).toBe("idle");
    expect(h.result.current.ring).toBeNull();

    h.rerender({ scenario: here });
    expect(h.result.current.phase).toBe("idle");
    expect(h.result.current.ring).toBeNull();
  });

  it("stays while the pin and the crossing stay, and clear() forgets it and its point", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 502 }) as Response);
    vi.stubGlobal("fetch", fetchMock);
    const here = scenarioAt(39.74);
    const h = mount(here);
    await failedTap(h);
    h.rerender({ scenario: { ...here } as Scenario });
    expect(h.result.current.phase).toBe("error");

    act(() => h.result.current.clear());
    expect(h.result.current.phase).toBe("idle");
    expect(h.result.current.ring).toBeNull();
    // Try again has nothing left to repeat.
    fetchMock.mockClear();
    act(() => h.result.current.retry());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.result.current.phase).toBe("idle");
  });
});
