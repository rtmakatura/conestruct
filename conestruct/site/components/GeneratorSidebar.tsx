"use client";

import { useMemo, useRef, useState } from "react";
import {
  applyClassification,
  carryMeta,
  defaultFor,
  ENABLED_SCENARIO_KINDS,
  isScenarioKindEnabled,
  SCENARIO_KINDS,
  type FlaggerRoadType,
  type LaneClosureRoadType,
  type MobileRoadType2Lane,
  type MobileRoadTypeMultilane,
  type RoadType,
  type Scenario,
  type ScenarioKind,
  type ScenarioMeta,
  type WorkBeyondShoulderRoadType,
} from "@/lib/scenarios";
import { buildCorridorSpec } from "@/lib/corridor-spacing";
import {
  buildCorridorPolyline,
  ZONE_COLOR,
  ZONE_LABEL,
  type CorridorPolyline,
  type CorridorZone,
} from "@/lib/corridor-polyline";
import { Field, FieldGroup, LabelRow } from "./GeneratorFormPrimitives";
import { ShoulderForm } from "./ShoulderForm";
import { FlaggerForm } from "./FlaggerForm";
import { LaneClosureForm } from "./LaneClosureForm";
import { WorkBeyondShoulderForm } from "./WorkBeyondShoulderForm";
import { MobileOp2LaneForm } from "./MobileOp2LaneForm";
import { MobileOpMultilaneForm } from "./MobileOpMultilaneForm";
import { SiteConditionsField } from "./SiteConditionsField";
import {
  LocationPickerModal,
  type LocationPickerResult,
  type RoadFieldOverrides,
} from "./LocationPickerModal";

interface Props {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  generating: boolean;
  onGenerate: () => void;
}

const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  rural_undivided: "Rural — undivided",
  rural_divided: "Rural — divided",
  urban_arterial: "Urban arterial",
  freeway: "Freeway / interstate",
};

function fmt6(n: number): string {
  return n.toFixed(6);
}

function fmtFt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// Apply user overrides on top of a freshly-applied classification.
// Mirrors the per-scenario-kind narrowing rules in
// ``applyClassification``: a roadType override only sticks when it's
// in the kind's allowed set; ``lanes`` only persists on shoulder
// (the only kind that carries it on the scenario today).
function applyOverridesToScenario(
  scenario: Scenario,
  overrides: RoadFieldOverrides,
): Scenario {
  let next: Scenario = scenario;
  if (overrides.speedMph !== undefined) {
    next = { ...next, speed: overrides.speedMph } as Scenario;
  }
  if (overrides.roadType !== undefined) {
    next = applyRoadTypeOverride(next, overrides.roadType);
  }
  if (overrides.divided !== undefined && next.kind === "shoulder") {
    next = { ...next, divided: overrides.divided };
  }
  if (
    overrides.lanesPerDirection !== undefined &&
    next.kind === "shoulder"
  ) {
    next = { ...next, lanes: overrides.lanesPerDirection };
  }
  return next;
}

const FLAGGER_TYPES: ReadonlySet<FlaggerRoadType> = new Set<FlaggerRoadType>([
  "rural_undivided",
  "urban_arterial",
]);
const LANE_CLOSURE_TYPES: ReadonlySet<LaneClosureRoadType> =
  new Set<LaneClosureRoadType>(["rural_divided", "freeway"]);
const WORK_BEYOND_TYPES: ReadonlySet<WorkBeyondShoulderRoadType> =
  new Set<WorkBeyondShoulderRoadType>([
    "rural_undivided",
    "rural_divided",
    "urban_arterial",
    "freeway",
  ]);
const MOBILE_2LANE_TYPES: ReadonlySet<MobileRoadType2Lane> =
  new Set<MobileRoadType2Lane>(["rural_undivided", "urban_arterial"]);
const MOBILE_MULTILANE_TYPES: ReadonlySet<MobileRoadTypeMultilane> =
  new Set<MobileRoadTypeMultilane>(["rural_divided", "freeway"]);

