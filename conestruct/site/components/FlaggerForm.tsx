"use client";

import { useState } from "react";
import {
  FLAGGER_WORK_TYPES,
  type Duration,
  type FlaggerLaneClosureScenario,
  type FlaggerRoadType,
  type FlaggerWorkType,
} from "@/lib/scenarios";
import { validateWorkZone } from "@/lib/scenarios/validation";
import {
  ChipRow,
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

const DURATIONS: Array<{ v: Duration; l: string }> = [
  { v: "short", l: "Short (<1h)" },
  { v: "long", l: "Long-term" },
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

  // UX-21: inline min-validation on the work-zone field (blur-gated
  // error text; live button gating lives in GeneratorSidebar).
  const [wzTouched, setWzTouched] = useState(false);
  const wzValidation = validateWorkZone(scenario);

  return (
    <>
      <FieldGroup label="Roadway" ix="A">
        <Field>
          <LabelRow>Road type</LabelRow>
          <select
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
            TA-10 applies to 2-lane 2-way roadways only
          </div>
        </Field>

        <Field>
          <LabelRow value={`${scenario.speed} mph`}>Speed limit</LabelRow>
          <input
            type="range"
            min="25"
            max="55"
            step="5"
            value={scenario.speed}
            onChange={(e) => set("speed", +e.target.value)}
            className="range-orange w-full my-1.5"
          />
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1">
            MUTCD: ≥45 mph uses L=W·S
          </div>
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
      </FieldGroup>

      <FieldGroup label="Work" ix="B">
        <Field>
          <LabelRow>Work type</LabelRow>
          <select
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
          <LabelRow>Duration</LabelRow>
          <ChipRow
            options={DURATIONS}
            value={scenario.duration}
            onChange={(v) => set("duration", v)}
          />
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
          {scenario.workLen > 1500 && !scenario.pilotCar && (
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--orange)] mt-1.5">
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

      <FieldGroup label="Flagger" ix="C">
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
