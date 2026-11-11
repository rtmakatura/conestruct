// @vitest-environment happy-dom
//
// R107 / R108 (setup-what-redesign) — Step 2 (WHAT) as WhatC5.dc.html
// draws it: two columns, each row a label with its marker under it beside
// its control; the guesses marked and never confirmed.  Still under R98
// (a marker + one click counts as the provenance line) and R101 (the
// popover closes on click-away and Esc).  R100's record and the
// suggestion rows are gone with the confirm step (R108).
//
// Mounted on the E Colfax shape (Rule 11).

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import { WhatBand } from "./bands/WhatBand";
import type { JurisdictionLookup } from "./JurisdictionSection";
import {
  measuredChecks,
  openMeasured,
  sourceWord,
  whyTip,
} from "./__fixtures__/what-section";

afterEach(cleanup);

const PIN = { lat: 39.7402, lng: -104.956 };

function road(
  roadTypeMethod: "measured" | "inferred",
  dividedMethod: "measured" | "inferred" = "inferred",
): ConfirmedRoad {
  return {
    candidate: {
      way_id: "1042",
      highway_class: "primary",
      name: "E Colfax Ave",
      ref: null,
      bearing: 270,
      snap_distance_m: 4,
      snapped_lat: PIN.lat,
      snapped_lng: PIN.lng,
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
      raw: {
        class: "primary",
        oneway: false,
        roadName: "E Colfax Ave",
        placeName: "Denver",
      },
      fields: {
        speed: {
          value: 30,
          confidence: "high",
          source: "OSM maxspeed tag",
          method: "measured",
        },
        lanes: {
          value: 2,
          confidence: "high",
          source: "OSM lanes tag",
          method: "measured",
        },
        roadType: {
          value: "urban_arterial",
          confidence: "medium",
          source: "class",
          method: roadTypeMethod,
        },
        divided: {
          value: true,
          confidence: "medium",
          source: "class",
          method: dividedMethod,
        },
      },
    },
    method: "auto_single",
    overrides: {},
    isUrban: true,
    placeName: "Denver",
    pinLat: PIN.lat,
    pinLng: PIN.lng,
  } as unknown as ConfirmedRoad;
}

function scenario(
  opts: {
    guessed?: boolean;
    oneGuess?: boolean;
    roadTypeMeasured?: boolean;
    dividedMeasured?: boolean;
  } = {},
): Scenario {
  return {
    ...DEFAULT_SHOULDER,
    speed: 30,
    lanes: 2,
    roadType: "urban_arterial",
    divided: true,
    ...(opts.oneGuess
      ? {
          street_class: "arterial",
          guesses: { street_class: { highwayClass: "primary" } },
        }
      : {}),
    ...(opts.guessed
      ? {
          street_class: "arterial",
          jurisdiction_key: "denver",
          guesses: {
            street_class: { highwayClass: "primary" },
            jurisdiction_key: PIN,
          },
        }
      : {}),
    meta: {
      ...DEFAULT_SHOULDER.meta,
      ...PIN,
      bearingDeg: 270,
      confirmedRoad: road(
        opts.roadTypeMeasured ? "measured" : "inferred",
        opts.dividedMeasured ? "measured" : "inferred",
      ),
    },
  } as Scenario;
}

const READY: JurisdictionLookup = {
  status: "ready",
  data: {
    suggestion: "denver",
    reason:
      "Pin is inside Denver municipal limits (US Census TIGER/Line Place boundaries, 2025 vintage).",
    confidence: "inside",
    distance_to_boundary_ft: 900,
    warnings: [],
    boundary_source: {
      source: "US Census TIGER/Line Place boundaries",
      vintage: "2025 vintage",
    },
  },
};

function mount(
  opts: {
    guessed?: boolean;
    oneGuess?: boolean;
    roadTypeMeasured?: boolean;
    dividedMeasured?: boolean;
    errored?: boolean;
    lookup?: JurisdictionLookup;
  } = {},
) {
  return render(
    <WhatBand
      scenario={scenario(opts)}
      setScenario={() => {}}
      setMeta={() => {}}
      jurisdictionBlock={null}
      jurisdictionLoading={false}
      jurisdictionErrored={opts.errored ?? false}
      jurisdictionLookup={opts.lookup ?? READY}
      stepIndex="STEP 2 OF 4"
      handoff={[]}
    />,
  );
}

const band = () =>
  document.querySelector('[data-testid="band-what"]') as HTMLElement;
const cell = (id: string) =>
  document.querySelector(`[data-testid="cell-${id}"]`) as HTMLElement;
const trigger = (id: string) =>
  document.querySelector(
    `[data-testid="info-toggle-${id}"]`,
  ) as HTMLButtonElement;
const panel = (id: string) =>
  document.querySelector(`[data-testid="info-${id}"]`) as HTMLElement;
// #520: each section is one grid of cells in reading order (two to a row).
const columnRows = (name: string) => {
  const g = document.querySelector(
    `[data-testid="what-${name}-grid"]`,
  ) as HTMLElement;
  return [...g.querySelectorAll(':scope > [data-testid^="cell-"]')].map((c) =>
    c.getAttribute("data-testid")!.slice("cell-".length),
  );
};

