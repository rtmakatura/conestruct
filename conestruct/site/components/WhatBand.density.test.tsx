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
// R96 A (2026-10-06) AMENDS this suite under R98 (rule 137: a symbol +
// word marker with the full line one click away counts as the provenance
// line) and R101 (the details open as a popover that closes on click-away
// and Esc).  R108 (setup-what-redesign, 2026-10-07) removes its third
// clause — there is no suggestion "needing action" left, so no action
// line and no suggestion row — and R107 lays the rows out in two columns
// (R110 Q7 gives the Lanes row two markers).  The cases keep #289's
// intent: one thing at rest per field, details on click or tap and never
// hover.
//
// Mounted with a confirmed road (detection speaks) and the pin lookup's
// answer, so every kind of "everything else" the ruling names is on the
// page.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import type { JurisdictionSuggestion } from "@/lib/jurisdiction";
import { WhatBand } from "./bands/WhatBand";

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
  return render(
    <WhatBand
      scenario={s}
      setScenario={() => {}}
      setMeta={() => {}}
      jurisdictionBlock={null}
      jurisdictionLoading={false}
      jurisdictionErrored={false}
      jurisdictionLookup={{ status: "ready", data: SUGGEST }}
      stepIndex="STEP 2 OF 4"
      handoff={[]}
    />,
  );
}

/** R110 Q7: the Lanes row carries two markers — the count's and the
 *  width's.  Every other row carries one. */
const markersIn = (id: string) => (id === "cell-lanes" ? 2 : 1);

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

