"use client";

import {
  carryMeta,
  defaultFor,
  SCENARIO_KINDS,
  type Scenario,
  type ScenarioKind,
  type ScenarioMeta,
} from "@/lib/scenarios";
import { Field, FieldGroup, LabelRow } from "./GeneratorFormPrimitives";
import { ShoulderForm } from "./ShoulderForm";
import { FlaggerForm } from "./FlaggerForm";
import { LaneClosureForm } from "./LaneClosureForm";
import { WorkBeyondShoulderForm } from "./WorkBeyondShoulderForm";
import { MobileOp2LaneForm } from "./MobileOp2LaneForm";
import { MobileOpMultilaneForm } from "./MobileOpMultilaneForm";
import { SiteConditionsField } from "./SiteConditionsField";

interface Props {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  generating: boolean;
  onGenerate: () => void;
}

export function GeneratorSidebar({
  scenario,
  setScenario,
  generating,
  onGenerate,
}: Props) {
  const onKindChange = (kind: ScenarioKind) => {
    if (kind === scenario.kind) return;
    setScenario(carryMeta(scenario, defaultFor(kind)));
  };

  const setMeta = (meta: ScenarioMeta) => {
    setScenario({ ...scenario, meta } as Scenario);
  };

  return (
    <aside className="bg-[color:var(--canvas-tint)] border-r border-[color:var(--rule)] md:sticky md:top-[52px] md:self-start md:h-[calc(100vh-52px)] md:overflow-y-auto max-md:border-r-0 max-md:border-b">
      <div className="flex justify-between items-baseline px-6 pt-6 pb-3">
        <h2 className="text-[15px] font-semibold text-white m-0 tracking-[-0.005em]">
          Scenario
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--cyan)]">
          01 · INPUT
        </span>
      </div>

      <ScenarioPicker value={scenario.kind} onChange={onKindChange} />

      {scenario.kind === "shoulder" && (
        <ShoulderForm scenario={scenario} setScenario={setScenario} />
      )}
      {scenario.kind === "flagger_lane_closure" && (
        <FlaggerForm scenario={scenario} setScenario={setScenario} />
      )}
      {scenario.kind === "lane_closure_divided" && (
        <LaneClosureForm scenario={scenario} setScenario={setScenario} />
      )}
      {scenario.kind === "work_beyond_shoulder" && (
        <WorkBeyondShoulderForm
          scenario={scenario}
          setScenario={setScenario}
        />
      )}
      {scenario.kind === "mobile_op_2lane" && (
        <MobileOp2LaneForm scenario={scenario} setScenario={setScenario} />
      )}
      {scenario.kind === "mobile_op_multilane" && (
        <MobileOpMultilaneForm
          scenario={scenario}
          setScenario={setScenario}
        />
      )}

      <LocationGroup meta={scenario.meta} setMeta={setMeta} />

      <SiteConditionsField meta={scenario.meta} setMeta={setMeta} />

      <div className="px-6 pt-5 pb-7 border-t border-[color:var(--rule)] bg-gradient-to-b from-transparent to-black/20">
        <button
          type="button"
          className="generate-btn"
          onClick={onGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <span className="inline-block w-3 h-3 rounded-full border-[1.5px] border-white/40 border-t-white animate-spin" />
              Generating MHT…
            </>
          ) : (
            <>
              Generate MHT package
              <span className="font-mono">→</span>
            </>
          )}
        </button>

        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] text-center">
          Output requires TCS review
        </div>
      </div>
    </aside>
  );
}

function ScenarioPicker({
  value,
  onChange,
}: {
  value: ScenarioKind;
  onChange: (v: ScenarioKind) => void;
}) {
  return (
    <div className="border-t border-b border-[color:var(--rule)] bg-[color:var(--canvas)]">
      <div className="px-6 py-2 flex justify-between items-center font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
        <span>Scenario type</span>
        <span className="text-[color:var(--cyan)]">SELECT</span>
      </div>
      <div className="px-6 pb-5 pt-2 flex flex-col gap-2">
        {SCENARIO_KINDS.map((k) => {
          const active = value === k.v;
          return (
            <button
              key={k.v}
              type="button"
              onClick={() => onChange(k.v)}
              className={[
                "flex items-baseline justify-between text-left px-3 py-2.5 border transition-colors",
                active
                  ? "border-[color:var(--cyan)] bg-[color:var(--canvas-tint)]"
                  : "border-[color:var(--rule)] hover:border-[color:var(--ink-on-dark-faint)]",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[13px] font-medium",
                  active ? "text-white" : "text-[color:var(--ink-on-dark)]",
                ].join(" ")}
              >
                {k.l}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
                {k.sub}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LocationGroup({
  meta,
  setMeta,
}: {
  meta: ScenarioMeta;
  setMeta: (m: ScenarioMeta) => void;
}) {
  const set = <K extends keyof ScenarioMeta>(key: K, value: ScenarioMeta[K]) =>
    setMeta({ ...meta, [key]: value });

  return (
    <FieldGroup label="Location" ix="· OPT">
      <Field>
        <LabelRow>Address / intersection</LabelRow>
        <input
          type="text"
          className="field-input"
          value={meta.address}
          placeholder="US-85 & Bromley Ln, Brighton, CO"
          onChange={(e) => set("address", e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2.5 mb-3.5">
        <div>
          <LabelRow>Latitude</LabelRow>
          <input
            type="number"
            step="0.000001"
            className="field-input"
            value={meta.lat}
            onChange={(e) => set("lat", +e.target.value || 0)}
          />
        </div>
        <div>
          <LabelRow>Longitude</LabelRow>
          <input
            type="number"
            step="0.000001"
            className="field-input"
            value={meta.lng}
            onChange={(e) => set("lng", +e.target.value || 0)}
          />
        </div>
      </div>

      <Field>
        <LabelRow>Project name</LabelRow>
        <input
          type="text"
          className="field-input"
          value={meta.project}
          placeholder="I-25 MM 184 Resurfacing"
          onChange={(e) => set("project", e.target.value)}
        />
      </Field>
    </FieldGroup>
  );
}
