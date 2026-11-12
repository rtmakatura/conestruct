// @vitest-environment happy-dom
//
// #517 (UX group 7, Ryan 2026-11-11, boards B and D) — the What section,
// guesses first.
//
// Authority: validation-artifacts/committed/missions/ux-group7-what-section/
// issue-517/rulings.md, rulings 1, 2, 3, 5 and 7 and self-rulings S1-S5,
// S9.  Mounted (Rule 11): the band as the column renders it, read from
// the DOM.

import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario, ScenarioGuesses } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import { classifyFromOsmTags } from "@/lib/road-detection/classify";
import { WhatBand } from "./bands/WhatBand";
import { pickOption } from "./__fixtures__/listbox";
import { windowsSummary } from "./ScheduleField";
import { denverBlock, denverDays } from "./__fixtures__/what-section";
import type { JurisdictionBlock } from "@/lib/jurisdiction";

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
      {
        highwayClass: "residential",
        name: candidate.name,
        ref: null,
        tags: candidate.tags,
      },
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

const THREE: ScenarioGuesses = {
  road_type: { highwayClass: "residential", urban: true, divided: false },
  street_class: { highwayClass: "residential" },
  jurisdiction_key: { lat: PIN.lat, lng: PIN.lng },
};

function sc(guesses: ScenarioGuesses, withRoad = true): Scenario {
  return {
    ...DEFAULT_SHOULDER,
    speed: 30,
    street_class: "local",
    jurisdiction_key: "denver",
    guesses,
    meta: {
      ...DEFAULT_SHOULDER.meta,
      lat: PIN.lat,
      lng: PIN.lng,
      confirmedRoad: withRoad ? road("30 mph") : null,
    },
  } as Scenario;
}

let latest: Scenario | null = null;
function Harness({
  initial,
  block = null,
}: {
  initial: Scenario;
  /** #526: a block, so the Work dates line reads (as the sidebar passes it). */
  block?: JurisdictionBlock | null;
}) {
  const [scenario, setScenario] = useState(initial);
  latest = scenario;
  return (
    <WhatBand
      scenario={scenario}
      setScenario={setScenario}
      setMeta={() => {}}
      jurisdictionBlock={block}
      jurisdictionLoading={false}
      jurisdictionErrored={false}
      stepIndex="STEP 2 OF 4"
      windowsLine={windowsSummary({ scenario, jurisdiction: block })}
    />
  );
}

