// @vitest-environment happy-dom
//
// #289 WHAT density — Ryan, 2026-09-24 ("WAY too busy", P19), recorded in
// rulings.md, "After the S4 prod run":
//
//   "Each field shows exactly: the control, ONE provenance line (source ·
//   value · method), and any suggestion needing action as one line +
//   Confirm/Dismiss.  Everything else attached to that field … moves
//   behind an ⓘ toggle on that field that expands inline on click/tap.
//   Never hover-only (rules 141, 142).  #214's disclosure stays standing
//   and inspectable behind the toggle, text byte-identical (#198).
//   Street classification becomes its own cell in the second group."
//
// Mounted with a confirmed road (detection speaks), a picker handoff
// sentence, the REAL pin-suggestion slot and the REAL street-class slot,
// so every kind of "everything else" the ruling names is on the page.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import type { JurisdictionSuggestion } from "@/lib/jurisdiction";
import { bearingCaveat } from "@/lib/road-detection/detected-rows";
import { WhatBand } from "./bands/WhatBand";
import {
  JurisdictionControls,
  JurisdictionSuggestSlot,
  type SuggestSection,
} from "./JurisdictionSection";

afterEach(cleanup);

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");

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
    tags: {
      oneway: null,
      maxspeed: "30 mph",
      lanes: "4",
      lanes_forward: null,
      lanes_backward: null,
      lanes_both_ways: null,
      turn_lanes: null,
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
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
    raw: {
      class: "primary",
      oneway: false,
      roadName: "E Colfax Ave",
      roadRef: null,
      placeName: "Denver",
      osmLanesTag: "4",
      osmMaxspeedTag: "30 mph",
    },
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

function scenario(base: Scenario = DEFAULT_SHOULDER): Scenario {
  return {
    ...base,
    speed: 30,
    lanes: 2,
    roadType: "urban_arterial",
    divided: true,
    meta: {
      ...base.meta,
      lat: 39.7402,
      lng: -104.956,
      bearingDeg: 270,
      confirmedRoad: ROAD,
    },
  } as Scenario;
}

const SUGGEST: JurisdictionSuggestion = {
  suggestion: "denver",
  reason: "Pin is inside Denver municipal limits (US Census TIGER/Line Place boundaries, 2025 vintage).",
  confidence: "inside",
  distance_to_boundary_ft: 900,
  warnings: [],
  boundary_source: { source: "US Census TIGER/Line Place boundaries", vintage: "2025 vintage" },
};

function mount(s: Scenario = scenario()) {
  const suggest = (section: SuggestSection = "all") => (
    <JurisdictionSuggestSlot suggest={SUGGEST} jurisdictionKey={null} section={section} />
  );
  const classFields = (section: SuggestSection = "all") => (
    <JurisdictionControls
      jurisdiction={null}
      jurisdictionKey={null}
      setJurisdictionKey={() => {}}
      streetClass={null}
      setStreetClass={() => {}}
      omitJurisdictionField
      bare
      section={section}
      classSuggest="arterial"
      classSuggestTier="primary"
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

const cell = (id: string) => document.querySelector(`[data-testid="cell-${id}"]`) as HTMLElement;
const panel = (id: string) => document.querySelector(`[data-testid="info-${id}"]`) as HTMLElement | null;
const toggle = (id: string) =>
  document.querySelector(`[data-testid="info-toggle-${id}"]`) as HTMLButtonElement | null;
/** What a cell shows at rest: everything outside its (closed) panel. */
function atRest(el: HTMLElement): Element[] {
  return [...el.querySelectorAll(".tr-prov, .sugg-row, .sugg-reason, .honesty, .warnrow, .mapchip")].filter(
    (n) => !n.closest(".a-info"),
  );
}

describe("each field shows the control, ONE provenance line and its one action line", () => {
  it("every WHAT cell has exactly one provenance line at rest", () => {
    mount();
    const cells = [...document.querySelectorAll('[data-testid="band-what"] [data-testid^="cell-"]')];
    expect(cells.length).toBeGreaterThan(8);
    for (const c of cells) {
      const provs = [...c.querySelectorAll(".tr-prov")].filter(
        (n) => !n.closest(".a-info") && !n.closest(".jbar-suggest"),
      );
      expect(provs, c.getAttribute("data-testid")!).toHaveLength(1);
    }
  });

  it("road type at rest: the select and source · value · method — nothing else", () => {
    mount();
    const rt = cell("road-type");
    expect(rt.querySelector("#what-road-type")).not.toBeNull();
    expect(atRest(rt).map((n) => n.textContent)).toEqual([
      document.querySelector('[data-testid="prov-road-type"]')!.textContent,
    ]);
    // Bearing and #214 are detail.
    expect(panel("road-type")!.hasAttribute("hidden")).toBe(true);
    expect(panel("road-type")!.querySelector('[data-testid="detect-bearing"]')).not.toBeNull();
  });

  it("jurisdiction at rest: the select, its line, and the one suggestion line with Confirm / Dismiss", () => {
    mount();
    const j = cell("jurisdiction");
    const rest = atRest(j);
    expect(rest.map((n) => n.className)).toEqual(["tr-prov", "sugg-row"]);
    const row = rest[1];
    expect(row.textContent).toContain("Pin suggests: Denver");
    expect(row.querySelector("button.confirm")!.textContent).toBe("Confirm Denver");
    expect(row.querySelector("button.ghost")!.textContent).toBe("Dismiss");
    // The explanatory paragraphs and the TIGER caveat are detail.
    const p = panel("jurisdiction")!;
    expect(p.hasAttribute("hidden")).toBe(true);
    expect(p.querySelector(".sugg-reason")!.textContent).toBe(SUGGEST.reason);
    expect(p.querySelector(".honesty")!.textContent).toBe(
      "Boundary data is approximate (US Census TIGER/Line Place boundaries, 2025) — confirm jurisdiction with the permitting authority.",
    );
  });

  it("street classification is its own cell in the second group — chips, line, and the suggestion's one line", () => {
    mount();
    const sc = cell("street-class");
    expect(screen.getByTestId("plan-details").contains(sc)).toBe(true);
    expect(cell("road-type").querySelector(".classpick")).toBeNull();
    expect(sc.querySelector(".classpick")).not.toBeNull();
    const rest = atRest(sc);
    expect(rest.map((n) => n.className)).toEqual(["tr-prov", "sugg-row"]);
    expect(rest[1].textContent).toContain("Detected road suggests street class: Arterial (OSM primary)");
    expect(rest[1].querySelector("button.confirm")!.textContent).toBe("Confirm Arterial");
  });

  it("the kind's case note is detail, not a second clause on the provenance line", () => {
    mount(scenario(DEFAULT_FLAGGER));
    const note = document.querySelector('[data-testid="road-type-note"]')!;
    expect(note.closest('[data-testid="info-road-type"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="prov-road-type"]')!.textContent).not.toContain(
      note.textContent!,
    );
  });
});

describe("the details toggle — click / tap, never hover (rules 141, 142)", () => {
  it("opens and closes inline, and says which it is", async () => {
    mount();
    const user = userEvent.setup();
    const t = toggle("road-type")!;
    expect(t.tagName).toBe("BUTTON");
    expect(t.getAttribute("aria-expanded")).toBe("false");
    expect(t.getAttribute("aria-controls")).toBe(panel("road-type")!.id);
    expect(t.getAttribute("aria-label")).toBe("Details for Road type");
    // Rule 17's info symbol beside rule 18's word.
    expect(t.textContent).toBe("idetails");
    await user.click(t);
    expect(t.getAttribute("aria-expanded")).toBe("true");
    expect(panel("road-type")!.hasAttribute("hidden")).toBe(false);
    // Inline: the panel is inside the cell it is about.
    expect(cell("road-type").contains(panel("road-type"))).toBe(true);
    await user.click(t);
    expect(panel("road-type")!.hasAttribute("hidden")).toBe(true);
  });

  it("the keyboard opens it too — it is a button, not a hover target", async () => {
    mount();
    const user = userEvent.setup();
    toggle("jurisdiction")!.focus();
    await user.keyboard("{Enter}");
    expect(panel("jurisdiction")!.hasAttribute("hidden")).toBe(false);
  });

  it("nothing reveals a panel on hover, and no title carries its text", () => {
    mount();
    expect(css).not.toMatch(/:hover[^{]*\.a-info\b/);
    for (const el of document.querySelectorAll('[data-testid="band-what"] [title]')) {
      expect(el.getAttribute("title"), "a title carries panel text").not.toMatch(/geometry|TIGER|bearing/i);
    }
  });

  it("a field with nothing more to say has no toggle", () => {
    mount();
    expect(toggle("project")).toBeNull();
    expect(toggle("work-dates")).toBeNull();
  });
});

describe("#214's disclosure stays standing, byte-identical, behind the toggle (#198)", () => {
  it("the caveat is in the document, closed, with its exact text", () => {
    mount();
    const caveat = document.querySelector('[data-testid="detect-bearing-caveat"]')!;
    expect(caveat.textContent).toBe(bearingCaveat(true));
    expect(caveat.closest('[data-testid="info-road-type"]')!.hasAttribute("hidden")).toBe(true);
  });
});
