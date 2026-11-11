// @vitest-environment happy-dom
//
// R126 / R127 (r126-step2-layout) — Step 2's layout items, as
// design-refs/SpeedD3.dc.html draws them:
//   - the windows check folds into ONE footer line beside File details, in
//     the check's own words (Q5), and the table opens from it;
//   - one marker per row, and no row reaches the "i about" fallback;
//   - "Carriageway" reads detection's clause, or default-or-yours.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SCENARIO, DEFAULT_SHOULDER, type Scenario } from "@/lib/scenarios";
import type { HoursEval, JurisdictionBlock } from "@/lib/jurisdiction";
import { windowsSummary } from "./ScheduleField";
import { WhatBand, type WindowsLine } from "./bands/WhatBand";
import { sourceWord, whyTip } from "./__fixtures__/what-section";
import { listboxValue } from "./__fixtures__/listbox";

afterEach(cleanup);

const SRC = { doc: "DPW Rules", section: "3", status: "verified" };

function block(hoursEval: HoursEval, shape = "nested_envelope"): JurisdictionBlock {
  return {
    name: "Denver",
    hours: {
      shape,
      windows:
        shape === "none"
          ? []
          : [
              { kind: "work", days: "weekday", classes: ["arterial"], start: 9, end: 17, source: SRC },
              { kind: "ban", days: "all", classes: null, start: 22, end: 5, source: SRC },
            ],
      holiday_rule: "none",
      conflict: null,
    },
    hours_eval: hoursEval,
  } as unknown as JurisdictionBlock;
}

const UNKNOWN: HoursEval = { status: "unknown", violations: [] };
const INSIDE: HoursEval = { status: "inside", violations: [] };
const BAN: HoursEval = {
  status: "outside",
  violations: [
    {
      kind: "ban_window_overlap",
      window: { start: 22, end: 5, days: "all" },
      overlap_hours: 2,
      source: SRC,
    } as unknown as HoursEval["violations"][number],
  ],
};
const OUTSIDE_WORK: HoursEval = {
  status: "outside",
  violations: [
    {
      kind: "outside_work_window",
      window: { start: 9, end: 17, days: "weekday" },
      outside_hours: 3,
      source: SRC,
    } as unknown as HoursEval["violations"][number],
  ],
};

const DATED = {
  date_mode: "single" as const,
  work_date: "2026-09-01",
  start_time: 20,
  end_time: 2,
};

function sc(over: Partial<Scenario>): Scenario {
  return { ...DEFAULT_SCENARIO, ...over } as Scenario;
}

const said = (w: ReturnType<typeof windowsSummary>) =>
  `${w.head} · ${w.glyph ? `${w.glyph} ` : ""}${w.text}`;

describe("R127 Q5: the windows footer line, in the check's own words", () => {
  const denver = { jurisdiction_key: "denver", street_class: "arterial" } as Partial<Scenario>;

  it("no jurisdiction", () => {
    expect(said(windowsSummary({ scenario: sc({}) }))).toBe("Windows · select a jurisdiction to check");
  });
  it("the block not loaded yet", () => {
    expect(said(windowsSummary({ scenario: sc(denver), jurisdiction: null }))).toBe("Windows · ◌ loading");
  });
  it("#398: a declined plan, and a check that didn't answer, never read 'loading'", () => {
    expect(
      said(windowsSummary({ scenario: sc(denver), jurisdiction: null, declined: true, errored: true })),
    ).toBe("Windows · not checked: the plan was declined");
    expect(said(windowsSummary({ scenario: sc(denver), jurisdiction: null, errored: true }))).toBe(
      "Windows · check failed: the check didn't answer",
    );
    // A block on screen wins: the flags only speak to its absence.
    expect(
      said(windowsSummary({ scenario: sc(denver), jurisdiction: block(UNKNOWN), declined: true })),
    ).toBe("Denver windows · set dates to check");
  });
  it("none published", () => {
    expect(
      said(windowsSummary({ scenario: sc(denver), jurisdiction: block(UNKNOWN, "none") })),
    ).toBe("Denver windows · ◌ none published");
  });
  it("no dates: D3's words, verbatim", () => {
    expect(said(windowsSummary({ scenario: sc(denver), jurisdiction: block(UNKNOWN) }))).toBe(
      "Denver windows · set dates to check",
    );
  });
  it("a refetch in flight never shows the last answer", () => {
    expect(
      said(
        windowsSummary({
          scenario: sc({ ...denver, schedule: DATED }),
          jurisdiction: block(BAN),
          verifying: true,
        }),
      ),
    ).toBe("Denver windows · ◌ checking your dates");
  });
  it("inside", () => {
    expect(
      said(windowsSummary({ scenario: sc({ ...denver, schedule: DATED }), jurisdiction: block(INSIDE) })),
    ).toBe("Denver windows · ✓ fits your dates");
  });
  it("a ban overlap, in the backend's violation facts", () => {
    expect(
      said(windowsSummary({ scenario: sc({ ...denver, schedule: DATED }), jurisdiction: block(BAN) })),
    ).toBe("Denver windows · ⚠ 2 h overlaps the 10:00 PM–5:00 AM ban");
  });
  it("outside a permitted window", () => {
    expect(
      said(
        windowsSummary({ scenario: sc({ ...denver, schedule: DATED }), jurisdiction: block(OUTSIDE_WORK) }),
      ),
    ).toBe("Denver windows · ⚠ 3 h outside the permitted 9:00 AM–5:00 PM window");
  });
});

