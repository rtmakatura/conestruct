"use client";

// Schedule entry — a first-class Setup step (gen2 inc-8).
//
// #289 hand-check, 2026-09-23, correction 1: the SECTION is gone.  Its
// controls are cells in the WHAT band's second group (bands/PlanDetails)
// and its window block sits under that group, because "the dates
// control" is one of the inputs the 3 × 2 grid does not hold.  What
// moved is the container and the register; the LOGIC is untouched, and
// deliberately so — #199's display-only "Not set" default, #188's
// overnight wrap (every half hour offered, `(next day)` labels, `end ==
// start` excluded as ambiguous at the wire) and the stranded-end clear
// are all behaviours a rewrite would have quietly dropped.  The
// design-phase move of schedule inputs onto the jurisdiction hours card
// left pre-generation with no visible way to set a time at all; entry
// now lives here.  The post-generation strip inline-edits the SAME
// scenario.schedule fields, and the Zone 3 hours chip READS them (it no
// longer hosts inputs) — one fact, one home, everywhere in sync.

import { hhmm, type JurisdictionBlock } from "@/lib/jurisdiction";
import type { Scenario } from "@/lib/scenarios";
import { Listbox } from "./ui/Listbox";
import { WhyCell } from "./bands/FieldCell";
import {
  ADD_STREET_CLASS,
  ADD_TIMES,
  DATES_CHECK_FAILED,
  DATES_DECLINED,
  DATES_NO_JURISDICTION,
  cantCheckYet,
  checkingDates,
  datesOptional,
  fitsEveryDay,
  fitsPartial,
  noHoursData,
  noRecordDays,
  outsideLine,
  shortName,
  timeWhy,
} from "@/lib/scenarios/why-lines";

/** The backend's `hours_eval` note for dates with no times
 *  (src/rules/jurisdiction.py `NO_SCHEDULE_NOTE`). */
const NO_SCHEDULE_NOTE = "no work schedule provided";

type Sched = NonNullable<Scenario["schedule"]>;
type DateMode = Sched["date_mode"];

const HALF_HOURS = Array.from({ length: 48 }, (_, i) => i * 0.5);

interface Props {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  // #289 correction 1: `step` and `stepsPending` retired with the
  // section.  The band header carries the index (ruling 198's four
  // steps), and the pre-pin gate is the COLUMN's now — the WHAT band
  // does not open before there is a pin, so a per-section pending state
  // has nothing left to describe.
  /** #227: the selected jurisdiction's evaluated block (device-breakdown
   *  response) — the reference block renders its REAL window set.  Null
   *  when none is selected or the block is in flight. */
  jurisdiction?: JurisdictionBlock | null;
  /** #152 D, re-earned for this surface (#289 hand-check 2026-09-23,
   *  correction 2).  True while a breakdown for the SAME jurisdiction is
   *  in flight — the held block is content, which may stay on screen,
   *  but `hours_eval` is a VERDICT, and a verdict for inputs the backend
   *  has not answered yet may not render as current (rule 10).  The
   *  reference panel's own HoursVerdictBlock has taken this flag since
   *  #152 D; pre-generate the window rows are the only surface carrying
   *  the verdict, so they take it too. */
  verifying?: boolean;
}

export function ScheduleField({
  scenario,
  setScenario,
  jurisdiction = null,
  verifying = false,
}: Props) {
  const sched = scenario.schedule ?? null;
  // Untouched scenario: present "Not set" (#199) — the honest default
  // for a schedule nobody entered, matching what the hours card reports.
  // Display-only: nothing is written until the user interacts (the
  // payload stays unchanged).  Pre-fix this presented "Single day" as
  // chosen — an asserted shape under a caption promising that windows
  // and lead times compute from it.
  const mode: DateMode = sched?.date_mode ?? "tbd";

  const startWhy = timeWhy("start", sched?.start_time != null);
  const endWhy = timeWhy("end", sched?.end_time != null);

  const patch = (p: Partial<Sched>) =>
    setScenario({
      ...scenario,
      schedule: { date_mode: mode, ...(sched ?? {}), ...p },
    } as Scenario);

  return (
    <>
      {/* #289 hand-check, 2026-09-23, fix 1: the DATES are gone from
          here.  They were the duplicate — the WHAT grid's own cell wrote
          `work_date`, and so did this one, behind three chips that wrote
          `date_mode` for the same answer.  The grid's cell is the one
          control now (bands/WhatBand.tsx) and the mode derives from what
          is in it; what is left here is the TIMES, which are a different
          question with a different field, and #188's whole contract. */}
      {mode !== "tbd" && (
        <>
          {/* #517 ruling 6: the shared listbox (S7) in place of the native
              select; #188's options and the stranded-end clear unchanged.
              "Not set" is the clearing option (#199's display-only
              default). */}
          {/* #521 (ruling 5, S4): each time row has its source line,
              "Set by you" or "Not set yet", as every other row does. */}
          <WhyCell
            label="Start time"
            htmlFor="sched-start"
            testid="start-time"
            source={startWhy.source}
            tip={startWhy.tip}
          >
            <Listbox
              id="sched-start"
              label="Start time"
              value={sched?.start_time != null ? String(sched.start_time) : ""}
              options={[
                { value: "", label: "Not set" },
                ...HALF_HOURS.map((h) => ({
                  value: String(h),
                  label: hhmm(h),
                })),
              ]}
              onChange={(raw) => {
                const v = raw === "" ? undefined : +raw;
                // #188: end == start is rejected at the wire (ambiguous:
                // zero-length vs 24 h wrap) — clear the end in the same
                // patch rather than POSTing a value the list can no
                // longer display (the stranded-end bug).
                patch(
                  v != null && sched?.end_time === v
                    ? { start_time: v, end_time: undefined }
                    : { start_time: v },
                );
              }}
            />
            <span className="tr-note">Local time.</span>
          </WhyCell>

          <WhyCell
            label="End time"
            htmlFor="sched-end"
            testid="end-time"
            source={endWhy.source}
            tip={endWhy.tip}
          >
            <Listbox
              id="sched-end"
              label="End time"
              value={sched?.end_time != null ? String(sched.end_time) : ""}
              options={[
                { value: "", label: "Not set" },
                // #188: an end at/before the start wraps past midnight —
                // every half hour stays selectable, labeled "(next day)"
                // when it lands after midnight.  Only end == start is
                // excluded (rejected at the wire as ambiguous).
                ...HALF_HOURS.filter((h) => h !== sched?.start_time).map(
                  (h) => ({
                    value: String(h),
                    label:
                      sched?.start_time != null && h < sched.start_time
                        ? `${hhmm(h)} (next day)`
                        : hhmm(h),
                  }),
                ),
              ]}
              onChange={(raw) =>
                patch({ end_time: raw === "" ? undefined : +raw })
              }
            />
            <span className="tr-note">
              An end before the start runs past midnight.
            </span>
          </WhyCell>
        </>
      )}
    </>
  );
}