const q = (sel: string) => document.querySelector(sel);
const text = (testid: string) =>
  (q(`[data-testid="${testid}"]`)?.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();
const boxOrder = () =>
  Array.from(
    document.querySelectorAll('[data-testid="what-guesses"] > .a-cell'),
  ).map((c) => c.getAttribute("data-testid"));
const intro = () => (q(".a-question-prov")?.textContent ?? "").trim();

describe("#517 ruling 1: the heading, the intro line and the guesses box", () => {
  it("asks What's the job?", () => {
    render(<Harness initial={sc(THREE)} />);
    expect(q(".a-question")?.textContent).toBe("What's the job?");
  });

  it("three guesses: the line counts them, the box holds them in order", () => {
    render(<Harness initial={sc(THREE)} />);
    expect(intro()).toBe(
      "We filled this in from the road you confirmed. Check our 3 guesses, then tell us about the work.",
    );
    expect(text("what-guesses-head")).toBe("Check these 3 guesses");
    // #526 ruling 1 (3c): the count of guesses checked, on the heading row.
    expect(text("what-guesses-count")).toBe("0 of 3 checked");
    expect(boxOrder()).toEqual([
      "cell-road-type",
      "cell-street-class",
      "cell-jurisdiction",
    ]);
    // Ruling 2: each reason states the record's basis.
    expect(text("prov-road-type")).toBe(
      "Based on the road's map tag and the built-up area around it",
    );
    expect(text("prov-street-class")).toBe("Based on the road's map tag");
    expect(text("prov-jurisdiction")).toBe("Based on where your pin is");
  });

  it("one guess: 'guess', singular", () => {
    render(
      <Harness initial={sc({ jurisdiction_key: THREE.jurisdiction_key })} />,
    );
    expect(intro()).toBe(
      "We filled this in from the road you confirmed. Check our 1 guess, then tell us about the work.",
    );
    expect(text("what-guesses-head")).toBe("Check this guess");
    expect(boxOrder()).toEqual(["cell-jurisdiction"]);
  });

  it("no guesses: the second clause goes and the box does not show", () => {
    render(<Harness initial={sc({})} />);
    expect(intro()).toBe("We filled this in from the road you confirmed.");
    expect(q('[data-testid="what-guesses"]')).toBeNull();
  });

  it("the speed guess reads its own basis", () => {
    const s = sc({ speed: { highwayClass: "residential" } });
    s.meta = { ...s.meta, confirmedRoad: road(null) };
    render(<Harness initial={s} />);
    expect(text("prov-speed")).toBe(
      "Based on the road's map tag. The map has no posted speed here.",
    );
  });
});

describe("#517 ruling 3 (P1, S2): a checked guess stays put", () => {
  it("a changed guess reads ✓ Checked; nothing moves", () => {
    render(<Harness initial={sc(THREE)} />);
    const before = boxOrder();
    pickOption("what-street-class", "arterial");
    expect(text("prov-street-class")).toBe("Checked");
    expect(
      q('[data-testid="info-toggle-street-class"] [aria-hidden]')?.textContent,
    ).toBe("✓");
    expect(boxOrder()).toEqual(before);
    expect(latest?.street_class).toBe("arterial");
    expect(latest?.guesses?.street_class).toBeUndefined();
  });

  it("picking the value it already holds is the check", () => {
    render(<Harness initial={sc(THREE)} />);
    pickOption("what-jurisdiction", "denver");
    expect(text("prov-jurisdiction")).toBe("Checked");
    expect(latest?.jurisdiction_key).toBe("denver");
    expect(latest?.guesses?.jurisdiction_key).toBeUndefined();
    pickOption("what-road-type", latest!.roadType as string);
    expect(text("prov-road-type")).toBe("Checked");
    expect(latest?.meta.operatorSet).toContain("roadType");
    // #526 ruling 1: the count follows; the heading's n never changes.
    expect(text("what-guesses-count")).toBe("2 of 3 checked");
    expect(text("what-guesses-head")).toBe("Check these 3 guesses");
    expect(boxOrder()).toEqual([
      "cell-road-type",
      "cell-street-class",
      "cell-jurisdiction",
    ]);
    // The count stays the box's rows (S1).
    expect(intro()).toContain("Check our 3 guesses");
  });
});

describe("#517 ruling 1, S5: the measured row", () => {
  it("closed: the values on one line and a Change button; open in place", () => {
    render(<Harness initial={sc(THREE)} />);
    const toggle = q(
      '[data-testid="what-measured-toggle"]',
    ) as HTMLButtonElement;
    const panel = q('[data-testid="what-measured-panel"]') as HTMLElement;
    expect(toggle.textContent).toBe("Change");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hidden).toBe(true);
    // #521 (Rule 10): the line lists only what the map measured (the
    // posted 30 mph); the lane count and width are defaults here, so they
    // follow on their own line.
    expect(text("what-measured-line")).toBe("30 mph");
    expect(text("what-measured-extra")).toMatch(
      /^Not from the map: \d lanes? each way · \d+(\.\d+)? ft lanes/,
    );
    act(() => {
      fireEvent.click(toggle);
    });
    expect(toggle.textContent).toBe("Done");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector("#what-speed")).not.toBeNull();
    expect(panel.querySelector("#what-lanes")).not.toBeNull();
  });

  it("starts open when a field inside needs the operator now (no speed set)", () => {
    render(<Harness initial={sc({}, false)} />);
    expect(
      (q('[data-testid="what-measured-panel"]') as HTMLElement).hidden,
    ).toBe(false);
    expect(text("what-measured-line")).toContain("Speed not set");
  });
});

