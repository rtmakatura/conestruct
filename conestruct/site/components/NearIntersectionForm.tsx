"use client";

// Form for the GATED near_intersection kind (#117, Option C inc. 4).
// Not reachable through the scenario picker while the kind is absent
// from ENABLED_SCENARIO_KINDS — tests mount it via GeneratorShell's
// initialScenario prop.  The scenario object IS the wire payload, so
// every field here writes real scenario state; UI-only state (the
// needs-confirmation hold on detection-filled lane counts) lives in
// GeneratorSidebar and arrives via props.

import { useState } from "react";
import {
  NEAR_INTERSECTION_WORK_TYPES,
  type NearIntersectionApproach,
  type NearIntersectionRoadType,
  type NearIntersectionScenario,
  type NearIntersectionWorkType,
} from "@/lib/scenarios";
import {
  validateApproaches,
  validateLanes,
  validateWorkZone,
} from "@/lib/scenarios/validation";
import {
  appendDetectionOverride,
  lanesArithmeticMismatch,
  lastDetectionOverride,
  overrideDetectedClause,
  undoDetectionOverride,
} from "@/lib/scenarios/auto-apply";
import type { DetectionOverride } from "@/lib/scenarios";
import {
  CheckRow,
  ChipRow,
  Field,
  FieldErrorLine,
  FieldGroup,
  LabelRow,
} from "./GeneratorFormPrimitives";

const ROAD_TYPES: Array<{ v: NearIntersectionRoadType; l: string }> = [
  { v: "rural_undivided", l: "Rural — undivided" },
  { v: "urban_arterial", l: "Urban arterial" },
];

interface Props {
  scenario: NearIntersectionScenario;
  setScenario: (next: NearIntersectionScenario) => void;
  /** Needs-confirmation hold on detection-filled approach lane counts
   *  (owned by GeneratorSidebar so it can also gate the Generate CTA). */
  approachConfirm: { pending: boolean; reason: string | null };
  clearApproachConfirm: () => void;
}

