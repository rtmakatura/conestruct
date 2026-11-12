// #517 — test helpers for the rebuilt What section (rulings 1, 5, 7; S5,
// S8, S10).  The suites that read the old markers ("✓ measured",
// "default", "⚠ from the road"), the old full lines under them, or drove
// the native date inputs use these.
//
//   sourceWord(id)  the field's source line ("Measured from the map",
//                   "Our guess. Check it.", "Default", "Not set yet",
//                   "Set by you", "Checked"), or the guess's reason line in
//                   the box: the old marker's successor.
//   whyTip(id)      the why tip's lines, first the plain-words reason: the
//                   old full line's successor.
//   openMeasured()  / openFiles(): press "Change" / "Show" when closed.
//   pickDates(start, end?)  drive the DateRangePicker as a person does.

import { act, fireEvent } from "@testing-library/react";
import type { DayKindEval, HoursDays, HoursEval, JurisdictionBlock } from "@/lib/jurisdiction";

/** The source line's words for a WhyCell (`prov-<id>`). */
export function sourceWord(id: string): string {
  const el = document.querySelector(`[data-testid="prov-${id}"]`);
  if (!el) throw new Error(`no source line for ${id}`);
  return (el.textContent ?? "").trim();
}

/** The source line's kind (`data-source` on the why button). */
export function sourceKind(id: string): string | null {
  return document.querySelector(`[data-testid="info-toggle-${id}"]`)?.getAttribute("data-source") ?? null;
}

/** The why tip's lines (rendered even while the tip is closed). */
export function whyTip(id: string): string[] {
  const tip = document.querySelector(`[data-testid="info-${id}"]`);
  if (!tip) throw new Error(`no why tip for ${id}`);
  return Array.from(tip.querySelectorAll(".w-tip-line")).map((e) => (e.textContent ?? "").trim());
}

function openRow(testid: string): void {
  const t = document.querySelector(`[data-testid="${testid}-toggle"]`);
  if (!t) throw new Error(`no ${testid} row on screen`);
  if (t.getAttribute("aria-expanded") === "false") {
    act(() => {
      fireEvent.click(t);
    });
  }
}

/** "Measured from the map": press Change when it is closed. */
export function openMeasured(): void {
  openRow("what-measured");
}

/** "File details (optional)": press Show when it is closed. */
export function openFiles(): void {
  openRow("what-files");
}

/** The measured row's one line ("30 mph · 2 lanes each way · ..."). */
export function measuredLine(): string {
  return (document.querySelector('[data-testid="what-measured-line"]')?.textContent ?? "").trim();
}

