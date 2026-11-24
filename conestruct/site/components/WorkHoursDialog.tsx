"use client";

// #526 (Ryan, 2026-11-11, item 1 ruling 4; the `Demo` board): the
// work-hours window, opened from "See <jurisdiction>'s work hours".  A real
// dialog: focus moves in, Tab stays inside, Esc and Close close it, and the
// caller returns focus to the link.  One fixed size in both views.
//
// Rule 3: every allowed span, verdict, outside span, fix window, date and
// source is the backend's `hours_days` (src/rules/jurisdiction.py
// `evaluate_hours_days`).  This file only places them on a scale and words
// them.  Your hours are drawn from the page's own start and end in --ink,
// and the backend's outside spans are drawn over them in --dim: no time
// arithmetic decides a colour.
//
// #555 (Ryan, 2026-11-24): "Both the week view and the weekday ruler always
// run from 6 am to 6 am the next morning (24 hours), for every job."  That
// replaces #526's 5 am to 9 pm ruler.  The backend scores every hour of a
// shift, the hours after midnight included, against the day the shift
// starts on (src/rules/jurisdiction.py `_day_kind_eval`), so the hours
// before 6 am are drawn on that same day, at the end of its scale
// (rulings.md S1, S2).

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

// #555: the scale, in hours counted from the day's own midnight: 6 is 6 am,
// 24 is midnight, 30 is 6 am the next morning.  Both views use it.
const S = 6;
const E = 30;
const MIDNIGHT = 24;
// #555: "Ticks at 6 am, noon, 6 pm, midnight and 6 am."
const TICKS = [6, 12, 18, MIDNIGHT, 30];
// S11, CHOSEN: two labels centred on their hours need about 4 hours between
// them at 390 (a 292 px track is 12.2 px an hour; "3:30 pm" is 50 px wide).
const NEAR = 4;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pct = (x: number) => `${(((x - S) / (E - S)) * 100).toFixed(2)}%`;
const len = (a: number, b: number) => `${(((b - a) / (E - S)) * 100).toFixed(2)}%`;

/** A span placed on the scale.  `cutA` / `cutB`: that end is the 6 am cut,
 *  not the span's own start or end. */
export interface Piece {
  a: number;
  b: number;
  cutA: boolean;
  cutB: boolean;
}

/** #555: clock-hour spans (0 to 24, as the backend sends them and as #188
 *  stores the page's hours) placed on the 6 am to 6 am scale.  Placement
 *  only: an hour before 6 am sits at `h + 24`, on the same day (S1).  A span
 *  crossing 6 am is cut there into two pieces (S2).  A piece ending at
 *  midnight and one starting at midnight draw as one (S3: "Allowed windows
 *  and your hours that cross midnight draw as one continuous band or
 *  bar"); nothing else is joined. */
export function placed(spans: [number, number][]): Piece[] {
  const pieces: Piece[] = [];
  for (const [a, b] of spans) {
    if (!(b > a)) continue;
    if (b > S) pieces.push({ a: Math.max(a, S), b, cutA: a < S, cutB: false });
    if (a < S) pieces.push({ a: a + 24, b: Math.min(b, S) + 24, cutA: false, cutB: b > S });
  }
  pieces.sort((x, y) => x.a - y.a);
  const joined: Piece[] = [];
  for (const p of pieces) {
    const last = joined[joined.length - 1];
    if (last && last.b === MIDNIGHT && p.a === MIDNIGHT) {
      last.b = p.b;
      last.cutB = p.cutB;
    } else joined.push(p);
  }
  return joined;
}

/** The page's hours as clock-hour spans: an end before the start runs past
 *  midnight (#188). */
function hourSpans(start: number, end: number): [number, number][] {
  return end > start ? [[start, end]] : [[start, 24], [0, end]];
}

/** S6 / round 2 (finding 7): the hours clipped at the scale's ends.  An
 *  arrow is --dim only when the clipped part is outside what's allowed;
 *  otherwise it only says "more this way" in --ink-faint.
 *  #555 (S9): the scale now holds all 24 hours, so no placed piece runs
 *  past either end and this always answers null for both.  The arrows'
 *  markup and CSS stay until #557 removes them. */
