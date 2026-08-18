"use client";

import { useState } from "react";
import {
  SHOULDER_WORK_TYPES,
  type ShoulderScenario,
  type ShoulderWorkType,
  type RoadType,
} from "@/lib/scenarios";
import { validateLanes, validateWorkZone } from "@/lib/scenarios/validation";
import { dividedForShoulderRoadType } from "@/lib/scenarios/overrides";
import {
  appendDetectionOverride,
  lanesArithmeticMismatch,
} from "@/lib/scenarios/auto-apply";
import {
  ChipRow,
  CheckRow,
  Field,
  FieldErrorLine,
  FieldGroup,
  LabelRow,
} from "./GeneratorFormPrimitives";

const ROAD_TYPES: Array<{ v: RoadType; l: string }> = [
  { v: "rural_undivided", l: "Rural — undivided" },
  { v: "rural_divided", l: "Rural — divided hwy" },
  { v: "urban_arterial", l: "Urban arterial" },
  { v: "freeway", l: "Freeway / interstate" },
];

interface Props {
  scenario: ShoulderScenario;
  setScenario: (next: ShoulderScenario) => void;
}

export function ShoulderForm({ scenario, setScenario }: Props) {
  const set = <K extends keyof ShoulderScenario>(
    key: K,
    value: ShoulderScenario[K],
  ) => setScenario({ ...scenario, [key]: value });

  // Single-source divided (#85): roadType drives `divided` so the two
  // can't disagree. Set both in one update; urban_arterial keeps the
  // explicit toggle (rendered below), preserving its current value here.
  // When divided-ness flips, lanes resets to the road-class default
  // (2 per direction divided, 1 undivided — the classic 2-lane road);
  // the picker's auto-apply sets lanes in the same patch as roadType,
  // so a detected value is never clobbered by this reset.
  const onRoadTypeChange = (rt: RoadType) => {
    const nextDivided = dividedForShoulderRoadType(rt, scenario.divided);
    setScenario({
      ...scenario,
      roadType: rt,
      divided: nextDivided,
      ...(nextDivided !== scenario.divided
        ? { lanes: nextDivided ? 2 : 1 }
        : {}),
    });
  };

  // UX-21: inline schema-bound validation on the work-zone field
  // (required / ceiling).  The error text is blur-gated (``wzTouched``)
  // so transient keystrokes don't flash it mid-entry; the GenerateButton
  // disabled state (wired in GeneratorSidebar) is live regardless.  The
  // MUTCD taper floor is backend-owned (engine-removal PR D) and
  // surfaces via the StatusBar / Generate gate, not inline here.
  const [wzTouched, setWzTouched] = useState(false);
  const wzValidation = validateWorkZone(scenario);
  // Lanes x width drawable bound (schemas.py mirror).  Rendered live —
  // it only trips on chip/slider clicks, never mid-keystroke.
  const lanesValidation = validateLanes(scenario);

  return (
    <>
      <FieldGroup label="Road" step={3}>
        <Field>
          <LabelRow htmlFor="sh-road-type">Road type</LabelRow>
          <select id="sh-road-type"
            className="field-input field-select"
            value={scenario.roadType}
            onChange={(e) => onRoadTypeChange(e.target.value as RoadType)}
          >
            {ROAD_TYPES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <LabelRow htmlFor="sh-speed" value={`${scenario.speed} mph`}>Speed limit</LabelRow>
          <input id="sh-speed"
            type="range"
            min="25"
            max="75"
            step="5"
            value={scenario.speed}
            onChange={(e) => {
              const newSpeed = +e.target.value;
              // Clamp work-zone speed if it would exceed the new posted.
              // Equal-to-posted means "no reduction" — drop to undefined.
              if (
                scenario.workZoneSpeed !== undefined &&
                scenario.workZoneSpeed >= newSpeed
              ) {
                setScenario({
                  ...scenario,
                  speed: newSpeed,
                  workZoneSpeed: undefined,
                });
              } else {
                set("speed", newSpeed);
              }
            }}
            className="range-orange w-full my-1.5"
          />
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1.5">
            MUTCD: ≥45 mph uses L=W·S
          </div>
        </Field>

        <Field>
          <LabelRow>Lanes per direction</LabelRow>
          <ChipRow
            options={[1, 2, 3, 4].map((n) => ({ v: n, l: String(n) }))}
            value={scenario.lanes}
            // Editing the lane count is the operator correcting detection,
            // so clear the relayed single-lane signal — this lifts the
            // backend single-lane block (issue #136).
            onChange={(v) => {
              // Disputed-only override record (#177): the erased relays
              // were driving the #136 refusal (total === 1), the #120
              // caution, or the #173 signal-proximity refusal (both
              // arithmetic mismatch — the edit is the shoulder kind's
              // recovery affordance for that gate; the signal-distance
              // fact itself stays, and alone it never blocks).  An
              // ordinary edit over consistent relays is the
              // manual-supersede convention (#112) and stays silent.
              const disputed =
                scenario.detectedLanesTotal === 1 ||
                lanesArithmeticMismatch(
                  scenario.detectedLanesTotal,
                  scenario.detectedLanesForward,
                  scenario.detectedLanesBackward,
                  scenario.detectedLanesBothWays,
                );
              setScenario({
                ...scenario,
                lanes: v,
                // Editing the count takes ownership of it: clear the
                // #136 single-lane relay and the #120 per-direction
                // relays together, lifting the block and the caution.
                detectedLanesTotal: undefined,
                detectedLanesForward: undefined,
                detectedLanesBackward: undefined,
                detectedLanesBothWays: undefined,
                detectionOverrides: disputed
                  ? appendDetectionOverride(scenario.detectionOverrides, {
                      via: "shoulder_lane_edit",
                      detectedLanesTotal: scenario.detectedLanesTotal,
                      detectedLanesForward: scenario.detectedLanesForward,
                      detectedLanesBackward: scenario.detectedLanesBackward,
                      detectedLanesBothWays: scenario.detectedLanesBothWays,
                      asserted: `${v} lane${v === 1 ? "" : "s"} per direction`,
                    })
                  : scenario.detectionOverrides,
              });
            }}
          />
        </Field>

        <Field>
          <LabelRow htmlFor="sh-lane-width" value={`${scenario.laneWidth} ft`}>Lane width</LabelRow>
          <input id="sh-lane-width"
            type="range"
            min="9"
            max="14"
            step="0.5"
            value={scenario.laneWidth}
            onChange={(e) => set("laneWidth", +e.target.value)}
            className="range-orange w-full my-1.5"
          />
          {!lanesValidation.ok && (
            <FieldErrorLine>{lanesValidation.message}</FieldErrorLine>
          )}
        </Field>

        {/* Divided is derived from road type for every type except urban
            arterial, which can be either — so only it shows the toggle.
            (#85 single-source consolidation.) */}
        {scenario.roadType === "urban_arterial" && (
          <CheckRow
            on={scenario.divided}
            label="Divided highway"
            desc="Median present"
            onToggle={() =>
              // Same divided-flip lanes default as onRoadTypeChange.
              setScenario({
                ...scenario,
                divided: !scenario.divided,
                lanes: !scenario.divided ? 2 : 1,
              })
            }
          />
        )}
      </FieldGroup>

      <FieldGroup label="Work" step={4}>
        <Field>
          <LabelRow htmlFor="sh-work-type">Work type</LabelRow>
          <select id="sh-work-type"
            className="field-input field-select"
            value={scenario.workType}
            onChange={(e) =>
              set("workType", e.target.value as ShoulderWorkType)
            }
          >
            {SHOULDER_WORK_TYPES.map((w) => (
              <option key={w.v} value={w.v}>
                {w.l}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <LabelRow htmlFor="sh-work-len">Work zone length (ft)</LabelRow>
          <input id="sh-work-len"
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

        <CheckRow
          on={scenario.workZoneSpeed !== undefined}
          label="Apply work-zone speed reduction"
          desc="Lower limit through zone"
          onToggle={() =>
            scenario.workZoneSpeed === undefined
              ? set("workZoneSpeed", Math.max(25, scenario.speed - 10))
              : set("workZoneSpeed", undefined)
          }
        />

        {scenario.workZoneSpeed !== undefined && (
          // Top margin matches the form's per-Field 12 px rhythm so the
          // conditional input clears the CheckRow group's bottom border
          // instead of butting up against it (see GeneratorFormPrimitives
          // — Field uses mb-3, CheckRow carries no margin).
          <div className="mt-3">
            <Field>
              <LabelRow htmlFor="sh-wz-speed" value={`${scenario.workZoneSpeed} mph`}>
                Work-zone speed limit
              </LabelRow>
              <input id="sh-wz-speed"
                type="number"
                className="field-input"
                min={20}
                max={scenario.speed}
                step={5}
                value={scenario.workZoneSpeed}
                onChange={(e) =>
                  set("workZoneSpeed", +e.target.value || 0)
                }
              />
              <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1.5">
                {scenario.speed - scenario.workZoneSpeed > 15
                  ? `Δ${scenario.speed - scenario.workZoneSpeed} mph · S-630-1 Sheet 2 Note 3: ${Math.ceil((scenario.speed - scenario.workZoneSpeed) / 15)} stepped sign installations`
                  : `Δ${scenario.speed - scenario.workZoneSpeed} mph · S-630-1 Sheet 2 Note 3: 1 advance sign`}
              </div>
            </Field>
          </div>
        )}
      </FieldGroup>
    </>
  );
}
