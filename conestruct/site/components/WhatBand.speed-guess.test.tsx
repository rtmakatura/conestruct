// @vitest-environment happy-dom
//
// R126 / R127 — WHAT's Speed row: the road-class estimate prefilled as a
// guess, "◌ not set" when nothing gives a speed.
//
// Authority: validation-artifacts/committed/r126-step2/rulings.md.
// R126: "prefill the road-class estimate like R108's guesses, marked "⚠ from
// the road" (one line) ... If the road has no class either, Speed reads
// "◌ not set" ... Remove the ⚠ estimate line and the Use N mph button."

import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import { classifyFromOsmTags } from "@/lib/road-detection/classify";
import { withCurrentGuesses } from "@/lib/scenarios/guesses";
import { applyClassification } from "@/lib/scenarios/auto-apply";
import { WhatBand } from "./bands/WhatBand";

afterEach(cleanup);

const PIN = { lat: 39.7174, lng: -104.9338 };

function road(maxspeed: string | null): ConfirmedRoad {
  const candidate = {
    way_id: "16984132",
    highway_class: "residential",
    name: "North Cherry Street",
    ref: null,
    bearing: 0,
    snap_distance_m: 13,
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

function scenarioOn(r: ConfirmedRoad | null): Scenario {
  const base = {
    ...DEFAULT_SHOULDER,
    speed: 65,
    meta: { ...DEFAULT_SHOULDER.meta, lat: PIN.lat, lng: PIN.lng, confirmedRoad: r },
  } as Scenario;
  // The picker's Save applies the detection first (a posted speed lands
  // here), then the shell's normalizer runs, as GeneratorSidebar does.
  return withCurrentGuesses(r ? applyClassification(base, r.classification).scenario : base);
}

function Harness({ initial }: { initial: Scenario }) {
  const [scenario, setScenario] = useState(initial);
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

const marker = () =>
  document.querySelector('[data-testid="info-toggle-speed"]')?.textContent?.replace(/\s+/g, " ").trim();
const select = () => document.getElementById("what-speed") as HTMLSelectElement;

describe("R126: WHAT's Speed row", () => {
  it("no posted speed: the estimate is the value, marked ⚠ from the road; no estimate line, no button", () => {
    render(<Harness initial={scenarioOn(road(null))} />);
    expect(select().value).toBe("25");
    expect(marker()).toBe("⚠ from the road");
    expect(document.querySelector('[data-testid="speed-estimate"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /Use \d+ mph/ })).toBeNull();
  });

  it("no road at the pin: ◌ not set, and the select shows Not set", () => {
    render(<Harness initial={scenarioOn(null)} />);
    expect(marker()).toBe("◌ not set");
    expect(select().value).toBe("");
    expect(select().selectedOptions[0]?.textContent).toBe("Not set");
  });

  it("a posted speed: measured, no guess", () => {
    render(<Harness initial={scenarioOn(road("30 mph"))} />);
    expect(select().value).toBe("30");
    expect(marker()).toBe("✓ measured");
  });
});