function applyRoadTypeOverride(scenario: Scenario, rt: RoadType): Scenario {
  switch (scenario.kind) {
    case "shoulder":
      // ShoulderScenario carries the full RoadType union, so anything sticks.
      return { ...scenario, roadType: rt };
    case "flagger_lane_closure":
      return FLAGGER_TYPES.has(rt as FlaggerRoadType)
        ? { ...scenario, roadType: rt as FlaggerRoadType }
        : scenario;
    case "lane_closure_divided":
      return LANE_CLOSURE_TYPES.has(rt as LaneClosureRoadType)
        ? { ...scenario, roadType: rt as LaneClosureRoadType }
        : scenario;
    case "work_beyond_shoulder":
      return WORK_BEYOND_TYPES.has(rt as WorkBeyondShoulderRoadType)
        ? { ...scenario, roadType: rt as WorkBeyondShoulderRoadType }
        : scenario;
    case "mobile_op_2lane":
      return MOBILE_2LANE_TYPES.has(rt as MobileRoadType2Lane)
        ? { ...scenario, roadType: rt as MobileRoadType2Lane }
        : scenario;
    case "mobile_op_multilane":
      return MOBILE_MULTILANE_TYPES.has(rt as MobileRoadTypeMultilane)
        ? { ...scenario, roadType: rt as MobileRoadTypeMultilane }
        : scenario;
  }
}

