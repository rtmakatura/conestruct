// @vitest-environment happy-dom
//
// R96 A (declutter-three-surfaces) — Step 2 (WHAT), as mocked up
// (mockups/what.html), under R98 (a marker + one click counts as the
// provenance line), R100 (an answered suggestion collapses into its field)
// and R101 (the details popover closes on click-away and Esc).
//
// Mounted on the E Colfax shape with the REAL suggestion slots, as the
// #289 density suite is (Rule 11).

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import type { JurisdictionSuggestion } from "@/lib/jurisdiction";
import { WhatBand } from "./bands/WhatBand";
import {
  JurisdictionControls,
  JurisdictionSuggestSlot,
  type SuggestSection,
} from "./JurisdictionSection";

afterEach(cleanup);

const ROAD = {
  candidate: {
    way_id: "1042",
    highway_class: "primary",
    name: "E Colfax Ave",
    ref: null,
    bearing: 270,
    snap_distance_m: 4,
    snapped_lat: 39.7402,
    snapped_lng: -104.956,
    tags: { oneway: null, maxspeed: "30 mph", lanes: "4" },
    signal_distance_m: null,
    geometry: [
      [39.7402, -104.955],
      [39.7402, -104.957],
    ],
  },
  classification: {
    roadType: "urban_arterial",
    divided: true,
    laneWidthFt: 12,
    lanesPerDirection: 2,
    speedLimitMph: 30,
    confidence: "high",
    source: "osm-tags",
    raw: { class: "primary", oneway: false, roadName: "E Colfax Ave", placeName: "Denver" },
    fields: {
      speed: { value: 30, confidence: "high", source: "OSM maxspeed tag", method: "measured" },
      lanes: { value: 2, confidence: "high", source: "OSM lanes tag", method: "measured" },
      roadType: { value: "urban_arterial", confidence: "medium", source: "class", method: "inferred" },
      divided: { value: true, confidence: "medium", source: "class", method: "inferred" },
    },
  },
  method: "auto_single",
  overrides: {},
  isUrban: true,
  placeName: "Denver",
  pinLat: 39.7402,
  pinLng: -104.956,
} as unknown as ConfirmedRoad;

const SCENARIO = {
  ...DEFAULT_SHOULDER,
  speed: 30,
  lanes: 2,
  roadType: "urban_arterial",
  divided: true,
  meta: { ...DEFAULT_SHOULDER.meta, lat: 39.7402, lng: -104.956, bearingDeg: 270, confirmedRoad: ROAD },
} as Scenario;

const SUGGEST: JurisdictionSuggestion = {
  suggestion: "denver",
  reason: "Pin is inside Denver municipal limits (US Census TIGER/Line Place boundaries, 2025 vintage).",
  confidence: "inside",
  distance_to_boundary_ft: 900,
  warnings: [],
  boundary_source: { source: "US Census TIGER/Line Place boundaries", vintage: "2025 vintage" },
};

function mount(opts: { confirmed?: boolean; classConfirmed?: boolean } = {}) {
  const s = opts.confirmed ? ({ ...SCENARIO, jurisdiction_key: "denver" } as Scenario) : SCENARIO;
  // As GeneratorShell builds them: no record until a suggestion is answered.
  const suggest = (section: SuggestSection = "all") =>
    section === "record" && !opts.confirmed ? null : (
    <JurisdictionSuggestSlot
      suggest={SUGGEST}
      jurisdictionKey={opts.confirmed ? "denver" : null}
      resolution={
        opts.confirmed
          ? { resolution: "confirmed", suggested: "denver", prior: null, priorPresent: false }
          : null
      }
      section={section}
    />
  );
  const classFields = (section: SuggestSection = "all") =>
    section === "record" && !opts.classConfirmed ? null : (
    <JurisdictionControls
      jurisdiction={null}
      jurisdictionKey={null}
      setJurisdictionKey={() => {}}
      streetClass={opts.classConfirmed ? "arterial" : null}
      setStreetClass={() => {}}
      omitJurisdictionField
      bare
      section={section}
      classSuggest="arterial"
      classSuggestTier="primary"
      classResolution={
        opts.classConfirmed
          ? { resolution: "confirmed", suggested: "arterial", prior: null, priorPresent: false }
          : null
      }
    />
  );
  return render(
    <WhatBand
      scenario={s}
      setScenario={() => {}}
      setMeta={() => {}}
      jurisdictionBlock={null}
      jurisdictionLoading={false}
      jurisdictionErrored={false}
      stepIndex="STEP 2 OF 4"
      jurisdictionSuggest={suggest}
      classificationFields={classFields}
      handoff={[]}
    />,
  );
}

const band = () => document.querySelector('[data-testid="band-what"]') as HTMLElement;
const cell = (id: string) => document.querySelector(`[data-testid="cell-${id}"]`) as HTMLElement;
const trigger = (id: string) =>
  document.querySelector(`[data-testid="info-toggle-${id}"]`) as HTMLButtonElement;
