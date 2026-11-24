// @vitest-environment happy-dom
//
// #526 (Ryan, 2026-11-11, item 1 ruling 4): the work-hours window.  "A real
// dialog: focus moves in, Tab stays inside, Esc and Close close it, and
// focus returns to the link."  The fix button "sets the page's start and
// end times and shows group U's Undo link (P15)"; #535 (Ryan, 2026-11-12):
// Undo restores only the times the fix changed, never a later date change.
// The whole week dims "days outside your dates".
// Every span and verdict is the backend's hours_days (fixtures in the
// backend's own shapes, __fixtures__/what-section.ts).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SHOULDER, type Scenario } from "@/lib/scenarios";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import { WorkHoursDialog, noRecordRuns, type FixRecord } from "./WorkHoursDialog";
import { WhatBand } from "./bands/WhatBand";
import { windowsSummary } from "./ScheduleField";
import { denverBlock, denverDays } from "./__fixtures__/what-section";

afterEach(cleanup);

function open(
  over: Partial<{
    block: JurisdictionBlock;
    start: number | null;
    end: number | null;
    fixed: FixRecord | null;
  }> = {},
) {
  const onFix = vi.fn();
  const onUndo = vi.fn();
  const onClose = vi.fn();
  render(
    <WorkHoursDialog
      jurisdiction={over.block ?? denverBlock(denverDays("outside"))}
      streetClass="collector"
      start={over.start === undefined ? 7 : over.start}
      end={over.end === undefined ? 17 : over.end}
      verifying={false}
      fixed={over.fixed ?? null}
      onFix={onFix}
      onUndo={onUndo}
      onClose={onClose}
    />,
  );
  return { onFix, onUndo, onClose, dialog: screen.getByTestId("hours-dialog") };
}

/** The drawn spans under `root`: each one's inline start and length. */
const spans = (root: Element, selector: string, at: "left" | "top", size: "width" | "height") =>
  [...root.querySelectorAll<HTMLElement>(selector)].map((e) => [e.style[at], e.style[size]]);

const focusables = (d: HTMLElement) =>
  Array.from(d.querySelectorAll<HTMLElement>("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"));

