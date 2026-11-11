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