function mount(scenario: Scenario, windowsLine?: WindowsLine) {
  return render(
    <WhatBand
      scenario={scenario}
      setScenario={() => {}}
      setMeta={() => {}}
      jurisdictionBlock={null}
      jurisdictionLoading={false}
      jurisdictionErrored={false}
      stepIndex="STEP 2 OF 4"
      scheduleWindows={<div className="sched-windows">THE TABLE</div>}
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
// to check' bottom row goes away."  Its claims move to their new homes:
// the hours result sits right under the work dates and opens #227's table
// ("See all of <jurisdiction>'s work hours"); File details is its own row
// with its own Show (ruling 1).
const DENVER_DATED = { ...URBAN, jurisdiction_key: "denver", schedule: DATED } as unknown as Scenario;
const FITS: WindowsLine = { head: "Denver windows", glyph: "✓", text: "fits your dates", tone: "" };

describe("#517 ruling 7 (was R126 / D3's footer): the hours result under the dates, File details its own row", () => {
  it("unset dates: the line under them names the jurisdiction; no hours line, no table", () => {
    mount({ ...URBAN, jurisdiction_key: "denver" } as unknown as Scenario, FITS);
    expect(screen.getByTestId("what-dates-hint").textContent).toBe(
      "Optional. We check them against Denver's work hours.",
    );
    expect(screen.queryByTestId("what-windows-line")).toBeNull();
    expect(document.querySelector(".sched-windows")).toBeNull();
    expect(screen.queryByTestId("what-footer")).toBeNull();
    expect(document.body.textContent).not.toContain("Denver windows");
  });

  it("set dates: the hours result in the check's own words, and its link opens the table; File details keeps its own Show", async () => {
    mount(DENVER_DATED, FITS);
    expect(screen.getByTestId("what-windows-line").textContent).toBe("Denver's work hours: ✓ fits your dates");
    expect(document.querySelector(".sched-windows")).toBeNull();
    const user = userEvent.setup();
    const link = screen.getByTestId("what-hours-all");
    expect(link.textContent).toBe("See all of Denver's work hours");
    expect(link.getAttribute("aria-expanded")).toBe("false");
    await user.click(link);
    expect(link.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector(".sched-windows")!.textContent).toBe("THE TABLE");
    // The table opening never opens File details.
    expect(screen.getByTestId("what-files-panel").hasAttribute("hidden")).toBe(true);
    expect(screen.getByTestId("what-files-toggle").textContent).toBe("Show");
  });

  it("the table sits under the hours result, in the dates' own row, never between the sections", async () => {
    mount(DENVER_DATED, FITS);
    await userEvent.setup().click(screen.getByTestId("what-hours-all"));
    const table = document.querySelector(".sched-windows")!;
    expect(table.closest('[data-testid="what-hours"]')).not.toBeNull();
    expect(table.closest('[data-testid="cell-work-dates"]')).not.toBeNull();
    expect(table.previousElementSibling?.getAttribute("data-testid")).toBe("what-hours-all");
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
