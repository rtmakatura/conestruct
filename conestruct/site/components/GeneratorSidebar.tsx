"use client";

import {
  CLOSURE_TYPES,
  ROAD_TYPES,
  type ScenarioParams,
} from "@/lib/compute";

type Setter = <K extends keyof ScenarioParams>(
  key: K,
  value: ScenarioParams[K],
) => void;

interface Props {
  params: ScenarioParams;
  setParam: Setter;
  generating: boolean;
  onGenerate: () => void;
}

export function GeneratorSidebar({
  params,
  setParam,
  generating,
  onGenerate,
}: Props) {
  return (
    <aside className="bg-white border-r border-line px-7 pt-7 pb-10 md:sticky md:top-[60px] md:self-start md:h-[calc(100vh-60px)] md:overflow-y-auto max-md:border-r-0 max-md:border-b">
      {/* Sidebar head */}
      <div className="flex justify-between items-baseline mb-6 pb-4 border-b border-line">
        <h2 className="text-[18px] font-bold text-navy m-0 tracking-[-0.01em]">
          Scenario
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-orange">
          01 · INPUT
        </span>
      </div>

      {/* Group A — Roadway */}
      <FieldGroup label="Roadway" ix="A">
        <Field>
          <label className="field-label-row">
            <span>Road type</span>
          </label>
          <select
            className="field-input field-select"
            value={params.roadType}
            onChange={(e) =>
              setParam("roadType", e.target.value as ScenarioParams["roadType"])
            }
          >
            {ROAD_TYPES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <div className="field-label-row">
            <span>Speed limit</span>
            <span className="field-val">{params.speed} mph</span>
          </div>
          <input
            type="range"
            min="25"
            max="75"
            step="5"
            value={params.speed}
            onChange={(e) => setParam("speed", +e.target.value)}
            className="range-orange w-full my-1.5"
          />
          <div className="font-mono text-[10px] tracking-[0.06em] text-ink-faint mt-1">
            MUTCD: ≥45 mph uses L=W·S
          </div>
        </Field>

        <Field>
          <div className="field-label-row">
            <span>Lanes per direction</span>
          </div>
          <div className="chip-row">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                className={`chip ${params.lanes === n ? "on" : ""}`}
                onClick={() => setParam("lanes", n)}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>

        <Field>
          <div className="field-label-row">
            <span>Lane width</span>
            <span className="field-val">{params.laneWidth} ft</span>
          </div>
          <input
            type="range"
            min="9"
            max="14"
            step="0.5"
            value={params.laneWidth}
            onChange={(e) => setParam("laneWidth", +e.target.value)}
            className="range-orange w-full my-1.5"
          />
        </Field>
      </FieldGroup>

      {/* Group B — Closure */}
      <FieldGroup label="Closure" ix="B">
        <Field>
          <div className="field-label-row">
            <span>Closure type</span>
          </div>
          <div className="chip-row">
            {CLOSURE_TYPES.map((c) => (
              <button
                key={c.v}
                type="button"
                className={`chip ${params.closure === c.v ? "on" : ""}`}
                onClick={() => setParam("closure", c.v)}
              >
                {c.l}
              </button>
            ))}
          </div>
        </Field>

        <Field>
          <div className="field-label-row">
            <span>Work zone length (ft)</span>
          </div>
          <input
            type="number"
            className="field-input"
            value={params.workLen}
            onChange={(e) => setParam("workLen", +e.target.value || 0)}
          />
        </Field>

        <button
          type="button"
          className={`check-row ${params.divided ? "on" : ""}`}
          onClick={() => setParam("divided", !params.divided)}
        >
          <span className="check-box" />
          <span className="check-lbl">Divided highway</span>
          <span className="check-desc">Median present</span>
        </button>
        <button
          type="button"
          className={`check-row w-full ${params.night ? "on" : ""}`}
          onClick={() => setParam("night", !params.night)}
        >
          <span className="check-box" />
          <span className="check-lbl">Night operation</span>
          <span className="check-desc">+ retroreflective</span>
        </button>
      </FieldGroup>

      {/* Group C — Location */}
      <FieldGroup label="Location" ix="C · OPT">
        <Field>
          <div className="field-label-row">
            <span>Address / intersection</span>
          </div>
          <input
            type="text"
            className="field-input"
            value={params.address}
            placeholder="US-85 & Bromley Ln, Brighton, CO"
            onChange={(e) => setParam("address", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2.5 mb-3.5">
          <div>
            <div className="field-label-row">
              <span>Latitude</span>
            </div>
            <input
              type="number"
              step="0.000001"
              className="field-input"
              value={params.lat}
              onChange={(e) => setParam("lat", +e.target.value || 0)}
            />
          </div>
          <div>
            <div className="field-label-row">
              <span>Longitude</span>
            </div>
            <input
              type="number"
              step="0.000001"
              className="field-input"
              value={params.lng}
              onChange={(e) => setParam("lng", +e.target.value || 0)}
            />
          </div>
        </div>

        <Field>
          <div className="field-label-row">
            <span>Project name</span>
          </div>
          <input
            type="text"
            className="field-input"
            value={params.project}
            placeholder="I-25 MM 184 Resurfacing"
            onChange={(e) => setParam("project", e.target.value)}
          />
        </Field>
      </FieldGroup>

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

      <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint text-center">
        Output requires TCS review
      </div>
    </aside>
  );
}

function FieldGroup({
  label,
  ix,
  children,
}: {
  label: string;
  ix: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-3 pb-1.5 border-b border-dashed border-line">
        <span>{label}</span>
        <span className="text-orange">{ix}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="mb-3.5">{children}</div>;
}
