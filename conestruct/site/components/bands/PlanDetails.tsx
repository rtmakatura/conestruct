"use client";

// R107 (setup-what-redesign, 2026-10-07): the WHAT band's rows beyond its
// first three — street class, the carriageway or the Divided toggle in
// "The road"; work type, hours and the speed reduction in "The job" — as
// rows of the band's two columns (WhatC5.dc.html).  R107's labels: "Street
// class, Carriageway (One-way / Divided), Hours and Speed reduction", each
// a segmented control split evenly (R107: "this fixes the empty gap after
// 'Arterial'").  R108: the street class is prefilled from the road and
// marked as a guess; there is no Confirm.  R110 Q8: Hours and Speed
// reduction read "✓ default" until changed, then "✓ yours"; the
// reduction's off option reads "None".
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
import { setNight, setWorkZoneSpeed } from "@/lib/scenarios/what-writes";
import {
  isGuessed,
  isOperatorSet,
  setStreetClassByOperator,
} from "@/lib/scenarios/guesses";
import {
  carriagewayApplies,
  carriagewayVerdict,
  TWIN_RADIUS_M,
  type CarriagewayFacts,
} from "@/lib/road-detection/carriageway";
import { markerOf } from "@/lib/scenarios/provenance-marker";
import { useWriteLock } from "../WriteLock";
import { FieldCell, Segmented } from "./FieldCell";
import { STREET_CLASSES, StreetClassEvidence } from "../JurisdictionSection";

/** #308 — the carriageway facts when the road is a street-class one-way
 *  (the only roads the question applies to); null otherwise.  #309: the
 *  near-intersection kind relays them too (R114 Q4). */
function oneWayFacts(scenario: Scenario): CarriagewayFacts | null {
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
  return (
    PLAN_DETAILS[scenario.kind]?.dividedToggle === true &&
    scenario.roadType === "urban_arterial" &&
    oneWayFacts(scenario) === null
  );
}

/** #308 — the carriageway row's provenance: whose answer it shows. */
function carriagewayProvenance(f: CarriagewayFacts): string {
  if (f.confirmed) return "your answer · operator-set from here on";
  const verdict = carriagewayVerdict(f);
  if (verdict === "undecided") return "⚠ needs you · the map couldn't tell";
  if (verdict === "divided") return `detected · a same-name carriageway ${f.twinDistanceM} m away`;
  return `detected · no same-name carriageway within ${TWIN_RADIUS_M} m`;
}

/** R108 — the street class's provenance: a guess off the road (its tag
 *  named), the operator's pick, or not set. */
export function streetClassProvenance(scenario: Scenario): { text: string; amber: boolean } {
  const guess = scenario.guesses?.street_class;
  if (guess && isGuessed(scenario, "street_class")) {
    return {
      text: `guessed, not confirmed · OSM highway=${guess.highwayClass} · from the road`,
      amber: true,
    };
  }
  return scenario.street_class
    ? { text: "your change · operator-set from here on", amber: false }
    : { text: "not set · operator-set when picked", amber: false };
}

/** R110 Q8 — "✓ default" until changed, then "✓ yours".  A value away
 *  from the default is the operator's even on a plan saved before the
 *  record existed. */
function defaultOrYours(mine: boolean, defaultLine: string): string {
  return mine ? "your change · operator-set from here on" : defaultLine;
}

/** One row, in the band's register — WhatBand's `Cell` in every respect
 *  that matters (label, control, rule 137's line as a marker), kept local
 *  because the WHAT rows own a detection model this group has no use for. */
function Cell({
  label,
  htmlFor,
  provenance,
  amber = false,
  line = null,
  detail = null,
  children,
  testid,
}: {
  label: string;
  htmlFor?: string;
  provenance: string;
  amber?: boolean;
  /** A detection fact about THIS field (fix 3), behind its marker. */
  line?: { key: string; text: string; amber: boolean } | null;
  /** Anything else about the field (street class's evidence). */
  detail?: ReactNode;
  children: ReactNode;
  testid: string;
}) {
  const hasDetail = line !== null || (detail !== null && detail !== undefined);
  return (
    <FieldCell
      label={label}
      htmlFor={htmlFor}
      testid={testid}
      provenance={
        <span
          className={`tr-prov${amber ? " is-amber" : ""}`}
          data-testid={`prov-${testid}`}
        >
          {amber ? `⚠ ${provenance}` : provenance}
        </span>
      }
      // R98: the line as one quiet marker; "⚠ needs you" stays a line.
      marker={markerOf(provenance, { amber })}
      info={
        hasDetail ? (
          <>
            {line && (
              <span
                className={`tr-prov${line.amber ? " is-amber" : ""}`}
                data-testid={`detect-${line.key}`}
              >
                {line.amber ? `⚠ ${line.text}` : line.text}
              </span>
            )}
            {detail}
          </>
        ) : null
      }
    >
      {children}
    </FieldCell>
  );
}

/** R107 — the rows the first three don't hold, rendered INSIDE the WHAT
 *  band's two columns (a fragment, never a wrapper: the column is the
 *  band's):
 *
 *    road  street class, then the Divided toggle or #308's carriageway;
 *    job   work type, hours, the speed reduction and its limit. */
