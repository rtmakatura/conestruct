// @vitest-environment happy-dom
//
// #224 phase 2 (s2-arc16, commit 6) — the manual detect section retired.
// The in-generate scan (phase 1) owns detection; the "Detect nearby site
// conditions" button, its point-mode note, the "N flag(s) auto-checked"
// provenance line and the #16 evidence lines (which were computed from
// the button's result) are gone.  What survives to phase 3 (ruling 6):
// the "Site conditions" group with the seven checkbox rows writing
// meta.siteConditions, untouched.
//
// #186 doctrine, carried: pre-generation the rows render NO evidence —
// no counts, no distances, no phantom numbers — ever.  (The former
// detect-time evidence tests retired with the button; these two pins are
// the doctrine's new home.)

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

describe("SiteConditionsField after the manual detect retirement (#224 phase 2)", () => {
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

  it("the seven checkbox rows survive and still write meta.siteConditions", () => {
    const { getAllByRole, getByRole, getByTestId } = render(
      <Harness initial={scenario()} />,
    );
    expect(getAllByRole("checkbox").length).toBe(7);
    fireEvent.click(getByRole("checkbox", { name: /Pedestrian sidewalks present/i }));
    expect(JSON.parse(getByTestId("meta").textContent ?? "{}")).toEqual({
      pedestrian_facility: true,
    });
    fireEvent.click(getByRole("checkbox", { name: /Pedestrian sidewalks present/i }));
    expect(JSON.parse(getByTestId("meta").textContent ?? "{}")).toEqual({});
  });
});
