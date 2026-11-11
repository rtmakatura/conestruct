"use client";

// #517 (UX group 7, 2026-11-11): these rows now render as WhyCells — a
// plain source line with a why tip (ruling 5) — and every list is the
// shared Listbox (ruling 6).  Street class is a listbox (S7: every guess
// row has a dropdown); the Carriageway answer moves into the "Measured
// from the map" row unchanged (S6: same writer, same
// `carriageway.confirmed`).  The job's rows are "About the work" (ruling
// 1); "Hours" reads "Work hours" and "Work type" reads "Type of work".
//
// R107 (setup-what-redesign, 2026-10-07): the WHAT band's rows beyond its
// first three — street class, the carriageway or the Divided toggle in
// "The road"; work type, hours and the speed reduction in "The job" — as
// rows of the band's two columns (WhatC5.dc.html).  R107's labels: "Street
// class, Carriageway (One-way / Divided), Hours and Speed reduction", each
// a segmented control split evenly (R107: "this fixes the empty gap after
// 'Arterial'").  R108: the street class is prefilled from the road and
// marked as a guess; there is no Confirm.  R110 Q8 as amended by Ryan,
// 2026-10-26 (#411): Hours and Speed reduction read plain "default", with
// no mark, until changed, then "✓ yours"; the reduction's off option
// reads "None".
//
// Earlier rulings this keeps (each still stands):
//   #289 hand-check, correction 1 — the flagger's four recovery confirms
//   (#136, #86, #158, #173, each with its #177 record and #179 untick) and
//   the near-intersection's approach set are BACKEND GATES and their
//   recovery affordances, not plan inputs: they render below the band,
//   unchanged.
//   The reduction keeps ShoulderForm's rule (a reduction at or above the
//   posted speed means "no reduction"); the Divided toggle keeps its lanes
//   default — the same flip `setRoadType` performs, #85's single-sourcing.
//   Nothing here computes a compliance value (rule 3).

import type { ReactNode } from "react";
import type { Scenario, ScenarioKind, ShoulderScenario } from "@/lib/scenarios";
import type { JurisdictionBlock, StreetClass } from "@/lib/jurisdiction";
import { PLAN_DETAILS } from "@/lib/scenarios/what-cells";
import { laneWidthCeilingFt } from "@/lib/scenarios/validation";
import { isKindDefault } from "@/lib/scenarios";
import { setNight, setWorkType, setWorkZoneSpeed } from "@/lib/scenarios/what-writes";
import { isOperatorSet, setStreetClassByOperator } from "@/lib/scenarios/guesses";
import {
  carriagewayApplies,
  carriagewayVerdict,
  type CarriagewayFacts,
} from "@/lib/road-detection/carriageway";
import {
  carriagewayWhy,
  dividedWhy,
  nightWhy,
  reductionWhy,
  streetClassWhy,
  workTypeWhy,
  workZoneSpeedWhy,
} from "@/lib/scenarios/why-lines";
import type { DetectedModel } from "@/lib/road-detection/detected-rows";
import { useWriteLock } from "../WriteLock";
import { Segmented, WhyCell } from "./FieldCell";
import { Listbox } from "../ui/Listbox";
import { STREET_CLASSES, StreetClassEvidence } from "../JurisdictionSection";

/** #308 — the carriageway facts when the road is a street-class one-way
 *  (the only roads the question applies to); null otherwise.  #309: the
 *  near-intersection kind relays them too (R114 Q4). */
export function oneWayFacts(scenario: Scenario): CarriagewayFacts | null {
  if (scenario.kind !== "shoulder" && scenario.kind !== "near_intersection") return null;
  if (!scenario.carriageway) return null;
  const f = scenario.carriageway;
  return carriagewayApplies(f.oneway, f.highwayClass) ? f : null;
}

/** Does this scenario show the explicit divided toggle?  #85: every road
 *  type but `urban_arterial` derives `divided` from itself, so the
 *  toggle is a row only where the value is genuinely the operator's.
 *  #308: on a one-way road the carriageway row carries the same fact,
 *  so the toggle steps aside — one control per fact (P2). */
export function showsDividedToggle(scenario: Scenario): boolean {
  // #332: a two-way trunk is undivided by the backend's verdict, which the
  // toggle couldn't change (P2: no control the plan ignores).
  const cw = "carriageway" in scenario ? scenario.carriageway : undefined;
  return (
    PLAN_DETAILS[scenario.kind]?.dividedToggle === true &&
    scenario.roadType === "urban_arterial" &&
    oneWayFacts(scenario) === null &&
    carriagewayVerdict(cw) !== "undivided"
  );
}