// #517 ruling 1 (Ryan, 2026-11-11) replaced R107's two columns ("The
// road" / "The job") with the guesses box, "About the work" (a 2-column
// grid), and the "Measured from the map" row, whose panel holds the road's
// fields in two columns.  The claim kept: every field has its one row, in
// a fixed order, with nothing else in the band.
describe("the section's rows, in ruling 1's order (was R107's two columns)", () => {
  it("About the work holds the job's rows; the measured row's panel holds the road's", () => {
    mount();
    const parts = [...document.querySelector(".w-what")!.children].map((c) =>
      c.getAttribute("data-testid"),
    );
    // No guess record on this fixture, so no box (ruling 1).
    expect(parts).toEqual(["what-about", "what-measured", "what-files"]);
    // #520: About the work is one grid, its cells in ruling 1's order.
    expect(columnRows("about")).toEqual([
      "work-type",
      "night",
      "reduction",
      "work-dates",
    ]);
    // #517 round 1: lane width is its own row with its own source.
    expect(columnRows("road")).toEqual([
      "speed",
      "lanes",
      "lane-width",
      "road-type",
      "street-class",
      "divided",
      "jurisdiction",
    ]);
    expect(band().textContent).not.toContain("The rest of this plan");
  });

  it("each row is its label with the source line beside it, over the control", () => {
    mount();
    const row = cell("speed");
    const head = row.querySelector(":scope > .a-cell-head")!;
    // R126: "Speed", no longer "Speed limit".
    expect(head.querySelector(".w-label")!.textContent).toBe("Speed");
    expect(head.contains(trigger("speed"))).toBe(true);
    // Ruling 6: the shared listbox's button carries the old select's id.
    const ctl = row.querySelector(":scope > .a-cell-ctl #what-speed")!;
    expect(ctl.tagName).toBe("BUTTON");
    expect(ctl.getAttribute("aria-haspopup")).toBe("listbox");
  });
});

