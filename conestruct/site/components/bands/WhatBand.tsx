"use client";

// #517 (UX group 7, 2026-11-11) — the What section, guesses first.
//
// Authority: validation-artifacts/committed/missions/ux-group7-what-section/
// issue-517/rulings.md (Ryan, boards B and D).
//   Ruling 1: "The heading is 'What's the job?' (19/600), with the line 'We
//   filled this in from the road you confirmed. Check our <n> guesses, then
//   tell us about the work.' ... Then the 'Check these <n> guesses' box ...
//   Then 'About the work' ... Then one row, 'Measured from the map' ...
//   with a 'Change' button ... Then one row, 'File details (optional)'."
//   Ruling 3: "A checked guess stays put (P1)."
//   Ruling 5: the plain source line and its why tip.
//   Ruling 6: one shared listbox.  Ruling 7: the date picker and the hours
//   result under it.
//
// S1 (which rows sit in the box): a field with a guess record (road type,
// street class, jurisdiction, speed), or one that was in the box earlier in
// this visit for the same road and has since been checked.  Which rows were
// in the box is this component's own state, keyed by the road at the pin
// (way and pin) and reset when that changes (S2); it does not survive a
// reload, where a checked field reads "Set by you" in the measured row (S3).
//
// What stands, unchanged: #198's byte-identical handoff sentences, now in
// the why tip of the field they describe; ruling 196's jurisdiction states;
// the boundary warnings on show under the jurisdiction's control (P3); the
// kind's own fields below the band (rule 139's chain stays visible); #227's
// windows table, opened from the hours line; the writers in what-writes.ts
// and guesses.ts.  Rule 3: nothing here computes a value the backend owns.

import { useRef, useState, type ReactNode } from "react";
import type { Scenario, ScenarioMeta, RoadType } from "@/lib/scenarios";
import {
  JURISDICTION_OPTIONS,
  type JurisdictionBlock,
} from "@/lib/jurisdiction";
import { validateLanes } from "@/lib/scenarios/validation";
import {
  setLaneWidth,
  setLanes,
  setRoadType,
  setSpeed,
  setWorkDates,
} from "@/lib/scenarios/what-writes";
import {
  PLAN_DETAILS,
  WHAT_CELLS,
  laneWidthOptions,
  speedOptions,
} from "@/lib/scenarios/what-cells";
import { deriveDetectedRows } from "@/lib/road-detection/detected-rows";
import { carriagewayVerdict } from "@/lib/road-detection/carriageway";
import {
  isGuessed,
  markOperatorSet,
  setJurisdictionByOperator,
  speedSet,
} from "@/lib/scenarios/guesses";
import {
  BOX_FIELDS,
  type BoxField,
  boxHeading,
  carriagewayWhy,
  datesHint,
  detectionLine,
  dividedWhy,
  fileDetailsLine,
  notFromMap,
  guessReason,
  hoursFrame,
  introLine,
  isOpenGuess,
  jurisdictionLabel,
  jurisdictionWhy,
  lanesWhy,
  laneWidthWhy,
  locationWhy,
  projectWhy,
  roadTypeWhy,
  seeAllHours,
  speedWhy,
  streetClassWhy,
  workDatesWhy,
  type Why,
} from "@/lib/scenarios/why-lines";
import { handoffNotesByCell } from "./HandoffNotes";
import {
  CarriagewayCells,
  JobCells,
  StreetClassCell,
  oneWayFacts,
  showsDividedToggle,
  type BoxState,
} from "./PlanDetails";
import type { HandoffEvent } from "@/lib/scenarios/handoff-summary";
import { OpenBand } from "./BandPrimitives";
import { WhyCell } from "./FieldCell";
import { Listbox } from "../ui/Listbox";
import { DateRangePicker } from "../ui/DateRangePicker";
import {
  JurisdictionEvidence,
  JurisdictionWarnings,
  type JurisdictionLookup,
} from "../JurisdictionSection";
import { useWriteLock } from "../WriteLock";

/** The three states ruling 196 gives the jurisdiction field, plus the
 *  in-flight presentation of "not yet evaluated", plus #425's "declined"
 *  (the check answered with a 400, so no block is coming until the input
 *  changes). */
export type JurisdictionCellState =
  | "unset"
  | "evaluated"
  | "evaluating"
  | "declined"
  | "check-failed";

