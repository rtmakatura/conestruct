"use client";

import {
  SHOULDER_WORK_TYPES,
  type ShoulderScenario,
  type ShoulderWorkType,
  type RoadType,
  type Duration,
} from "@/lib/scenarios";
import {
  ChipRow,
  CheckRow,
  Field,
  FieldGroup,
  LabelRow,
} from "./GeneratorFormPrimitives";

const ROAD_TYPES: Array<{ v: RoadType; l: string }> = [
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
  scenario: ShoulderScenario;
  setScenario: (next: ShoulderScenario) => void;
}

export function ShoulderForm({ scenario, setScenario }: Props) {
  const set = <K extends keyof ShoulderScenario>(
    key: K,
    value: ShoulderScenario[K],
  ) => setScenario({ ...scenario, [key]: value });

  return (
    <>
      <FieldGroup label="Roadway" ix="A">
        <Field>
          <LabelRow>Road type</LabelRow>
          <select
            className="field-input field-select"
            value={scenario.roadType}
            onChange={(e) => set("roadType", e.target.value as RoadType)}
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

        <CheckRow
          on={scenario.divided}
          label="Divided highway"
          desc="Median present"
          onToggle={() => set("divided", !scenario.divided)}
        />
      </FieldGroup>

      <FieldGroup label="Work" ix="B">
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
          <LabelRow>Duration</LabelRow>
          <ChipRow
            options={DURATIONS}
            value={scenario.duration}
            onChange={(v) => set("duration", v)}
          />
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1.5">
            MUTCD § 6G.02 · short-duration permits minimum signing
          </div>
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
        )}
      </FieldGroup>
    </>
  );
}