export function GeneratorSidebar({
  scenario,
  setScenario,
  generating,
  onGenerate,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;

  const onKindChange = (kind: ScenarioKind) => {
    if (kind === scenario.kind) return;
    setScenario(carryMeta(scenario, defaultFor(kind)));
  };

  const setMeta = (meta: ScenarioMeta) => {
    setScenario({ ...scenario, meta } as Scenario);
  };

  const onPickerSave = (r: LocationPickerResult) => {
    const cur = scenarioRef.current;
    let next: Scenario = {
      ...cur,
      meta: {
        ...cur.meta,
        address: r.address || cur.meta.address,
        lat: r.lat,
        lng: r.lng,
        bearingDeg: r.bearingDeg,
      },
    } as Scenario;
    if (r.workZoneFt > 0) {
      next = { ...next, workLen: r.workZoneFt } as Scenario;
    }
    if (r.classification) {
      next = applyClassification(next, r.classification).scenario;
    }
    next = applyOverridesToScenario(next, r.overrides);
    setScenario(next);
    setPickerOpen(false);
  };

  return (
    <>
      <aside className="bg-[color:var(--canvas-tint)] border-r border-[color:var(--rule)] md:sticky md:top-[52px] md:self-start md:h-[calc(100vh-52px)] md:overflow-y-auto max-md:border-r-0 max-md:border-b">
        <div className="flex justify-between items-baseline px-6 pt-6 pb-3">
          <h2 className="text-[15px] font-semibold text-white m-0 tracking-[-0.005em]">
            Plan
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--cyan)]">
            01 · INPUT
          </span>
        </div>

        <ProjectGroup scenario={scenario} setMeta={setMeta} />

        <LocationCorridorSection
          scenario={scenario}
          setMeta={setMeta}
          setScenario={setScenario}
          onOpenPicker={() => setPickerOpen(true)}
        />

        <DisabledScenarioBanner kind={scenario.kind} />
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

        <SiteConditionsField scenario={scenario} setMeta={setMeta} />

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
                Building bundle…
              </>
            ) : (
              <>
                Download MHT package (.zip)
                <span className="font-mono">↓</span>
              </>
            )}
          </button>

          <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] text-center">
            Output requires TCS review
          </div>
        </div>
      </aside>
      {pickerOpen && (
        <LocationPickerModal
          open={pickerOpen}
          initial={{
            address: scenario.meta.address,
            lat: scenario.meta.lat,
            lng: scenario.meta.lng,
            bearingDeg: scenario.meta.bearingDeg,
            workZoneFt: scenario.workLen,
            scenarioKind: scenario.kind,
            speedMph: scenario.speed,
          }}
          onCancel={() => setPickerOpen(false)}
          onSave={onPickerSave}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function ProjectGroup({
  scenario,
  setMeta,
}: {
  scenario: Scenario;
  setMeta: (m: ScenarioMeta) => void;
}) {
  const meta = scenario.meta;
  const set = <K extends keyof ScenarioMeta>(key: K, value: ScenarioMeta[K]) =>
    setMeta({ ...meta, [key]: value });
  return (
    <FieldGroup label="Project Information" ix="· OPT">
      <Field>
        <LabelRow>Project name</LabelRow>
        <input
          type="text"
          className="field-input"
          value={meta.project}
          placeholder="I-25 NB MP 184 Resurfacing"
          onChange={(e) => set("project", e.target.value)}
        />
      </Field>

      <Field>
        <LabelRow>Location description</LabelRow>
        <input
          type="text"
          className="field-input"
          value={meta.locationDescription ?? ""}
          placeholder="I-25 NB, MP 144.5–146, Colorado Springs"
          onChange={(e) => set("locationDescription", e.target.value)}
        />
      </Field>

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
    </FieldGroup>
  );
}

// Top-level wrapper: either renders the "Pick on Map" CTA + manual
// fallback (no location set), or the read-only summary (location set).
function LocationCorridorSection({
  scenario,
  setMeta,
  setScenario,
  onOpenPicker,
}: {
  scenario: Scenario;
  setMeta: (m: ScenarioMeta) => void;
  setScenario: (next: Scenario) => void;
  onOpenPicker: () => void;
}) {
  const meta = scenario.meta;
  const hasPin = meta.lat !== 0 || meta.lng !== 0;
  return (
    <FieldGroup label="Location & Corridor" ix="01 · DEFINE">
      {hasPin ? (
        <LocationSummary
          scenario={scenario}
          onOpenPicker={onOpenPicker}
          setMeta={setMeta}
          setScenario={setScenario}
        />
      ) : (
        <UnsetLocation
          scenario={scenario}
          setMeta={setMeta}
          setScenario={setScenario}
          onOpenPicker={onOpenPicker}
        />
      )}
    </FieldGroup>
  );
}

// State: no pin yet.  Primary CTA opens the modal; a smaller "Enter
// manually" link reveals the legacy lat/lng/bearing inputs for
// degraded environments (Mapbox token unset, JS error during modal
// load).
function UnsetLocation({
  scenario,
  setMeta,
  setScenario,
  onOpenPicker,
}: {
  scenario: Scenario;
  setMeta: (m: ScenarioMeta) => void;
  setScenario: (next: Scenario) => void;
  onOpenPicker: () => void;
}) {
  const tokenAvailable =
    (process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "").length > 0;
  // Auto-expand the manual fallback when there's no map to fall back
  // *from*.  Operator can still try the modal but it'll degrade to a
  // numeric-only form, so showing the inline inputs up-front saves a
  // click.
  const [showManual, setShowManual] = useState(!tokenAvailable);
  return (
    <div>
      <button
        type="button"
        onClick={onOpenPicker}
        className="w-full border border-[color:var(--cyan)] bg-transparent text-[color:var(--cyan)] font-mono text-[11px] uppercase tracking-[0.1em] py-3 hover:bg-[color:var(--cyan)] hover:text-white transition-colors flex items-center justify-center gap-2"
      >
        <svg width="13" height="15" viewBox="0 0 12 14" fill="none">
          <path
            d="M6 1C3.5 1 1.5 3 1.5 5.5C1.5 9 6 13 6 13C6 13 10.5 9 10.5 5.5C10.5 3 8.5 1 6 1Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <circle cx="6" cy="5.5" r="1.5" fill="currentColor" />
        </svg>
        Pick Location on Map
      </button>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] text-center">
        Map · road detect · work zone in one step
      </div>
      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => setShowManual((s) => !s)}
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] hover:text-[color:var(--cyan)]"
        >
          {showManual ? "Hide manual entry" : "Enter manually"}
        </button>
      </div>
      {showManual && (
        <div className="mt-3">
          <ManualFallback
            scenario={scenario}
            setMeta={setMeta}
            setScenario={setScenario}
          />
        </div>
      )}
    </div>
  );
}

