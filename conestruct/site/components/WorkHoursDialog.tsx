"use client";

// #526 (Ryan, 2026-11-11, item 1 ruling 4; the `Demo` board): the
// work-hours window, opened from "See <jurisdiction>'s work hours".  A real
// dialog: focus moves in, Tab stays inside, Esc and Close close it, and the
// caller returns focus to the link.  One fixed size in both views.
//
// Rule 3: every allowed span, verdict, outside span, fix window, date and
// source is the backend's `hours_days` (src/rules/jurisdiction.py
// `evaluate_hours_days`).  This file only places them on a 5 am to 9 pm
// scale (ruling 4's ruler) and words them.  Your hours are drawn from the
// page's own start and end (split at midnight to draw, as #188 stores
// them) in --ink, and the backend's outside spans are drawn over them in
// --dim: no time arithmetic decides a colour.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { DayKind, DayKindEval, HoursDays, JurisdictionBlock } from "@/lib/jurisdiction";
import {
  NO_RECORD_LABEL,
  NO_RECORD_SR,
  SET_CLASS_TO_SEE,
  SET_TIMES_TO_SEE,
  checkingDates,
  clock,
  fixButton,
  fixRecord,
  holidayLine,
  hoursSub,
  hoursTitle,
  sourceLine,
  weekNote,
  weekdayNoRecord,
  weekdayVerdict,
  weekendLine,
} from "@/lib/scenarios/why-lines";

// Ruling 4: "A ruler from 5 am to 9 pm."  The week grid uses the same scale.
const S = 5;
const E = 21;
// CHOSEN: the ruler's labelled hours (the board's).
const TICKS = [6, 9, 12, 15, 18];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const clip = (h: number) => Math.max(S, Math.min(E, h));
const pct = (h: number) => `${(((clip(h) - S) / (E - S)) * 100).toFixed(2)}%`;
const len = (a: number, b: number) =>
  `${(((clip(b) - clip(a)) / (E - S)) * 100).toFixed(2)}%`;
const shows = (a: number, b: number) => clip(b) > clip(a);

/** The page's hours as drawn spans: an end before the start runs past
 *  midnight (#188), so it draws as two pieces of the same day. */
function hourSpans(start: number, end: number): [number, number][] {
  return end > start ? [[start, end]] : [[start, 24], [0, end]];
}

/** S6 / round 2 (finding 7): the hours clipped at the scale's ends.  An
 *  arrow is --dim only when the clipped part is outside what's allowed (one
 *  of the backend's outside spans runs past that end); otherwise it only
 *  says "more this way" in --ink-faint.  No time arithmetic decides it: the
 *  outside spans are the backend's. */
function clipped(
  start: number,
  end: number,
  outside: [number, number][],
): { before: null | "out" | "in"; after: null | "out" | "in" } {
  const spans = hourSpans(start, end);
  const before = spans.some(([a]) => a < S)
    ? outside.some(([a]) => a < S)
      ? "out"
      : "in"
    : null;
  const after = spans.some(([, b]) => b > E)
    ? outside.some(([, b]) => b > E)
      ? "out"
      : "in"
    : null;
  return { before, after };
}

/** The week shown: the job's first week, or a plain Monday-to-Sunday one. */
function weekOf(days: HoursDays) {
  return (
    days.job?.week ??
    DAY_NAMES.map((_, i) => ({
      date: "",
      day_kind: (i < 5 ? "weekday" : "weekend") as DayKind,
      in_job: true,
    }))
  );
}

export interface FixRecord {
  start: number;
  end: number;
}