function clipped(
  yours: Piece[],
  outside: Piece[],
): { before: null | "out" | "in"; after: null | "out" | "in" } {
  const before = yours.some((p) => p.a < S) ? (outside.some((p) => p.a < S) ? "out" : "in") : null;
  const after = yours.some((p) => p.b > E) ? (outside.some((p) => p.b > E) ? "out" : "in") : null;
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
  const allowed = placed(noRecord ? [] : (wd.allowed ?? []));
  const yours = timed && start != null && end != null ? placed(hourSpans(start, end)) : null;
  const outside = placed(wd.outside);
  const clip = yours ? clipped(yours, outside) : null;
  const holiday = holidayLine(days.holiday_rule);
  return (
    <>
      {verdict}
      <div className="whd-ruler" aria-hidden data-testid="hours-ruler">
        <div className="whd-labels">
          {/* S4: an end made by the 6 am cut takes no label (#526 S6: the
              ruler's edge is not the window's start or end). */}
          {allowed.flatMap(({ a, b, cutA, cutB }, i) => [
            !cutA && (
              // S11: a window that starts soon after the one before it ends
              // sets its start label from its start, clear of that end label.
              <span
                key={`a${a}`}
                className={`whd-cap${i > 0 && a - allowed[i - 1].b < NEAR ? " is-near" : ""}`}
                style={{ left: pct(a) }}
              >
                {clock(a)}
              </span>
            ),
            !cutB && (
              <span key={`b${b}`} className="whd-cap is-end" style={{ left: pct(b) }}>
                {clock(b)}
              </span>
            ),
          ])}
        </div>
        <div className="whd-track">
          {allowed.map(({ a, b }) => (
            <span key={`w${a}`} className="whd-band" style={{ left: pct(a), width: len(a, b) }} />
          ))}
          {/* #555: "a faint dashed line across each day" at midnight, over
              the band and under your hours. */}
          <span className="whd-midnight" style={{ left: pct(MIDNIGHT) }} />
          {yours && (
            <>
              {yours.map(({ a, b }) => (
                <span
                  key={`y${a}`}
                  className={`whd-yours${noRecord ? " is-unchecked" : ""}`}
                  data-unchecked={noRecord ? "" : undefined}
                  style={{ left: pct(a), width: len(a, b) }}
                />
              ))}
              {outside.map(({ a, b }) => (
                <span
                  key={`o${a}`}
                  className="whd-yours is-out"
                  style={{ left: pct(a), width: len(a, b) }}
                />
              ))}
              {/* S6: hours past the ruler's ends were clipped with an arrow.
                  #555 (S9): nothing is clipped on the 24-hour scale, so
                  these never render; #557 removes them. */}
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
            <span
              key={h}
              className={`whd-tick${h === MIDNIGHT ? " is-midnight" : ""}`}
              style={{ left: pct(h) }}
            >
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
  const yours = timed && start != null && end != null ? placed(hourSpans(start, end)) : null;
  return (
    <>
      <div className="whd-week" data-testid="hours-week">
        <div className="whd-vticks" aria-hidden>
          {TICKS.map((h) => (
            <span key={h} className={h === MIDNIGHT ? "is-midnight" : undefined} style={{ top: vpos(h) }}>
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
          const outside = placed(k.outside);
          const clip = yours && d.in_job ? clipped(yours, outside) : null;
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
                {placed(none ? [] : (k.allowed ?? [])).map(({ a, b }) => (
                  <span key={a} className="whd-band is-v" style={{ top: vpos(a), height: len(a, b) }} />
                ))}
                {/* #555: the midnight line, across every day. */}
                <span className="whd-midnight is-v" style={{ top: vpos(MIDNIGHT) }} />
                {yours && d.in_job && (
                  <>
                    {yours.map(({ a, b }) => (
                      <span
                        key={`y${a}`}
                        className={`whd-yours is-v${none ? " is-unchecked" : ""}`}
                        data-unchecked={none ? "" : undefined}
                        style={{ top: vpos(a), height: len(a, b) }}
                      />
                    ))}
                    {outside.map(({ a, b }) => (
                      <span
                        key={`o${a}`}
                        className="whd-yours is-v is-out"
                        style={{ top: vpos(a), height: len(a, b) }}
                      />
                    ))}
                  </>
                )}
                {/* Finding 7: clipped ends, as on the ruler.  #555 (S9):
                    never rendered on the 24-hour scale; #557 removes them. */}
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
