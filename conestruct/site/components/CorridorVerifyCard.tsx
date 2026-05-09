"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Confidence,
  DetectedField,
  RoadClassification,
} from "@/lib/road-classify";
import type { Scenario, ScenarioKind } from "@/lib/scenarios";
import { applyClassification } from "@/lib/scenarios";
import {
  buildCorridorSpec,
  corridorTotalLengthFt,
} from "@/lib/corridor-spacing";
import type { CorridorSpec } from "@/lib/corridor-map";
import { Field, LabelRow } from "./GeneratorFormPrimitives";

interface Props {
  // The auto-detected classification.  Only this card's verification
  // controls live here; the parent owns the underlying scenario state.
  result: RoadClassification;
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  // Defaulted by the parent when the user hasn't provided a value yet —
  // the corridor preview still renders something useful.
  workZoneFt: number;
  setWorkZoneFt: (next: number) => void;
  bearingDeg: number;
  setBearingDeg: (next: number) => void;
}

type FieldKey = "speed" | "lanes" | "roadType" | "divided";

const COMPASS_OPTIONS: Array<{ v: number; l: string }> = [
  { v: 0, l: "N" },
  { v: 45, l: "NE" },
  { v: 90, l: "E" },
  { v: 135, l: "SE" },
  { v: 180, l: "S" },
  { v: 225, l: "SW" },
  { v: 270, l: "W" },
  { v: 315, l: "NW" },
];

const ROAD_TYPE_LABELS: Record<RoadClassification["roadType"], string> = {
  rural_undivided: "Rural — undivided",
  rural_divided: "Rural — divided",
  urban_arterial: "Urban arterial",
  freeway: "Freeway / interstate",
};

function confDot(c: Confidence): string {
  switch (c) {
    case "high":
      return "bg-[color:var(--cyan)]";
    case "medium":
      return "bg-[color:var(--orange)]";
    case "low":
      return "bg-[#d94f4f]";
  }
}

function confLabel(c: Confidence): string {
  return c.toUpperCase();
}

