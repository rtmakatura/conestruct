"use client";

import { useState } from "react";
import {
  SHOULDER_WORK_TYPES,
  type ShoulderScenario,
  type ShoulderWorkType,
  type RoadType,
} from "@/lib/scenarios";
import { validateWorkZone } from "@/lib/scenarios/validation";
import { dividedForShoulderRoadType } from "@/lib/scenarios/overrides";
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
  const onRoadTypeChange = (rt: RoadType) =>
    setScenario({
      ...scenario,
      roadType: rt,
      divided: dividedForShoulderRoadType(rt, scenario.divided),
    });

  // UX-21: inline min-validation on the work-zone field.  The error
  // text is blur-gated (``wzTouched``) so transient keystrokes don't
  // flash it mid-entry; the GenerateButton disabled state (wired in
  // GeneratorSidebar from the same validateWorkZone helper) is live
  // regardless.
  const [wzTouched, setWzTouched] = useState(false);
  const wzValidation = validateWorkZone(scenario);

  return (
    <>
      <FieldGroup label="Road" step={3}>
        <Field>
          <LabelRow>Road type</LabelRow>
          <select
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
          <LabelRow value={`${scenario.speed} mph`}>Speed limit</LabelRow>
          <input
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
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1">
            MUTCD: ≥45 mph uses L=W·S
          </div>
        </Field>

        <Field>
          <LabelRow>Lanes per direction</LabelRow>
          <ChipRow
            options={[1, 2, 3, 4].map((n) => ({ v: n, l: String(n) }))}
            value={scenario.lanes}
            onChange={(v) => set("lanes", v)}
          />
        </Field>

        <Field>
          <LabelRow value={`${scenario.laneWidth} ft`}>Lane width</LabelRow>
          <input
            type="range"
            min="9"
            max="14"
            step="0.5"
            value={scenario.laneWidth}
            onChange={(e) => set("laneWidth", +e.target.value)}
            className="range-orange w-full my-1.5"
          />
        </Field>

        {/* Divided is derived from road type for every type except urban
            arterial, which can be either — so only it shows the toggle.
            (#85 single-source consolidation.) */}
        {scenario.roadType === "urban_arterial" && (
          <CheckRow
            on={scenario.divided}
            label="Divided highway"
            desc="Median present"
            onToggle={() => set("divided", !scenario.divided)}
          />
        )}
      </FieldGroup>

      <FieldGroup label="Work" step={4}>
        <Field>
          <LabelRow>Work type</LabelRow>
          <select
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
          <LabelRow>Work zone length (ft)</LabelRow>
          <input
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
          // Top margin matches the form's per-Field 14 px rhythm so the
          // conditional input clears the CheckRow group's bottom border
          // instead of butting up against it (see GeneratorFormPrimitives
          // — Field uses mb-3.5, CheckRow carries no margin).
          <div className="mt-3.5">
            <Field>
              <LabelRow value={`${scenario.workZoneSpeed} mph`}>
                Work-zone speed limit
              </LabelRow>
              <input
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
                  ? `Δ${scenario.speed - scenario.workZoneSpeed} mph · CO §2B.13(A): ${Math.ceil((scenario.speed - scenario.workZoneSpeed) / 15)} stepped sign installations`
                  : `Δ${scenario.speed - scenario.workZoneSpeed} mph · CO §2B.13(A): 1 advance sign`}
              </div>
            </Field>
          </div>
        )}
      </FieldGroup>
    </>
  );
}
