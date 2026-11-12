// @vitest-environment happy-dom
//
// R126 / R127 (r126-step2-layout) — Step 2's layout items, as
// design-refs/SpeedD3.dc.html draws them:
//   - the windows check folds into ONE line in the check's own words (Q5);
//     #526 (Ryan, 2026-11-11, item 1 ruling 2) moves it to the Work dates
//     cell's result line, in one of the ruled states, and the work hours
//     open in a dialog from a row of their own under the grid;
//   - one marker per row, and no row reaches the "i about" fallback;
//   - "Carriageway" reads detection's clause, or default-or-yours.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SCENARIO, DEFAULT_SHOULDER, type Scenario } from "@/lib/scenarios";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import { windowsSummary } from "./ScheduleField";
import { WhatBand, type WindowsLine } from "./bands/WhatBand";
import { denverBlock, denverDays, sourceWord, whyTip } from "./__fixtures__/what-section";
import { listboxValue } from "./__fixtures__/listbox";

afterEach(cleanup);

const DATED = {
  date_mode: "range" as const,
  work_date: "2026-11-16",
  work_date_end: "2026-11-20",
  start_time: 9,
  end_time: 15,
};

function sc(over: Partial<Scenario>): Scenario {
  return { ...DEFAULT_SCENARIO, ...over } as Scenario;
}

const said = (w: ReturnType<typeof windowsSummary>) => `${w.kind}: ${w.text}`;

describe("#526 ruling 2: the Work dates result line, in the check's own words", () => {
  const denver = { jurisdiction_key: "denver", street_class: "collector" } as Partial<Scenario>;

  it("no jurisdiction (R145 S2)", () => {
    expect(said(windowsSummary({ scenario: sc({}) }))).toBe(
      "none: Optional. Pick a jurisdiction to check your dates against its work hours.",
    );
  });
  it("the block not loaded yet: checking, named from the picked option", () => {
    expect(said(windowsSummary({ scenario: sc(denver), name: "Denver", jurisdiction: null }))).toBe(
      "none: Checking your dates against Denver's work hours.",
    );
  });
  it("#398: a declined plan, and a check that didn't answer, never read 'checking'", () => {
    expect(
      said(windowsSummary({ scenario: sc(denver), name: "Denver", jurisdiction: null, declined: true, errored: true })),
    ).toBe("none: Not checked: the plan was declined.");
    expect(said(windowsSummary({ scenario: sc(denver), name: "Denver", jurisdiction: null, errored: true }))).toBe(
      "none: Check failed: the check didn't answer.",
    );
    // A block on screen wins: the flags only speak to its absence.
    expect(
      said(windowsSummary({ scenario: sc(denver), jurisdiction: denverBlock(denverDays("dates")), declined: true })),
    ).toBe("none: Optional. We check your dates and times against Denver's work hours.");
  });
  it("no data for the jurisdiction (Rule 10)", () => {
    expect(said(windowsSummary({ scenario: sc({ ...denver, jurisdiction_key: "cdot" }), jurisdiction: denverBlock(null, undefined, "Colorado Department of Transportation") }))).toBe(
      "none: We don't have CDOT's work hours yet, so we can't check your dates.",
    );
  });
  it("no dates", () => {
    expect(said(windowsSummary({ scenario: sc(denver), jurisdiction: denverBlock(denverDays("dates")) }))).toBe(
      "none: Optional. We check your dates and times against Denver's work hours.",
    );
  });
  it("dates, no times", () => {
    const { start_time: _s, end_time: _e, ...noTimes } = DATED;
    expect(
      said(
        windowsSummary({
          scenario: sc({ ...denver, schedule: noTimes } as Partial<Scenario>),
          jurisdiction: denverBlock(denverDays("times")),
        }),
      ),
    ).toBe("none: Add a start and end time to finish the check.");
  });
  it("a refetch in flight never shows the last answer", () => {
    expect(
      said(
        windowsSummary({
          scenario: sc({ ...denver, schedule: DATED }),
          jurisdiction: denverBlock(denverDays("outside")),
          verifying: true,
        }),
      ),
    ).toBe("none: Checking your dates against Denver's work hours.");
  });
  it("fits", () => {
    expect(
      said(windowsSummary({ scenario: sc({ ...denver, schedule: DATED }), jurisdiction: denverBlock(denverDays("inside")) })),
    ).toBe("ok: Fits Denver's work hours on every day.");
  });
  it("outside, in the backend's starts-before / ends-after facts", () => {
    expect(
      said(
        windowsSummary({
          scenario: sc({ ...denver, schedule: { ...DATED, start_time: 7, end_time: 17 } }),
          jurisdiction: denverBlock(denverDays("outside")),
        }),
      ),
    ).toBe("bad: Starts before 8:30\u00a0am and ends after 3:30\u00a0pm on weekdays.");
  });
  it("a weekend with no closures, its dates named", () => {
    expect(
      said(
        windowsSummary({
          scenario: sc({ ...denver, schedule: { ...DATED, work_date_end: "2026-11-22" } }),
          jurisdiction: denverBlock(denverDays("weekend_closed")),
        }),
      ),
    ).toBe("bad: Nov 21 and 22 are a weekend: no closures.");
  });
});

function mount(scenario: Scenario, windowsLine?: WindowsLine, block: JurisdictionBlock | null = null) {
  return render(
    <WhatBand
      scenario={scenario}
      setScenario={() => {}}
      setMeta={() => {}}
      jurisdictionBlock={block}
      jurisdictionLoading={false}
      jurisdictionErrored={false}
      stepIndex="STEP 2 OF 4"
      windowsLine={windowsLine}
      handoff={[]}
    />,
  );
}