export function CorridorVerifyCard({
  result,
  scenario,
  setScenario,
  workZoneFt,
  setWorkZoneFt,
  bearingDeg,
  setBearingDeg,
}: Props) {
  // Per-field verification state lives here — verifying a field doesn't
  // mutate the scenario, it just records that the operator has reviewed
  // it.  Re-classification (a fresh result reference) clears verification.
  const [verified, setVerified] = useState<Record<FieldKey, boolean>>({
    speed: false,
    lanes: false,
    roadType: false,
    divided: false,
  });
  const [editing, setEditing] = useState<Record<FieldKey, boolean>>({
    speed: false,
    lanes: false,
    roadType: false,
    divided: false,
  });

  // Reset verification on a fresh classification.
  useEffect(() => {
    setVerified({
      speed: false,
      lanes: false,
      roadType: false,
      divided: false,
    });
    setEditing({
      speed: false,
      lanes: false,
      roadType: false,
      divided: false,
    });
  }, [result]);

  const meta = scenario.meta;
  const corridor = useMemo<CorridorSpec | null>(() => {
    if (!meta.lat || !meta.lng || workZoneFt <= 0) return null;
    const speed = result.speedLimitMph ?? result.fields.speed.value;
    if (!speed) return null;
    return buildCorridorSpec({
      anchorLat: meta.lat,
      anchorLng: meta.lng,
      bearingDeg,
      speedMph: speed,
      workZoneFt,
      scenarioKind: scenario.kind as ScenarioKind,
    });
  }, [meta.lat, meta.lng, workZoneFt, bearingDeg, result, scenario.kind]);

  return (
    <div className="mt-3 border border-[color:var(--rule)] bg-[color:var(--canvas)]">
      <div className="px-3 py-2 border-b border-[color:var(--rule)] flex justify-between items-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--cyan)]">
          Verify · corridor
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
          {Object.values(verified).filter(Boolean).length}/4 confirmed
        </span>
      </div>

      <CorridorMap corridor={corridor} />

      <div className="px-3 py-2.5 border-t border-[color:var(--rule)]">
        <div className="grid grid-cols-2 gap-2.5">
          <Field>
            <LabelRow>Work zone length (ft)</LabelRow>
            <input
              type="number"
              min={0}
              step={50}
              className="field-input"
              value={workZoneFt || ""}
              placeholder="800"
              onChange={(e) => setWorkZoneFt(Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
          <Field>
            <LabelRow>Direction of travel</LabelRow>
            <select
              className="field-input"
              value={bearingDeg}
              onChange={(e) => setBearingDeg(Number(e.target.value))}
            >
              {COMPASS_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l} ({o.v}°)
                </option>
              ))}
            </select>
          </Field>
        </div>
        {corridor && (
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)]">
            Corridor extent · {corridorTotalLengthFt(corridor).toFixed(0)} ft
            <span className="opacity-60">
              {" "}(advance {corridor.advanceWarningFt.toFixed(0)} · taper{" "}
              {corridor.taperFt.toFixed(0)} · buffer {corridor.bufferFt.toFixed(0)}
              {" · "}work {corridor.workZoneFt.toFixed(0)} · downstream{" "}
              {corridor.downstreamTaperFt.toFixed(0)})
            </span>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-[color:var(--rule)]">
        <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] mb-2">
          Detected values
        </div>
        <div className="flex flex-col gap-2">
          <SpeedRow
            field={result.fields.speed}
            displayValue={result.speedLimitMph ?? result.fields.speed.value}
            verified={verified.speed}
            editing={editing.speed}
            onConfirm={() =>
              setVerified((v) => ({ ...v, speed: true }))
            }
            onChange={(next) => {
              setEditing((e) => ({ ...e, speed: false }));
              setVerified((v) => ({ ...v, speed: true }));
              setScenario({ ...scenario, speed: next });
            }}
            onToggleEdit={() =>
              setEditing((e) => ({ ...e, speed: !e.speed }))
            }
            currentScenarioValue={scenario.speed}
          />
          <LanesRow
            field={result.fields.lanes}
            displayValue={result.lanesPerDirection ?? result.fields.lanes.value}
            verified={verified.lanes}
            editing={editing.lanes}
            scenario={scenario}
            onConfirm={() =>
              setVerified((v) => ({ ...v, lanes: true }))
            }
            onChange={(next) => {
              setEditing((e) => ({ ...e, lanes: false }));
              setVerified((v) => ({ ...v, lanes: true }));
              if (scenario.kind === "shoulder") {
                setScenario({ ...scenario, lanes: next });
              }
            }}
            onToggleEdit={() =>
              setEditing((e) => ({ ...e, lanes: !e.lanes }))
            }
          />
          <RoadTypeRow
            field={result.fields.roadType}
            verified={verified.roadType}
            editing={editing.roadType}
            scenario={scenario}
            classification={result}
            onConfirm={() =>
              setVerified((v) => ({ ...v, roadType: true }))
            }
            onChange={(next) => {
              setEditing((e) => ({ ...e, roadType: false }));
              setVerified((v) => ({ ...v, roadType: true }));
              setScenario({
                ...scenario,
                roadType: next,
              } as Scenario);
            }}
            onToggleEdit={() =>
              setEditing((e) => ({ ...e, roadType: !e.roadType }))
            }
          />
          <DividedRow
            field={result.fields.divided}
            verified={verified.divided}
            editing={editing.divided}
            scenario={scenario}
            onConfirm={() =>
              setVerified((v) => ({ ...v, divided: true }))
            }
            onChange={(next) => {
              setEditing((e) => ({ ...e, divided: false }));
              setVerified((v) => ({ ...v, divided: true }));
              if (scenario.kind === "shoulder") {
                setScenario({ ...scenario, divided: next });
              }
            }}
            onToggleEdit={() =>
              setEditing((e) => ({ ...e, divided: !e.divided }))
            }
          />
        </div>
      </div>
    </div>
  );
}

// ----- Map preview ---------------------------------------------------