/** #526 (Ryan, 2026-11-11, item 1 ruling 2): the Work dates cell's result
 *  line, in one of its states.  `kind` picks the mark: "ok" a check mark,
 *  "bad" the orange (`--dim`) square, "none" no mark.  Every verdict, hour
 *  and date is the backend's `hours_days` (Rule 3); this picks the words.
 *  Ruling 3's trace: "set dates to check" was every `unknown`, and the
 *  backend says `unknown` both for dates with no times and for a
 *  class-scoped window with no street class (rulings.md R145 S2). */
export function windowsSummary({
  scenario,
  name = null,
  jurisdiction = null,
  verifying = false,
  declined = false,
  errored = false,
}: {
  scenario: Scenario;
  /** The jurisdiction's name: the block's, else the picked option's. */
  name?: string | null;
  jurisdiction?: JurisdictionBlock | null;
  verifying?: boolean;
  /** #398: the plan's check answered with a decline (400), so no block
   *  is coming until the input changes. */
  declined?: boolean;
  /** #398: the check failed without a decline; no block is coming. */
  errored?: boolean;
}): { kind: "none" | "ok" | "bad"; text: string } {
  const none = (text: string) => ({ kind: "none" as const, text });
  if (!scenario.jurisdiction_key) return none(DATES_NO_JURISDICTION);
  name = jurisdiction?.name ?? name;
  if (!name) return none(DATES_NO_JURISDICTION);
  // Round-2 rework (R145 S21a): the line names the picked jurisdiction by
  // its short name, so every state fits ruling 2's two lines.
  const j = shortName(scenario.jurisdiction_key, name) ?? name;
  if (!jurisdiction) {
    // #398 (Rule 10): a decline or a failure is an answer; otherwise the
    // check is open.
    if (declined) return none(DATES_DECLINED);
    if (errored) return none(DATES_CHECK_FAILED);
    return none(checkingDates(j));
  }
  const days = jurisdiction.hours_days;
  if (
    jurisdiction.hours.shape === "none" ||
    jurisdiction.hours.windows.length === 0 ||
    days === null
  ) {
    return none(noHoursData(j));
  }
  const dated = Boolean(scenario.schedule?.work_date);
  if (!dated) return none(datesOptional(j));
  if (verifying) return none(checkingDates(j));
  if (days === undefined) {
    // Round 2 (finding 5, R145 S15): an older backend without the per-day
    // check.  Say what is missing when its answer says so; otherwise a
    // plain line that is no verdict and no endless "Checking" (Rule 10).
    const ev = jurisdiction.hours_eval;
    const timed =
      scenario.schedule?.start_time != null && scenario.schedule?.end_time != null;
    if (ev.status === "unknown" && ev.note === NO_SCHEDULE_NOTE && !timed) {
      return none(ADD_TIMES);
    }
    if (ev.status === "unknown" && !scenario.street_class && ev.note !== NO_SCHEDULE_NOTE) {
      return none(ADD_STREET_CLASS);
    }
    return none(cantCheckYet(j));
  }
  if (days.missing === "dates") return none(datesOptional(j));
  if (days.missing === "times") return none(ADD_TIMES);
  if (days.missing === "street_class") return none(ADD_STREET_CLASS);
  if (days.status === "inside") {
    return { kind: "ok", text: fitsEveryDay(j) };
  }
  // Round 2 (R145 S10, Rule 10): a day kind with no window on record is
  // absence, never a fit: no check mark.
  if (days.status === "partial") {
    const fits = (days.job?.kinds ?? []).find((k) => days.kinds[k].status === "inside") ?? "weekday";
    return none(fitsPartial(j, fits));
  }
  if (days.status === "no_record") return none(noRecordDays(j));
  if (days.status !== "outside" || !days.job) {
    return none(cantCheckYet(j));
  }
  return {
    kind: "bad",
    text: outsideLine(days.kinds, days.job) ?? `Goes outside ${j}'s work hours.`,
  };
}
