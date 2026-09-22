"use client";

import {
  SHOULDER_WORK_TYPES,
  type ShoulderScenario,
  type ShoulderWorkType,
} from "@/lib/scenarios";
import {
  CheckRow,
  Field,
  FieldGroup,
  LabelRow,
} from "./GeneratorFormPrimitives";

// #289 Phase 2: ROAD_TYPES moved to lib/scenarios/what-cells.ts, which is
// now the one table three forms used to keep three copies of.  Its
// "Rural — divided hwy" label lost to the strip's "Rural — divided" —
// same enum value, one spelling (see that file's header).

interface Props {
  scenario: ShoulderScenario;
  setScenario: (next: ShoulderScenario) => void;
  /** #222: pre-pin, this kind's steps render pending (dim + inert +
   *  focusable summary) until a location exists. */
  stepsPending?: boolean;
}

export function ShoulderForm({ scenario, setScenario, stepsPending = false }: Props) {
  const set = <K extends keyof ShoulderScenario>(
    key: K,
    value: ShoulderScenario[K],
  ) => setScenario({ ...scenario, [key]: value });

  return (
    <>
      {/* #289 Phase 2 — the Road step's FIELDS moved into the WHAT
          band's grid (§8.22): road type, speed, lanes and lane width are
          cells there now, written through lib/scenarios/what-writes.ts so
          the #85 divided single-sourcing and the #136/#177 lane
          bookkeeping travelled with them rather than being re-typed.
          DetectedVsApplied went with them, as the cells' provenance lines
          (§8.23, lib/road-detection/detected-rows.ts).

          What stays here is the one control the grid has no cell for: the
          explicit divided toggle, which exists ONLY on urban_arterial
          because every other road type derives `divided` from itself
          (#85).  It renders inside the WHAT band's kind row.  A shoulder
          plan on any other road type renders no Road group at all rather
          than an empty one (rule 10). */}
      {scenario.roadType === "urban_arterial" && (
        <FieldGroup label="Road" anchorId="rail-step-road" pending={stepsPending}>
          <CheckRow
            on={scenario.divided}
            label="Divided highway"
            desc="Median present"
            onToggle={() =>
              // Same divided-flip lanes default as setRoadType().
              setScenario({
                ...scenario,
                divided: !scenario.divided,
                lanes: !scenario.divided ? 2 : 1,
              })
            }
          />
        </FieldGroup>
      )}

      <FieldGroup label="Work" anchorId="rail-step-work" pending={stepsPending}>
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

        {/* #289 Phase 2: the work-zone length moved to the WHERE band —
            FLOW.md §5a move 3 makes the extent a WHERE question, and it
            is one field for every kind, so it is one control there
            instead of three copies here.  `wzTouched` and its blur-gated
            validation went with it. */}
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
               
                value={scenario.workZoneSpeed}
                onChange={(e) =>
                  set("workZoneSpeed", +e.target.value || 0)
                }
              />
              <div className="tr-prov mt-1.5">
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
