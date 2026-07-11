"use client";

import {
  MOBILE_WORK_TYPES,
  type MobileOpMultilaneScenario,
  type MobileRoadTypeMultilane,
  type MobileWorkType,
} from "@/lib/scenarios";
import {
  CheckRow,
  Field,
  FieldGroup,
  LabelRow,
} from "./GeneratorFormPrimitives";

const ROAD_TYPES: Array<{ v: MobileRoadTypeMultilane; l: string }> = [
  { v: "freeway", l: "Freeway / interstate" },
  { v: "rural_divided", l: "Rural — divided hwy" },
];

interface Props {
  scenario: MobileOpMultilaneScenario;
  setScenario: (next: MobileOpMultilaneScenario) => void;
}

export function MobileOpMultilaneForm({ scenario, setScenario }: Props) {
  const set = <K extends keyof MobileOpMultilaneScenario>(
    key: K,
    value: MobileOpMultilaneScenario[K],
  ) => setScenario({ ...scenario, [key]: value });

  return (
    <>
      <FieldGroup label="Road" step={3}>
        <Field>
          <LabelRow>Road type</LabelRow>
          <select
            className="field-input field-select"
            value={scenario.roadType}
            onChange={(e) =>
              set("roadType", e.target.value as MobileRoadTypeMultilane)
            }
          >
            {ROAD_TYPES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </select>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1.5">
            TA-26 — multi-lane mobile op, TMA + arrow board
          </div>
        </Field>

        <Field>
          <LabelRow value={`${scenario.speed} mph`}>Speed limit</LabelRow>
          <input
            type="range"
            min="45"
            max="75"
            step="5"
            value={scenario.speed}
            onChange={(e) => set("speed", +e.target.value)}
            className="range-orange w-full my-1.5"
          />
        </Field>

        <Field>
          <LabelRow value={`${scenario.laneWidth} ft`}>Lane width</LabelRow>
          <input
            type="range"
            min="10"
            max="14"
            step="0.5"
            value={scenario.laneWidth}
            onChange={(e) => set("laneWidth", +e.target.value)}
            className="range-orange w-full my-1.5"
          />
        </Field>
      </FieldGroup>

      <FieldGroup label="Operation" step={4}>
        <Field>
          <LabelRow>Work type</LabelRow>
          <select
            className="field-input field-select"
            value={scenario.workType}
            onChange={(e) =>
              set("workType", e.target.value as MobileWorkType)
            }
          >
            {MOBILE_WORK_TYPES.map((w) => (
              <option key={w.v} value={w.v}>
                {w.l}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <LabelRow>Shadow trailing distance (ft)</LabelRow>
          <input
            type="number"
            className="field-input"
            value={scenario.workLen}
            onChange={(e) => set("workLen", +e.target.value || 0)}
          />
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1.5">
            Typical: 200–400 ft on freeways
          </div>
        </Field>

        <CheckRow
          on={scenario.night}
          label="Night operation"
          desc="+ retroreflective"
          onToggle={() => set("night", !scenario.night)}
        />
      </FieldGroup>

      <FieldGroup label="Protection" step={5}>
        <CheckRow
          on={scenario.secondTMA}
          label="Second TMA upstream"
          desc="Recommended ≥55 mph"
          onToggle={() => set("secondTMA", !scenario.secondTMA)}
        />
        {scenario.speed >= 55 && !scenario.secondTMA && (
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--warn)] mt-1.5 px-1">
            ⚠ Second TMA strongly recommended at this speed
          </div>
        )}
      </FieldGroup>
    </>
  );
}