export function PlanDetailCells({
  group,
  scenario,
  setScenario,
  dividedLine = null,
  jurisdictionBlock = null,
}: {
  group: "road" | "job";
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  /** #289 hand-check, 2026-09-23, fix 3: "divided under the Divided
   *  control."  Null when detection has nothing to say, or when there is
   *  no Divided control to sit under — the road-type row takes it then. */
  dividedLine?: { key: string; text: string; amber: boolean } | null;
  /** For the street class's map caveat (the jurisdiction's adopted
   *  classification map governs, not the road tier). */
  jurisdictionBlock?: JurisdictionBlock | null;
}): ReactNode {
  const locked = useWriteLock();
  const table = PLAN_DETAILS[scenario.kind as ScenarioKind];
  if (!table) return null;

  const wz = "workZoneSpeed" in scenario ? scenario.workZoneSpeed : undefined;
  const delta = wz !== undefined ? scenario.speed - wz : 0;
  const carriageway = oneWayFacts(scenario);

  if (group === "job") {
    return (
      <>
        <Cell
          label="Work type"
          htmlFor="pd-work-type"
          provenance="your change · operator-set from here on"
          testid="work-type"
        >
          <select
            id="pd-work-type"
            className="a-fld"
            data-write=""
            disabled={locked}
            value={(scenario as { workType: string }).workType}
            onChange={(e) =>
              setScenario({ ...scenario, workType: e.target.value } as Scenario)
            }
          >
            {table.workTypes.map((w) => (
              <option key={w.v} value={w.v}>
                {w.l}
              </option>
            ))}
          </select>
        </Cell>

        <Cell
          label="Hours"
          provenance={defaultOrYours(
            isOperatorSet(scenario, "night") || scenario.night,
            "default · daytime; night work adds retroreflective devices",
          )}
          testid="night"
        >
          <Segmented
            name="Hours"
            options={[
              { v: false, l: "Daytime" },
              { v: true, l: "Night" },
            ]}
            value={scenario.night}
            onChange={(v) => setScenario(setNight(scenario, v))}
            locked={locked}
          />
        </Cell>

        {table.speedReduction && (
          <Cell
            label="Speed reduction"
            provenance={defaultOrYours(
              isOperatorSet(scenario, "workZoneSpeed") || wz !== undefined,
              "default · no lower limit through the zone",
            )}
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
                  setWorkZoneSpeed(
                    scenario,
                    v ? Math.max(25, scenario.speed - 10) : undefined,
                  ),
                )
              }
              locked={locked}
            />
          </Cell>
        )}

        {table.speedReduction && wz !== undefined && (
          <Cell
            label="Work-zone speed limit"
            htmlFor="pd-wz-speed"
            provenance={
              delta > 15
                ? `Δ${delta} mph · S-630-1 Sheet 2 Note 3: ${Math.ceil(delta / 15)} stepped sign installations`
                : `Δ${delta} mph · S-630-1 Sheet 2 Note 3: 1 advance sign`
            }
            testid="wz-speed"
          >
            <input
              id="pd-wz-speed"
              type="number"
              className="a-fld"
              data-write=""
              disabled={locked}
              min={20}
              max={scenario.speed}
              value={wz}
              onChange={(e) =>
                setScenario(setWorkZoneSpeed(scenario, +e.target.value || 0))
              }
            />
          </Cell>
        )}
      </>
    );
  }

  const classProv = streetClassProvenance(scenario);
  const tier =
    scenario.guesses?.street_class?.highwayClass ??
    (scenario.meta.confirmedRoad &&
    scenario.meta.confirmedRoad.pinLat === scenario.meta.lat &&
    scenario.meta.confirmedRoad.pinLng === scenario.meta.lng
      ? scenario.meta.confirmedRoad.candidate.highway_class
      : null);
  const classEvidence = (
    <StreetClassEvidence tier={tier} jurisdiction={jurisdictionBlock} />
  );

  return (
    <>
      <Cell
        label="Street class"
        provenance={classProv.text}
        amber={classProv.amber}
        detail={classEvidence}
        testid="street-class"
      >
        <Segmented<StreetClass>
          name="Street class"
          options={STREET_CLASSES.map(([v, l]) => ({ v, l }))}
          value={scenario.street_class ?? null}
          onChange={(c) => setScenario(setStreetClassByOperator(scenario, c))}
          locked={locked}
        />
      </Cell>

      {showsDividedToggle(scenario) && (
        <Cell
          label="Divided highway"
          provenance="median present · every other road type sets this itself (#85)"
          line={dividedLine}
          testid="divided"
        >
          <Segmented
            name="Divided highway"
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
        </Cell>
      )}

      {carriageway && (
        <Cell
          label="Carriageway"
          provenance={carriagewayProvenance(carriageway)}
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
                // #309 R114: only the answer.  The kind rejects divided,
                // and a divided verdict keeps today's plan (Q3 (a)).
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
        </Cell>
      )}
    </>
  );
}
