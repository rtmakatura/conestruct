"use client";

import {
  WORK_BEYOND_SHOULDER_WORK_TYPES,
  type Duration,
  type WorkBeyondShoulderRoadType,
  type WorkBeyondShoulderScenario,
  type WorkBeyondShoulderWorkType,
} from "@/lib/scenarios";
import {
  ChipRow,
  CheckRow,
  Field,
  FieldGroup,
  LabelRow,
} from "./GeneratorFormPrimitives";

const ROAD_TYPES: Array<{ v: WorkBeyondShoulderRoadType; l: string }> = [
  { v: "rural_undivided", l: "Rural — undivided" },
  { v: "rural_divided", l: "Rural — divided hwy" },
  { v: "urban_arterial", l: "Urban arterial" },
  { v: "freeway", l: "Freeway / interstate" },
];

const DURATIONS: Array<{ v: Duration; l: string }> = [
  { v: "short", l: "Short (<1h)" },
  { v: "long", l: "Long-term" },
];

interface Props {
  scenario: WorkBeyondShoulderScenario;
  setScenario: (next: WorkBeyondShoulderScenario) => void;
}

export function WorkBeyondShoulderForm({ scenario, setScenario }: Props) {
  const set = <K extends keyof WorkBeyondShoulderScenario>(
    key: K,
    value: WorkBeyondShoulderScenario[K],
  ) => setScenario({ ...scenario, [key]: value });

  return (
    <>
      <FieldGroup label="Roadway" ix="A">
        <Field>
          <LabelRow>Road type</LabelRow>
          <select
            className="field-input field-select"
            value={scenario.roadType}
            onChange={(e) =>
              set("roadType", e.target.value as WorkBeyondShoulderRoadType)
            }
          >
            {ROAD_TYPES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </select>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1.5">
            TA-1 — work entirely off the roadway
          </div>
        </Field>

        <Field>
          <LabelRow value={`${scenario.speed} mph`}>Speed limit</LabelRow>
          <input
            type="range"
            min="25"
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
              set("workType", e.target.value as WorkBeyondShoulderWorkType)
            }
          >
            {WORK_BEYOND_SHOULDER_WORK_TYPES.map((w) => (
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
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1.5">
            MUTCD § 6G.04 · short-duration permits minimum signing
          </div>
        </Field>

        <Field>
          <LabelRow>Work area length (ft)</LabelRow>
          <input
            type="number"
            className="field-input"
            value={scenario.workLen}
            onChange={(e) => set("workLen", +e.target.value || 0)}
          />
        </Field>

        <CheckRow
          on={scenario.night}
          label="Night operation"
          desc="+ retroreflective"
          onToggle={() => set("night", !scenario.night)}
        />
      </FieldGroup>
    </>
  );
}
