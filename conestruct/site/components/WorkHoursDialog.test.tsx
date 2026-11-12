// @vitest-environment happy-dom
//
// #526 (Ryan, 2026-11-11, item 1 ruling 4): the work-hours window.  "A real
// dialog: focus moves in, Tab stays inside, Esc and Close close it, and
// focus returns to the link."  The fix button "sets the page's start and
// end times and shows group U's Undo link (P15)"; R145 S9: Undo restores the
// schedule object exactly.  The whole week dims "days outside your dates".
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

  it("with the fix applied: the record and Undo, no fix button", async () => {
    const { onUndo } = open({ start: 8.5, end: 15.5, fixed: { start: 8.5, end: 15.5 } });
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

  it("night work past midnight (S6): clipped at both ends of the 5 am to 9 pm ruler, with arrows", () => {
    open({ block: denverBlock(denverDays("inside")), start: 20, end: 5 });
    expect(screen.getByTestId("hours-dialog-sub").textContent).toContain("Your hours: 8\u00a0pm to 5\u00a0am.");
    const ruler = screen.getByTestId("hours-ruler");
    expect(ruler.querySelector(".whd-clip.is-left")).not.toBeNull();
    expect(ruler.querySelector(".whd-clip.is-right")).not.toBeNull();
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
      "Your dates run Nov 16 to Nov 20, so the other days are greyed out.",
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

  it("the fix sets the page's times; Undo restores the exact prior schedule object", async () => {
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
    expect(latest!.schedule).toBe(prior);
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
    expect(latest!.schedule).toBe(prior);
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

describe("#526 round 2 (finding 7): clipped ends are --dim only when the clipped part is outside", () => {
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
    expect(screen.getByTestId("hours-clip-left").classList.contains("is-out")).toBe(true);
    expect(screen.getByTestId("hours-clip-right").classList.contains("is-out")).toBe(true);
  });
  it("the ruler: night work that fits is clipped in --ink-faint, never --dim", () => {
    open({ block: denverBlock(denverDays("inside")), start: 20, end: 5 });
    expect(screen.getByTestId("hours-clip-left").classList.contains("is-out")).toBe(false);
    expect(screen.getByTestId("hours-clip-right").classList.contains("is-out")).toBe(false);
  });
  it("the whole week: in-job days mark both clipped ends the same way", async () => {
    open({ block: outsideBlock([[4, 8.5]]), start: 4, end: 22 });
    await userEvent.setup().click(screen.getByTestId("hours-view-week"));
    const mon = screen.getAllByTestId("hours-week-day")[0];
    expect(mon.querySelector(".whd-clip.is-top")?.classList.contains("is-out")).toBe(true);
    expect(mon.querySelector(".whd-clip.is-bottom")?.classList.contains("is-out")).toBe(false);
    // A day outside the job carries no hours, so no marks.
    const sat = screen.getAllByTestId("hours-week-day")[5];
    expect(sat.querySelector(".whd-clip")).toBeNull();
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

  it("a hand edit of the times keeps the record; Undo still restores the prior schedule", async () => {
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
    expect(latest!.schedule).toBe(prior);
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
});

