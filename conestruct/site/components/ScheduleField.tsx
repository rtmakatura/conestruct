"use client";

// Schedule entry — a first-class Setup step (gen2 inc-8).  The
// design-phase move of schedule inputs onto the jurisdiction hours card
// left pre-generation with no visible way to set a time at all; entry
// now lives here.  The post-generation strip inline-edits the SAME
// scenario.schedule fields, and the Zone 3 hours chip READS them (it no
// longer hosts inputs) — one fact, one home, everywhere in sync.

import { hhmm } from "@/lib/jurisdiction";
import type { Scenario } from "@/lib/scenarios";
import { ChipRow, Field, FieldGroup, LabelRow } from "./GeneratorFormPrimitives";

type Sched = NonNullable<Scenario["schedule"]>;
type DateMode = Sched["date_mode"];

const HALF_HOURS = Array.from({ length: 48 }, (_, i) => i * 0.5);

interface Props {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  step: number;
}

export function ScheduleField({ scenario, setScenario, step }: Props) {
  const sched = scenario.schedule ?? null;
  // Untouched scenario: present "Single day" with empty fields; nothing
  // is written until the user interacts (the payload stays unchanged).
  const mode: DateMode = sched?.date_mode ?? "single";

  const patch = (p: Partial<Sched>) =>
    setScenario({
      ...scenario,
      schedule: { date_mode: mode, ...(sched ?? {}), ...p },
    } as Scenario);

  return (
    <FieldGroup label="Schedule" step={step}>
      <Field>
        <LabelRow>Work dates</LabelRow>
        <ChipRow<DateMode>
          options={[
            { v: "single", l: "Single day" },
            { v: "range", l: "Date range" },
            { v: "tbd", l: "Not set" },
          ]}
          value={mode}
          onChange={(v) => patch({ date_mode: v })}
        />
      </Field>

      {mode !== "tbd" ? (
        <>
          <Field>
            <LabelRow htmlFor="sched-date">
              {mode === "range" ? "First work day" : "Work date"}
            </LabelRow>
            <input
              id="sched-date"
              type="date"
              className="field-input"
              value={sched?.work_date ?? ""}
              onChange={(e) =>
                patch({ work_date: e.target.value || undefined })
              }
            />
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1.5">
              Jurisdiction work windows &amp; permit lead times compute from
              this
            </div>
          </Field>
          {mode === "range" && (
            <Field>
              <LabelRow htmlFor="sched-date-end">Last work day</LabelRow>
              <input
                id="sched-date-end"
                type="date"
                className="field-input"
                value={sched?.work_date_end ?? ""}
                onChange={(e) =>
                  patch({ work_date_end: e.target.value || undefined })
                }
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <Field>
              <LabelRow htmlFor="sched-start">Start time</LabelRow>
              <select
                id="sched-start"
                className="field-input w-full"
                value={sched?.start_time ?? ""}
                onChange={(e) =>
                  patch({
                    start_time:
                      e.target.value === "" ? undefined : +e.target.value,
                  })
                }
              >
                <option value="">—</option>
                {HALF_HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hhmm(h)}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <LabelRow htmlFor="sched-end">End time</LabelRow>
              <select
                id="sched-end"
                className="field-input w-full"
                value={sched?.end_time ?? ""}
                onChange={(e) =>
                  patch({
                    end_time:
                      e.target.value === "" ? undefined : +e.target.value,
                  })
                }
              >
                <option value="">—</option>
                {HALF_HOURS.filter(
                  (h) => sched?.start_time == null || h > sched.start_time,
                ).map((h) => (
                  <option key={h} value={h}>
                    {hhmm(h)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </>
      ) : (
        <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)]">
          Jurisdiction windows show for reference — no dates to check yet
        </div>
      )}
    </FieldGroup>
  );
}
