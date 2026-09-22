"use client";

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
  signalProximityLaneConfidence,
  undoDetectionOverride,
} from "@/lib/scenarios/auto-apply";
import {
  CheckRow,
  Field,
  FieldGroup,
  LabelRow,
} from "./GeneratorFormPrimitives";

// #289 Phase 2: ROAD_TYPES moved to lib/scenarios/what-cells.ts.

interface Props {
  scenario: FlaggerLaneClosureScenario;
  setScenario: (next: FlaggerLaneClosureScenario) => void;
  /** #222: pre-pin, this kind's steps render pending (dim + inert +
   *  focusable summary) until a location exists. */
  stepsPending?: boolean;
}

export function FlaggerForm({ scenario, setScenario, stepsPending = false }: Props) {
  const set = <K extends keyof FlaggerLaneClosureScenario>(
    key: K,
    value: FlaggerLaneClosureScenario[K],
  ) => setScenario({ ...scenario, [key]: value });

  // UX-21: inline schema-bound validation on the work-zone field
  // (required / 20,000-ft ceiling; blur-gated error text — live button
  // gating lives in GeneratorSidebar).  The MUTCD taper floor is
  // backend-owned (engine-removal PR D): it surfaces via the StatusBar's
  // INVALID INPUT and the Generate gate, not inline here.

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
  const laneCountMarker = lastDetectionOverride(
    scenario.detectionOverrides,
    "flagger_lane_count_confirm",
  );
  const laneCountArmed = signalProximityLaneConfidence(scenario);
  // Confirmed-row description: built ONLY from the marker's recorded
  // fields — never a value detection didn't report.
  const confirmedDesc = (m: NonNullable<typeof singleLaneMarker>) =>
    `Map data reported ${overrideDetectedClause(m)} — untick to restore detection`;

  return (
    <>
      <FieldGroup label="Road" anchorId="rail-step-road" pending={stepsPending}>
        {/* #289 Phase 2 — road type, speed and lane width moved into the
            WHAT band's grid (§8.22); TA-10's "one through lane in each
            direction" sentence moved with the road-type cell, as that
            cell's own note (lib/scenarios/what-cells.ts).
            DetectedVsApplied went with them, as the cells' provenance
            lines (§8.23).

            The four recovery confirms below STAY.  Each one is a
            backend gate's recovery affordance (#136 single lane, #86
            multi-lane, #158 one-way, #173 lane confidence) with its own
            #177 disputed-override record and its own #179 untick, and
            none of them is a field the grid has a cell for. */}
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

        {/* Lane-consistency recovery (issue #173): beside a detected
            traffic signal, self-contradicting OSM lane tags refuse
            generation (turn pockets inflate counts exactly there).  The
            flagger has no lane field to edit, so this confirm is the
            operator's recovery path — asserting the count was checked
            clears the four lane relays and lifts the block.  The
            signal-distance fact itself stays: it is true regardless,
            and alone it never blocks. */}
        {(laneCountArmed || laneCountMarker !== null) && (
          <CheckRow
            on={!laneCountArmed && laneCountMarker !== null}
            label="Lane count is right"
            desc={
              laneCountArmed || laneCountMarker === null
                ? "The map's lane counts contradict each other beside a signalized intersection — confirm to enable this plan"
                : confirmedDesc(laneCountMarker)
            }
            onToggle={() => {
              if (!laneCountArmed && laneCountMarker !== null) {
                // Untick (#179): restore all four recorded lane relays —
                // the proximity refusal honestly re-derives.
                const undo = undoDetectionOverride(
                  scenario.detectionOverrides,
                  "flagger_lane_count_confirm",
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
                // arms in the disputed (gate-refused) state.
                detectionOverrides: appendDetectionOverride(
                  scenario.detectionOverrides,
                  {
                    via: "flagger_lane_count_confirm",
                    detectedLanesTotal: scenario.detectedLanesTotal,
                    detectedLanesForward: scenario.detectedLanesForward,
                    detectedLanesBackward: scenario.detectedLanesBackward,
                    detectedLanesBothWays: scenario.detectedLanesBothWays,
                    asserted: "lane count is right",
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
          <div className="tr-prov mt-1.5">
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

      <FieldGroup label="Work" anchorId="rail-step-work" pending={stepsPending}>
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

        {/* #289 Phase 2: the work-zone length moved to the WHERE band
            (FLOW.md §5a move 3).  Its >1500 ft pilot-car note moved with
            it as the length field's own provenance — the note is about
            the length, so it belongs beside the length. */}
        <CheckRow
          on={scenario.night}
          label="Night operation"
          desc="+ retroreflective"
          onToggle={() => set("night", !scenario.night)}
        />
      </FieldGroup>

      <FieldGroup label="Flagger" anchorId="rail-step-extra" pending={stepsPending}>
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