export function NearIntersectionForm({
  scenario,
  setScenario,
  approachConfirm,
  clearApproachConfirm,
}: Props) {
  const set = <K extends keyof NearIntersectionScenario>(
    key: K,
    value: NearIntersectionScenario[K],
  ) => setScenario({ ...scenario, [key]: value });

  const [wzTouched, setWzTouched] = useState(false);
  const wzValidation = validateWorkZone(scenario);
  const lanesValidation = validateLanes(scenario);
  const approachesValidation = validateApproaches(scenario);

  const legs = scenario.approaches;
  const setLegs = (next: NearIntersectionApproach[]) =>
    set("approaches", next);
  const updateAllLegs = (patch: Partial<NearIntersectionApproach>) =>
    setLegs(legs.map((l) => ({ ...l, ...patch })));
  const updateLeg = (i: number, patch: Partial<NearIntersectionApproach>) =>
    setLegs(legs.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  // Lane-relay clear (issue #120): confirming or editing the approach
  // lane count strips the detection's raw lane-tag relays from EVERY
  // leg (both legs carry the same way's tags), which lifts the
  // backend's lane-count consistency 400.  An operator-owned count is
  // no longer a detection claim — same provenance rule as the #136/#158
  // clears on the other forms.
  const laneRelayClear = {
    detectedLanesTotal: undefined,
    detectedLanesForward: undefined,
    detectedLanesBackward: undefined,
    detectedLanesBothWays: undefined,
  } as const;
  // Disputed-only override record (#177): the erased relays were driving
  // the #120 mismatch 400 or the needs-confirmation hold.  Both legs
  // carry the same way's tags, so leg 0 is the one detection fact.  An
  // erase with nothing present records nothing — absence and override
  // must not look alike.
  const recordedOverrides = (
    via: "approach_lane_confirm" | "approach_lane_edit",
    asserted: string,
  ): DetectionOverride[] | undefined => {
    const leg = legs[0];
    const hasSignal =
      leg !== undefined &&
      (leg.detectedLanesTotal !== undefined ||
        leg.detectedLanesForward !== undefined ||
        leg.detectedLanesBackward !== undefined ||
        leg.detectedLanesBothWays !== undefined);
    const disputed =
      approachConfirm.pending ||
      (leg !== undefined &&
        lanesArithmeticMismatch(
          leg.detectedLanesTotal,
          leg.detectedLanesForward,
          leg.detectedLanesBackward,
          leg.detectedLanesBothWays,
        ));
    if (!hasSignal || !disputed) return scenario.detectionOverrides;
    return appendDetectionOverride(scenario.detectionOverrides, {
      via,
      detectedLanesTotal: leg.detectedLanesTotal,
      detectedLanesForward: leg.detectedLanesForward,
      detectedLanesBackward: leg.detectedLanesBackward,
      detectedLanesBothWays: leg.detectedLanesBothWays,
      asserted,
    });
  };
  const updateLegAndClearRelays = (
    i: number,
    patch: { lanesPerDirection: number },
  ) =>
    setScenario({
      ...scenario,
      approaches: legs.map((l, idx) => ({
        ...l,
        ...(idx === i ? patch : {}),
        ...laneRelayClear,
      })),
      detectionOverrides: recordedOverrides(
        "approach_lane_edit",
        `approach lane count ${patch.lanesPerDirection}`,
      ),
    });
  const confirmLaneCounts = () => {
    const counts = [...new Set(legs.map((l) => l.lanesPerDirection))].join("/");
    setScenario({
      ...scenario,
      approaches: legs.map((l) => ({ ...l, ...laneRelayClear })),
      detectionOverrides: recordedOverrides(
        "approach_lane_confirm",
        `approach lane count ${counts}`,
      ),
    });
    clearApproachConfirm();
  };
  // #179: the confirm's inverse.  A recorded approach_lane_confirm
  // marker renders the confirmed note below the lane fields; Undo
  // removes the marker and restores its recorded relays onto EVERY leg
  // (both legs carry the same way's tags — one fact), so the #120
  // mismatch 400 honestly re-derives when the relays still refuse.
  // The sidebar's one-time needs-confirmation hold is UI state and does
  // not return — the restored relays re-engage the backend gate, which
  // is the only blocking path.  A no-dispute confirm recorded no marker
  // (nothing was erased), so it leaves no note and nothing to undo.
  // Manual lane edits made after the confirm survive: the restore
  // touches only the relay fields, never lanesPerDirection.
  const approachConfirmMarker = lastDetectionOverride(
    scenario.detectionOverrides,
    "approach_lane_confirm",
  );
  const undoConfirmLaneCounts = () => {
    const undo = undoDetectionOverride(
      scenario.detectionOverrides,
      "approach_lane_confirm",
    );
    const m = undo.marker;
    if (m === null) return;
    setScenario({
      ...scenario,
      approaches: legs.map((l) => ({
        ...l,
        detectedLanesTotal: m.detectedLanesTotal,
        detectedLanesForward: m.detectedLanesForward,
        detectedLanesBackward: m.detectedLanesBackward,
        detectedLanesBothWays: m.detectedLanesBothWays,
      })),
      detectionOverrides: undo.overrides,
    });
  };

  // The one supported cross street, presented in plain language: a
  // side (past vs before the work zone, in the direction of travel)
  // plus a distance.  Both map onto the shared alongStationFt the
  // backend expects (negative = past the downstream end; greater than
  // workLen = before the upstream start).
  const along = legs[0]?.alongStationFt ?? -200;
  const sideUpstream = along > scenario.workLen;
  const distanceFt = sideUpstream ? along - scenario.workLen : -along;
  const setSideAndDistance = (upstream: boolean, dist: number) => {
    const nextAlong = upstream ? scenario.workLen + dist : -dist;
    updateAllLegs({ alongStationFt: nextAlong });
  };

  const legCount = legs.length;
  const setLegCount = (n: 1 | 2) => {
    if (n === legCount) return;
    if (n === 1) {
      setLegs(legs.slice(0, 1));
      return;
    }
    const a = legs[0];
    setLegs([
      a,
      {
        ...a,
        id: "cross_b",
        bearingDeg:
          a.bearingDeg === undefined ? undefined : (a.bearingDeg + 180) % 360,
      },
    ]);
  };

  return (
    <>
      <FieldGroup label="Road" step={3} anchorId="rail-step-road">
        <Field>
          <LabelRow htmlFor="ni-road-type">Road type</LabelRow>
          <select id="ni-road-type"
            className="field-input field-select"
            value={scenario.roadType}
            onChange={(e) =>
              set("roadType", e.target.value as NearIntersectionRoadType)
            }
          >
            {ROAD_TYPES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </select>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1.5">
            CDOT Cases 18/19 cover undivided and arterial roads
          </div>
        </Field>

        <Field>
          <LabelRow htmlFor="ni-speed" value={`${scenario.speed} mph`}>Speed limit</LabelRow>
          <input id="ni-speed"
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
          <LabelRow>Lanes per direction</LabelRow>
          <ChipRow
            options={[2, 3, 4].map((n) => ({ v: n, l: String(n) }))}
            value={scenario.lanes}
            onChange={(v) => set("lanes", v)}
          />
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1.5">
            Needs 2+ — traffic merges into the next lane over
          </div>
          {!lanesValidation.ok && (
            <FieldErrorLine>{lanesValidation.message}</FieldErrorLine>
          )}
        </Field>

        <Field>
          <LabelRow htmlFor="ni-lane-width" value={`${scenario.laneWidth} ft`}>Lane width</LabelRow>
          <input id="ni-lane-width"
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

      <FieldGroup label="Work" step={4} anchorId="rail-step-work">
        <Field>
          <LabelRow htmlFor="ni-work-type">Work type</LabelRow>
          <select id="ni-work-type"
            className="field-input field-select"
            value={scenario.workType}
            onChange={(e) =>
              set("workType", e.target.value as NearIntersectionWorkType)
            }
          >
            {NEAR_INTERSECTION_WORK_TYPES.map((w) => (
              <option key={w.v} value={w.v}>
                {w.l}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <LabelRow htmlFor="ni-work-len">Work zone length (ft)</LabelRow>
          <input id="ni-work-len"
            type="number"
            className="field-input"
            value={scenario.workLen}
            onChange={(e) => set("workLen", +e.target.value || 0)}
            onBlur={() => setWzTouched(true)}
          />
          {wzTouched && !wzValidation.ok && (
            <FieldErrorLine>{wzValidation.message}</FieldErrorLine>
          )}
        </Field>

        <CheckRow
          on={scenario.night}
          label="Night operation"
          desc="+ retroreflective"
          onToggle={() => set("night", !scenario.night)}
        />
      </FieldGroup>

      <FieldGroup label="Cross street" step={5} anchorId="rail-step-extra">
        <Field>
          <LabelRow>Cross-street directions</LabelRow>
          <ChipRow
            options={[
              { v: 1, l: "One (T-intersection)" },
              { v: 2, l: "Both" },
            ]}
            value={legCount}
            onChange={(v) => setLegCount(v as 1 | 2)}
          />
        </Field>

        <Field>
          <LabelRow htmlFor="ni-side">Where is the intersection?</LabelRow>
          <select id="ni-side"
            className="field-input field-select"
            value={sideUpstream ? "upstream" : "downstream"}
            onChange={(e) =>
              setSideAndDistance(
                e.target.value === "upstream",
                Math.max(0, distanceFt),
              )
            }
          >
            <option value="downstream">
              Past the far end of the work zone (traffic reaches the work
              first)
            </option>
            <option value="upstream">
              Before the work zone (traffic crosses it first)
            </option>
          </select>
        </Field>

        <Field>
          <LabelRow htmlFor="ni-distance">Distance from the work zone (ft)</LabelRow>
          <input id="ni-distance"
            type="number"
            className="field-input"
            value={Math.round(distanceFt)}
            onChange={(e) =>
              setSideAndDistance(sideUpstream, +e.target.value || 0)
            }
          />
          {!approachesValidation.ok && (
            <FieldErrorLine>{approachesValidation.message}</FieldErrorLine>
          )}
        </Field>

        <CheckRow
          on={legs[0]?.signalized ?? false}
          label="Signalized intersection"
          desc="Traffic signal present"
          onToggle={() =>
            updateAllLegs({ signalized: !(legs[0]?.signalized ?? false) })
          }
        />

        <Field>
          <LabelRow htmlFor="ni-cross-type">Cross-street type</LabelRow>
          <select id="ni-cross-type"
            className="field-input field-select"
            value={legs[0]?.roadType ?? "urban_arterial"}
            onChange={(e) =>
              updateAllLegs({
                roadType: e.target.value as NearIntersectionRoadType,
              })
            }
          >
            {ROAD_TYPES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <LabelRow htmlFor="ni-cross-speed" value={`${legs[0]?.speed ?? 30} mph`}>
            Cross-street speed limit
          </LabelRow>
          <input id="ni-cross-speed"
            type="range"
            min="25"
            max="55"
            step="5"
            value={legs[0]?.speed ?? 30}
            onChange={(e) => updateAllLegs({ speed: +e.target.value })}
            className="range-orange w-full my-1.5"
          />
        </Field>

        <Field>
          <LabelRow htmlFor="ni-cross-lane-width" value={`${legs[0]?.laneWidth ?? 12} ft`}>
            Cross-street lane width
          </LabelRow>
          <input id="ni-cross-lane-width"
            type="range"
            min="9"
            max="14"
            step="0.5"
            value={legs[0]?.laneWidth ?? 12}
            onChange={(e) => updateAllLegs({ laneWidth: +e.target.value })}
            className="range-orange w-full my-1.5"
          />
        </Field>

        {legs.map((leg, i) => (
          <Field key={leg.id}>
            <LabelRow>
              {legCount === 1
                ? "Cross-street lanes (each direction)"
                : i === 0
                  ? "Cross-street lanes — direction A"
                  : "Cross-street lanes — direction B"}
            </LabelRow>
            <ChipRow
              options={[1, 2, 3, 4].map((n) => ({ v: n, l: String(n) }))}
              value={leg.lanesPerDirection}
              onChange={(v) => {
                updateLegAndClearRelays(i, { lanesPerDirection: v });
                // A manual lane edit IS the confirmation.
                clearApproachConfirm();
              }}
            />
          </Field>
        ))}

        {approachConfirm.pending && (
          <div
            role="alert"
            className="mt-1 border border-[color:var(--warn)] px-3 py-2"
          >
            <p className="text-[11px] text-[color:var(--warn)] m-0">
              {approachConfirm.reason ??
                "The cross-street lane count was filled from map data. Map " +
                  "lane counts near intersections often include turn " +
                  "pockets — check the through-lane count before generating."}
            </p>
            <button
              type="button"
              onClick={confirmLaneCounts}
              className="mt-1.5 px-3 py-1 font-sans text-[12px] border border-[color:var(--act)] text-[color:var(--act)] hover:bg-[color:var(--act)] hover:text-[color:var(--on-act)]"
            >
              Lane count is right
            </button>
          </div>
        )}

        {/* #179: the confirmed state stays visible with its undo — text
            + button, no hue-only signal (rule 13); description built
            only from the marker's recorded fields. */}
        {!approachConfirm.pending && approachConfirmMarker !== null && (
          <div className="mt-1 border border-[color:var(--line-soft)] px-3 py-2">
            <p className="text-[11px] text-[color:var(--ink-on-dark-faint)] m-0">
              ✓ Cross-street lane count confirmed — map data reported{" "}
              {overrideDetectedClause(approachConfirmMarker)}.
            </p>
            <button
              type="button"
              onClick={undoConfirmLaneCounts}
              className="mt-1.5 px-3 py-1 font-sans text-[12px] border border-[color:var(--act)] text-[color:var(--act)] hover:bg-[color:var(--act)] hover:text-[color:var(--on-act)]"
            >
              Undo — restore detected lane data
            </button>
          </div>
        )}
      </FieldGroup>
    </>
  );
}
