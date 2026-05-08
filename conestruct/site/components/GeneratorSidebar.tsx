"use client";

import { useRef, useState } from "react";
import {
  applyClassification,
  carryMeta,
  defaultFor,
  ENABLED_SCENARIO_KINDS,
  isScenarioKindEnabled,
  SCENARIO_KINDS,
  type Scenario,
  type ScenarioKind,
  type ScenarioMeta,
} from "@/lib/scenarios";
import type { RoadClassification } from "@/lib/road-classify";
import { Field, FieldGroup, LabelRow } from "./GeneratorFormPrimitives";
import { ShoulderForm } from "./ShoulderForm";
import { FlaggerForm } from "./FlaggerForm";
import { LaneClosureForm } from "./LaneClosureForm";
import { WorkBeyondShoulderForm } from "./WorkBeyondShoulderForm";
import { MobileOp2LaneForm } from "./MobileOp2LaneForm";
import { MobileOpMultilaneForm } from "./MobileOpMultilaneForm";
import { SiteConditionsField } from "./SiteConditionsField";
import { CorridorVerifyCard } from "./CorridorVerifyCard";

type ClassifyStatus =
  | { state: "idle" }
  | { state: "resolving" }
  | { state: "detected"; result: RoadClassification }
  | { state: "error"; message: string };

