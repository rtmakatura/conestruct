"use client";

// #517 ruling 7 (Ryan, 2026-11-11, board D part 3): "The native 'mm / dd /
// yyyy' input becomes a 44 px button: 'Pick start and end dates' (unset) or
// 'Mon Nov 16 to Fri Nov 20' (set).  It opens a styled date picker.  Trace
// whether one exists; if none does, record what you used."  None did
// (checkpoint.md), so this is built here (S8): a month grid of 44 px day
// buttons in a labelled dialog.  The first pick is the start; the second is
// the end when it is on or after the start (the same day again is a
// one-day job); a pick before the start starts over.  "Clear" empties both.
//
// Dates are YYYY-MM-DD strings, parsed and formatted by hand
// (lib/scenarios/why-lines.ts), so no timezone shifts a day.  The writes
// go through `onPick` as the native inputs' did (`setWorkDates`).
// Esc and a click outside close; Esc returns focus to the button.

import { useEffect, useRef, useState } from "react";
import {
  MONTHS,
  dateButtonLabel,
  daysInMonth,
  longDate,
  parseYmd,
  weekday,
  ymd,
} from "@/lib/scenarios/why-lines";

const WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const WEEK_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function today(): { y: number; m: number } {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

export function DateRangePicker({
  id,
  label,
  start,
  end,
  onPick,
  disabled = false,
  describedBy,
}: {
  id: string;
  /** The field's name; the button's name is it and then the dates. */
  label: string;
  start: string;
  end: string;
  /** One write per pick, in `setWorkDates`' shape. */
  onPick: (dates: { start?: string; end?: string }) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const first = parseYmd(start) ?? null;
  const [view, setView] = useState<{ y: number; m: number }>(() =>
    first ? { y: first.y, m: first.m } : today(),
  );
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const headId = `${id}-month`;

  const openPicker = () => {
    if (disabled) return;
    const p = parseYmd(start);
    setView(p ? { y: p.y, m: p.m } : today());
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    // Focus the picked start, else the first day, so arrows/Tab start inside.
    const target =
      dialogRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ??
      dialogRef.current?.querySelector<HTMLButtonElement>("button.drp-day");
    target?.focus();
    const onDown = (e: PointerEvent | MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // close() only touches refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pickDay = (day: string) => {
    if (!start || end) {
      // First pick, or a fresh one after a full range: the start.
      onPick(end ? { start: day, end: "" } : { start: day });
      return;
    }
    if (day < start) {
      onPick({ start: day });
      return;
    }
    if (day > start) onPick({ end: day });
    // The same day again: a one-day job, nothing to write.
    close(true);
  };

  const shift = (k: 1 | -1) =>
    setView((v) => {
      const m = v.m + k;
      return m < 1 ? { y: v.y - 1, m: 12 } : m > 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m };
    });

  const lead = weekday(view.y, view.m, 1);
  const count = daysInMonth(view.y, view.m);
  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: count }, (_, i) => ymd(view.y, view.m, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const picked = (d: string) => d === start || (end !== "" && d === end);
  const between = (d: string) => Boolean(start && end && d > start && d < end);

  return (
    <div className="drp" ref={wrapRef}>
      <span id={`${id}-name`} hidden>
        {label}
      </span>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        className={`drp-btn${start ? "" : " is-unset"}`}
        data-write=""
        disabled={disabled}
        // "Work dates Mon Nov 16": the field, then what the button shows
        // (WCAG 2.5.3: the visible words stay in the name).
        aria-labelledby={`${id}-name ${id}-val`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        onClick={() => (open ? close(true) : openPicker())}
      >
        <span id={`${id}-val`}>{dateButtonLabel(start, end)}</span>
      </button>
      {open && (
        <div
          ref={dialogRef}
          className="drp-pop"
          role="dialog"
          aria-modal="false"
          aria-labelledby={headId}
          data-testid="date-picker"
        >
          <div className="drp-head">
            <button
              type="button"
              className="drp-nav"
              aria-label="Previous month"
              onClick={() => shift(-1)}
            >
              <span aria-hidden>‹</span>
            </button>
            <span id={headId} className="drp-month" aria-live="polite">
              {`${MONTHS[view.m - 1]} ${view.y}`}
            </span>
            <button
              type="button"
              className="drp-nav"
              aria-label="Next month"
              onClick={() => shift(1)}
            >
              <span aria-hidden>›</span>
            </button>
          </div>
          <table className="drp-grid" aria-labelledby={headId}>
            <thead>
              <tr>
                {WEEK.map((w, i) => (
                  <th key={w} scope="col" abbr={WEEK_NAMES[i]}>
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((wk, wi) => (
                <tr key={wi}>
                  {wk.map((d, di) => (
                    <td key={di}>
                      {d && (
                        <button
                          type="button"
                          className={`drp-day${between(d) ? " is-between" : ""}`}
                          aria-label={longDate(d)}
                          aria-pressed={picked(d)}
                          data-date={d}
                          onClick={() => pickDay(d)}
                        >
                          {Number(d.slice(8))}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="drp-foot">
            <span className="drp-hint">
              {!start || end ? "Pick the first day." : "Pick the last day, or the same day again for one day."}
            </span>
            <button
              type="button"
              className="drp-clear"
              disabled={!start}
              onClick={() => {
                onPick({ start: "", end: "" });
                close(true);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