function CorridorMap({ corridor }: { corridor: CorridorSpec | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!corridor) {
      setUrl(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    fetch("/api/corridor-map", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corridor),
      signal: ctrl.signal,
    })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(
            r.status === 503
              ? "Mapbox not configured"
              : `Map preview failed (${r.status})`,
          );
        }
        const j = (await r.json()) as { url: string };
        setUrl(j.url);
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [corridor]);

  if (!corridor) {
    return (
      <div className="px-3 py-6 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
        Provide work-zone length to render the corridor preview
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-6 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
        {error}
      </div>
    );
  }

  if (loading || !url) {
    return (
      <div className="px-3 py-6 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
        Rendering corridor preview…
      </div>
    );
  }

  return (
    <div className="bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Corridor preview"
        className="block w-full h-auto"
        loading="lazy"
      />
      <div className="px-3 py-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
        <LegendDot color="#ffd166" label="Advance" />
        <LegendDot color="#f3722c" label="Taper" />
        <LegendDot color="#ff7a00" label="Buffer" />
        <LegendDot color="#1ec8a5" label="Work" />
        <LegendDot color="#8a8a8a" label="Downstream" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

// ----- Verification rows --------------------------------------------

interface RowChromeProps {
  label: string;
  field: DetectedField<unknown>;
  displayValueText: string;
  verified: boolean;
  editing: boolean;
  onConfirm: () => void;
  onToggleEdit: () => void;
  editor: React.ReactNode;
}

function RowChrome({
  label,
  field,
  displayValueText,
  verified,
  editing,
  onConfirm,
  onToggleEdit,
  editor,
}: RowChromeProps) {
  const isLow = field.confidence === "low";

  return (
    <div
      className={[
        "border px-2.5 py-2",
        verified
          ? "border-[color:var(--cyan)] bg-[color:var(--canvas-tint)]"
          : "border-[color:var(--rule)]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] flex-none">
            {label}
          </span>
          <span className="text-[13px] text-white font-medium truncate">
            {displayValueText}
          </span>
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full flex-none ${confDot(field.confidence)}`}
            title={`${confLabel(field.confidence)} confidence`}
          />
          {verified && (
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--cyan)] flex-none">
              ✓ verified
            </span>
          )}
        </div>
        <div className="flex gap-1.5 flex-none">
          <button
            type="button"
            onClick={onConfirm}
            disabled={verified}
            className="font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1 border border-[color:var(--cyan)] text-[color:var(--cyan)] hover:bg-[color:var(--cyan)] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={onToggleEdit}
            className="font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1 border border-[color:var(--rule)] text-[color:var(--ink-on-dark)] hover:border-[color:var(--ink-on-dark-faint)] transition-colors"
          >
            {editing ? "Cancel" : "Change"}
          </button>
        </div>
      </div>
      <div className="mt-1 font-mono text-[10px] text-[color:var(--ink-on-dark-faint)] leading-snug">
        {field.source}
        {field.rawData ? <span className="opacity-70"> · {field.rawData}</span> : null}
      </div>
      {isLow && !verified && (
        <div className="mt-1.5 px-2 py-1 border border-[#d94f4f]/40 bg-[#d94f4f]/10 text-[10px] text-[#ffb0b0] leading-snug">
          Could not reliably detect — please verify
        </div>
      )}
      {editing && <div className="mt-2">{editor}</div>}
    </div>
  );
}

function SpeedRow({
  field,
  displayValue,
  verified,
  editing,
  onConfirm,
  onChange,
  onToggleEdit,
  currentScenarioValue,
}: {
  field: DetectedField<number | null>;
  displayValue: number | null;
  verified: boolean;
  editing: boolean;
  onConfirm: () => void;
  onChange: (v: number) => void;
  onToggleEdit: () => void;
  currentScenarioValue: number;
}) {
  const [draft, setDraft] = useState<number>(currentScenarioValue);
  useEffect(() => {
    if (editing) setDraft(currentScenarioValue);
  }, [editing, currentScenarioValue]);

  const display = displayValue !== null ? `${displayValue} mph` : "—";
  return (
    <RowChrome
      label="Speed"
      field={field}
      displayValueText={display}
      verified={verified}
      editing={editing}
      onConfirm={onConfirm}
      onToggleEdit={onToggleEdit}
      editor={
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={20}
            max={75}
            step={5}
            value={draft}
            onChange={(e) => setDraft(Number(e.target.value) || 0)}
            className="field-input flex-1"
          />
          <button
            type="button"
            onClick={() => onChange(draft)}
            className="font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1.5 border border-[color:var(--cyan)] text-[color:var(--cyan)] hover:bg-[color:var(--cyan)] hover:text-white transition-colors"
          >
            Apply
          </button>
        </div>
      }
    />
  );
}

function LanesRow({
  field,
  displayValue,
  verified,
  editing,
  scenario,
  onConfirm,
  onChange,
  onToggleEdit,
}: {
  field: DetectedField<number | null>;
  displayValue: number | null;
  verified: boolean;
  editing: boolean;
  scenario: Scenario;
  onConfirm: () => void;
  onChange: (v: number) => void;
  onToggleEdit: () => void;
}) {
  const applicable = scenario.kind === "shoulder";
  const [draft, setDraft] = useState<number>(
    scenario.kind === "shoulder" ? scenario.lanes : 1,
  );
  useEffect(() => {
    if (editing && scenario.kind === "shoulder") setDraft(scenario.lanes);
  }, [editing, scenario]);

  const display =
    displayValue !== null
      ? `${displayValue} per direction`
      : "—";

  return (
    <RowChrome
      label="Lanes"
      field={field}
      displayValueText={display}
      verified={verified}
      editing={editing}
      onConfirm={onConfirm}
      onToggleEdit={onToggleEdit}
      editor={
        applicable ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={6}
              value={draft}
              onChange={(e) => setDraft(Number(e.target.value) || 1)}
              className="field-input flex-1"
            />
            <button
              type="button"
              onClick={() => onChange(draft)}
              className="font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1.5 border border-[color:var(--cyan)] text-[color:var(--cyan)] hover:bg-[color:var(--cyan)] hover:text-white transition-colors"
            >
              Apply
            </button>
          </div>
        ) : (
          <div className="font-mono text-[10px] text-[color:var(--ink-on-dark-faint)]">
            Lanes are not editable on this scenario kind — switch to
            shoulder work, or update lanes once the scenario type is
            corridor-aware.
          </div>
        )
      }
    />
  );
}

function RoadTypeRow({
  field,
  verified,
  editing,
  scenario,
  classification,
  onConfirm,
  onChange,
  onToggleEdit,
}: {
  field: DetectedField<RoadClassification["roadType"]>;
  verified: boolean;
  editing: boolean;
  scenario: Scenario;
  classification: RoadClassification;
  onConfirm: () => void;
  onChange: (v: RoadClassification["roadType"]) => void;
  onToggleEdit: () => void;
}) {
  const applied = applyClassification(scenario, classification).delta
    .roadTypeApplied;
  const display = `${ROAD_TYPE_LABELS[scenario.kind === "shoulder" ? scenario.roadType : (scenario as { roadType: RoadClassification["roadType"] }).roadType] ?? ROAD_TYPE_LABELS[field.value]}${
    applied ? "" : " (not applied)"
  }`;

  return (
    <RowChrome
      label="Road type"
      field={field}
      displayValueText={display}
      verified={verified}
      editing={editing}
      onConfirm={onConfirm}
      onToggleEdit={onToggleEdit}
      editor={
        <div className="flex flex-col gap-1.5">
          {(Object.keys(ROAD_TYPE_LABELS) as Array<keyof typeof ROAD_TYPE_LABELS>).map(
            (rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => onChange(rt)}
                className="text-left px-2 py-1.5 border border-[color:var(--rule)] hover:border-[color:var(--cyan)] text-[12px] text-[color:var(--ink-on-dark)] transition-colors"
              >
                {ROAD_TYPE_LABELS[rt]}
              </button>
            ),
          )}
        </div>
      }
    />
  );
}

function DividedRow({
  field,
  verified,
  editing,
  scenario,
  onConfirm,
  onChange,
  onToggleEdit,
}: {
  field: DetectedField<boolean>;
  verified: boolean;
  editing: boolean;
  scenario: Scenario;
  onConfirm: () => void;
  onChange: (v: boolean) => void;
  onToggleEdit: () => void;
}) {
  const applicable = scenario.kind === "shoulder";
  const value = scenario.kind === "shoulder" ? scenario.divided : field.value;
  const display = value ? "Divided" : "Undivided";

  return (
    <RowChrome
      label="Divided"
      field={field}
      displayValueText={display}
      verified={verified}
      editing={editing}
      onConfirm={onConfirm}
      onToggleEdit={onToggleEdit}
      editor={
        applicable ? (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onChange(true)}
              className="flex-1 px-2 py-1.5 border border-[color:var(--rule)] hover:border-[color:var(--cyan)] text-[12px] transition-colors"
            >
              Divided
            </button>
            <button
              type="button"
              onClick={() => onChange(false)}
              className="flex-1 px-2 py-1.5 border border-[color:var(--rule)] hover:border-[color:var(--cyan)] text-[12px] transition-colors"
            >
              Undivided
            </button>
          </div>
        ) : (
          <div className="font-mono text-[10px] text-[color:var(--ink-on-dark-faint)]">
            Divided/undivided is implied by the road type for this
            scenario kind.
          </div>
        )
      }
    />
  );
}