const panel = (id: string) => document.querySelector(`[data-testid="info-${id}"]`) as HTMLElement;
const groupCells = (name: string) => {
  const g = document.querySelector(`[data-testid="what-group-${name}"]`) as HTMLElement;
  return [...g.querySelectorAll(':scope > .a-grid > [data-testid^="cell-"]')].map((c) =>
    c.getAttribute("data-testid")!.slice("cell-".length),
  );
};

describe("two groups named for the user's question (P20)", () => {
  it("THE ROAD and THE JOB, in the mocked-up order; no second section", () => {
    mount();
    expect(groupCells("road")).toEqual([
      "speed",
      "lanes",
      "lane-width",
      "road-type",
      "street-class",
      "divided",
    ]);
    expect(groupCells("job")).toEqual(["work-type", "night", "reduction", "jurisdiction", "work-dates"]);
    expect(band().textContent).not.toContain("The rest of this plan");
  });
});

describe("one quiet marker per field (R98, P9)", () => {
  it("at rest each field shows a symbol + word, not its sentence", () => {
    mount();
    expect(trigger("speed").textContent).toBe("✓ measured");
    expect(trigger("lanes").textContent).toBe("✓ measured");
    expect(trigger("lane-width").textContent).toBe("✓ yours");
    expect(trigger("road-type").textContent).toBe("⚠ inferred");
    expect(trigger("jurisdiction").textContent).toBe("◌ not set");
    expect(trigger("work-dates").textContent).toBe("◌ not set");
    expect(trigger("night").textContent).toBe("i about");
    // The full line is in the closed popover, one click away.
    expect(panel("speed").hasAttribute("hidden")).toBe(true);
    expect(panel("speed").querySelector('[data-testid="prov-speed"]')!.textContent).toBe(
      "OSM · 30 mph · measured",
    );
  });

  it("the marker opens the popover; Esc closes it and returns focus; click-away closes it", async () => {
    mount();
    const user = userEvent.setup();
    await user.click(trigger("road-type"));
    expect(trigger("road-type").getAttribute("aria-expanded")).toBe("true");
    expect(panel("road-type").hasAttribute("hidden")).toBe(false);
    await user.keyboard("{Escape}");
    expect(panel("road-type").hasAttribute("hidden")).toBe(true);
    expect(document.activeElement).toBe(trigger("road-type"));
    await user.click(trigger("speed"));
    expect(panel("speed").hasAttribute("hidden")).toBe(false);
    fireEvent.pointerDown(document.body);
    expect(panel("speed").hasAttribute("hidden")).toBe(true);
  });
});

describe("an answered suggestion collapses into its field (R100)", () => {
  it("the Denver record and its Undo render inside the jurisdiction cell; no band-wide row", () => {
    mount({ confirmed: true });
    const j = cell("jurisdiction");
    const record = j.querySelector(".a-cell-record")!;
    expect(record.textContent).toContain("Confirmed Denver (was Not set).");
    expect(record.querySelector("button")!.textContent).toBe("Undo");
    const row = document.querySelector('[data-testid="action-jurisdiction"]');
    expect(row === null || row.textContent === "").toBe(true);
    // Its details are still one click away, from the label row.
    expect(j.querySelector(".a-cell-head")!.contains(trigger("jurisdiction"))).toBe(true);
  });

  it("a confirmed street class: only its record in the footer row, one set of chips", () => {
    mount({ classConfirmed: true });
    const sc = cell("street-class");
    const record = sc.querySelector(".a-cell-foot .a-cell-record")!;
    expect(record.textContent).toContain("Confirmed Arterial (was Not set).");
    expect(record.querySelector("button")!.textContent).toBe("Undo");
    expect(sc.querySelector(".a-cell-foot .classpick")).toBeNull();
    expect(document.querySelectorAll(".classpick")).toHaveLength(1);
    // The evidence (the tier line) is detail, in the closed popover.
    expect(sc.querySelector(".a-cell-foot")!.textContent).not.toContain("detected road tier");
  });

  it("an unanswered suggestion keeps its full row with real buttons (P10)", () => {
    mount();
    const row = document.querySelector('[data-testid="action-jurisdiction"]')!;
    expect(row.querySelector("button.confirm")!.textContent).toBe("Confirm Denver");
  });
});

describe("File details: the two optional fields behind a labelled count (P13)", () => {
  it("closed by default, saying what is inside; open shows both fields", async () => {
    mount();
    expect(document.querySelector("#what-project")).toBeNull();
    const d = document.querySelector('[data-testid="what-file-details"]') as HTMLElement;
    expect(d.textContent).toContain("File details · Project name, Location description · ◌ 2 not set");
    await userEvent.setup().click(d.querySelector("button")!);
    expect(document.querySelector("#what-project")).not.toBeNull();
    expect(document.querySelector("#what-location-description")).not.toBeNull();
  });
});