export function WorkHoursDialog({
  jurisdiction,
  streetClass,
  start,
  end,
  verifying,
  fixed,
  onFix,
  onUndo,
  onClose,
}: {
  jurisdiction: JurisdictionBlock;
  streetClass: string | null;
  start: number | null;
  end: number | null;
  verifying: boolean;
  /** R145 S9: the fix applied, while its times stand. */
  fixed: FixRecord | null;
  onFix: (fix: [number, number]) => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<"day" | "week">("day");
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subId = useId();
  const days = jurisdiction.hours_days ?? null;
  const name = jurisdiction.name;
  const timed = start != null && end != null;

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const f = Array.from(
        ref.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === ref.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      } else if (!ref.current.contains(at)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sources = days
    ? [...days.kinds.weekday.sources, ...days.kinds.weekend.sources].filter(
        (s, i, all) =>
          all.findIndex((o) => o.doc === s.doc && o.section === s.section) === i,
      )
    : [];
  const source = sourceLine(sources);
  // Round 2 (R145 S10): "No record" joins the key only when a day shows it.
  const noRecordShown =
    view === "week" && days !== null && weekOf(days).some((d) => days.kinds[d.day_kind].record === "none");

  return (
    <div className="whd-scrim">
      <div
        ref={ref}
        className="whd"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subId}
        tabIndex={-1}
        data-testid="hours-dialog"
      >
        <div className="whd-head">
          <div className="whd-heading">
            <h2 className="whd-title" id={titleId}>
              {hoursTitle(name)}
            </h2>
            <p className="whd-sub" id={subId} data-testid="hours-dialog-sub">
              {hoursSub(streetClass, start, end)}
            </p>
          </div>
          <button
            type="button"
            className="w-btn whd-close"
            onClick={onClose}
            data-testid="hours-dialog-close"
          >
            Close
          </button>
        </div>
        <div className="whd-switch" role="group" aria-label="Show">
          {(
            [
              ["day", "A weekday"],
              ["week", "The whole week"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              className="whd-seg"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              data-testid={`hours-view-${v}`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* The body scrolls inside the fixed size, so it takes focus to
            scroll by keyboard (axe scrollable-region-focusable), named by
            the view it shows. */}
        <div
          className="whd-body"
          role="region"
          tabIndex={0}
          aria-label={view === "day" ? "A weekday" : "The whole week"}
        >
          {!days ? null : verifying ? (
            <p className="whd-line">{checkingDates(name)}</p>
          ) : view === "day" ? (
            <Weekday
              days={days}
              name={name}
              start={start}
              end={end}
              timed={timed}
              fixed={fixed}
              onFix={onFix}
              onUndo={onUndo}
            />
          ) : (
            <Week days={days} start={start} end={end} timed={timed} />
          )}
        </div>
        <div className="whd-foot">
          <Legend noRecord={noRecordShown} />
          {source && (
            <p className="whd-source" data-testid="hours-dialog-source">
              {source}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Legend({ noRecord }: { noRecord: boolean }) {
  return (
    <ul className="whd-legend" aria-label="Key">
      <li>
        <span className="whd-key is-allowed" aria-hidden />
        Allowed
      </li>
      <li>
        <span className="whd-key is-yours" aria-hidden />
        Your hours
      </li>
      <li>
        <span className="whd-key is-out" aria-hidden />
        Outside what&apos;s allowed
      </li>
      {noRecord && (
        <li data-testid="hours-key-no-record">
          <span className="whd-key is-none" aria-hidden />
          {NO_RECORD_LABEL}
        </li>
      )}
    </ul>
  );
}

/** Round 3 (#531, S23): the [first, last] day indexes of each run of
 *  no-record days, Monday = 0. */
export function noRecordRuns(none: boolean[]): [number, number][] {
  const runs: [number, number][] = [];
  none.forEach((n, i) => {
    if (!n) return;
    const last = runs[runs.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else runs.push([i, i]);
  });
  return runs;
}

function Mark({ kind }: { kind: "ok" | "bad" }) {
  return kind === "ok" ? (
    <span className="whd-mark sym-pass" aria-hidden>
      ✓
    </span>
  ) : (
    <span className="wd-bad" aria-hidden />
  );
}

function Weekday({
  days,
  name,
  start,
  end,
  timed,
  fixed,
  onFix,
  onUndo,
}: {
  days: HoursDays;
  name: string;
  start: number | null;
  end: number | null;
  timed: boolean;
  fixed: FixRecord | null;
  onFix: (fix: [number, number]) => void;
  onUndo: () => void;
}) {
  const wd = days.kinds.weekday;
  const we = days.kinds.weekend;
  // Round 2 (R145 S10, Rule 10): weekdays with no window on record say so,
  // with no band and no mark.
  const noRecord = wd.record === "none";
  const verdict: ReactNode = noRecord ? (
    <p className="whd-line whd-verdict" data-testid="hours-verdict">
      {weekdayNoRecord(name)}
    </p>
  ) : wd.allowed === null ? (
    <p className="whd-line">{SET_CLASS_TO_SEE}</p>
  ) : !timed || (wd.status !== "inside" && wd.status !== "outside") ? (
    <p className="whd-line">{SET_TIMES_TO_SEE}</p>
  ) : (
    <p className="whd-line whd-verdict" data-testid="hours-verdict">
      <Mark kind={wd.status === "inside" ? "ok" : "bad"} />
      {weekdayVerdict(name, wd.status)}
    </p>
  );
  const allowed = noRecord ? [] : (wd.allowed ?? []);
  const clip = timed && start != null && end != null ? clipped(start, end, wd.outside) : null;
  const holiday = holidayLine(days.holiday_rule);
  return (
    <>
      {verdict}
      <div className="whd-ruler" aria-hidden data-testid="hours-ruler">
        <div className="whd-labels">
          {allowed
            .filter(([a, b]) => shows(a, b))
            // A clipped end (S6) takes no label: the ruler's edge is not
            // the window's start or end.
            .flatMap(([a, b]) => [
              a >= S && (
                <span key={`a${a}`} className="whd-cap" style={{ left: pct(a) }}>
                  {clock(a)}
                </span>
              ),
              b <= E && (
                <span key={`b${b}`} className="whd-cap is-end" style={{ left: pct(b) }}>
                  {clock(b)}
                </span>
              ),
            ])}
        </div>
        <div className="whd-track">
          {allowed
            .filter(([a, b]) => shows(a, b))
            .map(([a, b]) => (
              <span
                key={`w${a}`}
                className="whd-band"
                style={{ left: pct(a), width: len(a, b) }}
              />
            ))}
          {timed && start != null && end != null && (
            <>
              {hourSpans(start, end)
                .filter(([a, b]) => shows(a, b))
                .map(([a, b]) => (
                  <span
                    key={`y${a}`}
                    className={`whd-yours${noRecord ? " is-unchecked" : ""}`}
                    data-unchecked={noRecord ? "" : undefined}
                    style={{ left: pct(a), width: len(a, b) }}
                  />
                ))}
              {wd.outside
                .filter(([a, b]) => shows(a, b))
                .map(([a, b]) => (
                  <span
                    key={`o${a}`}
                    className="whd-yours is-out"
                    style={{ left: pct(a), width: len(a, b) }}
                  />
                ))}
              {/* S6: hours past the ruler's ends are clipped with an arrow,
                  --dim only when the clipped part is outside (finding 7). */}
              {clip?.before && (
                <span
                  className={`whd-clip is-left${clip.before === "out" ? " is-out" : ""}`}
                  data-testid="hours-clip-left"
                >
                  ◂
                </span>
              )}
              {clip?.after && (
                <span
                  className={`whd-clip is-right${clip.after === "out" ? " is-out" : ""}`}
                  data-testid="hours-clip-right"
                >
                  ▸
                </span>
              )}
            </>
          )}
        </div>
        <div className="whd-ticks">
          {TICKS.map((h) => (
            <span key={h} className="whd-tick" style={{ left: pct(h) }}>
              {clock(h)}
            </span>
          ))}
        </div>
      </div>
      {fixed && (
        <p className="whd-line whd-record" data-testid="hours-fix-record">
          <span>{fixRecord(fixed.start, fixed.end)}</span>
          <button
            type="button"
            className="undo-link wq-link"
            data-write=""
            onClick={onUndo}
            data-testid="hours-fix-undo"
          >
            Undo
          </button>
        </p>
      )}
      {/* #535 (Ryan, 2026-11-12): the fix comes back whenever the hours are
          outside again, even while the record stands. */}
      {timed && wd.status === "outside" && wd.fix && (
        <button
          type="button"
          className="whd-fix"
          data-write=""
          onClick={() => onFix(wd.fix as [number, number])}
          data-testid="hours-fix"
        >
          {fixButton(wd.fix[0], wd.fix[1])}
        </button>
      )}
      <p className="whd-line" data-testid="hours-weekend">
        {weekendLine(
          we,
          days.job?.kinds.includes("weekend") ? days.job.kind_dates.weekend : [],
        )}
      </p>
      {holiday && <p className="whd-line">{holiday}</p>}
    </>
  );
}

function Week({
  days,
  start,
  end,
  timed,
}: {
  days: HoursDays;
  start: number | null;
  end: number | null;
  timed: boolean;
}) {
  const week = weekOf(days);
  const vpos = (h: number) => pct(h);
  return (
    <>
      <div className="whd-week" data-testid="hours-week">
        <div className="whd-vticks" aria-hidden>
          {TICKS.map((h) => (
            <span key={h} style={{ top: vpos(h) }}>
              {clock(h)}
            </span>
          ))}
        </div>
        {week.map((d, i) => {
          const k: DayKindEval = days.kinds[d.day_kind];
          const dim = Boolean(days.job) && !d.in_job;
          // Round 2 (R145 S10): a day with no window on record is an empty
          // dashed column labelled "No record", never an Allowed band.
          const none = k.record === "none";
          const clip =
            timed && start != null && end != null && d.in_job ? clipped(start, end, k.outside) : null;
          return (
            <div
              key={i}
              className={`whd-day${dim ? " is-dim" : ""}${none ? " is-none" : ""}`}
              data-testid="hours-week-day"
              data-in-job={d.in_job ? "" : undefined}
              data-record={k.record}
            >
              {/* Name over date, so seven fit at 390. */}
              <span className="whd-dayname">
                <span>{DAY_NAMES[i]}</span>
                {d.date ? <span>{` ${Number(d.date.slice(8))}`}</span> : null}
              </span>
              <div className="whd-col" aria-hidden>
                {k.no_closures && <span className="whd-closed" />}
                {(none ? [] : (k.allowed ?? []))
                  .filter(([a, b]) => shows(a, b))
                  .map(([a, b]) => (
                    <span
                      key={a}
                      className="whd-band is-v"
                      style={{ top: vpos(a), height: len(a, b) }}
                    />
                  ))}
                {timed && start != null && end != null && d.in_job && (
                  <>
                    {hourSpans(start, end)
                      .filter(([a, b]) => shows(a, b))
                      .map(([a, b]) => (
                        <span
                          key={`y${a}`}
                          className={`whd-yours is-v${none ? " is-unchecked" : ""}`}
                          data-unchecked={none ? "" : undefined}
                          style={{ top: vpos(a), height: len(a, b) }}
                        />
                      ))}
                    {k.outside
                      .filter(([a, b]) => shows(a, b))
                      .map(([a, b]) => (
                        <span
                          key={`o${a}`}
                          className="whd-yours is-v is-out"
                          style={{ top: vpos(a), height: len(a, b) }}
                        />
                      ))}
                  </>
                )}
                {/* Finding 7: clipped ends, as on the ruler (top: before
                    5 am, bottom: after 9 pm). */}
                {clip?.before && (
                  <span className={`whd-clip is-top${clip.before === "out" ? " is-out" : ""}`}>▴</span>
                )}
                {clip?.after && (
                  <span className={`whd-clip is-bottom${clip.after === "out" ? " is-out" : ""}`}>▾</span>
                )}
              </div>
              <span className="sr-only">
                {none
                  ? NO_RECORD_SR
                  : k.no_closures
                  ? "No closures."
                  : k.allowed === null
                    ? "Needs a street class."
                    : `Allowed ${k.allowed.map(([a, b]) => `${clock(a)} to ${clock(b)}`).join(", ")}.`}
                {/* Round 3 (#531, S25, Rule 13): an outside day says so in
                    words, not by colour alone. */}
                {timed && d.in_job && k.outside.length > 0
                  ? ` Outside: ${k.outside.map(([a, b]) => `${clock(a)} to ${clock(b)}`).join(", ")}.`
                  : ""}
              </span>
            </div>
          );
        })}
        {/* Round 3 (#531, S23): one "No record" caption per run of
            no-record days (Mon-Fri or Sat-Sun), spanning its columns under
            them, so it covers nothing and fits at 390.  Screen readers get
            each day's sentence instead. */}
        {noRecordRuns(week.map((d) => days.kinds[d.day_kind].record === "none")).map(([a, b]) => (
          <span
            key={a}
            className="whd-none-label"
            style={{ gridColumn: `${a + 2} / ${b + 3}` }}
            aria-hidden
            data-testid="hours-week-no-record"
          >
            {NO_RECORD_LABEL}
          </span>
        ))}
      </div>
      <p className="whd-line" data-testid="hours-week-note">
        {weekNote(days.job)}
      </p>
    </>
  );
}
