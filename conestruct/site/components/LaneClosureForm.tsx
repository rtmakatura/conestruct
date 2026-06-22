"use client";

import {
  LANE_CLOSURE_WORK_TYPES,
  type Duration,
  type LaneClosureDividedScenario,
  type LaneClosureRoadType,
  type LaneClosureWorkType,
} from "@/lib/scenarios";
import {
  ChipRow,
  CheckRow,
  Field,
  FieldGroup,
  LabelRow,
} from "./GeneratorFormPrimitives";

const ROAD_TYPES: Array<{ v: LaneClosureRoadType; l: string }> = [
  { v: "freeway", l: "Freeway / interstate" },
  { v: "rural_divided", l: "Rural — divided hwy" },
];

const DURATIONS: Array<{ v: Duration; l: string }> = [
  { v: "short", l: "Short (<1h)" },
  { v: "long", l: "Long-term" },
];

interface Props {
  scenario: LaneClosureDividedScenario;
  setScenario: (next: LaneClosureDividedScenario) => void;
}

export function LaneClosureForm({ scenario, setScenario }: Props) {
  const set = <K extends keyof LaneClosureDividedScenario>(
    key: K,
    value: LaneClosureDividedScenario[K],
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
              set("roadType", e.target.value as LaneClosureRoadType)
            }
          >
            {ROAD_TYPES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </select>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1.5">
            TA-19 — divided highway, right lane closed
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
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1">
            MUTCD: ≥45 mph uses L=W·S
          </div>
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

      <FieldGroup label="Work" step={4}>
        <Field>
          <LabelRow>Work type</LabelRow>
          <select
            className="field-input field-select"
            value={scenario.workType}
            onChange={(e) =>
              set("workType", e.target.value as LaneClosureWorkType)
            }
          >
            {LANE_CLOSURE_WORK_TYPES.map((w) => (
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
          />
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
          on={scenario.truckMountedAttenuator}
          label="Truck-mounted attenuator"
          desc="Recommended ≥45 mph"
          onToggle={() =>
            set("truckMountedAttenuator", !scenario.truckMountedAttenuator)
          }
        />
        {scenario.speed >= 45 && !scenario.truckMountedAttenuator && (
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--orange)] mt-1.5 px-1">
            ⚠ TMA strongly recommended at this speed (CDOT M-630)
          </div>
        )}
      </FieldGroup>
    </>
  );
}