export function jurisdictionCellState(opts: {
  key: string | null;
  block: JurisdictionBlock | null;
  loading: boolean;
  errored: boolean;
  /** #425 / #406: the error is the plan's decline (Rule 10: a decline is
   *  an answer, so the cell never says the check didn't answer). */
  declined?: boolean;
}): JurisdictionCellState {
  if (!opts.key) return "unset";
  if (opts.block) return "evaluated";
  if (opts.loading) return "evaluating";
  if (opts.declined) return "declined";
  // Ryan, 2026-10-29 (#425 ruling 3): a check that ran and failed is
  // "check failed", never "not checked".
  return opts.errored ? "check-failed" : "evaluating";
}

/** The windows check's line (ScheduleField `windowsSummary`). */
export interface WindowsLine {
  head: string;
  glyph: string;
  text: string;
  tone: string;
}

/** #198's handoff sentences for one field, in its why tip: one text node
 *  per sentence, the glyph its own node (byte-identity). */
function HandoffLines({ notes, testid }: { notes: string[]; testid: string }) {
  return (
    <>
      {notes.map((n, i) => (
        <span
          key={i}
          className="w-tip-line is-warn"
          data-testid={`handoff-${testid}`}
        >
          <span aria-hidden>⚠ </span>
          {n}
        </span>
      ))}
    </>
  );
}

/** The road at the pin (way and pin): the box's key (S2). */
function boxKey(s: Scenario): string {
  const r = s.meta.confirmedRoad ?? null;
  const fresh =
    r && r.pinLat === s.meta.lat && r.pinLng === s.meta.lng ? r : null;
  return `${fresh ? fresh.candidate.way_id : "-"}@${s.meta.lat},${s.meta.lng}`;
}

/** A plain row under the box: a title, a line, and one 44 px button that
 *  opens its panel in place (ruling 1's "Measured from the map" and "File
 *  details").  The panel stays mounted, `hidden` while closed. */
function DisclosureRow({
  id,
  title,
  line,
  extra = null,
  checks = [],
  open,
  onToggle,
  openWord,
  closedWord,
  testid,
  children,
}: {
  id: string;
  title: string;
  line: string;
  /** #521: a second plain line under the first (the values not measured). */
  extra?: string | null;
  checks?: string[];
  open: boolean;
  onToggle: () => void;
  openWord: string;
  closedWord: string;
  testid: string;
  children: ReactNode;
}) {
  return (
    <div className="w-row" data-testid={testid}>
      <div className="w-row-head">
        <div className="w-row-text">
          <span className="w-row-title" id={`${id}-title`}>
            {title}
          </span>
          <span className="tr-help w-row-line" data-testid={`${testid}-line`}>
            {line}
          </span>
          {extra && (
            <span
              className="tr-help w-row-line"
              data-testid={`${testid}-extra`}
            >
              {extra}
            </span>
          )}
          {!open &&
            checks.map((c) => (
              <span
                key={c}
                className="w-line is-warn"
                data-testid={`${testid}-check`}
              >
                <span aria-hidden>⚠ </span>
                {c}
              </span>
            ))}
        </div>
        <button
          type="button"
          className="w-btn"
          data-read=""
          aria-expanded={open}
          aria-controls={id}
          aria-describedby={`${id}-title`}
          onClick={onToggle}
          data-testid={`${testid}-toggle`}
        >
          {open ? openWord : closedWord}
        </button>
      </div>
      <div
        id={id}
        className="w-panel"
        hidden={!open}
        data-testid={`${testid}-panel`}
      >
        {children}
      </div>
    </div>
  );
}

