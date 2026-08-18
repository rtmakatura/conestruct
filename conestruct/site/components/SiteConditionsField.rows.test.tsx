// @vitest-environment happy-dom
// #16 — the site-conditions rows surface the detection margin.
//
// Rule 11: the defect lived in the rendered output (nearest_distance_m
// and details crossed the wire typed but the rows rendered booleans
// only — a sidewalk 140 ft out and one 10 ft out read identically), so
// these tests assert the mounted rows' text after a mocked detect, not
// helper returns.  Rule 3: every rendered number is a backend value
// verbatim.  #186: the absent case renders no number, ever.

import { useState } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

// Auto-check flows through setMeta → parent state → re-render, so the
// harness holds real state instead of a no-op setMeta.
function Harness({ initial }: { initial: Scenario }) {
  const [s, setS] = useState(initial);
  return (
    <SiteConditionsField
      scenario={s}
      setMeta={(m) => setS((prev) => ({ ...prev, meta: m }))}
      step={5}
    />
  );
}

const SIDEWALKS_BUCKET = {
  detected: true,
  count: 2,
  nearest_distance_m: 122.0,
  details: [
    "Curbside Walk [work_zone @ 400 ft]",
    "Setback Path [lateral 140 ft off centerline]",
  ],
};

async function renderAfterDetect(result: Record<string, unknown>) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => result }));
  vi.stubGlobal("fetch", fetchMock);
  const utils = render(<Harness initial={scenario()} />);
  fireEvent.click(
    utils.getByRole("button", { name: /detect nearby site conditions/i }),
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(utils.container.textContent).toMatch(/flag\(s\) auto-checked/),
  );
  return utils;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("#16 site-conditions rows render the detection margin", () => {
  it("an auto-checked row carries the bucket's count, nearest distance, and detail lines", async () => {
    const { container } = await renderAfterDetect({
      mode: "corridor",
      sidewalks: SIDEWALKS_BUCKET,
    });
    const text = container.textContent ?? "";
    expect(text).toContain("2 found, nearest ~122 m");
    // Backend-authored evidence verbatim — the 140 ft margin visible.
    expect(text).toContain("Curbside Walk [work_zone @ 400 ft]");
    expect(text).toContain("Setback Path [lateral 140 ft off centerline]");
  });

  it("omits the nearest clause when the bucket has no nearest_distance_m", async () => {
    const { container } = await renderAfterDetect({
      mode: "corridor",
      schools: { detected: true, count: 1, details: ["Foothills Elementary [advance_warning @ 1100 ft]"] },
    });
    const text = container.textContent ?? "";
    expect(text).toContain("1 found");
    expect(text).not.toContain("nearest ~");
    expect(text).toContain("Foothills Elementary [advance_warning @ 1100 ft]");
  });

  it("renders at most two detail lines", async () => {
    const { container } = await renderAfterDetect({
      mode: "corridor",
      sidewalks: {
        ...SIDEWALKS_BUCKET,
        details: ["one [work_zone @ 10 ft]", "two [buffer @ 20 ft]", "three [transition @ 30 ft]"],
      },
    });
    const text = container.textContent ?? "";
    expect(text).toContain("one [work_zone @ 10 ft]");
    expect(text).toContain("two [buffer @ 20 ft]");
    expect(text).not.toContain("three [transition @ 30 ft]");
  });

  it("#186 absent case: an undetected bucket renders no number and no evidence", async () => {
    const { container } = await renderAfterDetect({
      mode: "corridor",
      sidewalks: { detected: false, count: 0, details: [] },
    });
    const text = container.textContent ?? "";
    expect(text).not.toContain("found");
    expect(text).not.toContain("nearest ~");
  });

  it("#186 absent case: before any detect, no evidence text exists", () => {
    const { container } = render(<Harness initial={scenario()} />);
    const text = container.textContent ?? "";
    expect(text).not.toContain("found");
    expect(text).not.toContain("nearest ~");
  });

  it("unchecking the auto-checked row hides its evidence with it", async () => {
    const utils = await renderAfterDetect({
      mode: "corridor",
      sidewalks: SIDEWALKS_BUCKET,
    });
    expect(utils.container.textContent).toContain("2 found, nearest ~122 m");
    fireEvent.click(
      utils.getByRole("checkbox", { name: /Pedestrian sidewalks present/i }),
    );
    expect(utils.container.textContent).not.toContain("2 found");
  });
});
