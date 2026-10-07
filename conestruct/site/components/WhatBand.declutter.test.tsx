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

afterEach(cleanup);

const PIN = { lat: 39.7402, lng: -104.956 };

function road(roadTypeMethod: "measured" | "inferred"): ConfirmedRoad {
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
      raw: { class: "primary", oneway: false, roadName: "E Colfax Ave", placeName: "Denver" },
      fields: {
        speed: { value: 30, confidence: "high", source: "OSM maxspeed tag", method: "measured" },
        lanes: { value: 2, confidence: "high", source: "OSM lanes tag", method: "measured" },
        roadType: { value: "urban_arterial", confidence: "medium", source: "class", method: roadTypeMethod },
        divided: { value: true, confidence: "medium", source: "class", method: "inferred" },
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

function scenario(opts: { guessed?: boolean; roadTypeMeasured?: boolean } = {}): Scenario {
  return {
    ...DEFAULT_SHOULDER,
    speed: 30,
    lanes: 2,
    roadType: "urban_arterial",
    divided: true,
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
      confirmedRoad: road(opts.roadTypeMeasured ? "measured" : "inferred"),
    },
  } as Scenario;
}

const READY: JurisdictionLookup = {
  status: "ready",
  data: {
    suggestion: "denver",
    reason: "Pin is inside Denver municipal limits (US Census TIGER/Line Place boundaries, 2025 vintage).",
    confidence: "inside",
    distance_to_boundary_ft: 900,
    warnings: [],
    boundary_source: { source: "US Census TIGER/Line Place boundaries", vintage: "2025 vintage" },
  },
};

function mount(
  opts: {
    guessed?: boolean;
    roadTypeMeasured?: boolean;
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

const band = () => document.querySelector('[data-testid="band-what"]') as HTMLElement;
const cell = (id: string) => document.querySelector(`[data-testid="cell-${id}"]`) as HTMLElement;
const trigger = (id: string) =>
  document.querySelector(`[data-testid="info-toggle-${id}"]`) as HTMLButtonElement;
const panel = (id: string) => document.querySelector(`[data-testid="info-${id}"]`) as HTMLElement;
const columnRows = (name: string) => {
  const g = document.querySelector(`[data-testid="what-group-${name}"]`) as HTMLElement;
  return [...g.querySelectorAll(':scope > [data-testid^="cell-"]')].map((c) =>
    c.getAttribute("data-testid")!.slice("cell-".length),
  );
};

describe("two columns named for the user's question (R107, P20)", () => {
  it("The road on the left, The job on the right, in WhatC5's order", () => {
    mount();
    const cols = document.querySelector(".a-cols")!;
    expect([...cols.children].map((c) => c.getAttribute("data-testid"))).toEqual([
      "what-group-road",
      "what-group-job",
    ]);
    expect(columnRows("road")).toEqual(["speed", "lanes", "road-type", "street-class", "divided"]);
    expect(columnRows("job")).toEqual(["work-type", "night", "reduction", "jurisdiction", "work-dates"]);
    expect(band().textContent).not.toContain("The rest of this plan");
  });

  it("each row is its label with the marker under it, beside the control", () => {
    mount();
    const row = cell("speed");
    const head = row.querySelector(":scope > .a-cell-head")!;
    expect(head.querySelector(".tr-field")!.textContent).toBe("Speed limit");
    expect(head.contains(trigger("speed"))).toBe(true);
    expect(row.querySelector(":scope > .a-cell-ctl > select#what-speed")).not.toBeNull();
  });
});

describe("one quiet marker per field (R98, P9)", () => {
  it("at rest each field shows a symbol + word, not its sentence", () => {
    mount();
    expect(trigger("speed").textContent).toBe("✓ measured");
    expect(trigger("lanes").textContent).toBe("✓ measured");
    // R110 Q7: lane width's own source, its own marker in the Lanes row.
    expect(trigger("lane-width").textContent).toBe("✓ default");
    expect(cell("lanes").contains(trigger("lane-width"))).toBe(true);
    expect(trigger("road-type").textContent).toBe("⚠ from the road");
    expect(trigger("street-class").textContent).toBe("◌ not set");
    expect(trigger("jurisdiction").textContent).toBe("◌ not set");
    expect(trigger("work-dates").textContent).toBe("◌ not set");
    // R110 Q8.
    expect(trigger("night").textContent).toBe("✓ default");
    expect(trigger("reduction").textContent).toBe("✓ default");
    // The full line is in the closed popover, one click away.
    expect(panel("speed").hasAttribute("hidden")).toBe(true);
    expect(panel("speed").querySelector('[data-testid="prov-speed"]')!.textContent).toBe(
      "OSM · 30 mph · measured",
    );
  });

  it("both Lanes markers open the one popover, holding both lines", async () => {
    mount();
    const user = userEvent.setup();
    await user.click(trigger("lane-width"));
    expect(panel("lanes").hasAttribute("hidden")).toBe(false);
    expect(panel("lanes").querySelector('[data-testid="prov-lanes"]')!.textContent).toBe(
      "OSM · 2 · measured",
    );
    expect(panel("lanes").querySelector('[data-testid="prov-lane-width"]')!.textContent).toBe(
      "default · the plan's standard lane; detection doesn't measure width",
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
  it("street class '⚠ from the road', jurisdiction '⚠ from the pin', and the header counts them", () => {
    mount({ guessed: true });
    expect(trigger("street-class").textContent).toBe("⚠ from the road");
    expect(trigger("jurisdiction").textContent).toBe("⚠ from the pin");
    // Road type (inferred) + the two guesses.
    expect(band().textContent).toContain("3 guesses marked ⚠ · change any that are wrong");
  });

  it("no confirm, dismiss, undo, record or suggestion row anywhere", () => {
    mount({ guessed: true });
    for (const name of [/^Confirm/, /^Dismiss$/, /^Undo$/]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(document.querySelector(".a-cell-record, .a-cell-action, .classpick")).toBeNull();
  });

  it("the pin's evidence rides the jurisdiction's details, the TIGER caveat with it", () => {
    mount({ guessed: true });
    const p = panel("jurisdiction");
    expect(p.hasAttribute("hidden")).toBe(true);
    expect(p.textContent).toContain("The pin is in Denver.");
    expect(p.textContent).toContain("Confirm the jurisdiction with the permitting authority.");
    expect(p.querySelector('[data-testid="prov-jurisdiction"]')!.textContent).toBe(
      "⚠ guessed, not confirmed · from the pin",
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
              message: "Pin is 120 ft from the Glendale boundary. Jurisdiction lines here are jigsawed; verify which side the work zone falls on.",
              source: { doc: "TIGER", date: "2025", status: "verified" },
            },
          ],
        },
      },
    });
    const w = cell("jurisdiction").querySelector('[data-testid="jurisdiction-warning"]')!;
    expect(w).not.toBeNull();
    expect(w.closest(".a-info")).toBeNull();
  });

  it("an evaluation that failed keeps its error line on show over the guess (P3)", () => {
    mount({ guessed: true, errored: true });
    const line = cell("jurisdiction").querySelector('[data-testid="prov-jurisdiction"]')!;
    expect(line.textContent).toBe(
      "not evaluated: the check didn't answer; the option you picked stands",
    );
    expect(line.closest(".a-info")).toBeNull();
  });

  it("nothing guessed off a road: the header reads 'prefilled from the road' (R110 Q5)", () => {
    mount({ roadTypeMeasured: true });
    expect(band().textContent).toContain("prefilled from the road");
    expect(band().textContent).not.toContain("guesses marked");
  });

  it("one guess reads in the singular", () => {
    mount();
    expect(band().textContent).toContain("1 guess marked ⚠ · change any that are wrong");
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