describe("#517 ruling 5: the source line and its why tip", () => {
  it("measured: the plain word; the tip opens on click, closes on Esc and returns focus", () => {
    render(<Harness initial={sc({})} />);
    act(() => {
      fireEvent.click(q('[data-testid="what-measured-toggle"]') as HTMLElement);
    });
    const trigger = q('[data-testid="info-toggle-speed"]') as HTMLButtonElement;
    const tip = q('[data-testid="info-speed"]') as HTMLElement;
    expect(text("prov-speed")).toBe("Measured from the map");
    expect(tip.hidden).toBe(true);
    act(() => {
      fireEvent.click(trigger);
    });
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toContain(
      "The road's map record says the posted speed is 30 mph. If the sign on site says otherwise, change it here.",
    );
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(tip.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it("a guess's tip opens on focus + Enter and closes on a tap outside", async () => {
    const user = userEvent.setup();
    render(<Harness initial={sc(THREE)} />);
    const trigger = q(
      '[data-testid="info-toggle-street-class"]',
    ) as HTMLButtonElement;
    const tip = q('[data-testid="info-street-class"]') as HTMLElement;
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toContain(
      "We matched the road's map tag (residential street) to a street class.",
    );
    act(() => {
      fireEvent.pointerDown(document.body);
    });
    expect(tip.hidden).toBe(true);
  });

  it("no jargon anywhere in the section's text, tips included", () => {
    const s = sc(THREE);
    s.guesses = { ...THREE, speed: { highwayClass: "residential" } };
    s.meta = { ...s.meta, confirmedRoad: road(null) };
    render(<Harness initial={s} />);
    const band = q('[data-testid="band-what"]') as HTMLElement;
    const all = band.textContent ?? "";
    for (const word of [
      "OSM",
      "highway=",
      "operator-set",
      "evaluated ·",
      "· from the road",
      "withdrawn ·",
      "detected ·",
    ]) {
      expect(all, word).not.toContain(word);
    }
  });
});

describe("#517 ruling 7, S9, #526 ruling 2: the work dates", () => {
  it("unset: the button and the result line naming the jurisdiction", () => {
    render(<Harness initial={sc(THREE)} block={denverBlock(denverDays("dates"))} />);
    expect(
      screen.getByRole("button", {
        name: "Work dates Pick start and end dates",
      }).id,
    ).toBe("what-date");
    expect(text("what-windows-line")).toBe(
      "Optional. We check your dates and times against Denver's work hours.",
    );
  });

  it("no jurisdiction: S2's line", () => {
    const s = sc({});
    s.jurisdiction_key = null;
    render(<Harness initial={s} />);
    expect(text("what-windows-line")).toBe(
      "Optional. Pick a jurisdiction to check your dates against its work hours.",
    );
    // No jurisdiction, no hours row (ruling 2).
    expect(q('[data-testid="what-hours"]')).toBeNull();
  });

  it("the old footer and the old words are gone", () => {
    render(<Harness initial={sc(THREE)} block={denverBlock(denverDays("dates"))} />);
    expect(q('[data-testid="what-footer"]')).toBeNull();
    expect(q('[data-testid="what-dates-hint"]')).toBeNull();
    expect(document.body.textContent).not.toContain("set dates to check");
    expect(text("what-files-line")).toBe(
      "Project name and location description. They print on the plan's title block. 2 not set.",
    );
  });
});

describe("#517 round 1 repairs", () => {
  const tipLines = (id: string) =>
    Array.from(
      document.querySelectorAll(`[data-testid="info-${id}"] .w-tip-line`),
    ).map((e) => (e.textContent ?? "").replace(/\s+/g, " ").trim());

  it("lane width has its own row and source line, never under the count's (Rule 10/12)", () => {
    render(<Harness initial={sc(THREE)} />);
    expect(
      q('[data-testid="cell-lane-width"] #what-lane-width'),
    ).not.toBeNull();
    expect(q('[data-testid="cell-lanes"] #what-lane-width')).toBeNull();
    expect(text("prov-lane-width")).toBe("Default");
  });

  it("with no confirmed road the row is not titled 'Measured from the map' (Rule 10, S22)", () => {
    render(<Harness initial={sc({}, false)} />);
    expect(text("what-measured")).toContain("About the road");
    expect(text("what-measured")).not.toContain("Measured from the map");
    cleanup();
    render(<Harness initial={sc(THREE)} />);
    expect(text("what-measured")).toContain("Measured from the map");
  });

  it("divided-ness has one voice: no Divided line under the road type when Carriageway carries it (P2)", () => {
    const withCarriageway = {
      ...sc({}),
      roadType: "urban_arterial",
      carriageway: {
        oneway: "yes",
        highwayClass: "primary",
        twinDistanceM: null,
        twinSearched: true,
      },
    } as Scenario;
    render(<Harness initial={withCarriageway} />);
    expect(q('[data-testid="cell-carriageway"]')).not.toBeNull();
    expect(tipLines("road-type").some((l) => l.startsWith("Divided:"))).toBe(
      false,
    );
  });

  it("a Divided line, where one shows, reads yes or no, never 'Divided: Divided.'", () => {
    render(<Harness initial={sc({})} />);
    for (const l of tipLines("road-type").filter((x) =>
      x.includes("Divided:"),
    )) {
      expect(l).toMatch(/Divided: (yes|no)\./);
    }
    expect(document.body.textContent).not.toContain("Divided: Divided.");
  });
});

// #521: the measured row, one-way roads and the time rows.
describe("#521: only measured values under Measured from the map", () => {
  it("every value on the line has a measured source in the open panel", () => {
    render(<Harness initial={sc({})} />);
    const line = text("what-measured-line").split(" · ");
    act(() => {
      fireEvent.click(
        q('[data-testid="what-measured-toggle"]') as HTMLButtonElement,
      );
    });
    const measured = Array.from(
      document.querySelectorAll(
        '#what-measured-panel [data-source="measured"]',
      ),
    ).map((b) => b.getAttribute("data-testid"));
    expect(line).toEqual(["30 mph"]);
    expect(measured).toEqual(["info-toggle-speed"]);
    // Set by you (street class, jurisdiction) is never on the measured line.
    expect(text("what-measured-extra")).toContain("Local street");
    expect(text("what-measured-extra")).toContain("Denver");
  });

  it("no line says each way on a one-way road", () => {
    const one = {
      ...sc({}),
      lanes: 4,
      carriageway: {
        oneway: "yes",
        highwayClass: "primary",
        twinDistanceM: null,
        twinSearched: true,
        confirmed: "one_way_street",
      },
    } as Scenario;
    render(<Harness initial={one} />);
    const all = `${text("what-measured-line")} ${text("what-measured-extra")}`;
    expect(all).toContain("4 lanes");
    expect(all).toContain("One-way");
    expect(all).not.toContain("each way");
  });
});