type GeocodeStatus =
  | { state: "idle" }
  | { state: "resolving" }
  | { state: "resolved"; lat: number; lng: number }
  | { state: "error"; message: string };

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
  const [classify, setClassify] = useState<ClassifyStatus>({ state: "idle" });
  const [geo, setGeo] = useState<GeocodeStatus>({ state: "idle" });
  const [lockingIn, setLockingIn] = useState(false);
  // Corridor preview inputs.  These live in component state for v1 — the
  // backend doesn't yet accept a corridor, so we don't persist them on
  // ScenarioMeta.  ``workZoneFt`` defaults to the scenario's ``workLen``
  // (already entered elsewhere); ``bearingDeg`` defaults to north until
  // the operator picks a direction.
  const [bearingDeg, setBearingDeg] = useState(0);
  const [workZoneFt, setWorkZoneFt] = useState(scenario.workLen ?? 0);

  // Latest scenario in a ref so the async lock-in orchestrator reads the
  // current scenario without forcing the consumer to re-pass it on click.
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;

  // Single orchestrator: geocode (if address set) → classify → apply both
  // updates in one setScenario call. Avoids the stale-closure race that
  // would happen if two effects each issued their own setScenario.
  const onLockIn = async () => {
    if (lockingIn) return;
    const cur = scenarioRef.current;
    const address = cur.meta.address.trim();
    const hasManualCoords = cur.meta.lat !== 0 || cur.meta.lng !== 0;
    if (!address && !hasManualCoords) return;

    setLockingIn(true);
    let lat = cur.meta.lat;
    let lng = cur.meta.lng;
    let geoResolvedFromAddress = false;

    try {
      if (address) {
        setGeo({ state: "resolving" });
        try {
          const r = await fetch("/api/geocode", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ address }),
          });
          if (!r.ok) {
            const msg =
              r.status === 503
                ? "Geocoding not configured"
                : r.status === 404
                  ? "No match for that address"
                  : `Geocoding failed (${r.status})`;
            setGeo({ state: "error", message: msg });
            return;
          }
          const j = (await r.json()) as { lat: number; lng: number };
          lat = j.lat;
          lng = j.lng;
          setGeo({ state: "resolved", lat, lng });
          geoResolvedFromAddress = true;
        } catch (e) {
          setGeo({ state: "error", message: (e as Error).message });
          return;
        }
      } else {
        setGeo({ state: "idle" });
      }

      setClassify({ state: "resolving" });
      let classification: RoadClassification | null = null;
      try {
        const cr = await fetch("/api/road-classify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lat, lng }),
        });
        if (!cr.ok) {
          setClassify({
            state: "error",
            message:
              cr.status === 404
                ? "No road found at this point"
                : "Auto-classify failed",
          });
        } else {
          classification = (await cr.json()) as RoadClassification;
          setClassify({ state: "detected", result: classification });
        }
      } catch {
        setClassify({ state: "error", message: "Auto-classify failed" });
      }

      // Commit meta + classification together. Even if classify failed we
      // still write the geocoded lat/lng so the operator's address resolution
      // isn't lost.
      const latest = scenarioRef.current;
      let next: Scenario = latest;
      if (geoResolvedFromAddress) {
        next = { ...latest, meta: { ...latest.meta, lat, lng } };
      }
      if (classification) {
        next = applyClassification(next, classification).scenario;
      }
      if (next !== latest) setScenario(next);
    } finally {
      setLockingIn(false);
    }
  };

  const onKindChange = (kind: ScenarioKind) => {
    if (kind === scenario.kind) return;
    let next = carryMeta(scenario, defaultFor(kind));
    // Re-apply the cached classification to the new scenario so a kind
    // switch carries the auto-detected road type forward (when the new
    // kind's narrowed RoadType union allows it).
    if (classify.state === "detected") {
      next = applyClassification(next, classify.result).scenario;
    }
    setScenario(next);
  };

  const setMeta = (meta: ScenarioMeta) => {
    setScenario({ ...scenario, meta } as Scenario);
  };

  return (
    <aside className="bg-[color:var(--canvas-tint)] border-r border-[color:var(--rule)] md:sticky md:top-[52px] md:self-start md:h-[calc(100vh-52px)] md:overflow-y-auto max-md:border-r-0 max-md:border-b">
      <div className="flex justify-between items-baseline px-6 pt-6 pb-3">
        <h2 className="text-[15px] font-semibold text-white m-0 tracking-[-0.005em]">
          Plan
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--cyan)]">
          01 · INPUT
        </span>
      </div>

      <LocationGroup
        scenario={scenario}
        setMeta={setMeta}
        classify={classify}
        geo={geo}
        lockingIn={lockingIn}
        onLockIn={onLockIn}
      />

      {classify.state === "detected" && (
        <div className="px-6 pb-5">
          <CorridorVerifyCard
            result={classify.result}
            scenario={scenario}
            setScenario={setScenario}
            workZoneFt={workZoneFt}
            setWorkZoneFt={setWorkZoneFt}
            bearingDeg={bearingDeg}
            setBearingDeg={setBearingDeg}
          />
        </div>
      )}

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
  // Only show kinds gated on by ENABLED_SCENARIO_KINDS. When a single
  // kind is enabled the dropdown collapses to static text — no point
  // rendering a one-button picker.
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

// Surfaces a warning when a saved plan or URL-loaded scenario carries a
// kind we have temporarily gated off.  The picker below collapses to
// the enabled set, so without this banner the operator would just see
// a stale form with no explanation.  Pre-fills the first enabled kind
// so a single click migrates the plan into a supported state.
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

const ROAD_TYPE_LABELS: Record<RoadClassification["roadType"], string> = {
  rural_undivided: "Rural — undivided",
  rural_divided: "Rural — divided hwy",
  urban_arterial: "Urban arterial",
  freeway: "Freeway / interstate",
};

const ROAD_CLASS_GLOSS: Record<string, string> = {
  motorway: "Interstate / freeway",
  motorway_link: "Freeway ramp",
  trunk: "US/state primary route",
  trunk_link: "Trunk ramp",
  primary: "Major arterial / county primary",
  primary_link: "Primary ramp",
  secondary: "Connector / minor arterial",
  secondary_link: "Connector ramp",
  tertiary: "Local collector",
  tertiary_link: "Collector ramp",
  street: "Local street",
  street_limited: "Limited-access local",
  service: "Service road / driveway",
  residential: "Residential street",
};