const URBAN = {
  ...DEFAULT_SHOULDER,
  roadType: "urban_arterial",
  divided: false,
  lanes: 1,
} as unknown as Scenario;

// #517 ruling 7 (Ryan, 2026-11-11): "The old 'Denver windows · set dates
// to check' bottom row goes away."  #526 ruling 2: the Work dates cell holds
// the date button and one result line; the inline windows list goes away and
// a row of its own under the grid opens the work hours (ruling 4's dialog).
const DENVER_DATED = { ...URBAN, jurisdiction_key: "denver", street_class: "collector", schedule: DATED } as unknown as Scenario;
const FITS: WindowsLine = { kind: "ok", text: "Fits Denver's work hours on every day." };

describe("#526 ruling 2 (was #517 ruling 7): the result line under the dates, the hours row under the grid", () => {
  it("the result line sits in the Work dates cell, described by the date button", () => {
    mount(DENVER_DATED, FITS, denverBlock(denverDays("inside")));
    const line = screen.getByTestId("what-windows-line");
    expect(line.textContent).toBe("✓Fits Denver's work hours on every day.");
    expect(line.className).toBe("w-result is-ok");
    expect(line.closest('[data-testid="cell-work-dates"]')).not.toBeNull();
    expect(document.getElementById("what-date")!.getAttribute("aria-describedby")).toContain("what-date-hint");
    expect(screen.queryByTestId("what-footer")).toBeNull();
    expect(document.querySelector(".sched-windows")).toBeNull();
  });

  it("a bad line carries the orange mark, not a glyph", () => {
    mount(DENVER_DATED, { kind: "bad", text: "Starts before 8:30\u00a0am on weekdays." }, denverBlock(denverDays("outside")));
    const line = screen.getByTestId("what-windows-line");
    expect(line.className).toBe("w-result is-bad");
    expect(line.querySelector(".wd-bad")).not.toBeNull();
    expect(line.textContent).toBe("Starts before 8:30\u00a0am on weekdays.");
  });

  it("the hours row under the grid: the ruled line and the link, which opens the dialog; File details stays shut", async () => {
    mount(DENVER_DATED, FITS, denverBlock(denverDays("inside")));
    const row = screen.getByTestId("what-hours");
    expect(row.closest('[data-testid="cell-work-dates"]')).toBeNull();
    expect(row.previousElementSibling?.getAttribute("data-testid")).toBe("what-about-grid");
    expect(row.querySelector(".w-hours-text")!.textContent).toBe("Denver limits when you can close a lane.");
    const link = screen.getByTestId("what-hours-all");
    expect(link.textContent).toBe("See Denver's work hours");
    expect(link.getAttribute("aria-haspopup")).toBe("dialog");
    await userEvent.setup().click(link);
    expect(screen.getByTestId("hours-dialog").getAttribute("role")).toBe("dialog");
    expect(screen.getByTestId("what-files-panel").hasAttribute("hidden")).toBe(true);
    expect(screen.getByTestId("what-files-toggle").textContent).toBe("Show");
  });

  it("no data for the jurisdiction: the row says so, with no link (Rule 10)", () => {
    mount(DENVER_DATED, { kind: "none", text: "x" }, denverBlock(null));
    expect(screen.getByTestId("what-hours").textContent).toBe("We don't have Denver's work hours yet.");
    expect(screen.queryByTestId("what-hours-all")).toBeNull();
  });
});

describe("R126: one marker per row, none of them 'i about'", () => {
  it("no WHAT row's marker is the about fallback", () => {
    mount(URBAN);
    const markers = [...document.querySelectorAll('[data-testid^="info-toggle-"]')].map(
      (m) => m.textContent,
    );
    expect(markers.length).toBeGreaterThan(8);
    for (const m of markers) expect(m).not.toMatch(/about/);
  });

  it("Carriageway: the label, and default-or-yours with no detection behind it", () => {
    mount(URBAN);
    const cell = document.querySelector('[data-testid="cell-divided"]')!;
    expect(cell.querySelector(".w-label")!.textContent).toBe("Carriageway");
    // #411 (Ryan, 2026-10-26): plain "default", no mark (#517 ruling 5's "Default").
    expect(sourceWord("divided")).toBe("Default");
    expect(screen.getByTestId("info-toggle-divided").textContent).not.toMatch(/[✓⚠]/);
    expect(whyTip("divided")).toEqual(["Undivided until you say otherwise."]);
    cleanup();
    mount({ ...URBAN, divided: true, lanes: 2 } as unknown as Scenario);
    expect(sourceWord("divided")).toBe("Set by you");
  });

  it("R128: an empty kind row (shoulder) takes no strip and no second divider", () => {
    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");
    expect(css).toMatch(/\.workbench \.a-kindrow:empty \{\s*display: none;/);
    const i = css.indexOf(".workbench .a-footline {");
    const footline = css.slice(i, css.indexOf("}", i));
    // R128: the windows line's underline is the text's, ending with the words.
    expect(footline).toContain("text-decoration-line: underline;");
    expect(footline).not.toMatch(/border-bottom/);
  });

  it("the road-type option reads 'Urban street' (R127 Q4); the wire value is unchanged", () => {
    mount(URBAN);
    // #517 ruling 6: the shared listbox; its selected option carries the
    // wire value, its label the words.
    expect(listboxValue("what-road-type")).toBe("Urban street");
    fireEvent.click(document.getElementById("what-road-type")!);
    const sel = document.querySelector('#what-road-type-list [aria-selected="true"]')!;
    expect(sel.getAttribute("data-value")).toBe("urban_arterial");
    expect(sel.textContent).toContain("Urban street");
  });
});
