"use client";

import { useState } from "react";
import {
  FLAGGER_WORK_TYPES,
  type FlaggerLaneClosureScenario,
  type FlaggerRoadType,
  type FlaggerWorkType,
} from "@/lib/scenarios";
import {
  ONEWAY_BLOCKING,
  appendDetectionOverride,
  flaggerLaneIneligibleHigh,
  lastDetectionOverride,
  overrideDetectedClause,
  undoDetectionOverride,
} from "@/lib/scenarios/auto-apply";
import { validateWorkZone } from "@/lib/scenarios/validation";
import {
  CheckRow,
  Field,
  FieldErrorLine,
  FieldGroup,
  LabelRow,
} from "./GeneratorFormPrimitives";

const ROAD_TYPES: Array<{ v: FlaggerRoadType; l: string }> = [
  { v: "rural_undivided", l: "Rural — 2-lane 2-way" },
  { v: "urban_arterial", l: "Urban arterial" },
];

interface Props {
  scenario: FlaggerLaneClosureScenario;
  setScenario: (next: FlaggerLaneClosureScenario) => void;
}

export function FlaggerForm({ scenario, setScenario }: Props) {
  const set = <K extends keyof FlaggerLaneClosureScenario>(
    key: K,
    value: FlaggerLaneClosureScenario[K],
  ) => setScenario({ ...scenario, [key]: value });

  // UX-21: inline schema-bound validation on the work-zone field
  // (required / 20,000-ft ceiling; blur-gated error text — live button
  // gating lives in GeneratorSidebar).  The MUTCD taper floor is
  // backend-owned (engine-removal PR D): it surfaces via the StatusBar's
  // INVALID INPUT and the Generate gate, not inline here.
  const [wzTouched, setWzTouched] = useState(false);
  const wzValidation = validateWorkZone(scenario);

  // #179: each confirm row is two-state now — armed (the relay is
  // present and the backend gate refuses) or confirmed (the tick's #177
  // marker is on record).  The states are mutually exclusive per via by
  // construction: only the tick erases relays while appending its
  // marker, and every path that re-attaches relays (re-detection,
  // settled-null save, kind switch with a confirmed road) resets the
  // marker list in the same patch.  A confirmed row stays mounted,
  // checked, describing what it overrode; unticking removes the marker
  // and restores its recorded relay values, so the original refusal
  // honestly re-derives (strip → VERIFYING → the 400 returns).
  //
  // Announcements are deliberately left to the two existing channels
  // (#179 ruling): the row's native role="checkbox" + aria-checked flip
  // speaks the state change, and the StatusBar's polite live region
  // (fix-spec-02 P1·05) speaks the consequence (VERIFYING → the verdict).
  // No third voice.  Focus never moves: the row no longer unmounts on
  // tick, so tick and untick keep the keyboard where it was.
  const singleLaneMarker = lastDetectionOverride(
    scenario.detectionOverrides,
    "flagger_single_lane_confirm",
  );
  const multilaneMarker = lastDetectionOverride(
    scenario.detectionOverrides,
    "flagger_multilane_confirm",
  );
  const twowayMarker = lastDetectionOverride(
    scenario.detectionOverrides,
    "flagger_twoway_confirm",
  );
  const singleLaneArmed = scenario.detectedLanesTotal === 1;
  const multilaneArmed = flaggerLaneIneligibleHigh(
    scenario.detectedLanesTotal,
    scenario.detectedLanesForward,
    scenario.detectedLanesBackward,
    scenario.detectedLanesBothWays,
  );
  const twowayArmed =
    scenario.oneway !== undefined && ONEWAY_BLOCKING.has(scenario.oneway);
  // Confirmed-row description: built ONLY from the marker's recorded
  // fields — never a value detection didn't report.
  const confirmedDesc = (m: NonNullable<typeof singleLaneMarker>) =>
    `Map data reported ${overrideDetectedClause(m)} — untick to restore detection`;

  return (
    <>
      <FieldGroup label="Road" step={3}>
        <Field>
          <LabelRow htmlFor="fl-road-type">Road type</LabelRow>
          <select id="fl-road-type"
            className="field-input field-select"
            value={scenario.roadType}
            onChange={(e) =>
              set("roadType", e.target.value as FlaggerRoadType)
            }
          >
            {ROAD_TYPES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </select>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1.5">
            TA-10 applies to roads with one through lane in each direction
          </div>
        </Field>

        {/* Single-lane recovery (issue #136): a flagger has no lane-count
            field (TA-10 is definitionally one lane each direction), so
            when detection relays a genuinely single-lane road the backend
            blocks generation.  This confirm is the operator's recovery
            path — asserting the road has a lane in each direction clears
            the relayed signal and lifts the block. */}
        {(singleLaneArmed || singleLaneMarker !== null) && (
          <CheckRow
            on={!singleLaneArmed && singleLaneMarker !== null}
            label="Road has one lane in each direction"
            desc={
              singleLaneArmed || singleLaneMarker === null
                ? "Detection saw a single-lane road — confirm to enable this plan"
                : confirmedDesc(singleLaneMarker)
            }
            onToggle={() => {
              if (!singleLaneArmed && singleLaneMarker !== null) {
                // Untick (#179): remove the marker, restore the recorded
                // relay — the single-lane refusal honestly re-derives.
                const undo = undoDetectionOverride(
                  scenario.detectionOverrides,
                  "flagger_single_lane_confirm",
                );
                setScenario({
                  ...scenario,
                  detectedLanesTotal: undo.marker?.detectedLanesTotal,
                  detectionOverrides: undo.overrides,
                });
                return;
              }
              setScenario({
                ...scenario,
                detectedLanesTotal: undefined,
                // Record what this confirm erased (#177) — the row only
                // arms in the disputed (gate-refused) state.
                detectionOverrides: appendDetectionOverride(
                  scenario.detectionOverrides,
                  {
                    via: "flagger_single_lane_confirm",
                    detectedLanesTotal: scenario.detectedLanesTotal,
                    asserted: "one lane in each direction",
                  },
                ),
              });
            }}
          />
        )}

        {/* Multi-lane recovery (issue #86): TA-10 applies where one through
            lane runs in each direction, so when detection relays a total
            above the eligibility ceiling (4+, or an undecomposable 3) the
            backend blocks generation.  This confirm is the operator's
            recovery path — asserting the road's true shape clears ALL four
            lane relays (leaving a per-direction relay behind after the
            operator asserts 1+1 would be contradictory data). */}
        {(multilaneArmed || multilaneMarker !== null) && (
          <CheckRow
            on={!multilaneArmed && multilaneMarker !== null}
            label="Road has one through lane in each direction"
            desc={
              multilaneArmed || multilaneMarker === null
                ? "Detection saw a multi-lane road — confirm to enable this plan"
                : confirmedDesc(multilaneMarker)
            }
            onToggle={() => {
              if (!multilaneArmed && multilaneMarker !== null) {
                // Untick (#179): restore all four recorded lane relays —
                // fields absent from the marker restore as absent.
                const undo = undoDetectionOverride(
                  scenario.detectionOverrides,
                  "flagger_multilane_confirm",
                );
                setScenario({
                  ...scenario,
                  detectedLanesTotal: undo.marker?.detectedLanesTotal,
                  detectedLanesForward: undo.marker?.detectedLanesForward,
                  detectedLanesBackward: undo.marker?.detectedLanesBackward,
                  detectedLanesBothWays: undo.marker?.detectedLanesBothWays,
                  detectionOverrides: undo.overrides,
                });
                return;
              }
              setScenario({
                ...scenario,
                detectedLanesTotal: undefined,
                detectedLanesForward: undefined,
                detectedLanesBackward: undefined,
                detectedLanesBothWays: undefined,
                // Record what this confirm erased (#177) — the row only
                // arms in the disputed (gate-refused) state.  Only
                // the relays present at erase time land on the marker
                // (undefined fields drop at JSON serialization).
                detectionOverrides: appendDetectionOverride(
                  scenario.detectionOverrides,
                  {
                    via: "flagger_multilane_confirm",
                    detectedLanesTotal: scenario.detectedLanesTotal,
                    detectedLanesForward: scenario.detectedLanesForward,
                    detectedLanesBackward: scenario.detectedLanesBackward,
                    detectedLanesBothWays: scenario.detectedLanesBothWays,
                    asserted: "one through lane in each direction",
                  },
                ),
              });
            }}
          />
        )}

        {/* One-way recovery (issue #158): a flagger (TA-10) alternates
            traffic between two opposing directions, so when detection relays
            a one-way OSM tag the backend blocks generation.  This confirm is
            the operator's recovery path for a misdetection — asserting the
            road carries two-way traffic clears the relayed signal and lifts
            the block. */}
        {(twowayArmed || twowayMarker !== null) && (
          <CheckRow
            on={!twowayArmed && twowayMarker !== null}
            label="Road carries two-way traffic"
            desc={
              twowayArmed || twowayMarker === null
                ? "Detection saw a one-way street — confirm to enable this plan"
                : confirmedDesc(twowayMarker)
            }
            onToggle={() => {
              if (!twowayArmed && twowayMarker !== null) {
                // Untick (#179): restore the recorded oneway tag — the
                // directionality refusal honestly re-derives.
                const undo = undoDetectionOverride(
                  scenario.detectionOverrides,
                  "flagger_twoway_confirm",
                );
                setScenario({
                  ...scenario,
                  oneway: undo.marker?.detectedOneway,
                  detectionOverrides: undo.overrides,
                });
                return;
              }
              setScenario({
                ...scenario,
                oneway: undefined,
                // Record what this confirm erased (#177) — the row only
                // arms in the disputed (gate-refused) state.
                detectionOverrides: appendDetectionOverride(
                  scenario.detectionOverrides,
                  {
                    via: "flagger_twoway_confirm",
                    detectedOneway: scenario.oneway,
                    asserted: "two-way traffic",
                  },
                ),
              });
            }}
          />
        )}

        <Field>
          <LabelRow htmlFor="fl-speed" value={`${scenario.speed} mph`}>Speed limit</LabelRow>
          <input id="fl-speed"
            type="range"
            min="25"
            max="55"
            step="5"
            value={scenario.speed}
            onChange={(e) => set("speed", +e.target.value)}
            className="range-orange w-full my-1.5"
          />
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1.5">
            MUTCD: ≥45 mph uses L=W·S
          </div>
        </Field>

        <Field>
          <LabelRow htmlFor="fl-lane-width" value={`${scenario.laneWidth} ft`}>Lane width</LabelRow>
          <input id="fl-lane-width"
            type="range"
            min="9"
            max="14"
            step="0.5"
            value={scenario.laneWidth}
            onChange={(e) => set("laneWidth", +e.target.value)}
            className="range-orange w-full my-1.5"
          />
        </Field>
      </FieldGroup>

      <FieldGroup label="Work" step={4}>
        <Field>
          <LabelRow htmlFor="fl-work-type">Work type</LabelRow>
          <select id="fl-work-type"
            className="field-input field-select"
            value={scenario.workType}
            onChange={(e) =>
              set("workType", e.target.value as FlaggerWorkType)
            }
          >
            {FLAGGER_WORK_TYPES.map((w) => (
              <option key={w.v} value={w.v}>
                {w.l}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <LabelRow htmlFor="fl-work-len">Work zone length (ft)</LabelRow>
          <input id="fl-work-len"
            type="number"
            className="field-input"
            value={scenario.workLen}
            onChange={(e) => set("workLen", +e.target.value || 0)}
            onBlur={() => setWzTouched(true)}
          />
          {wzTouched && !wzValidation.ok && (
            <FieldErrorLine>{wzValidation.message}</FieldErrorLine>
          )}
          {scenario.workLen > 1500 && !scenario.pilotCar && (
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--warn)] mt-1.5">
              ⚠ &gt;1500 ft — MUTCD § 6E recommends pilot car
            </div>
          )}
        </Field>

        <CheckRow
          on={scenario.night}
          label="Night operation"
          desc="+ retroreflective"
          onToggle={() => set("night", !scenario.night)}
        />
      </FieldGroup>

      <FieldGroup label="Flagger" step={5}>
        <CheckRow
          on={scenario.afad}
          label="Use AFAD"
          desc="Automated paddle"
          onToggle={() => set("afad", !scenario.afad)}
        />
        <CheckRow
          on={scenario.pilotCar}
          label="Pilot car"
          desc="Convoy lead vehicle"
          onToggle={() => set("pilotCar", !scenario.pilotCar)}
        />
        <CheckRow
          on={scenario.pedestrianAccess}
          label="Pedestrian detour"
          desc="ADA route required"
          onToggle={() => set("pedestrianAccess", !scenario.pedestrianAccess)}
        />
      </FieldGroup>
    </>
  );
}