describe("#526 ruling 4: a real dialog", () => {
  it("is a modal dialog named by its title, and focus moves into it on open", () => {
    const { dialog } = open();
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const title = document.getElementById(dialog.getAttribute("aria-labelledby")!);
    expect(title?.textContent).toBe("Denver's work hours");
    expect(document.getElementById(dialog.getAttribute("aria-describedby")!)?.textContent).toBe(
      "When you can close a lane on a collector street. Your hours: 7\u00a0am to 5\u00a0pm.",
    );
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("Tab from the last control wraps to the first; Shift+Tab from the first wraps to the last", () => {
    const { dialog } = open();
    const f = focusables(dialog);
    expect(f.length).toBeGreaterThan(2);
    act(() => f[f.length - 1].focus());
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(f[0]);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(f[f.length - 1]);
  });

  it("Esc closes it", () => {
    const { onClose } = open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Close closes it", async () => {
    const { onClose } = open();
    await userEvent.setup().click(screen.getByTestId("hours-dialog-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("#526 ruling 4: a weekday", () => {
  it("outside: the verdict, and the fix button offers the backend's fix pair", async () => {
    const { onFix } = open();
    expect(screen.getByTestId("hours-verdict").textContent).toBe(
      "Your hours go outside what Denver allows on weekdays.",
    );
    const fix = screen.getByTestId("hours-fix");
    expect(fix.textContent).toBe("Change my hours to 8:30\u00a0am to 3:30\u00a0pm");
    await userEvent.setup().click(fix);
    expect(onFix).toHaveBeenCalledWith([8.5, 15.5]);
  });

  it("with the fix applied and the hours inside: the record and Undo, no fix button", async () => {
    const { onUndo } = open({
      block: denverBlock(denverDays("inside")),
      start: 8.5,
      end: 15.5,
      fixed: { start: 8.5, end: 15.5 },
    });
    expect(screen.queryByTestId("hours-fix")).toBeNull();
    expect(screen.getByTestId("hours-fix-record").textContent).toBe("Hours changed to 8:30\u00a0am to 3:30\u00a0pm.Undo");
    await userEvent.setup().click(screen.getByTestId("hours-fix-undo"));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("fits: a check mark and no fix button", () => {
    open({ block: denverBlock(denverDays("inside")), start: 9, end: 15 });
    expect(screen.getByTestId("hours-verdict").textContent).toBe("✓Your hours fit on weekdays.");
    expect(screen.queryByTestId("hours-fix")).toBeNull();
  });

  it("night work past midnight: nothing is clipped on the 6 am to 6 am ruler, so no arrows (#555 S9, was S6)", () => {
    open({ block: denverBlock(denverDays("inside")), start: 20, end: 5 });
    expect(screen.getByTestId("hours-dialog-sub").textContent).toContain("Your hours: 8\u00a0pm to 5\u00a0am.");
    const ruler = screen.getByTestId("hours-ruler");
    expect(ruler.querySelector(".whd-clip")).toBeNull();
  });

  it("weekends: S8's absence, never a permission", () => {
    open({ block: denverBlock(denverDays("inside")), start: 9, end: 15 });
    expect(screen.getByTestId("hours-weekend").textContent).toBe("Weekends: none on record.");
  });

  it("the source line is the backend's", () => {
    open();
    expect(screen.getByTestId("hours-dialog-source").textContent).toBe("Source: Rule 22.3 IV.4, Apr 22, 2022");
  });
});

describe("#526 ruling 4: the whole week", () => {
  it("shows 7 days and dims the days not in the job", async () => {
    open();
    await userEvent.setup().click(screen.getByTestId("hours-view-week"));
    expect(screen.getByTestId("hours-view-week").getAttribute("aria-pressed")).toBe("true");
    const days = screen.getAllByTestId("hours-week-day");
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.classList.contains("is-dim"))).toEqual([false, false, false, false, false, true, true]);
    expect(days.map((d) => d.textContent?.slice(0, 6))).toEqual([
      "Mon 16",
      "Tue 17",
      "Wed 18",
      "Thu 19",
      "Fri 20",
      "Sat 21",
      "Sun 22",
    ]);
    expect(screen.getByTestId("hours-week-note").textContent).toBe(
      "Your dates: Mon Nov 16 to Fri Nov 20. Sat and Sun aren't in them.",
    );
  });

  it("a day kind with no closures is striped", async () => {
    open({ block: denverBlock(denverDays("weekend_closed")), start: 9, end: 15 });
    await userEvent.setup().click(screen.getByTestId("hours-view-week"));
    const days = screen.getAllByTestId("hours-week-day");
    expect(days.map((d) => d.querySelector(".whd-closed") !== null)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
  });
});

// --- On the page: the link, the fix, Undo, and focus back --------------------

const OUTSIDE_SCHEDULE = {
  date_mode: "range" as const,
  work_date: "2026-11-16",
  work_date_end: "2026-11-20",
  start_time: 7,
  end_time: 17,
};

let latest: Scenario | null = null;

function Harness({ initial, block }: { initial: Scenario; block: JurisdictionBlock }) {
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

describe("#526 ruling 4, R145 S9: the fix and Undo on the page", () => {
  const initial = {
    ...DEFAULT_SHOULDER,
    roadType: "urban_arterial",
    divided: false,
    lanes: 1,
    jurisdiction_key: "denver",
    street_class: "collector",
    schedule: OUTSIDE_SCHEDULE,
  } as unknown as Scenario;

  it("the fix sets the page's times; Undo restores the prior times", async () => {
    const user = userEvent.setup();
    render(<Harness initial={initial} block={denverBlock(denverDays("outside"))} />);
    const prior = latest!.schedule;
    await user.click(screen.getByTestId("what-hours-all"));
    await user.click(screen.getByTestId("hours-fix"));
    expect(latest!.schedule).toEqual({ ...OUTSIDE_SCHEDULE, start_time: 8.5, end_time: 15.5 });
    // Only the two times change (the same fields a listbox writes).
    expect(Object.keys(latest!.schedule!)).toEqual(Object.keys(prior!));
    expect(screen.getByTestId("hours-fix-record").textContent).toContain("Hours changed to 8:30\u00a0am to 3:30\u00a0pm.");
    expect(screen.getByTestId("what-hours-record").textContent).toBe("Hours changed to 8:30\u00a0am to 3:30\u00a0pm.Undo");
    await user.click(screen.getByTestId("hours-fix-undo"));
    expect(latest!.schedule).toStrictEqual(prior);
    expect(latest!.schedule).toStrictEqual(OUTSIDE_SCHEDULE);
    expect(screen.queryByTestId("hours-fix-record")).toBeNull();
    expect(screen.queryByTestId("what-hours-record")).toBeNull();
  });

  it("the row's Undo does the same once the dialog is closed", async () => {
    const user = userEvent.setup();
    render(<Harness initial={initial} block={denverBlock(denverDays("outside"))} />);
    const prior = latest!.schedule;
    await user.click(screen.getByTestId("what-hours-all"));
    await user.click(screen.getByTestId("hours-fix"));
    await user.click(screen.getByTestId("hours-dialog-close"));
    await user.click(screen.getByTestId("what-hours-undo"));
    expect(latest!.schedule).toStrictEqual(prior);
  });

  it("closing the dialog returns focus to the link (Close and Esc)", async () => {
    const user = userEvent.setup();
    render(<Harness initial={initial} block={denverBlock(denverDays("outside"))} />);
    const link = screen.getByTestId("what-hours-all");
    await user.click(link);
    expect(screen.getByTestId("hours-dialog").contains(document.activeElement)).toBe(true);
    await user.click(screen.getByTestId("hours-dialog-close"));
    expect(screen.queryByTestId("hours-dialog")).toBeNull();
    expect(document.activeElement).toBe(link);
    await user.click(link);
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("hours-dialog")).toBeNull();
    expect(document.activeElement).toBe(link);
  });
});

// --- Round 2 ------------------------------------------------------------------

describe("#526 round 2 (R145 S10, Rule 10): no window on record is drawn as absence", () => {
  it("weekdays with no record: the verdict says so, with no band, no mark and no fix", () => {
    open({ block: denverBlock(denverDays("no_record")), start: 9, end: 15 });
    expect(screen.getByTestId("hours-verdict").textContent).toBe(
      "We don't have Denver's weekday hours for this street class.",
    );
    expect(screen.getByTestId("hours-ruler").querySelector(".whd-band")).toBeNull();
    expect(screen.getByTestId("hours-ruler").querySelector(".whd-cap")).toBeNull();
    expect(screen.queryByTestId("hours-fix")).toBeNull();
    expect(screen.getByTestId("hours-weekend").textContent).toBe(
      "Weekends: none on record. Your dates include Nov 21 and 22.",
    );
  });

  it("the whole week: no-record days are empty dashed columns labelled 'No record', never Allowed bands", async () => {
    open({ block: denverBlock(denverDays("partial")), start: 9, end: 15 });
    expect(screen.queryByTestId("hours-key-no-record")).toBeNull();
    await userEvent.setup().click(screen.getByTestId("hours-view-week"));
    const days = screen.getAllByTestId("hours-week-day");
    expect(days.map((d) => d.getAttribute("data-record"))).toEqual([
      "windows",
      "windows",
      "windows",
      "windows",
      "windows",
      "none",
      "none",
    ]);
    for (const d of days.slice(5)) {
      expect(d.classList.contains("is-none")).toBe(true);
      expect(d.querySelector(".whd-band")).toBeNull();
      expect(d.querySelector(".sr-only")?.textContent).toBe("No hours on record.");
    }
    expect(days[0].querySelector(".whd-band")).not.toBeNull();
    // Round 3 (#531, S23): one caption spans Sat-Sun (grid columns 7 to 9),
    // under the columns, not one per day.
    const caps = screen.getAllByTestId("hours-week-no-record");
    expect(caps.map((c) => [c.textContent, c.style.gridColumn])).toEqual([["No record", "7 / 9"]]);
    for (const d of days) expect(d.querySelector(".whd-none-label")).toBeNull();
    // The key names "No record" only when a day shows it.
    expect(screen.getByTestId("hours-key-no-record").textContent).toBe("No record");
  });

  it("no 'No record' key when every day has a record", async () => {
    open({ block: denverBlock(denverDays("weekend_closed")), start: 9, end: 15 });
    await userEvent.setup().click(screen.getByTestId("hours-view-week"));
    expect(screen.queryByTestId("hours-key-no-record")).toBeNull();
  });
});

// #555 (S9): the scale holds all 24 hours, so the states that used to clip
// (finding 7) now draw in full and no arrow renders.
describe("#526 round 2 (finding 7), after #555: hours that used to be clipped draw in full, with no arrows", () => {
  const outsideBlock = (outside: [number, number][]) => {
    const d = denverDays("outside");
    return denverBlock({ ...d, kinds: { ...d.kinds, weekday: { ...d.kinds.weekday, outside } } });
  };
  it("the ruler: hours past both ends, both outside", () => {
    open({
      block: outsideBlock([
        [4, 8.5],
        [15.5, 22],
      ]),
      start: 4,
      end: 22,
    });
    expect(screen.queryByTestId("hours-clip-left")).toBeNull();
    expect(screen.queryByTestId("hours-clip-right")).toBeNull();
    // Both outside spans are on the ruler whole: 3:30 to 10 pm, and 4 to
    // 8:30 am cut at 6 am (6 to 8:30 at the start, 4 to 6 at the end).
    expect(spans(screen.getByTestId("hours-ruler"), ".whd-yours.is-out", "left", "width")).toEqual([
      ["0.00%", "10.42%"],
      ["39.58%", "27.08%"],
      ["91.67%", "8.33%"],
    ]);
  });
  it("the ruler: night work that fits draws whole, with no arrows and nothing in --dim", () => {
    open({ block: denverBlock(denverDays("inside")), start: 20, end: 5 });
    const ruler = screen.getByTestId("hours-ruler");
    expect(ruler.querySelector(".whd-clip")).toBeNull();
    expect(ruler.querySelector(".whd-yours.is-out")).toBeNull();
  });
  it("the whole week: no day carries an arrow", async () => {
    open({ block: outsideBlock([[4, 8.5]]), start: 4, end: 22 });
    await userEvent.setup().click(screen.getByTestId("hours-view-week"));
    for (const d of screen.getAllByTestId("hours-week-day")) expect(d.querySelector(".whd-clip")).toBeNull();
    // The outside span is the backend's, on the in-job days only.
    const days = screen.getAllByTestId("hours-week-day");
    expect(spans(days[0], ".whd-yours.is-out", "top", "height")).toEqual([
      ["0.00%", "10.42%"],
      ["91.67%", "8.33%"],
    ]);
    expect(days[5].querySelector(".whd-yours")).toBeNull();
  });
});

describe("#526 round 2 (finding 3): inputs changed while the window is closed", () => {
  const base = {
    ...DEFAULT_SHOULDER,
    roadType: "urban_arterial",
    divided: false,
    lanes: 1,
    jurisdiction_key: "denver",
    street_class: "collector",
    schedule: OUTSIDE_SCHEDULE,
  } as unknown as Scenario;
  const band = (scenario: Scenario, block: JurisdictionBlock, verifying = false) => (
    <WhatBand
      scenario={scenario}
      setScenario={() => {}}
      setMeta={() => {}}
      jurisdictionBlock={block}
      jurisdictionLoading={false}
      jurisdictionErrored={false}
      stepIndex="STEP 2 OF 4"
      windowsLine={windowsSummary({ scenario, jurisdiction: block, verifying })}
      hoursVerifying={verifying}
    />
  );

  it("a new street class and jurisdiction: the window opens on the new block's values", async () => {
    const user = userEvent.setup();
    const { rerender } = render(band(base, denverBlock(denverDays("outside"))));
    await user.click(screen.getByTestId("what-hours-all"));
    expect(screen.getByTestId("hours-verdict").textContent).toBe(
      "Your hours go outside what Denver allows on weekdays.",
    );
    await user.click(screen.getByTestId("hours-dialog-close"));
    // Closed: the street class and the jurisdiction change, and the shell's
    // refetch answers with the new block (GeneratorShell's breakdown).
    const next = {
      ...base,
      jurisdiction_key: "englewood",
      street_class: "arterial",
      schedule: { ...OUTSIDE_SCHEDULE, start_time: 9, end_time: 15 },
    } as Scenario;
    rerender(band(next, denverBlock(denverDays("inside"), undefined, "Englewood")));
    await user.click(screen.getByTestId("what-hours-all"));
    const dialog = screen.getByTestId("hours-dialog");
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe(
      "Englewood's work hours",
    );
    expect(screen.getByTestId("hours-dialog-sub").textContent).toBe(
      "When you can close a lane on an arterial street. Your hours: 9\u00a0am to 3\u00a0pm.",
    );
    expect(screen.getByTestId("hours-verdict").textContent).toBe("✓Your hours fit on weekdays.");
  });

  it("while the refetch is in flight the verdict reads checking (#152 D)", async () => {
    const user = userEvent.setup();
    render(band(base, denverBlock(denverDays("outside")), true));
    await user.click(screen.getByTestId("what-hours-all"));
    expect(screen.getByTestId("hours-dialog").textContent).toContain(
      "Checking your dates against Denver's work hours.",
    );
    expect(screen.queryByTestId("hours-verdict")).toBeNull();
  });
});

describe("#526 round 2 (finding 8): the hours row reserves the record's line", () => {
  it("the slot is there before the fix, holds the record after it, and stays after Undo", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={
          {
            ...DEFAULT_SHOULDER,
            roadType: "urban_arterial",
            divided: false,
            lanes: 1,
            jurisdiction_key: "denver",
            street_class: "collector",
            schedule: OUTSIDE_SCHEDULE,
          } as unknown as Scenario
        }
        block={denverBlock(denverDays("outside"))}
      />,
    );
    const slot = screen.getByTestId("what-hours-slot");
    expect(slot.textContent).toBe("");
    await user.click(screen.getByTestId("what-hours-all"));
    await user.click(screen.getByTestId("hours-fix"));
    await user.click(screen.getByTestId("hours-dialog-close"));
    expect(screen.getByTestId("what-hours-slot")).toBe(slot);
    expect(slot.textContent).toBe("Hours changed to 8:30\u00a0am to 3:30\u00a0pm.Undo");
    await user.click(screen.getByTestId("what-hours-undo"));
    expect(screen.getByTestId("what-hours-slot")).toBe(slot);
    expect(slot.textContent).toBe("");
  });

  it("the reserve is the Undo's 44 px target (globals.css)", () => {
    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");
    expect(css).toMatch(/\.workbench \.w-hours-slot \{[^}]*min-height: 44px;/);
  });
});

// --- Round 3 (#531, #532) -----------------------------------------------------

describe("#531 round 3: the week view at 390 and Rule 10/13", () => {
  it("S23: no-record days group into runs, one caption each", () => {
    expect(noRecordRuns([false, false, false, false, false, true, true])).toEqual([[5, 6]]);
    expect(noRecordRuns([true, true, true, true, true, false, false])).toEqual([[0, 4]]);
    expect(noRecordRuns(Array(7).fill(true))).toEqual([[0, 6]]);
    expect(noRecordRuns(Array(7).fill(false))).toEqual([]);
  });

  it("S23: the caption row is reserved in every week, and no caption is narrower than two columns", () => {
    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");
    expect(css).toMatch(/\.workbench \.whd-week \{[^}]*grid-template-rows: auto minmax\(32px, auto\);/);
    expect(css).not.toMatch(/word-spacing: 100vw/);
  });

  it("S24: on a no-record day your hours are a hollow bar, never the inside ink (week and day view)", async () => {
    open({ block: denverBlock(denverDays("partial")), start: 9, end: 15 });
    await userEvent.setup().click(screen.getByTestId("hours-view-week"));
    const days = screen.getAllByTestId("hours-week-day");
    const yours = (d: HTMLElement) => [...d.querySelectorAll(".whd-yours:not(.is-out)")];
    const inJobNone = days.filter((d) => d.getAttribute("data-record") === "none" && d.hasAttribute("data-in-job"));
    expect(inJobNone.length).toBeGreaterThan(0);
    for (const d of inJobNone) {
      expect(yours(d).length).toBeGreaterThan(0);
      for (const y of yours(d)) expect(y.classList.contains("is-unchecked")).toBe(true);
    }
    for (const d of days.filter((d) => d.getAttribute("data-record") === "windows"))
      for (const y of yours(d)) expect(y.classList.contains("is-unchecked")).toBe(false);
  });

  it("S25: an outside day's screen-reader text says Outside, with the spans", async () => {
    open();
    await userEvent.setup().click(screen.getByTestId("hours-view-week"));
    const days = screen.getAllByTestId("hours-week-day");
    const sr = days.map((d) => d.querySelector(".sr-only")?.textContent ?? "");
    const inJob = days.map((d) => d.hasAttribute("data-in-job"));
    expect(sr.some((t, i) => inJob[i] && /Outside: \d/.test(t))).toBe(true);
    // Days not in the job never claim Outside.
    sr.forEach((t, i) => {
      if (!inJob[i]) expect(t).not.toMatch(/Outside/);
    });
  });

  it("S26: a time never breaks between the number and am/pm", async () => {
    open();
    const sub = screen.getByTestId("hours-dialog-sub").textContent ?? "";
    expect(sub).toMatch(/\d\u00a0(am|pm)/);
    expect(sub).not.toMatch(/\d (am|pm)/);
  });
});

describe("#532 P15 (Ryan, 2026-11-12): the Undo record stays until Undo or a pin move", () => {
  const initial = {
    ...DEFAULT_SHOULDER,
    roadType: "urban_arterial",
    divided: false,
    lanes: 1,
    jurisdiction_key: "denver",
    street_class: "collector",
    schedule: OUTSIDE_SCHEDULE,
  } as unknown as Scenario;
  let setOuter: ((s: Scenario) => void) | null = null;
  function Outer({ block }: { block: JurisdictionBlock }) {
    const [scenario, setScenario] = useState(initial);
    latest = scenario;
    setOuter = setScenario;
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

  it("a hand edit of the times keeps the record; Undo still restores the prior times", async () => {
    const user = userEvent.setup();
    render(<Outer block={denverBlock(denverDays("outside"))} />);
    const prior = latest!.schedule;
    await user.click(screen.getByTestId("what-hours-all"));
    await user.click(screen.getByTestId("hours-fix"));
    await user.click(screen.getByTestId("hours-dialog-close"));
    act(() => setOuter!({ ...latest!, schedule: { ...latest!.schedule!, start_time: 9 } }));
    expect(screen.getByTestId("what-hours-record").textContent).toBe(
      "Hours changed to 8:30\u00a0am to 3:30\u00a0pm.Undo",
    );
    await user.click(screen.getByTestId("what-hours-undo"));
    expect(latest!.schedule).toStrictEqual(prior);
    expect(screen.queryByTestId("what-hours-record")).toBeNull();
  });

  it("a pin move clears the record, and it doesn't come back if the pin returns", async () => {
    const user = userEvent.setup();
    render(<Outer block={denverBlock(denverDays("outside"))} />);
    await user.click(screen.getByTestId("what-hours-all"));
    await user.click(screen.getByTestId("hours-fix"));
    await user.click(screen.getByTestId("hours-dialog-close"));
    const meta = latest!.meta;
    act(() => setOuter!({ ...latest!, meta: { ...meta, lat: meta.lat + 0.01 } }));
    expect(screen.queryByTestId("what-hours-record")).toBeNull();
    act(() => setOuter!({ ...latest!, meta }));
    expect(screen.queryByTestId("what-hours-record")).toBeNull();
  });

  it("#535: Undo restores only the times; a date change made after the fix stays", async () => {
    const user = userEvent.setup();
    render(<Outer block={denverBlock(denverDays("outside"))} />);
    await user.click(screen.getByTestId("what-hours-all"));
    await user.click(screen.getByTestId("hours-fix"));
    await user.click(screen.getByTestId("hours-dialog-close"));
    act(() =>
      setOuter!({
        ...latest!,
        schedule: { ...latest!.schedule!, work_date: "2026-11-23", work_date_end: "2026-11-27" },
      }),
    );
    await user.click(screen.getByTestId("what-hours-undo"));
    expect(latest!.schedule).toStrictEqual({
      ...OUTSIDE_SCHEDULE,
      work_date: "2026-11-23",
      work_date_end: "2026-11-27",
    });
    expect(screen.queryByTestId("what-hours-record")).toBeNull();
  });

  it("#535: the fix comes back while the record stands when the hours are outside again", async () => {
    const user = userEvent.setup();
    render(<Outer block={denverBlock(denverDays("outside"))} />);
    await user.click(screen.getByTestId("what-hours-all"));
    await user.click(screen.getByTestId("hours-fix"));
    // The block still reads outside (a hand edit back out): record and fix both show.
    act(() => setOuter!({ ...latest!, schedule: { ...latest!.schedule!, start_time: 6 } }));
    expect(screen.getByTestId("hours-fix-record").textContent).toBe(
      "Hours changed to 8:30 am to 3:30 pm.Undo",
    );
    const again = screen.getByTestId("hours-fix");
    expect(again.textContent).toBe("Change my hours to 8:30 am to 3:30 pm");
    // R145 self-ruled (#535 S1): a second fix replaces the record, and its
    // Undo puts back the times that fix changed (the hand-edited ones).
    await user.click(again);
    expect(latest!.schedule).toStrictEqual({ ...OUTSIDE_SCHEDULE, start_time: 8.5, end_time: 15.5 });
    await user.click(screen.getByTestId("hours-fix-undo"));
    expect(latest!.schedule).toStrictEqual({ ...OUTSIDE_SCHEDULE, start_time: 6, end_time: 15.5 });
    expect(screen.queryByTestId("hours-fix-record")).toBeNull();
  });
});

describe("#535 (Ryan, 2026-11-12): the fix and the record together in the window", () => {
  it("the record stands and the hours are outside: the record, Undo and the fix button all show", async () => {
    const { onFix, onUndo } = open({ start: 6, end: 15.5, fixed: { start: 8.5, end: 15.5 } });
    expect(screen.getByTestId("hours-fix-record").textContent).toBe("Hours changed to 8:30 am to 3:30 pm.Undo");
    const user = userEvent.setup();
    await user.click(screen.getByTestId("hours-fix"));
    expect(onFix).toHaveBeenCalledWith([8.5, 15.5]);
    await user.click(screen.getByTestId("hours-fix-undo"));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});

// --- #555: the 6 am to 6 am day -----------------------------------------------

// Ryan, 2026-11-24 (docs/prompts/cc-prompt-ux-spacing-round.md, item 1):
// "Both the week view and the weekday ruler always run from 6 am to 6 am the
// next morning (24 hours), for every job.  Ticks at 6 am, noon, 6 pm,
// midnight and 6 am. 'Midnight' is set slightly stronger, with a faint
// dashed line across each day.  Allowed windows and your hours that cross
// midnight draw as one continuous band or bar.  The colors, states and the
// inside/outside split stay exactly as #526 and #535 left them."
// Positions are a share of the 24 hours from 6 am: 8 pm is 14/24 = 58.33%,
// midnight 18/24 = 75%, 5 am 23/24 = 95.83%.
describe("#555: both views run 6 am to 6 am", () => {
  const kinds = (weekday: Partial<ReturnType<typeof denverDays>["kinds"]["weekday"]>, state: "inside" | "outside" = "inside") => {
    const d = denverDays(state);
    return denverBlock({ ...d, kinds: { ...d.kinds, weekday: { ...d.kinds.weekday, ...weekday } } });
  };
  const week = async () => {
    await userEvent.setup().click(screen.getByTestId("hours-view-week"));
    return screen.getAllByTestId("hours-week-day");
  };

  it("the ruler: five ticks at 6 am, noon, 6 pm, midnight, 6 am; midnight is marked and has its line", () => {
    open({ block: denverBlock(denverDays("inside")), start: 9, end: 15 });
    const ruler = screen.getByTestId("hours-ruler");
    const ticks = [...ruler.querySelectorAll<HTMLElement>(".whd-tick")];
    expect(ticks.map((t) => [t.textContent, t.style.left])).toEqual([
      ["6\u00a0am", "0.00%"],
      ["noon", "25.00%"],
      ["6\u00a0pm", "50.00%"],
      ["midnight", "75.00%"],
      ["6\u00a0am", "100.00%"],
    ]);
    expect(ticks.map((t) => t.classList.contains("is-midnight"))).toEqual([false, false, false, true, false]);
    expect(spans(ruler, ".whd-track .whd-midnight", "left", "width")).toEqual([["75.00%", ""]]);
  });

  it("the whole week: the same five ticks, and a midnight line in every day", async () => {
    open({ block: denverBlock(denverDays("inside")), start: 9, end: 15 });
    const days = await week();
    const ticks = [...screen.getByTestId("hours-week").querySelectorAll<HTMLElement>(".whd-vticks span")];
    expect(ticks.map((t) => [t.textContent, t.style.top])).toEqual([
      ["6\u00a0am", "0.00%"],
      ["noon", "25.00%"],
      ["6\u00a0pm", "50.00%"],
      ["midnight", "75.00%"],
      ["6\u00a0am", "100.00%"],
    ]);
    expect(ticks.map((t) => t.classList.contains("is-midnight"))).toEqual([false, false, false, true, false]);
    for (const d of days) expect(spans(d, ".whd-col .whd-midnight.is-v", "top", "height")).toEqual([["75.00%", ""]]);
  });

  it("the ruler, 8 pm to 5 am: one unbroken bar, and Denver's night window is one band with both ends labelled", () => {
    open({ block: denverBlock(denverDays("inside")), start: 20, end: 5 });
    const ruler = screen.getByTestId("hours-ruler");
    expect(spans(ruler, ".whd-yours", "left", "width")).toEqual([["58.33%", "37.50%"]]);
    // The backend's allowed spans are 0-5, 8:30-15:30 and 20-24: two bands.
    expect(spans(ruler, ".whd-band", "left", "width")).toEqual([
      ["10.42%", "29.17%"],
      ["58.33%", "37.50%"],
    ]);
    expect([...ruler.querySelectorAll(".whd-cap")].map((c) => c.textContent)).toEqual([
      "8:30\u00a0am",
      "3:30\u00a0pm",
      "8\u00a0pm",
      "5\u00a0am",
    ]);
  });

  it("the whole week, 8 pm to 5 am: one unbroken bar on every day in the job, one night band on every weekday", async () => {
    open({ block: denverBlock(denverDays("inside")), start: 20, end: 5 });
    const days = await week();
    for (const d of days.slice(0, 5)) {
      expect(spans(d, ".whd-yours", "top", "height")).toEqual([["58.33%", "37.50%"]]);
      expect(spans(d, ".whd-band", "top", "height")).toEqual([
        ["10.42%", "29.17%"],
        ["58.33%", "37.50%"],
      ]);
    }
    // Sat and Sun are outside these dates: no hours drawn.
    for (const d of days.slice(5)) expect(d.querySelector(".whd-yours")).toBeNull();
  });

  it("a day shift, 9 am to 3 pm: one bar in both views", async () => {
    open({ block: denverBlock(denverDays("inside")), start: 9, end: 15 });
    expect(spans(screen.getByTestId("hours-ruler"), ".whd-yours", "left", "width")).toEqual([["12.50%", "25.00%"]]);
    const days = await week();
    expect(spans(days[0], ".whd-yours", "top", "height")).toEqual([["12.50%", "25.00%"]]);
  });

  it("the inside/outside split is the backend's, unchanged: 7 am to 5 pm against 8:30 to 3:30", async () => {
    open();
    const want = {
      yours: [["4.17%", "41.67%"]],
      out: [
        ["4.17%", "6.25%"],
        ["39.58%", "6.25%"],
      ],
    };
    const ruler = screen.getByTestId("hours-ruler");
    expect(spans(ruler, ".whd-yours:not(.is-out)", "left", "width")).toEqual(want.yours);
    expect(spans(ruler, ".whd-yours.is-out", "left", "width")).toEqual(want.out);
    const days = await week();
    expect(spans(days[0], ".whd-yours:not(.is-out)", "top", "height")).toEqual(want.yours);
    expect(spans(days[0], ".whd-yours.is-out", "top", "height")).toEqual(want.out);
  });

  it("an outside span that crosses midnight is one --dim piece (the backend's 22-24 and 0-2)", () => {
    open({
      block: kinds(
        {
          allowed: [[8.5, 15.5]],
          outside: [
            [0, 2],
            [22, 24],
          ],
        },
        "outside",
      ),
      start: 22,
      end: 2,
    });
    const ruler = screen.getByTestId("hours-ruler");
    expect(spans(ruler, ".whd-yours:not(.is-out)", "left", "width")).toEqual([["66.67%", "16.67%"]]);
    expect(spans(ruler, ".whd-yours.is-out", "left", "width")).toEqual([["66.67%", "16.67%"]]);
  });

  it("the 6 am edge (S2): 8 pm to 6 am is one bar to the last tick; 4 am to 2 pm is cut at 6 am, both pieces on its own day", async () => {
    open({ block: denverBlock(denverDays("inside")), start: 20, end: 6 });
    expect(spans(screen.getByTestId("hours-ruler"), ".whd-yours", "left", "width")).toEqual([["58.33%", "41.67%"]]);
    cleanup();
    open({ block: denverBlock(denverDays("inside")), start: 4, end: 14 });
    expect(spans(screen.getByTestId("hours-ruler"), ".whd-yours", "left", "width")).toEqual([
      ["0.00%", "33.33%"],
      ["91.67%", "8.33%"],
    ]);
    const days = await week();
    // Monday's column carries both pieces; no other day gains one.
    expect(days.map((d) => d.querySelectorAll(".whd-yours").length)).toEqual([2, 2, 2, 2, 2, 0, 0]);
  });

  it("S4: an end made by the 6 am cut takes no label (an all-day window, and one that starts before 6 am)", () => {
    open({ block: kinds({ allowed: [[0, 24]] }), start: 9, end: 15 });
    const ruler = screen.getByTestId("hours-ruler");
    expect(spans(ruler, ".whd-band", "left", "width")).toEqual([["0.00%", "100.00%"]]);
    expect(ruler.querySelector(".whd-cap")).toBeNull();
    cleanup();
    // Lakewood's shape: bans 7-9 and 15:30-18 leave 0-7, 9-15:30 and 18-24.
    open({
      block: kinds({
        allowed: [
          [0, 7],
          [9, 15.5],
          [18, 24],
        ],
      }),
      start: 9,
      end: 15,
    });
    const r2 = screen.getByTestId("hours-ruler");
    expect(spans(r2, ".whd-band", "left", "width")).toEqual([
      ["0.00%", "4.17%"],
      ["12.50%", "27.08%"],
      ["50.00%", "50.00%"],
    ]);
    expect([...r2.querySelectorAll(".whd-cap")].map((c) => c.textContent)).toEqual([
      "7\u00a0am",
      "9\u00a0am",
      "3:30\u00a0pm",
      "6\u00a0pm",
    ]);
  });

  it("S11: a start label less than 4 hours after the window before it is set from its start; Denver's don't move", () => {
    const near = () =>
      [...screen.getByTestId("hours-ruler").querySelectorAll(".whd-cap")].map((c) => [
        c.textContent,
        c.classList.contains("is-near"),
      ]);
    // Lakewood's shape: 7 am to 9 am is 2 hours, 3:30 pm to 6 pm is 2.5.
    open({
      block: kinds({
        allowed: [
          [0, 7],
          [9, 15.5],
          [18, 24],
        ],
      }),
      start: 9,
      end: 15,
    });
    expect(near()).toEqual([
      ["7 am", false],
      ["9 am", true],
      ["3:30 pm", false],
      ["6 pm", true],
    ]);
    cleanup();
    // Denver: 3:30 pm to 8 pm is 4.5 hours.
    open({ block: denverBlock(denverDays("inside")), start: 9, end: 15 });
    expect(near().map(([, n]) => n)).toEqual([false, false, false, false]);
    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");
    expect(css).toMatch(/\.workbench \.whd-cap\.is-near \{\s*transform: none;/);
  });

  it("the sizes hold: a 28 px track and 240 px columns (globals.css)", () => {
    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");
    expect(css).toMatch(/\.workbench \.whd-track \{[^}]*height: 28px;/);
    expect(css).toMatch(/\.workbench \.whd-day \{[^}]*grid-template-rows: 34px 240px;/);
    expect(css).toMatch(/\.workbench \.whd-vticks \{[^}]*height: 240px;/);
    expect(css).toMatch(/\.workbench \.whd-midnight \{[^}]*border-left: 1px dashed var\(--ink-faint\);/);
  });
});

// #556 (Ryan, 2026-11-24, item 2): "The key gains 'No closures allowed', with
// a small striped swatch matching the striped days.  It shows only when the
// week has a no-closures day."  "When no street class is set, your hours
// draw as a dashed outline (not checked yet), not the solid 'inside' ink.  A
// notice at the top of the chart reads 'Pick a street class on the page and
// we'll check your hours against it.'"  "At 390, the week note under the
// chart must never be cut off."
describe("#556: the no-closures key, hours with no street class, the week note", () => {
  const NOTICE = "Pick a street class on the page and we'll check your hours against it.";
  const css = () => readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");
  const toWeek = async () => {
    await userEvent.setup().click(screen.getByTestId("hours-view-week"));
    return screen.getAllByTestId("hours-week-day");
  };
  /** A Mon-to-Sun job with no street class: weekdays need a class, the
   *  weekend has no record (the backend's answer for Denver). */
  const classUnset = (lastDay: 20 | 22 = 22) => {
    const d = denverDays("street_class");
    const full = denverDays("partial").job;
    return denverBlock(lastDay === 22 ? { ...d, job: full } : d);
  };

  it("a: the key names the stripes, with a striped swatch, in a week with a no-closures day", async () => {
    open({ block: denverBlock(denverDays("weekend_closed")), start: 9, end: 15 });
    // The weekday view draws no stripes, so its key has no entry for them.
    expect(screen.queryByTestId("hours-key-no-closures")).toBeNull();
    const days = await toWeek();
    expect(days.filter((d) => d.querySelector(".whd-closed")).length).toBe(2);
    const key = screen.getByTestId("hours-key-no-closures");
    expect(key.textContent).toBe("No closures allowed");
    const swatch = key.querySelector(".whd-key.is-closed");
    expect(swatch).not.toBeNull();
    expect(swatch?.getAttribute("aria-hidden")).toBe("true");
    // It is in the key's list, after the entries that were there.
    const items = [...screen.getByLabelText("Key").querySelectorAll("li")].map((li) => li.textContent);
    expect(items).toEqual(["Allowed", "Your hours", "Outside what's allowed", "No closures allowed"]);
  });

  it("a: no entry in a week with no no-closures day", async () => {
    open({ block: denverBlock(denverDays("partial")), start: 9, end: 15 });
    const days = await toWeek();
    expect(days.some((d) => d.querySelector(".whd-closed"))).toBe(false);
    expect(screen.queryByTestId("hours-key-no-closures")).toBeNull();
    expect(screen.getByTestId("hours-key-no-record")).not.toBeNull();
  });

  it("a: the swatch is the days' stripes: the same two tokens at the same angle (globals.css)", () => {
    const stripes = (rule: string) => {
      const m = new RegExp(`\\.workbench \\.${rule} \\{[^}]*\\}`).exec(css())?.[0] ?? "";
      return [/repeating-linear-gradient\(\s*(\d+deg)/.exec(m)?.[1], ...[...m.matchAll(/var\((--[a-z-]+)\) \d/g)].map((x) => x[1])];
    };
    expect(stripes("whd-closed")).toEqual(["135deg", "--da-ground", "--pri-off"]);
    expect(stripes("whd-key\\.is-closed")).toEqual(stripes("whd-closed"));
  });

  it("b: the weekday view with no street class: the notice on top, a hollow bar, no inside or outside ink", () => {
    open({ block: classUnset(), start: 9, end: 14 });
    const body = screen.getByRole("region", { name: "A weekday" });
    const notice = screen.getByTestId("hours-class-notice");
    expect(notice.textContent).toBe(NOTICE);
    // At the top of the chart: the body's first line, above the ruler.
    expect(body.firstElementChild).toBe(notice);
    expect(notice.compareDocumentPosition(screen.getByTestId("hours-ruler")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(body.textContent).not.toContain("to see its hours here");
    const ruler = screen.getByTestId("hours-ruler");
    const yours = [...ruler.querySelectorAll(".whd-yours")];
    expect(spans(ruler, ".whd-yours", "left", "width")).toEqual([["12.50%", "20.83%"]]);
    for (const y of yours) expect(y.classList.contains("is-unchecked")).toBe(true);
    expect(ruler.querySelector(".whd-yours.is-out")).toBeNull();
    expect(ruler.querySelector(".whd-band")).toBeNull();
    expect(screen.queryByTestId("hours-verdict")).toBeNull();
    expect(screen.queryByTestId("hours-fix")).toBeNull();
  });

  it("b: the whole week with no street class: the notice on top, every bar hollow, no inside or outside ink", async () => {
    open({ block: classUnset(), start: 9, end: 14 });
    const days = await toWeek();
    const body = screen.getByRole("region", { name: "The whole week" });
    const notice = screen.getByTestId("hours-class-notice");
    expect(notice.textContent).toBe(NOTICE);
    expect(body.firstElementChild).toBe(notice);
    expect(notice.compareDocumentPosition(screen.getByTestId("hours-week")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(days.map((d) => d.querySelectorAll(".whd-yours").length)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    for (const d of days) {
      for (const y of d.querySelectorAll(".whd-yours")) expect(y.classList.contains("is-unchecked")).toBe(true);
      expect(d.querySelector(".whd-yours.is-out")).toBeNull();
    }
    // The days still say why in words (unchanged).
    expect(days.map((d) => d.querySelector(".sr-only")?.textContent)).toEqual([
      ...Array(5).fill("Needs a street class."),
      "No hours on record.",
      "No hours on record.",
    ]);
  });

  it("b: with a street class there is no notice, and checked hours keep the inside and outside ink", async () => {
    open();
    expect(screen.queryByTestId("hours-class-notice")).toBeNull();
    expect(screen.getByTestId("hours-ruler").querySelector(".whd-yours.is-unchecked")).toBeNull();
    expect(screen.getByTestId("hours-ruler").querySelectorAll(".whd-yours.is-out").length).toBe(2);
    const days = await toWeek();
    expect(screen.queryByTestId("hours-class-notice")).toBeNull();
    for (const d of days) expect(d.querySelector(".whd-yours.is-unchecked")).toBeNull();
  });

  it("b: the hollow bar is dashed and unfilled, so it differs by shape (globals.css)", () => {
    expect(css()).toMatch(
      /\.workbench \.whd-yours\.is-unchecked \{\s*background: transparent;\s*border: 1px dashed var\(--ink-faint\);\s*\}/,
    );
  });

  it("c: the week note, part of a week and the whole week", async () => {
    open();
    await toWeek();
    expect(screen.getByTestId("hours-week-note").textContent).toBe(
      "Your dates: Mon Nov 16 to Fri Nov 20. Sat and Sun aren't in them.",
    );
    cleanup();
    open({ block: denverBlock(denverDays("partial")), start: 9, end: 15 });
    await toWeek();
    expect(screen.getByTestId("hours-week-note").textContent).toBe(
      "Your dates: Mon Nov 16 to Sun Nov 22, the whole week.",
    );
  });

  it("c: the note is the last line of a body that scrolls and stays at its bottom edge; the window is taller at 600 px wide and under (globals.css)", async () => {
    open();
    await toWeek();
    const body = screen.getByRole("region", { name: "The whole week" });
    expect(body.lastElementChild).toBe(screen.getByTestId("hours-week-note"));
    // S12: the note is a direct child of the scrolling body and sticks to
    // its bottom, on the window's ground.  The walk measures the result.
    expect(screen.getByTestId("hours-week-note").classList.contains("whd-note")).toBe(true);
    expect(css()).toMatch(
      /\.workbench \.whd-note \{\s*position: sticky;\s*bottom: 0;\s*z-index: 1;\s*background: var\(--da-ground\);\s*\}/,
    );
    expect(body.getAttribute("tabindex")).toBe("0");
    expect(css()).toMatch(/\.workbench \.whd-body \{\s*overflow-y: auto;/);
    expect(css()).toMatch(/\.workbench \.whd \{[^}]*height: min\(600px, calc\(100vh - 32px\)\);/);
    expect(css()).toMatch(
      /@media \(max-width: 600px\) \{\s*\.workbench \.whd \{\s*height: min\(640px, calc\(100vh - 32px\)\);\s*\}\s*\}/,
    );
  });
});