/** The measured row's closed-state ⚠ lines (S5). */
export function measuredChecks(): string[] {
  return Array.from(document.querySelectorAll('[data-testid="what-measured-check"]')).map((e) =>
    (e.textContent ?? "").trim(),
  );
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dialog(id: string): HTMLElement {
  const d = document.querySelector<HTMLElement>(`#${id}-month`)?.closest('[role="dialog"]');
  if (!d) throw new Error(`date picker #${id} did not open`);
  return d as HTMLElement;
}

function clickDay(id: string, day: string): void {
  const want = Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1;
  for (let guard = 0; guard < 600; guard++) {
    const head = document.getElementById(`${id}-month`)?.textContent ?? "";
    const [name, year] = head.split(" ");
    const at = Number(year) * 12 + MONTHS.indexOf(name);
    if (at === want) break;
    const nav = dialog(id).querySelector<HTMLButtonElement>(
      `button[aria-label="${at < want ? "Next month" : "Previous month"}"]`,
    );
    act(() => {
      fireEvent.click(nav!);
    });
  }
  const btn = dialog(id).querySelector<HTMLButtonElement>(`button[data-date="${day}"]`);
  if (!btn) throw new Error(`date picker #${id} has no day ${day}`);
  act(() => {
    fireEvent.click(btn);
  });
}

/**
 * Pick work dates on the DateRangePicker (`#what-date` by default), as a
 * person does: open it, pick the first day, then the last (or the same
 * day again for a one-day job).  With a start already standing and no end,
 * `pickDates(<that start>, end)` picks only the end.
 */
export function pickDates(start: string, end?: string, id = "what-date"): void {
  const button = document.getElementById(id);
  if (!button) throw new Error(`no date button #${id} on screen`);
  if (button.getAttribute("aria-expanded") !== "true") {
    act(() => {
      fireEvent.click(button);
    });
  }
  const pressed = Array.from(dialog(id).querySelectorAll('button[aria-pressed="true"]')).map((b) =>
    b.getAttribute("data-date"),
  );
  const onlyStartStands = pressed.length === 1 && pressed[0] === start;
  if (!onlyStartStands) clickDay(id, start);
  // A mocked setScenario never re-renders the picker: one write, stop.
  if (!dialog(id).querySelector(`button[data-date="${start}"][aria-pressed="true"]`)) return;
  if (end && end !== start) clickDay(id, end);
  else if (document.getElementById(`${id}-month`)) clickDay(id, start);
}

// ---------------------------------------------------------------------------
// #526: `hours_days` blocks, in the backend's own shapes.  Every value is
// what src/rules/jurisdiction.py `evaluate_hours_days` returns for the
// committed Denver record (Rule 22.3 §IV.4: weekdays 8:30 am to 3:30 pm and
// 8 pm to 5 am on arterials and collectors, weekends none on record), for
// Mon Nov 16 to Fri Nov 20 2026 (or to Sun Nov 22 with `weekend`).
// ---------------------------------------------------------------------------

export const DENVER_SRC = { doc: "Rule 22.3", section: "IV.4", date: "2022-04-22", status: "verified" as const };
const WEEKDAY_ALLOWED: [number, number][] = [
  [0, 5],
  [8.5, 15.5],
  [20, 24],
];

export function kindEval(over: Partial<DayKindEval>): DayKindEval {
  return {
    allowed: [[0, 24]],
    record: "windows",
    no_closures: false,
    status: null,
    outside: [],
    starts_before: null,
    ends_after: null,
    misses: false,
    fix: null,
    sources: [],
    ...over,
  };
}

/** A day kind with no window on record (round 2, R145 S10): the backend's
 *  spans read 0..24 and the status says "no_record". */
export const NO_RECORD: DayKindEval = kindEval({ record: "none", status: "no_record" });

function job(lastDay: number): NonNullable<HoursDays["job"]> {
  const iso = (d: number) => `2026-11-${String(d).padStart(2, "0")}`;
  const weekdays = [16, 17, 18, 19, 20].filter((d) => d <= lastDay);
  const weekend = [21, 22].filter((d) => d <= lastDay).map(iso);
  return {
    start: iso(16),
    end: iso(lastDay),
    days: lastDay - 15,
    kinds: weekend.length ? ["weekday", "weekend"] : ["weekday"],
    kind_dates: { weekday: weekdays.map(iso).slice(0, 4), weekend },
    kind_days: { weekday: weekdays.length, weekend: weekend.length },
    week: [16, 17, 18, 19, 20, 21, 22].map((d) => ({
      date: iso(d),
      day_kind: d < 21 ? "weekday" : "weekend",
      in_job: d <= lastDay,
    })),
  };
}

export type DenverState =
  | "dates"
  | "times"
  | "street_class"
  | "inside"
  | "outside"
  | "partial"
  | "no_record"
  | "weekend_closed";

/** Denver's `hours_days` for one of the line's states, as the backend
 *  returns it (Denver's weekends have no window on record: "no_record").
 *  `partial` is a Mon-to-Sun job at 9 to 15 (weekdays inside, weekends no
 *  record); `no_record` is a local street (no window on any day).
 *  `weekend_closed` is the one shape not from Denver's record (Denver has no
 *  weekend rule): the backend's no-closures weekend kind, Mon to Sun. */
export function denverDays(state: DenverState): HoursDays {
  const weekday =
    state === "no_record"
      ? NO_RECORD
      : kindEval({
          allowed: state === "street_class" ? null : WEEKDAY_ALLOWED,
          sources: state === "street_class" ? [] : [DENVER_SRC],
          ...(state === "inside" || state === "weekend_closed" || state === "partial"
            ? { status: "inside" as const }
            : {}),
          ...(state === "outside"
            ? {
                status: "outside" as const,
                outside: [
                  [7, 8.5],
                  [15.5, 17],
                ] as [number, number][],
                starts_before: 8.5,
                ends_after: 15.5,
                fix: [8.5, 15.5] as [number, number],
              }
            : {}),
        });
  const weekend =
    state === "weekend_closed"
      ? kindEval({ allowed: [], no_closures: true, status: "outside", outside: [[9, 15]] })
      : NO_RECORD;
  const status: HoursDays["status"] =
    state === "inside" || state === "outside" || state === "partial" || state === "no_record"
      ? state
      : state === "weekend_closed"
        ? "outside"
        : "unknown";
  return {
    status,
    missing: state === "dates" ? "dates" : state === "times" ? "times" : state === "street_class" ? "street_class" : null,
    holiday_rule: "none",
    kinds: { weekday, weekend },
    job:
      state === "dates"
        ? null
        : job(state === "weekend_closed" || state === "partial" || state === "no_record" ? 22 : 20),
  };
}

/** A Denver jurisdiction block carrying `days` (null: no windows on record,
 *  the backend's answer for a jurisdiction with no work hours). */
export function denverBlock(
  days: HoursDays | null,
  hoursEval: HoursEval = { status: "unknown", violations: [] },
  name = "Denver",
): JurisdictionBlock {
  const windows =
    days === null
      ? []
      : [
          { kind: "work", days: "weekday", classes: ["arterial", "collector"], start: 8.5, end: 15.5, source: DENVER_SRC },
          { kind: "work", days: "weekday", classes: ["arterial", "collector"], start: 20, end: 24, source: DENVER_SRC },
          { kind: "work", days: "weekday", classes: ["arterial", "collector"], start: 0, end: 5, source: DENVER_SRC },
        ];
  return {
    name,
    tcp_term: "traffic control plan",
    hours: { shape: days === null ? "none" : "work_window", windows, holiday_rule: "none", conflict: null },
    hours_eval: hoursEval,
    hours_days: days,
    applied_deltas: [],
    chips: { personnel: [], device: [], hazard: [] },
    conflicts: [],
    provisional: false,
  } as unknown as JurisdictionBlock;
}
