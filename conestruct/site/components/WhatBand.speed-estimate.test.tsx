// @vitest-environment happy-dom
//
// R123 Q2 (#301) — WHAT's Speed row offers the road-class estimate.
//
// Authority: validation-artifacts/committed/issue-301-picker-pieces/rulings.md.
// "Move the road-class speed estimate to WHAT's Speed row as a ⚠ line, and
// keep a "Use N mph" button there. Nothing is prefilled; the operator's click
// sets it, and the audit records the speed as estimated from the road class
// and chosen by the operator."

import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import { classifyFromOsmTags } from "@/lib/road-detection/classify";
import { WhatBand } from "./bands/WhatBand";

afterEach(cleanup);

const PIN = { lat: 39.7337, lng: -104.98753 };

function road(maxspeed: string | null): ConfirmedRoad {
  const candidate = {
    way_id: "333003",
    highway_class: "residential",
    name: "Sidestreet",
    ref: null,
    bearing: 0,
    snap_distance_m: 4,
    snapped_lat: PIN.lat,
    snapped_lng: PIN.lng,
    tags: {
      oneway: null,
      maxspeed,
      lanes: null,
      lanes_forward: null,
      lanes_backward: null,
      lanes_both_ways: null,
      turn_lanes: null,
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
    signal_distance_m: null,
  };
  return {
    candidate,
    classification: classifyFromOsmTags(
      { highwayClass: "residential", name: candidate.name, ref: null, tags: candidate.tags },
      true,
      "Denver",
    ),
    method: "auto_single",
    isUrban: true,
    placeName: "Denver",
    pinLat: PIN.lat,
    pinLng: PIN.lng,
  };
}

function scenarioOn(r: ConfirmedRoad): Scenario {
  return {
    ...DEFAULT_SHOULDER,
    speed: 45,
    meta: { ...DEFAULT_SHOULDER.meta, lat: PIN.lat, lng: PIN.lng, confirmedRoad: r },
  } as Scenario;
}

let latest: Scenario | null = null;

function Harness({ initial }: { initial: Scenario }) {
  const [scenario, setScenario] = useState(initial);
  latest = scenario;
  return (
    <WhatBand
      scenario={scenario}
      setScenario={setScenario}
      setMeta={() => {}}
      jurisdictionBlock={null}
      jurisdictionLoading={false}
      jurisdictionErrored={false}
      stepIndex="STEP 2 OF 4"
    />
  );
}

const offer = () => document.querySelector('[data-testid="speed-estimate"]');

describe("R123 Q2: the Speed row's estimate", () => {
  it("a road with no posted speed shows the ⚠ estimate and Use N mph, and prefills nothing", () => {
    render(<Harness initial={scenarioOn(road(null))} />);
    expect(offer()?.textContent).toBe(
      "⚠ no posted speed on this road · its class suggests 25 mph Use 25 mph",
    );
    expect(screen.getByRole("button", { name: "Use 25 mph" })).toBeTruthy();
    expect(latest?.speed).toBe(45);
    expect(latest?.speed_estimate ?? null).toBeNull();
  });

  it("the click sets the speed and the record, the offer goes, and the row says whose it is", async () => {
    render(<Harness initial={scenarioOn(road(null))} />);
    await act(async () => {
      screen.getByRole("button", { name: "Use 25 mph" }).click();
    });
    expect(latest?.speed).toBe(25);
    expect(latest?.speed_estimate).toEqual({ highwayClass: "residential" });
    expect(offer()).toBeNull();
    expect(
      document.querySelector('[data-testid="prov-speed"]')?.textContent?.trim(),
    ).toBe(
      "your change · the road-class estimate (highway=residential); the road has no posted speed",
    );
    // The row's marker: the operator's value, "✓ yours" (markerOf).
    expect(
      document.querySelector('[data-testid="info-toggle-speed"]')?.textContent?.replace(/\s+/g, " ").trim(),
    ).toBe("✓ yours");
  });

  it("a road with a posted speed offers nothing", () => {
    render(<Harness initial={scenarioOn(road("30 mph"))} />);
    expect(offer()).toBeNull();
    expect(screen.queryByRole("button", { name: /Use \d+ mph/ })).toBeNull();
  });
});
