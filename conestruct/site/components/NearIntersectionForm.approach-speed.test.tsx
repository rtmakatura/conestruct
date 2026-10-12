// @vitest-environment happy-dom
//
// #316 (R129 Q3, Q4) — the cross-street speed control, mounted.  A select
// labelled "Cross-street speed" with "Not set" while unset (no slider: a
// slider always shows a position); its line says where the speed came
// from; WHAT's header counts its ⚠.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DEFAULT_NEAR_INTERSECTION, type Scenario } from "@/lib/scenarios";
import type { IntersectionRecord, NearIntersectionScenario } from "@/lib/scenarios/types";
import { withCurrentGuesses } from "@/lib/scenarios/guesses";
import { NearIntersectionForm } from "./NearIntersectionForm";
import { WhatBand } from "./bands/WhatBand";

afterEach(cleanup);

function plan(intersection: IntersectionRecord): NearIntersectionScenario {
  const leg = { speed: 30, roadType: "urban_arterial" as const, lanesPerDirection: 1, laneWidth: 12, signalized: false };
  return withCurrentGuesses({
    ...DEFAULT_NEAR_INTERSECTION,
    approaches: [{ id: "cross_a", ...leg }, { id: "cross_b", ...leg }],
    meta: {
      ...DEFAULT_NEAR_INTERSECTION.meta,
      lat: 39.7337,
      lng: -104.98753,
      pinModel: "work_start",
      intersection,
    },
  } as Scenario) as NearIntersectionScenario;
}

const X = { lat: 39.73274, lng: -104.98753, name: "E 11th Ave" };
const GUESSED = plan({ ...X, highwayClass: "residential", postedSpeedMph: null });
const MEASURED = plan({ ...X, highwayClass: "tertiary", postedSpeedMph: 30 });
const UNSET = plan({ ...X });

function form(s: NearIntersectionScenario) {
  return render(
    <NearIntersectionForm
      scenario={s}
      setScenario={() => {}}
      approachConfirm={{ pending: false, reason: null }}
      clearApproachConfirm={() => {}}
    />,
  );
}

const select = () => document.querySelector("#ni-cross-speed") as HTMLSelectElement;
const line = () => screen.getByTestId("ni-cross-speed-prov").textContent;

describe("the cross-street speed control (Q3)", () => {
  it("is a select labelled 'Cross-street speed', 25–55 mph — no slider", () => {
    form(GUESSED);
    expect(select().tagName).toBe("SELECT");
    expect(document.querySelector('input[type="range"]#ni-cross-speed')).toBeNull();
    expect(document.querySelector('label[for="ni-cross-speed"]')?.textContent).toContain(
      "Cross-street speed",
    );
    expect([...select().options].map((o) => o.value)).toEqual(["25", "30", "35", "40", "45", "50", "55"]);
  });

  it("guessed: 25, and the line says so with ⚠", () => {
    form(GUESSED);
    expect(select().value).toBe("25");
    expect(line()).toBe("⚠ guessed, not confirmed · OSM highway=residential · from the road");
  });

  it("measured: the posted speed", () => {
    form(MEASURED);
    expect(select().value).toBe("30");
    expect(line()).toBe("OSM · 30 mph · measured");
  });

  it("no cross street detected: 'Not set', never a 30 shown as fact", () => {
    form(UNSET);
    expect(select().value).toBe("");
    expect(select().selectedOptions[0].textContent).toBe("Not set");
    expect(line()).toBe("not set · operator-set when picked");
  });
});

describe("WHAT's header counts the cross-street speed's ⚠ (Q4)", () => {
  const header = (s: Scenario) => {
    render(
      <WhatBand
        scenario={s}
        setScenario={() => {}}
        setMeta={() => {}}
        jurisdictionBlock={null}
        jurisdictionLoading={false}
        jurisdictionErrored={false}
        stepIndex="STEP 2 OF 4"
        handoff={[]}
      />,
    );
    const text = document.querySelector('[data-testid="band-what"]')!.textContent ?? "";
    cleanup();
    const m = text.match(/(\d+) guess(es)? marked ⚠/);
    return m ? Number(m[1]) : 0;
  };

  it("a guessed cross-street speed adds one to the count; a measured one doesn't", () => {
    expect(header(GUESSED)).toBe(header(MEASURED) + 1);
  });
});