describe("each field shows the control and ONE provenance marker (R108: no action line)", () => {
  it("every WHAT row shows exactly its marker(s) at rest (R98)", () => {
    mount();
    const cells = [...document.querySelectorAll('[data-testid="band-what"] [data-testid^="cell-"]')];
    expect(cells.length).toBeGreaterThan(8);
    for (const c of cells) {
      const id = c.getAttribute("data-testid")!;
      // At rest nothing else in the row speaks: every other line is in
      // its closed popover.
      const provs = [...c.querySelectorAll(".tr-prov")].filter(
        (n) => !n.closest(".a-info") && !n.closest(".jbar-suggest"),
      );
      expect(provs, id).toHaveLength(markersIn(id));
      expect(provs.every((n) => n.classList.contains("a-mark")), id).toBe(true);
    }
  });

  it("road type at rest: the select and source · value · method — nothing else", () => {
    mount();
    const rt = cell("road-type");
    expect(rt.querySelector("#what-road-type")).not.toBeNull();
    // R98: at rest, the marker; the line itself is one click away.
    // R108 / WhatC5: an inferred road type reads as a guess "from the road".
    expect(atRest(rt).map((n) => n.textContent)).toEqual(["⚠ from the road"]);
    const p = panel("road-type")!;
    expect(p.hasAttribute("hidden")).toBe(true);
    expect(p.querySelector('[data-testid="prov-road-type"]')!.textContent).toBe(
      "⚠ OSM · Urban arterial · inferred",
    );
    expect(document.querySelector('[data-testid="detect-bearing"]')).toBeNull();
  });

  it("jurisdiction at rest: the select and its marker; the pin's evidence is detail, with no row of its own", () => {
    mount();
    const j = cell("jurisdiction");
    expect(atRest(j).map((n) => n.textContent)).toEqual(["◌ not set"]);
    // R108: no suggestion row, no Confirm, no Dismiss.
    expect(document.querySelector('[data-testid="action-jurisdiction"]')).toBeNull();
    expect(j.querySelector("button.confirm, button.ghost")).toBeNull();
    // The explanatory paragraphs and the TIGER caveat are detail.
    const p = panel("jurisdiction")!;
    expect(p.hasAttribute("hidden")).toBe(true);
    expect(
      [...p.querySelectorAll(".sugg-reason")].map((n) => n.textContent),
    ).toContain(SUGGEST.reason);
    expect(p.querySelector(".honesty")!.textContent).toBe(
      "Boundary data is approximate (US Census TIGER/Line Place boundaries, 2025). Confirm the jurisdiction with the permitting authority.",
    );
  });

  it("street class is its own row of The road — the segmented control and its marker, nothing else", () => {
    mount();
    const sc = cell("street-class");
    expect(screen.getByTestId("what-group-road").contains(sc)).toBe(true);
    expect(cell("road-type").querySelector(".a-seg")).toBeNull();
    expect(sc.querySelector('.a-seg[aria-label="Street class"]')).not.toBeNull();
    expect(atRest(sc).map((n) => n.textContent)).toEqual(["◌ not set"]);
    expect(document.querySelector('[data-testid="action-street-class"]')).toBeNull();
  });

  it("R107's grid: two columns while each has 340 px, a 132 px label track, every control 44 px", () => {
    const block = (sel: string, from = 0) => {
      const i = css.indexOf(`${sel} {`, from);
      expect(i, sel).toBeGreaterThan(-1);
      return css.slice(i, css.indexOf("}", i));
    };
    expect(block(".workbench .a-cols")).toMatch(
      /grid-template-columns:\s*repeat\(auto-fit, minmax\(340px, 1fr\)\)/,
    );
    expect(block(".workbench .a-col > .a-cell")).toMatch(
      /grid-template-columns:\s*132px minmax\(0, 1fr\)/,
    );
    expect(block(".workbench .a-fld")).toMatch(/height:\s*44px/);
    expect(block(".workbench .a-seg")).toMatch(/height:\s*44px/);
    // The suggestion row's rules are gone with the row (R108).
    expect(css).not.toContain(".a-cell-action");
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
  it("opens and closes on click, and says which it is (R101: a popover)", async () => {
    // #290: exercised on the jurisdiction cell — the road-type cell has no
    // details left on a shoulder plan (its typed-bearing lines retired).
    mount();
    const user = userEvent.setup();
    const t = toggle("jurisdiction")!;
    expect(t.tagName).toBe("BUTTON");
    expect(t.getAttribute("aria-expanded")).toBe("false");
    expect(t.getAttribute("aria-controls")).toBe(panel("jurisdiction")!.id);
    expect(t.getAttribute("aria-label")).toMatch(/^Details for /);
    // R98: the marker is the trigger — symbol + word.
    expect(t.textContent).toBe("◌ not set");
    await user.click(t);
    expect(t.getAttribute("aria-expanded")).toBe("true");
    expect(panel("jurisdiction")!.hasAttribute("hidden")).toBe(false);
    // The popover belongs to the cell it is about (and overlays the page).
    expect(cell("jurisdiction").contains(panel("jurisdiction"))).toBe(true);
    await user.click(t);
    expect(panel("jurisdiction")!.hasAttribute("hidden")).toBe(true);
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

  it("the toggle's hit box overhangs upward only, and its underline is on the word (prod, 380)", () => {
    // b81c722 on prod at 380: the 44 px box overhung its row by 14 px
    // both ways, so its lower 8 px sat on the control below and `.a-lk`'s
    // box-edge underline was drawn across the Divided chips.
    const block = (sel: string, from = 0) => {
      const i = css.indexOf(`${sel} {`, from);
      expect(i, sel).toBeGreaterThan(-1);
      return css.slice(i, css.indexOf("}", i));
    };
    const t = block(".workbench .a-info-toggle");
    expect(t).toMatch(/align-items:\s*flex-end/);
    expect(t).toMatch(/margin-top:\s*-16px/);
    expect(t).toMatch(/margin-bottom:\s*0/);
    expect(t).toMatch(/border-bottom-color:\s*transparent/);
    expect(t).not.toMatch(/margin-block/);
    expect(block(".workbench .a-info-toggle > span:last-child")).toMatch(/text-decoration:\s*underline/);
    // ≤480: the 44 px box (rule 163) sits 28 px above the row, 0 below.
    const narrow = css.indexOf("Rule 163's 44 px (the .a-lk rule): 28 px above the row.");
    expect(narrow).toBeGreaterThan(-1);
    expect(block(".workbench .a-info-toggle", narrow)).toMatch(/margin-top:\s*-28px/);
  });

  it("every field's line is one click away (R98): one trigger per marker", () => {
    mount();
    for (const c of document.querySelectorAll('[data-testid="band-what"] [data-testid^="cell-"]')) {
      const id = c.getAttribute("data-testid")!;
      expect(c.querySelectorAll('[data-testid^="info-toggle-"]'), id).toHaveLength(markersIn(id));
    }
    expect(toggle("work-dates")!.textContent).toBe("◌ not set");
  });
});

// #290 (RULE 5, stated): FLOW.md §5a — "The typed bearing field retires
// deliberately (Rule 5); the #214 disclosure sentence and its
// byte-identity pin retire with it."  This was that pin.
describe("#214's disclosure retires with the typed bearing (FLOW.md §5a, #290)", () => {
  it("neither the caveat nor its sentence is anywhere in the band", () => {
    mount();
    expect(document.querySelector('[data-testid="detect-bearing-caveat"]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/travel-direction sign only/);
    expect(document.body.textContent).not.toMatch(/typed bearing/);
  });
});