// State: pin set.  Read-only summary with an Edit button.
function LocationSummary({
  scenario,
  onOpenPicker,
  setMeta,
  setScenario,
}: {
  scenario: Scenario;
  onOpenPicker: () => void;
  setMeta: (m: ScenarioMeta) => void;
  setScenario: (next: Scenario) => void;
}) {
  const meta = scenario.meta;
  const [showManual, setShowManual] = useState(false);

  const corridor = useMemo<CorridorPolyline | null>(() => {
    if (!meta.lat || !meta.lng || !scenario.workLen) return null;
    const spec = buildCorridorSpec({
      anchorLat: meta.lat,
      anchorLng: meta.lng,
      bearingDeg: meta.bearingDeg ?? 0,
      speedMph: scenario.speed,
      workZoneFt: scenario.workLen,
      scenarioKind: scenario.kind,
    });
    return buildCorridorPolyline(spec);
  }, [meta.lat, meta.lng, meta.bearingDeg, scenario.speed, scenario.workLen, scenario.kind]);

  const lanes = scenario.kind === "shoulder" ? scenario.lanes : null;
  const divided = scenario.kind === "shoulder" ? scenario.divided : null;
  const roadType: RoadType | null =
    "roadType" in scenario ? (scenario.roadType as RoadType) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Location row */}
      <SummaryRow label="Location">
        <div className="text-[13px] text-white leading-tight">
          {meta.address || "—"}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-0.5">
          {fmt6(meta.lat)}, {fmt6(meta.lng)}
          {meta.bearingDeg !== undefined && (
            <span> · bearing {Math.round(meta.bearingDeg)}°</span>
          )}
        </div>
      </SummaryRow>

      {/* Road properties row */}
      <SummaryRow label="Road properties">
        <div className="text-[13px] text-white leading-tight">
          {scenario.speed} mph
          {lanes !== null && <span> · {lanes} lanes per direction</span>}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-0.5">
          {roadType ? ROAD_TYPE_LABELS[roadType] : "—"}
          {divided !== null && (
            <span> · {divided ? "Divided" : "Undivided"}</span>
          )}
        </div>
      </SummaryRow>

      {/* Corridor extent rows */}
      {corridor && (
        <SummaryRow label="Corridor extent">
          <div className="flex items-baseline justify-between border-b border-[color:var(--rule)] pb-1 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)]">
              Total
            </span>
            <span className="text-white font-semibold text-[14px] tabular-nums">
              {fmtFt(corridor.totalLengthFt)} ft
            </span>
          </div>
          <CorridorRows corridor={corridor} />
        </SummaryRow>
      )}
      {!corridor && (
        <SummaryRow label="Corridor extent">
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)]">
            Set work-zone length to compute
          </div>
        </SummaryRow>
      )}

      <button
        type="button"
        onClick={onOpenPicker}
        className="w-full border border-[color:var(--cyan)] bg-transparent text-[color:var(--cyan)] font-mono text-[11px] uppercase tracking-[0.1em] py-2.5 hover:bg-[color:var(--cyan)] hover:text-white transition-colors mt-1"
      >
        Edit Location &amp; Corridor →
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowManual((s) => !s)}
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] hover:text-[color:var(--cyan)]"
        >
          {showManual ? "Hide manual entry" : "Edit manually"}
        </button>
      </div>
      {showManual && (
        <ManualFallback
          scenario={scenario}
          setMeta={setMeta}
          setScenario={setScenario}
        />
      )}
    </div>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] mb-1">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function CorridorRows({ corridor }: { corridor: CorridorPolyline }) {
  // Same ordering convention as the modal preview: upstream → downstream
  // so the row reads in the direction a motorist encounters the zones.
  const ORDER: readonly CorridorZone[] = [
    "advance_warning",
    "transition",
    "buffer",
    "work_zone",
    "downstream",
  ];
  return (
    <div className="flex flex-col gap-0.5">
      {ORDER.map((zone) => {
        const seg = corridor.segments.find((s) => s.zone === zone);
        const length = seg?.lengthFt ?? 0;
        return (
          <div
            key={zone}
            className="flex items-baseline justify-between gap-2"
          >
            <span className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className="inline-block w-2.5 h-1 flex-shrink-0"
                style={{ background: ZONE_COLOR[zone] }}
              />
              <span className="text-[11px] text-[color:var(--ink-on-dark)] truncate">
                ✓ {ZONE_LABEL[zone]}
              </span>
            </span>
            <span className="font-mono text-[11px] text-white tabular-nums whitespace-nowrap">
              {fmtFt(length)} ft
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ManualFallback({
  scenario,
  setMeta,
  setScenario,
}: {
  scenario: Scenario;
  setMeta: (m: ScenarioMeta) => void;
  setScenario: (next: Scenario) => void;
}) {
  const meta = scenario.meta;
  return (
    <div className="border border-[color:var(--rule)] bg-[color:var(--canvas)] p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] mb-2">
        Manual entry (fallback)
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] block mb-1">
            Latitude
          </label>
          <input
            type="number"
            step="0.000001"
            className="field-input w-full"
            value={meta.lat}
            onChange={(e) => setMeta({ ...meta, lat: +e.target.value || 0 })}
          />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] block mb-1">
            Longitude
          </label>
          <input
            type="number"
            step="0.000001"
            className="field-input w-full"
            value={meta.lng}
            onChange={(e) => setMeta({ ...meta, lng: +e.target.value || 0 })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] block mb-1">
            Bearing (° from N)
          </label>
          <input
            type="number"
            step="1"
            min="0"
            max="359"
            className="field-input w-full"
            value={meta.bearingDeg ?? ""}
            placeholder="0–359"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setMeta({ ...meta, bearingDeg: undefined });
              } else {
                const n = parseInt(raw, 10);
                setMeta({
                  ...meta,
                  bearingDeg: Number.isFinite(n) ? n : undefined,
                });
              }
            }}
          />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] block mb-1">
            Work zone (ft)
          </label>
          <input
            type="number"
            step="10"
            min="0"
            className="field-input w-full"
            value={scenario.workLen || ""}
            placeholder="e.g., 200"
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setScenario({
                ...scenario,
                workLen: Number.isFinite(n) ? n : 0,
              } as Scenario);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ScenarioPicker({
  value,
  onChange,
}: {
  value: ScenarioKind;
  onChange: (v: ScenarioKind) => void;
}) {
  const enabledKinds = SCENARIO_KINDS.filter((k) => isScenarioKindEnabled(k.v));

  if (enabledKinds.length <= 1) {
    const only = enabledKinds[0];
    if (!only) return null;
    return (
      <div className="border-t border-b border-[color:var(--rule)] bg-[color:var(--canvas)]">
        <div className="px-6 py-2 flex justify-between items-center font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
          <span>Scenario type</span>
          <span className="text-[color:var(--cyan)]">LOCKED</span>
        </div>
        <div className="px-6 pb-5 pt-2">
          <div className="px-3 py-2.5 border border-[color:var(--cyan)] bg-[color:var(--canvas-tint)] flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-white">
              {only.l}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
              {only.sub}
            </span>
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
            Additional scenarios coming soon
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-b border-[color:var(--rule)] bg-[color:var(--canvas)]">
      <div className="px-6 py-2 flex justify-between items-center font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
        <span>Scenario type</span>
        <span className="text-[color:var(--cyan)]">SELECT</span>
      </div>
      <div className="px-6 pb-5 pt-2 flex flex-col gap-2">
        {enabledKinds.map((k) => {
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

function DisabledScenarioBanner({ kind }: { kind: ScenarioKind }) {
  if (isScenarioKindEnabled(kind)) return null;
  const currentLabel =
    SCENARIO_KINDS.find((k) => k.v === kind)?.l ?? kind;
  const enabledLabel =
    SCENARIO_KINDS.find((k) => k.v === ENABLED_SCENARIO_KINDS[0])?.l ??
    "shoulder closure";
  return (
    <div className="px-6 py-3 border-t border-b border-[color:var(--orange)] bg-[color:var(--canvas)]">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--orange)] mb-1">
        Scenario disabled
      </div>
      <div className="text-[12px] text-[color:var(--ink-on-dark)] leading-snug">
        {`"${currentLabel}" is temporarily disabled while we verify accuracy. ${enabledLabel} is currently available.`}
      </div>
    </div>
  );
}
