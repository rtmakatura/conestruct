// @vitest-environment happy-dom
//
// #224 phase 2 (s2-arc16, commit 6) — the manual detect section retired.
// The in-generate scan (phase 1) owns detection; the "Detect nearby site
// conditions" button, its point-mode note, the "N flag(s) auto-checked"
// provenance line and the #16 evidence lines (which were computed from
// the button's result) are gone.
//
// #224 phase 3 (s2-arc17, ruling a) — the five scanned checkboxes
// retired too; the slim control keeps the two operator-asserted keys
// (limited_sight_distance, driveways_present) writing meta.siteConditions
// under "Site conditions you assert".  Declared churn: 7 → 2 rows.
//
// #186 doctrine, carried: pre-generation the rows render NO evidence —
// no counts, no distances, no phantom numbers — ever.

import { useState } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios";
import { SiteConditionsField } from "./SiteConditionsField";

function scenario(): Scenario {
  return {
    ...DEFAULT_SHOULDER,
    meta: {
      ...DEFAULT_SHOULDER.meta,
      lat: 39.7113,
      lng: -105.0815,
      bearingDeg: 0,
    },
  };
}

function Harness({ initial }: { initial: Scenario }) {
  const [s, setS] = useState(initial);
  return (
    <>
      <SiteConditionsField
        scenario={s}
        setMeta={(m) => setS((prev) => ({ ...prev, meta: m }))}
        step={5}
      />
      <pre data-testid="meta">{JSON.stringify(s.meta.siteConditions ?? {})}</pre>
    </>
  );
}

afterEach(cleanup);

describe("SiteConditionsField — the slim control (#224 phase 2 + 3)", () => {
  it("no detect button, no scan copy — one provenance sentence says the scan happens at Generate", () => {
    const { container, queryByRole } = render(<Harness initial={scenario()} />);
    expect(queryByRole("button", { name: /detect nearby site conditions/i })).toBeNull();
    const text = container.textContent ?? "";
    expect(text).not.toContain("Scanning OpenStreetMap");
    expect(text).not.toContain("auto-checked");
    expect(text).not.toContain("point-and-radius");
    expect(text).toContain(
      "Site conditions are scanned along the corridor when you generate (OpenStreetMap).",
    );
  });

  it("#186 absent case: pre-generation the rows carry no evidence text, ever", () => {
    const { container } = render(<Harness initial={scenario()} />);
    const text = container.textContent ?? "";
    expect(text).not.toContain("found");
    expect(text).not.toContain("nearest ~");
    expect(text).not.toMatch(/\d+ m\b/);
  });

  it("exactly the two manual-only rows remain and still write meta.siteConditions", () => {
    const { container, getAllByRole, getByRole, queryByRole, getByTestId } = render(
      <Harness initial={scenario()} />,
    );
    expect(container.textContent).toContain("Site conditions you assert");
    expect(getAllByRole("checkbox").map((c) => c.getAttribute("aria-label") ?? c.textContent)).toHaveLength(2);
    // The five scanned keys are no longer offered — the scan owns them.
    for (const gone of [
      /Pedestrian sidewalks present/i,
      /Bike lane/i,
      /School zone/i,
      /Adjacent at-grade intersection/i,
      /Adjacent interchange/i,
    ]) {
      expect(queryByRole("checkbox", { name: gone })).toBeNull();
    }
    fireEvent.click(getByRole("checkbox", { name: /Driveways present/i }));
    expect(JSON.parse(getByTestId("meta").textContent ?? "{}")).toEqual({
      driveways_present: true,
    });
    fireEvent.click(getByRole("checkbox", { name: /Limited sight distance/i }));
    expect(JSON.parse(getByTestId("meta").textContent ?? "{}")).toEqual({
      driveways_present: true,
      limited_sight_distance: true,
    });
    fireEvent.click(getByRole("checkbox", { name: /Driveways present/i }));
    expect(JSON.parse(getByTestId("meta").textContent ?? "{}")).toEqual({
      limited_sight_distance: true,
    });
  });
});
