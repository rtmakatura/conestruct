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
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SCENARIO, DEFAULT_SHOULDER, type Scenario } from "@/lib/scenarios";
import type { HoursEval, JurisdictionBlock } from "@/lib/jurisdiction";
import { windowsSummary } from "./ScheduleField";
import { WhatBand, type WindowsLine } from "./bands/WhatBand";

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

describe("R126 / D3: the footer is one line — windows, then File details, then open", () => {
  it("the windows line comes first and opens the table; File details keeps its own open", async () => {
    mount(URBAN, { head: "Denver windows", glyph: "", text: "set dates to check", tone: "" });
    const head = document.querySelector(".a-filedetails-head")!;
    const parts = [...head.children].map((c) => c.textContent);
    expect(parts).toEqual(["Denver windows · set dates to check", "File details · ◌ 2 not set", "", "open ›"]);
    expect(document.querySelector(".sched-windows")).toBeNull();
    const user = userEvent.setup();
    const line = screen.getByTestId("what-windows-line");
    expect(line.getAttribute("aria-expanded")).toBe("false");
    await user.click(line);
    expect(line.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector(".sched-windows")!.textContent).toBe("THE TABLE");
    expect(document.querySelector("#what-project")).toBeNull();
  });

  it("the table sits under the footer, never between the columns and the footer", () => {
    mount(URBAN, { head: "Windows", glyph: "", text: "select a jurisdiction to check", tone: "" });
    const footer = screen.getByTestId("what-footer");
    expect(footer.previousElementSibling?.classList.contains("a-cols")).toBe(true);
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
    expect(cell.querySelector(".tr-field")!.textContent).toBe("Carriageway");
    expect(screen.getByTestId("info-toggle-divided").textContent).toBe("✓ default");
    expect(screen.getByTestId("prov-divided").textContent).toBe(
      "default · undivided until you say otherwise",
    );
    cleanup();
    mount({ ...URBAN, divided: true, lanes: 2 } as unknown as Scenario);
    expect(screen.getByTestId("info-toggle-divided").textContent).toBe("✓ yours");
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
    const sel = document.querySelector("#what-road-type") as HTMLSelectElement;
    expect(sel.value).toBe("urban_arterial");
    expect(sel.selectedOptions[0].textContent).toBe("Urban street");
  });
});
