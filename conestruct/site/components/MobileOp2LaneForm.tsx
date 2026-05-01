"use client";

import {
  MOBILE_WORK_TYPES,
  type MobileOp2LaneScenario,
  type MobileRoadType2Lane,
  type MobileWorkType,
} from "@/lib/scenarios";
import {
  CheckRow,
  Field,
  FieldGroup,
  LabelRow,
} from "./GeneratorFormPrimitives";

const ROAD_TYPES: Array<{ v: MobileRoadType2Lane; l: string }> = [
  { v: "rural_undivided", l: "Rural — 2-lane 2-way" },
  { v: "urban_arterial", l: "Urban arterial" },
];

interface Props {
  scenario: MobileOp2LaneScenario;
  setScenario: (next: MobileOp2LaneScenario) => void;
}

export function MobileOp2LaneForm({ scenario, setScenario }: Props) {
  const set = <K extends keyof MobileOp2LaneScenario>(
    key: K,
    value: MobileOp2LaneScenario[K],
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
              set("roadType", e.target.value as MobileRoadType2Lane)
            }
          >
            {ROAD_TYPES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </select>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1.5">
            TA-35 — slow-moving op, no static taper
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

      <FieldGroup label="Operation" ix="B">
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
            Typical: 100–300 ft behind work truck
          </div>
        </Field>

        <CheckRow
          on={scenario.night}
          label="Night operation"
          desc="+ retroreflective"
          onToggle={() => set("night", !scenario.night)}
        />
      </FieldGroup>

      <FieldGroup label="Protection" ix="C">
        <CheckRow
          on={scenario.arrowBoardOnShadow}
          label="Arrow board on shadow"
          desc="Caution mode (4-corner flash)"
          onToggle={() =>
            set("arrowBoardOnShadow", !scenario.arrowBoardOnShadow)
          }
        />
      </FieldGroup>
    </>
  );
}