export function WhatBand({
  scenario,
  setScenario,
  jurisdictionBlock,
  jurisdictionLoading,
  jurisdictionErrored,
  jurisdictionDeclined = false,
  jurisdictionLookup = { status: "idle", data: null },
  stepIndex,
  kindFields,
  scheduleCells,
  scheduleWindows,
  windowsLine,
  setMeta,
  handoff = [],
}: {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  jurisdictionBlock: JurisdictionBlock | null;
  jurisdictionLoading: boolean;
  jurisdictionErrored: boolean;
  /** #425: the breakdown's error is a 400 decline. */
  jurisdictionDeclined?: boolean;
  /** R108: the pin's boundary lookup — the jurisdiction row's evidence
   *  and warnings.  The guess itself is already the scenario's value. */
  jurisdictionLookup?: JurisdictionLookup;
  stepIndex: string;
  /** R1 — the kind's own fields, below the band.  `near_intersection`'s
   *  carries the approach-confirm hold, a rail blocker, so it is never
   *  put behind a disclosure (rule 139's chain has to stay visible). */
  kindFields?: ReactNode;
  /** The dates' time rows, under the work dates. */
  scheduleCells?: ReactNode;
  /** #227's windows table, opened from the hours line (ruling 7). */
  scheduleWindows?: ReactNode;
  /** The windows check's verdict, framed under the dates (ruling 7). */
  windowsLine?: WindowsLine;
  /** The title-block metadata (File details). */
  setMeta: (m: ScenarioMeta) => void;
  /** The picker → form handoff events; the sentences ride the rows they
   *  describe (correction 3). */
  handoff?: HandoffEvent[];
}): ReactNode {
  const locked = useWriteLock();
  const table = WHAT_CELLS[scenario.kind];
  const hasPlanDetails = Boolean(PLAN_DETAILS[scenario.kind]);
  const detected = deriveDetectedRows(scenario);
  const lanesValidation = validateLanes(scenario);
  const notes = handoffNotesByCell(scenario, handoff);

  // --- S1 / S2: the box's rows ---------------------------------------------
  const offered = (f: BoxField) => f !== "street_class" || hasPlanDetails;
  const openGuesses = BOX_FIELDS.filter(
    (f) => offered(f) && isOpenGuess(scenario, f),
  );
  const key = boxKey(scenario);
  const boxRef = useRef<{ key: string; fields: BoxField[] } | null>(null);
  if (boxRef.current === null || boxRef.current.key !== key) {
    boxRef.current = { key, fields: openGuesses };
  } else {
    const held = boxRef.current.fields;
    boxRef.current.fields = BOX_FIELDS.filter(
      (f) => held.includes(f) || openGuesses.includes(f),
    );
  }
  const boxFields = boxRef.current.fields;
  const inBox = (f: BoxField) => boxFields.includes(f);
  const boxState = (f: BoxField): BoxState | null =>
    inBox(f)
      ? { reason: guessReason(scenario, f), checked: !isOpenGuess(scenario, f) }
      : null;

  // --- The jurisdiction --------------------------------------------------------
  const jState = jurisdictionCellState({
    key: scenario.jurisdiction_key ?? null,
    block: jurisdictionBlock,
    loading: jurisdictionLoading,
    errored: jurisdictionErrored,
    declined: jurisdictionDeclined,
  });
  const pickedLabel = jurisdictionLabel(scenario.jurisdiction_key);
  const jurisdictionName = jurisdictionBlock?.name ?? pickedLabel;

  // --- The fields' whys --------------------------------------------------------
  const speedIsSet = speedSet(scenario);
  const speed = speedWhy(scenario, detected);
  const lanes = lanesWhy(scenario, detected, {
    takesCount: Boolean(table.lanes),
    fixedReason: table.lanesReason ?? null,
    valid: lanesValidation.ok,
    invalidMessage: lanesValidation.message ?? null,
    oneWay:
      carriagewayVerdict(oneWayFacts(scenario) ?? undefined) ===
      "one_way_street",
  });
  const laneWidth = laneWidthWhy(scenario);
  const roadType = roadTypeWhy(scenario, detected);
  const jurisdiction = jurisdictionWhy({
    s: scenario,
    state: jState,
    block: jurisdictionBlock,
    lookupLoading: jurisdictionLookup.status === "loading",
  });
  const showsDivided = showsDividedToggle(scenario);
  // #517 round 1 (P2): the divided-ness line rides the road type only when
  // no field of its own carries the fact — neither the Divided toggle nor
  // #308's Carriageway (oneWayFacts) — so it has one voice.
  const roadTypeLines = [
    detectionLine(detected, "One-way"),
    showsDivided || oneWayFacts(scenario)
      ? null
      : detectionLine(detected, "Divided"),
  ].filter((l): l is NonNullable<typeof l> => l !== null);

  const boxSource = (f: BoxField, why: Why): Why["source"] => {
    const b = boxState(f);
    return b ? (b.checked ? "checked" : "guess") : why.source;
  };

  // --- The rows ----------------------------------------------------------------
  const speedRow = (
    <WhyCell
      key="speed"
      label="Speed"
      htmlFor="what-speed"
      testid="speed"
      source={boxSource("speed", speed)}
      reason={boxState("speed")?.reason ?? null}
      tip={speed.tip}
      info={<HandoffLines notes={notes["speed"] ?? []} testid="speed" />}
    >
      <Listbox
        id="what-speed"
        label="Speed"
        disabled={locked}
        value={speedIsSet ? String(scenario.speed) : null}
        options={speedOptions(scenario.kind).map((s) => ({
          value: String(s),
          label: `${s} mph`,
        }))}
        // S2: a pick, the held value included, is the operator's (the
        // record drops in `setSpeed`).
        onChange={(v) => setScenario(setSpeed(scenario, +v))}
      />
    </WhyCell>
  );

  const roadTypeRow = (
    <WhyCell
      key="road-type"
      label="Road type"
      htmlFor="what-road-type"
      testid="road-type"
      source={boxSource("road_type", roadType)}
      reason={boxState("road_type")?.reason ?? null}
      tip={roadType.tip}
      info={
        <>
          {table.roadTypeNote && (
            <p className="w-tip-line" data-testid="road-type-note">
              {table.roadTypeNote}
            </p>
          )}
          {roadTypeLines.map((l) => (
            <p
              key={l.key}
              className={`w-tip-line${l.warn ? " is-warn" : ""}`}
              data-testid={`detect-${l.key}`}
            >
              {l.warn && <span aria-hidden>⚠ </span>}
              {l.text}
            </p>
          ))}
          <HandoffLines notes={notes["road-type"] ?? []} testid="road-type" />
        </>
      }
    >
      <Listbox
        id="what-road-type"
        label="Road type"
        disabled={locked}
        value={scenario.roadType as string}
        options={table.roadTypes.map((r) => ({ value: r.v, label: r.l }))}
        onChange={(v) => {
          const next = setRoadType(scenario, v as RoadType);
          // S2: in the box, picking the held value is the check too —
          // `setRoadType` records only a change, so the section records
          // the operator's confirm (reconcileRoadType then drops the guess).
          setScenario(
            inBox("road_type") ? markOperatorSet(next, "roadType") : next,
          );
        }}
      />
    </WhyCell>
  );

  const streetClassRow = hasPlanDetails ? (
    <StreetClassCell
      key="street-class"
      scenario={scenario}
      setScenario={setScenario}
      jurisdictionBlock={jurisdictionBlock}
      box={boxState("street_class")}
    />
  ) : null;

  const jurisdictionRow = (
    <WhyCell
      key="jurisdiction"
      label="Jurisdiction"
      htmlFor="what-jurisdiction"
      testid="jurisdiction"
      source={boxSource("jurisdiction_key", jurisdiction)}
      reason={boxState("jurisdiction_key")?.reason ?? null}
      tip={jurisdiction.tip}
      alert={<JurisdictionWarnings lookup={jurisdictionLookup} />}
      info={<JurisdictionEvidence lookup={jurisdictionLookup} />}
    >
      <Listbox
        id="what-jurisdiction"
        label="Jurisdiction"
        disabled={locked}
        dataAttrs={{ "data-jurisdiction-state": jState }}
        value={scenario.jurisdiction_key ?? ""}
        options={[
          // #260 / #257: "Not set" is the one word every surface uses for
          // an unset jurisdiction.
          { value: "", label: "Not set: MUTCD + CDOT only" },
          ...JURISDICTION_OPTIONS.map((o) => ({
            value: o.key,
            label: o.label,
          })),
        ]}
        // R108: the operator's pick, a guess replaced included; never
        // overwritten by a later pin answer (R110 Q4).
        onChange={(v) =>
          setScenario(setJurisdictionByOperator(scenario, v || null))
        }
      />
    </WhyCell>
  );

  const lanesCount =
    "lanes" in scenario ? (scenario as { lanes: number }).lanes : 1;
  const lanesRow = (
    <WhyCell
      key="lanes"
      label="Lanes"
      htmlFor={table.lanes ? "what-lanes" : undefined}
      testid="lanes"
      source={lanes.source}
      tip={lanes.tip}
      error={lanes.error ?? null}
      info={<HandoffLines notes={notes["lanes"] ?? []} testid="lanes" />}
    >
      <>
        {table.lanes ? (
          <Listbox
            id="what-lanes"
            label="Lanes per direction"
            disabled={locked}
            invalid={!lanesValidation.ok}
            value={String(lanesCount)}
            options={table.lanes.map((n) => ({
              value: String(n),
              label: `${n} per side`,
            }))}
            onChange={(v) => setScenario(setLanes(scenario, +v))}
          />
        ) : (
          // #209's read-only-with-reason: the kind has no lane count; the
          // row says which count the plan uses and why (rule 10, rule 136).
          <input
            className="a-fld w-fld"
            readOnly
            aria-readonly="true"
            data-read=""
            value="1 per side"
            aria-label="Lanes per direction (fixed by this plan kind)"
          />
        )}
      </>
    </WhyCell>
  );
  // #517 round 1 (Rule 10/12): the width is its own fact with its own
  // source — detection never measures it — so it is its own row and line
  // ("Default" / "Set by you"), never under the count's "Measured".
  const laneWidthRow = (
    <WhyCell
      key="lane-width"
      label="Lane width"
      htmlFor="what-lane-width"
      testid="lane-width"
      source={laneWidth.source}
      tip={laneWidth.tip}
      info={
        <HandoffLines notes={notes["lane-width"] ?? []} testid="lane-width" />
      }
    >
      <Listbox
        id="what-lane-width"
        label="Lane width"
        disabled={locked}
        value={String((scenario as { laneWidth: number }).laneWidth)}
        options={laneWidthOptions(scenario.kind).map((w) => ({
          value: String(w),
          label: `${w} ft`,
        }))}
        onChange={(v) => setScenario(setLaneWidth(scenario, +v))}
      />
    </WhyCell>
  );

  // --- The measured row (ruling 1, S3, S5, S6) ----------------------------------
  const carriage = oneWayFacts(scenario);
  const carriageWhy = carriage
    ? carriagewayWhy(carriage)
    : showsDivided
      ? dividedWhy(scenario, detected)
      : null;
  const roadTypeLabel =
    table.roadTypes.find((r) => r.v === scenario.roadType)?.l ??
    String(scenario.roadType);
  const classWhy = streetClassWhy(scenario);
  const classLabel = scenario.street_class
    ? `${scenario.street_class.charAt(0).toUpperCase()}${scenario.street_class.slice(1)} street`
    : "Street class not set";
  // #521 (Rule 10): "each way" only on a road that carries both directions.
  const verdict = carriage ? carriagewayVerdict(carriage) : null;
  const oneWay = verdict === "one_way_street";
  const lanesWord = (n: number) =>
    `${n} ${n === 1 ? "lane" : "lanes"}${oneWay ? "" : " each way"}`;
  // Each value with its field's source (the panel's source lines).
  const roadValues: Array<[string, Why | null] | null> = [
    inBox("speed")
      ? null
      : [speedIsSet ? `${scenario.speed} mph` : "Speed not set", speed],
    [lanesWord(table.lanes ? lanesCount : 1), lanes],
    [`${(scenario as { laneWidth: number }).laneWidth} ft lanes`, laneWidth],
    carriage
      ? verdict === "undecided"
        ? ["Carriageway not set", carriageWhy]
        : verdict === "divided"
          ? ["Divided", carriageWhy]
          : verdict === "undivided"
            ? ["Undivided", carriageWhy]
            : oneWay
              ? ["One-way", carriageWhy]
              : null
      : showsDivided
        ? [
            (scenario as { divided?: boolean }).divided
              ? "Divided"
              : "Undivided",
            carriageWhy,
          ]
        : null,
    inBox("road_type") ? null : [roadTypeLabel, roadType],
    inBox("street_class") || !hasPlanDetails ? null : [classLabel, classWhy],
    inBox("jurisdiction_key")
      ? null
      : [pickedLabel ?? "No jurisdiction", jurisdiction],
  ];
  const shownValues = roadValues.filter(
    (v): v is [string, Why | null] => v !== null,
  );
  // #521 (Rule 10, R145 S25): with a confirmed road, the row's line lists
  // only the values the map measured; the rest follow on their own line,
  // "Not from the map: …".  With nothing measured the row is titled for
  // what it holds (S22) and lists everything on one line.
  const measured = detected
    ? shownValues.filter(([, w]) => w?.source === "measured").map(([v]) => v)
    : [];
  const notMeasured = shownValues
    .filter(([, w]) => !detected || w?.source !== "measured")
    .map(([v]) => v);
  const measuredTitle = measured.length
    ? "Measured from the map"
    : "About the road";
  const measuredLine = measured.length
    ? measured.join(" · ")
    : notMeasured.join(" · ");
  const measuredExtra =
    measured.length && notMeasured.length ? notFromMap(notMeasured) : null;
  // S5: the closed row names each field inside that wants a check.
  const panelWhys: Array<[string, Why | null]> = [
    ["Speed", inBox("speed") ? null : speed],
    ["Lanes", lanes],
    ["Carriageway", carriageWhy],
    ["Road type", inBox("road_type") ? null : roadType],
    [
      "Street class",
      inBox("street_class") || !hasPlanDetails ? null : classWhy,
    ],
  ];
  const checks = panelWhys
    .filter(
      ([, w]) =>
        w && (w.error || w.alert || w.needsCheck || w.source === "guess"),
    )
    .map(([label, w]) => {
      const why = w as Why;
      const detail =
        why.error ??
        why.alert ??
        (why.source === "unset" ? "Not set yet." : "Check it.");
      return `${label}: ${detail}`;
    });
  // S5: a detection line under the road type that wants a check (an
  // inferred divided-ness) is flagged in the closed row too, while the
  // road type sits in the panel.
  if (!inBox("road_type")) {
    for (const l of roadTypeLines)
      if (l.warn) checks.push(`${l.text.split(":")[0]}: Check it.`);
  }
  // S5: open at first render when a field inside needs the operator now
  // (an error, the carriageway question, a speed nobody has set), so no
  // blocker hides (P3).  Never opens or closes by itself after that (P1).
  const needsNow = panelWhys.some(
    ([label, w]) =>
      w && (w.error || w.alert || (label === "Speed" && w.source === "unset")),
  );
  const [measuredOpen, setMeasuredOpen] = useState(needsNow);

  // --- About the work: the dates (ruling 7, S8, S9) -----------------------------
  const schedule = scenario.schedule ?? null;
  const workDate = schedule?.work_date ?? "";
  const workDateEnd = schedule?.work_date_end ?? "";
  const dates = workDatesWhy(workDate, workDateEnd);
  const [windowsOpen, setWindowsOpen] = useState(false);

  // --- File details (ruling 1) --------------------------------------------------
  const [filesOpen, setFilesOpen] = useState(false);
  const project = projectWhy(scenario.meta.project);
  const location = locationWhy(scenario.meta.locationDescription ?? "");
  const filesUnset = [
    scenario.meta.project,
    scenario.meta.locationDescription ?? "",
  ].filter((v) => !v).length;

  const boxRows: Record<BoxField, ReactNode> = {
    road_type: roadTypeRow,
    street_class: streetClassRow,
    jurisdiction_key: jurisdictionRow,
    speed: speedRow,
  };
  const n = boxFields.length;

  return (
    <OpenBand
      stepIndex={stepIndex}
      head="WHAT"
      provenance=""
      question="What's the job?"
      // R129 Q4 (Ryan): a guessed cross-street speed counts among the
      // line's guesses; its row stays with the kind's fields below (S1).
      questionProvenance={introLine(
        n + (isGuessed(scenario, "approach_speed") ? 1 : 0),
        detected !== null,
      )}
    >
      <div className="w-what">
        {n > 0 && (
          <div
            className="w-box"
            role="group"
            aria-labelledby="what-box-head"
            data-testid="what-guesses"
          >
            <p
              className="w-box-head"
              id="what-box-head"
              data-testid="what-guesses-head"
            >
              {boxHeading(n)}
            </p>
            {boxFields.map((f) => boxRows[f])}
          </div>
        )}

        <div
          className="w-sec"
          role="group"
          aria-labelledby="what-about-head"
          data-testid="what-about"
        >
          <p className="w-sec-head" id="what-about-head">
            About the work
          </p>
          {/* #520 (Ryan, 2026-11-11, ruling 1: "The rows end together"): one
              grid of cells in reading order, two to a row, so each row's
              cells share its height and the last row's content ends
              together (globals.css .w-grid).  The DOM order is unchanged. */}
          <div className="a-col w-grid" data-testid="what-about-grid">
            <JobCells scenario={scenario} setScenario={setScenario} />
            <WhyCell
              label="Work dates"
              htmlFor="what-date"
              testid="work-dates"
              source={dates.source}
              tip={dates.tip}
            >
              <DateRangePicker
                id="what-date"
                label="Work dates"
                start={workDate}
                end={workDateEnd}
                disabled={locked}
                describedBy={workDate ? undefined : "what-date-hint"}
                onPick={(d) => setScenario(setWorkDates(scenario, d))}
              />
              {!workDate ? (
                <span
                  className="tr-note"
                  id="what-date-hint"
                  data-testid="what-dates-hint"
                >
                  {datesHint(jurisdictionName)}
                </span>
              ) : (
                windowsLine && (
                  <div className="w-hours" data-testid="what-hours">
                    <span className="tr-help" data-testid="what-windows-line">
                      {hoursFrame(jurisdictionName)}{" "}
                      <span className={windowsLine.tone}>
                        {windowsLine.glyph ? `${windowsLine.glyph} ` : ""}
                        {windowsLine.text}
                      </span>
                    </span>
                    {jurisdictionName && scheduleWindows && (
                      <button
                        type="button"
                        className="w-link"
                        data-read=""
                        aria-expanded={windowsOpen}
                        onClick={() => setWindowsOpen((o) => !o)}
                        data-testid="what-hours-all"
                      >
                        {seeAllHours(jurisdictionName)}
                      </button>
                    )}
                    {windowsOpen && scheduleWindows}
                  </div>
                )
              )}
            </WhyCell>
            {/* The dates' time rows (ScheduleField), once a date stands. */}
            {scheduleCells}
          </div>
        </div>

        <DisclosureRow
          id="what-measured-panel"
          // #517 round 1 (Rule 10, R145 S22): with no confirmed road nothing
          // here was measured, so the row is titled for what it holds.
          title={measuredTitle}
          line={measuredLine}
          extra={measuredExtra}
          checks={checks}
          open={measuredOpen}
          onToggle={() => setMeasuredOpen((o) => !o)}
          openWord="Done"
          closedWord="Change"
          testid="what-measured"
        >
          {/* #520: the same shared-row grid as About the work. */}
          <div className="a-col w-grid" data-testid="what-road-grid">
            {!inBox("speed") && speedRow}
            {lanesRow}
            {laneWidthRow}
            {!inBox("road_type") && roadTypeRow}
            {!inBox("street_class") && streetClassRow}
            <CarriagewayCells
              scenario={scenario}
              setScenario={setScenario}
              detected={detected}
            />
            {!inBox("jurisdiction_key") && jurisdictionRow}
          </div>
        </DisclosureRow>

        <DisclosureRow
          id="what-files-panel"
          title="File details (optional)"
          line={fileDetailsLine(filesUnset)}
          open={filesOpen}
          onToggle={() => setFilesOpen((o) => !o)}
          openWord="Hide"
          closedWord="Show"
          testid="what-files"
        >
          <div className="a-col w-grid" data-testid="what-files-grid">
            <WhyCell
              label="Project name"
              htmlFor="what-project"
              testid="project"
              source={project.source}
              tip={project.tip}
            >
              <input
                id="what-project"
                className={`a-fld w-fld${scenario.meta.project ? "" : " is-unset"}`}
                data-write=""
                disabled={locked}
                placeholder="Not set"
                value={scenario.meta.project}
                onChange={(e) =>
                  setMeta({ ...scenario.meta, project: e.target.value })
                }
              />
            </WhyCell>
            <WhyCell
              label="Location description"
              htmlFor="what-location-description"
              testid="location-description"
              source={location.source}
              tip={location.tip}
            >
              <input
                id="what-location-description"
                className={`a-fld w-fld${scenario.meta.locationDescription ? "" : " is-unset"}`}
                data-write=""
                disabled={locked}
                placeholder="Not set"
                value={scenario.meta.locationDescription ?? ""}
                onChange={(e) =>
                  setMeta({
                    ...scenario.meta,
                    locationDescription: e.target.value,
                  })
                }
              />
            </WhyCell>
          </div>
        </DisclosureRow>
      </div>

      {/* R1 — the kind's own fields.  Never behind a disclosure: the
          near-intersection hold is a rail blocker and rule 139 keeps the
          chain visible. */}
      {kindFields && <div className="a-kindrow">{kindFields}</div>}
    </OpenBand>
  );
}