describe("one quiet source line per field (R98, P9; #517 ruling 5)", () => {
  it("at rest each field shows its source words, not its sentence", () => {
    mount();
    expect(sourceWord("speed")).toBe("Measured from the map");
    expect(trigger("speed").textContent).toContain("✓");
    expect(sourceWord("lanes")).toBe("Measured from the map");
    // R126 (one marker per row) and R110 Q7 (lane width its own source):
    // #517 round 1 gives the width its own row, so its own one line.
    expect(sourceWord("lane-width")).toBe("Default");
    // Inferred road type and divided-ness: guesses to check (no record, so
    // outside the box: S1).
    expect(sourceWord("road-type")).toBe("Our guess. Check it.");
    expect(trigger("road-type").textContent).toContain("⚠");
    // R126: Carriageway, detection's own clause (divided-ness inferred).
    expect(sourceWord("divided")).toBe("Our guess. Check it.");
    expect(sourceWord("street-class")).toBe("Not set yet");
    expect(sourceWord("jurisdiction")).toBe("Not set yet");
    expect(sourceWord("work-dates")).toBe("Not set yet");
    // R110 Q8, amended by Ryan 2026-10-26 (#411): plain "Default", no mark.
    expect(sourceWord("night")).toBe("Default");
    expect(trigger("night").textContent).not.toMatch(/[✓⚠]/);
    expect(sourceWord("reduction")).toBe("Default");
    // The full line is in the closed tip, one click away.
    expect(panel("speed").hasAttribute("hidden")).toBe(true);
    expect(whyTip("speed")[0]).toBe(
      "The road's map record says the posted speed is 30 mph. If the sign on site says otherwise, change it here.",
    );
  });

  it("R126: one marker per row — the Lanes marker opens the count's tip; lane width has its own", async () => {
    mount();
    const markers = [
      ...band().querySelectorAll('[data-testid^="info-toggle-"]'),
    ];
    for (const c of band().querySelectorAll('[data-testid^="cell-"]')) {
      const own = markers.filter(
        (m) => c.contains(m) && m.closest('[data-testid^="cell-"]') === c,
      );
      expect(own.length, c.getAttribute("data-testid")!).toBeLessThanOrEqual(1);
    }
    openMeasured();
    const user = userEvent.setup();
    await user.click(trigger("lanes"));
    expect(panel("lanes").hasAttribute("hidden")).toBe(false);
    expect(whyTip("lanes")[0]).toBe(
      "The road's map record says 2 lanes each way. If the road on site differs, change it here.",
    );
    expect(
      panel("lanes").querySelector('[data-testid="prov-lane-width"]'),
    ).toBeNull();
    expect(whyTip("lane-width")[0]).toBe(
      "The plan's standard lane. The map doesn't measure lane width, so check it on site.",
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

describe("guesses are marked, never confirmed (R108)", () => {
  it("street class and jurisdiction sit in the box with their reasons, and the intro counts them", () => {
    mount({ guessed: true });
    const box = document.querySelector(
      '[data-testid="what-guesses"]',
    ) as HTMLElement;
    expect(box.contains(cell("street-class"))).toBe(true);
    expect(box.contains(cell("jurisdiction"))).toBe(true);
    expect(sourceWord("street-class")).toBe("Based on the road's map tag");
    expect(sourceWord("jurisdiction")).toBe("Based on where your pin is");
    expect(trigger("street-class").textContent).toContain("⚠");
    expect(trigger("jurisdiction").textContent).toContain("⚠");
    expect(screen.getByTestId("what-guesses-head").textContent).toBe(
      "Check these 2 guesses",
    );
    expect(band().textContent).toContain(
      "We filled this in from the road you confirmed. Check our 2 guesses, then tell us about the work.",
    );
    // S1: road type and divided-ness (both inferred, no guess record) are
    // not box rows; the measured row names them as checks (S5).
    expect(measuredChecks()).toEqual([
      "⚠ Carriageway: Check it.",
      "⚠ Road type: Check it.",
    ]);
  });

  it("no confirm, dismiss, undo, record or suggestion row anywhere", () => {
    mount({ guessed: true });
    for (const name of [/^Confirm/, /^Dismiss$/, /^Undo$/]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(
      document.querySelector(".a-cell-record, .a-cell-action, .classpick"),
    ).toBeNull();
  });

  it("the pin's evidence rides the jurisdiction's details, the TIGER caveat with it", () => {
    mount({ guessed: true });
    const p = panel("jurisdiction");
    expect(p.hasAttribute("hidden")).toBe(true);
    expect(p.textContent).toContain("The pin is in Denver.");
    expect(p.textContent).toContain(
      "Confirm the jurisdiction with the permitting authority.",
    );
    expect(sourceWord("jurisdiction")).toBe("Based on where your pin is");
    expect(whyTip("jurisdiction")[0]).toBe(
      "We looked up which boundary your pin falls in.",
    );
  });

  it("a boundary warning stays on show in the row, outside the popover (P3)", () => {
    mount({
      guessed: true,
      lookup: {
        status: "ready",
        data: {
          ...(READY.data as NonNullable<JurisdictionLookup["data"]>),
          confidence: "near_boundary",
          warnings: [
            {
              kind: "near_boundary",
              message:
                "Pin is 120 ft from the Glendale boundary. Jurisdiction lines here are jigsawed; verify which side the work zone falls on.",
              source: { doc: "TIGER", date: "2025", status: "verified" },
            },
          ],
        },
      },
    });
    const w = cell("jurisdiction").querySelector(
      '[data-testid="jurisdiction-warning"]',
    )!;
    expect(w).not.toBeNull();
    expect(w.closest(".a-info")).toBeNull();
  });

  it("an evaluation that failed is not an error: a guess keeps its line, the failure in its details (#425 ruling 3)", () => {
    mount({ guessed: true, errored: true });
    expect(sourceWord("jurisdiction")).toBe("Based on where your pin is");
    expect(trigger("jurisdiction").classList.contains("is-error")).toBe(false);
    expect(screen.queryByTestId("error-jurisdiction")).toBeNull();
    expect(
      cell("jurisdiction").querySelector(".a-info")?.textContent,
    ).toContain("The check didn't answer. The option shown stands.");
  });

  it("nothing guessed off a road: the intro reads 'filled this in from the road' alone (R110 Q5, #517 ruling 1)", () => {
    mount({ roadTypeMeasured: true, dividedMeasured: true });
    expect(band().textContent).toContain(
      "We filled this in from the road you confirmed.",
    );
    expect(band().textContent).not.toContain("Check our");
    expect(screen.queryByTestId("what-guesses")).toBeNull();
    expect(measuredChecks()).toEqual([]);
  });

  it("one guess reads in the singular", () => {
    mount({ oneGuess: true, roadTypeMeasured: true, dividedMeasured: true });
    expect(band().textContent).toContain(
      "We filled this in from the road you confirmed. Check our 1 guess, then tell us about the work.",
    );
    expect(screen.getByTestId("what-guesses-head").textContent).toBe(
      "Check this guess",
    );
  });
});

describe("File details: the two optional fields behind a labelled count (P13; #517 ruling 1)", () => {
  it("closed by default, saying what is inside; Show opens both fields", async () => {
    mount();
    const panelEl = screen.getByTestId("what-files-panel");
    expect(panelEl.hasAttribute("hidden")).toBe(true);
    // Ruling 1: the row says what is inside and the count not set.
    expect(
      screen.getByTestId("what-files").querySelector(".w-row-title")!
        .textContent,
    ).toBe("File details (optional)");
    expect(screen.getByTestId("what-files-line").textContent).toBe(
      "Project name and location description. They print on the plan's title block. 2 not set.",
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Show" }));
    expect(panelEl.hasAttribute("hidden")).toBe(false);
    expect(panelEl.querySelector("#what-project")).not.toBeNull();
    expect(panelEl.querySelector("#what-location-description")).not.toBeNull();
  });
});