/** #517: a guess row's state in the box (S1, S2), or null outside it. */
export interface BoxState {
  reason: string;
  checked: boolean;
}

/** The job's rows (ruling 1's "About the work"): type of work, work
 *  hours, the speed reduction and its limit. */
export function JobCells({
  scenario,
  setScenario,
}: {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
}): ReactNode {
  const locked = useWriteLock();
  const table = PLAN_DETAILS[scenario.kind as ScenarioKind];
  if (!table) return null;
  const wz = "workZoneSpeed" in scenario ? scenario.workZoneSpeed : undefined;
  const delta = wz !== undefined ? scenario.speed - wz : 0;
  // #397: the kind's own default reads "Default" until changed (Ryan,
  // 2026-10-26, amending R110 Q8); never "Set by you" for a value nobody
  // picked (Rule 10).
  const workType = workTypeWhy(!isKindDefault(scenario, "workType"));
  const night = nightWhy(isOperatorSet(scenario, "night") || scenario.night);
  const reduction = reductionWhy(isOperatorSet(scenario, "workZoneSpeed") || wz !== undefined);
  const wzWhy = workZoneSpeedWhy(delta);
  return (
    <>
      <WhyCell
        label="Type of work"
        htmlFor="pd-work-type"
        source={workType.source}
        tip={workType.tip}
        testid="work-type"
      >
        <Listbox
          id="pd-work-type"
          label="Type of work"
          disabled={locked}
          value={(scenario as { workType: string }).workType}
          options={table.workTypes.map((w) => ({ value: w.v, label: w.l }))}
          onChange={(v) => setScenario(setWorkType(scenario, v))}
        />
      </WhyCell>

      <WhyCell label="Work hours" source={night.source} tip={night.tip} testid="night">
        <Segmented
          name="Work hours"
          options={[
            { v: false, l: "Daytime" },
            { v: true, l: "Night" },
          ]}
          value={scenario.night}
          onChange={(v) => setScenario(setNight(scenario, v))}
          locked={locked}
        />
      </WhyCell>

      {table.speedReduction && (
        <WhyCell
          label="Speed reduction"
          source={reduction.source}
          tip={reduction.tip}
          testid="reduction"
        >
          <Segmented
            name="Speed reduction"
            options={[
              { v: false, l: "None" },
              { v: true, l: "Reduced" },
            ]}
            value={wz !== undefined}
            onChange={(v) =>
              setScenario(
                setWorkZoneSpeed(scenario, v ? Math.max(25, scenario.speed - 10) : undefined),
              )
            }
            locked={locked}
          />
        </WhyCell>
      )}

      {table.speedReduction && wz !== undefined && (
        <WhyCell
          label="Work-zone speed limit"
          htmlFor="pd-wz-speed"
          source={wzWhy.source}
          tip={wzWhy.tip}
          testid="wz-speed"
        >
          <input
            id="pd-wz-speed"
            type="number"
            className="a-fld w-fld"
            data-write=""
            disabled={locked}
            min={20}
            max={scenario.speed}
            value={wz}
            onChange={(e) => setScenario(setWorkZoneSpeed(scenario, +e.target.value || 0))}
          />
        </WhyCell>
      )}
    </>
  );
}

/** The street class row: a guess row in the box, or a road row in the
 *  measured panel (S3). */
export function StreetClassCell({
  scenario,
  setScenario,
  jurisdictionBlock = null,
  box = null,
}: {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  jurisdictionBlock?: JurisdictionBlock | null;
  box?: BoxState | null;
}): ReactNode {
  const locked = useWriteLock();
  const why = streetClassWhy(scenario);
  const tier =
    scenario.guesses?.street_class?.highwayClass ??
    (scenario.meta.confirmedRoad &&
    scenario.meta.confirmedRoad.pinLat === scenario.meta.lat &&
    scenario.meta.confirmedRoad.pinLng === scenario.meta.lng
      ? scenario.meta.confirmedRoad.candidate.highway_class
      : null);
  return (
    <WhyCell
      label="Street class"
      htmlFor="what-street-class"
      source={box ? (box.checked ? "checked" : "guess") : why.source}
      reason={box ? box.reason : null}
      tip={why.tip}
      info={<StreetClassEvidence tier={tier} jurisdiction={jurisdictionBlock} />}
      testid="street-class"
    >
      <Listbox
        id="what-street-class"
        label="Street class"
        disabled={locked}
        value={scenario.street_class ?? null}
        options={STREET_CLASSES.map(([v, l]) => ({ value: v, label: l }))}
        // S2: picking a value, the one it holds included, is the check.
        onChange={(c) => setScenario(setStreetClassByOperator(scenario, c as StreetClass))}
      />
    </WhyCell>
  );
}