function confidenceCopy(c: RoadClassification): string {
  switch (c.confidence) {
    case "high":
      return "Motorway/interstate detection — class is unambiguous in Mapbox tile data.";
    case "medium":
      return "Multi-lane primary or trunk road. Divided/undivided depends on couplet detection — verify against site photos.";
    case "low":
      return "Tertiary or local road. Mapbox tile data is sparse here — verify every field against the site.";
  }
}

function fieldRow(
  label: string,
  applied: boolean,
  applicable: boolean,
  skippedReason?: string,
) {
  if (!applicable) {
    return (
      <div className="text-[color:var(--ink-on-dark-faint)]">
        — {label} <span className="opacity-70">(not on this scenario)</span>
      </div>
    );
  }
  if (applied) {
    return <div className="text-[color:var(--cyan)]">✓ {label}</div>;
  }
  return (
    <div className="text-[color:var(--orange)]">
      ✗ {label}
      {skippedReason ? (
        <span className="text-[color:var(--ink-on-dark-faint)]">
          {" — "}
          {skippedReason}
        </span>
      ) : null}
    </div>
  );
}

function ClassifyBanner({
  classify,
  scenario,
}: {
  classify: ClassifyStatus;
  scenario: Scenario;
}) {
  if (classify.state === "idle") return null;
  if (classify.state === "resolving") {
    return (
      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
        Classifying road type…
      </div>
    );
  }
  if (classify.state === "error") {
    return (
      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
        {classify.message} — verify roadway fields manually
      </div>
    );
  }
  const r = classify.result;
  const delta = applyClassification(scenario, r).delta;
  const confTone =
    r.confidence === "low"
      ? "text-[color:var(--orange)]"
      : "text-[color:var(--cyan)]";
  const classGloss = ROAD_CLASS_GLOSS[r.raw.class];
  const skippedReason = !delta.roadTypeApplied
    ? `not allowed for "${scenario.kind.replace(/_/g, " ")}"`
    : undefined;

  return (
    <div className="mt-3 border border-[color:var(--rule)] bg-[color:var(--canvas)]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[color:var(--rule)] flex justify-between items-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--cyan)]">
          Auto · Mapbox
        </span>
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.1em] ${confTone}`}
        >
          {r.confidence} confidence
        </span>
      </div>

      {/* Detected values */}
      <div className="px-3 py-2.5">
        <div className="text-[13px] text-white font-medium leading-tight">
          {ROAD_TYPE_LABELS[r.roadType]}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
          <span>{r.divided ? "Divided" : "Undivided"}</span>
          <span>·</span>
          <span>
            {r.laneWidthFt} ft{" "}
            <span className="opacity-70">(class default)</span>
          </span>
          {r.raw.structure && (
            <>
              <span>·</span>
              <span className="text-[color:var(--orange)]">
                {r.raw.structure} — extra signing
              </span>
            </>
          )}
        </div>
      </div>

      {/* Applied to form */}
      <div className="px-3 py-2 border-t border-[color:var(--rule)]">
        <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] mb-1.5">
          Applied to form
        </div>
        <div className="flex flex-col gap-0.5 text-[11px] leading-snug">
          {fieldRow(
            "Road type",
            delta.roadTypeApplied,
            delta.roadTypeApplicable,
            skippedReason,
          )}
          {fieldRow(
            "Divided",
            delta.dividedApplied,
            delta.dividedApplicable,
          )}
          {fieldRow(
            "Lane width (default)",
            delta.laneWidthApplied,
            delta.laneWidthApplicable,
          )}
        </div>
      </div>

      {/* Source data */}
      <div className="px-3 py-2 border-t border-[color:var(--rule)]">
        <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] mb-1.5">
          Source
        </div>
        <div className="font-mono text-[10px] text-[color:var(--ink-on-dark-faint)] leading-relaxed">
          <div>
            <span className="opacity-70">Class · </span>
            {r.raw.class}
            {classGloss && (
              <span className="opacity-70"> ({classGloss})</span>
            )}
          </div>
          {(r.raw.roadName || r.raw.roadRef) && (
            <div>
              <span className="opacity-70">Road · </span>
              {r.raw.roadRef ? `${r.raw.roadRef} ` : ""}
              {r.raw.roadName ?? ""}
            </div>
          )}
          {(r.raw.placeName || r.raw.place) && (
            <div>
              <span className="opacity-70">Place · </span>
              {r.raw.place ?? "—"}
              {r.raw.placeName ? `: ${r.raw.placeName}` : ""}
            </div>
          )}
          <div>
            <span className="opacity-70">One-way · </span>
            {r.raw.oneway ? "yes (couplet hint)" : "no"}
          </div>
        </div>
      </div>

      {/* Confidence rationale */}
      <div className="px-3 py-2 border-t border-[color:var(--rule)]">
        <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] mb-1">
          Why {r.confidence}?
        </div>
        <div className="text-[11px] text-[color:var(--ink-on-dark-faint)] leading-snug">
          {confidenceCopy(r)}
        </div>
      </div>
    </div>
  );
}

function LocationGroup({
  scenario,
  setMeta,
  classify,
  geo,
  lockingIn,
  onLockIn,
}: {
  scenario: Scenario;
  setMeta: (m: ScenarioMeta) => void;
  classify: ClassifyStatus;
  geo: GeocodeStatus;
  lockingIn: boolean;
  onLockIn: () => void;
}) {
  const meta = scenario.meta;
  const set = <K extends keyof ScenarioMeta>(key: K, value: ScenarioMeta[K]) =>
    setMeta({ ...meta, [key]: value });

  const canLockIn =
    meta.address.trim().length > 0 || meta.lat !== 0 || meta.lng !== 0;

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
        {geo.state !== "idle" && (
          <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
            {geo.state === "resolving" && <span>Resolving address…</span>}
            {geo.state === "resolved" && (
              <span className="text-[color:var(--cyan)]">
                Resolved: {geo.lat.toFixed(6)}, {geo.lng.toFixed(6)}
              </span>
            )}
            {geo.state === "error" && <span>{geo.message}</span>}
          </div>
        )}
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
        <LabelRow>Road bearing (° from N)</LabelRow>
        <input
          type="number"
          step="5"
          min="0"
          max="360"
          className="field-input"
          value={meta.bearingDeg ?? ""}
          placeholder="Leave blank for default ↑ = North"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              set("bearingDeg", undefined as never);
            } else {
              const n = +raw;
              set("bearingDeg", (Number.isFinite(n) ? n : undefined) as never);
            }
          }}
        />
        <div className="mt-1 font-mono text-[10px] text-[color:var(--ink-on-dark-faint)]">
          Rotates the north arrow on the schematic to match site bearing.
        </div>
      </Field>

      <button
        type="button"
        onClick={onLockIn}
        disabled={!canLockIn || lockingIn}
        className="w-full border border-[color:var(--cyan)] bg-transparent text-[color:var(--cyan)] font-mono text-[11px] uppercase tracking-[0.1em] py-2.5 hover:bg-[color:var(--cyan)] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[color:var(--cyan)] flex items-center justify-center gap-2"
      >
        {lockingIn ? (
          <>
            <span className="inline-block w-3 h-3 rounded-full border-[1.5px] border-[color:var(--cyan)]/40 border-t-[color:var(--cyan)] animate-spin" />
            Resolving…
          </>
        ) : classify.state === "detected" ? (
          <>Re-detect roadway →</>
        ) : (
          <>Lock in location →</>
        )}
      </button>
      {!canLockIn && (
        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
          Enter an address or lat/lng to enable
        </div>
      )}

      <ClassifyBanner classify={classify} scenario={scenario} />
    </FieldGroup>
  );
}