/** The carriageway rows: the urban-arterial Divided control, or #308's
 *  one-way answer (S6: this is the answer's one writer; the map window
 *  reads it). */
export function CarriagewayCells({
  scenario,
  setScenario,
  detected,
}: {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  detected: DetectedModel | null;
}): ReactNode {
  const locked = useWriteLock();
  const carriageway = oneWayFacts(scenario);
  const divided = showsDividedToggle(scenario) ? dividedWhy(scenario, detected) : null;
  const cw = carriageway ? carriagewayWhy(carriageway) : null;
  return (
    <>
      {divided && (
        <WhyCell label="Carriageway" source={divided.source} tip={divided.tip} testid="divided">
          <Segmented
            name="Carriageway"
            options={[
              { v: false, l: "Undivided" },
              { v: true, l: "Divided" },
            ]}
            value={Boolean((scenario as { divided?: boolean }).divided)}
            onChange={(v) =>
              // The deleted ShoulderForm's flip, carried whole
              // (components/ShoulderForm.tsx:56-63 at ccef2ee): the
              // divided-ness change drags the lane default with it,
              // exactly as `setRoadType` does.
              setScenario({
                ...scenario,
                divided: v,
                lanes: v ? 2 : 1,
              } as Scenario)
            }
            locked={locked}
          />
        </WhyCell>
      )}

      {carriageway && cw && (
        <WhyCell
          label="Carriageway"
          source={cw.source}
          tip={cw.tip}
          alertLine={cw.alert ?? null}
          testid="carriageway"
        >
          <Segmented
            name="Carriageway"
            options={[
              { v: false, l: "One-way" },
              { v: true, l: "Divided" },
            ]}
            value={
              carriagewayVerdict(carriageway) === "undecided"
                ? null
                : carriagewayVerdict(carriageway) === "divided"
            }
            onChange={(v) => {
              const confirmed = v ? ("divided" as const) : ("one_way_street" as const);
              if (scenario.kind === "near_intersection") {
                // #309 R114: only the answer.  The kind's wire `divided`
                // stays false; a divided verdict builds one carriageway
                // signed on both sides, the median side included (#312, R134).
                setScenario({ ...scenario, carriageway: { ...carriageway, confirmed } });
                return;
              }
              // #308 (R83): the operator's answer rides the facts to the
              // backend, which builds from it; divided-ness follows, and
              // the lanes refit if divided's wider shoulder would overrun
              // the sheet (the same ceiling auto-apply fits to).
              const s = scenario as ShoulderScenario;
              const ceiling = laneWidthCeilingFt("shoulder", s.lanes, v);
              setScenario({
                ...s,
                divided: v,
                laneWidth: Math.min(s.laneWidth, ceiling),
                carriageway: { ...carriageway, confirmed },
              });
            }}
            locked={locked}
          />
        </WhyCell>
      )}
    </>
  );
}

/** The pre-#517 entry point, kept for callers that render one group:
 *  road = street class then the carriageway rows; job = JobCells. */
export function PlanDetailCells({
  group,
  scenario,
  setScenario,
  jurisdictionBlock = null,
  detected = null,
}: {
  group: "road" | "job";
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  jurisdictionBlock?: JurisdictionBlock | null;
  detected?: DetectedModel | null;
}): ReactNode {
  if (!PLAN_DETAILS[scenario.kind as ScenarioKind]) return null;
  if (group === "job") return <JobCells scenario={scenario} setScenario={setScenario} />;
  return (
    <>
      <StreetClassCell
        scenario={scenario}
        setScenario={setScenario}
        jurisdictionBlock={jurisdictionBlock}
      />
      <CarriagewayCells scenario={scenario} setScenario={setScenario} detected={detected} />
    </>
  );
}
