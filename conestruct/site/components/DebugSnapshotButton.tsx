"use client";

// Dev-only replication-snapshot button (Refs #102).
//
// TEMPORARY DIAGNOSTIC SCAFFOLDING — not a V1 product feature. Delete this
// file together with app/api/replication-snapshot/route.ts, the
// /render/replication-snapshot endpoint + src/api/replication_snapshot.py
// on the backend, and the two wiring hunks (GeneratorShell mount,
// GeneratorSidebar onClassification callback).
//
// Gate: renders NOTHING unless the URL carries ?debug=1, so it is not
// reachable in a default production configuration. (The existing
// NEXT_PUBLIC_SENTRY_TEST env-gate convention was considered and rejected:
// replication happens on production, where that env is off.)
//
// The downloaded file = sections 1-2 built here (location/detection and the
// default-vs-changed scenario diff — knowable only frontend-side, since the
// wire payload carries final values) + sections 3-6 fetched from the
// backend, which sources them from the same shared functions the real
// deliverables use (rule #3).

import { useEffect, useState } from "react";
import { defaultFor, type Scenario } from "@/lib/scenarios";
import {
  DEFAULT_QUOTE_SETTINGS,
  type QuoteSettings,
} from "@/lib/quote-settings";
import type { RoadClassification } from "@/lib/road-detection/types";

// The last picker classification this session plus the pin it was
// captured at — transient state the sidebar surfaces up via
// onClassification (it is otherwise consumed and discarded at the
// picker → form handoff). The coords let the snapshot flag staleness
// when the location was edited after detection.
export interface SnapshotDetection {
  classification: RoadClassification;
  lat: number;
  lng: number;
}

interface Props {
  scenario: Scenario;
  settings: QuoteSettings;
  detection: SnapshotDetection | null;
}

function cell(value: unknown): string {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function diffTable(
  current: Record<string, unknown>,
  defaults: Record<string, unknown>,
  skip: ReadonlySet<string>,
): string {
  const lines = [
    "| field | value | default | status |",
    "|---|---|---|---|",
  ];
  for (const key of Object.keys(current)) {
    if (skip.has(key)) continue;
    const value = current[key];
    const fallback = defaults[key];
    const status =
      JSON.stringify(value) === JSON.stringify(fallback)
        ? "default"
        : "CHANGED";
    // Values render as their JSON form on purpose: "55" and 55 must stay
    // distinguishable — a coercion bug is exactly what this dump exists
    // to catch.
    lines.push(
      `| ${cell(key)} | ${cell(JSON.stringify(value))} | ${cell(JSON.stringify(fallback))} | ${status} |`,
    );
  }
  return lines.join("\n");
}

// Exported for tests: the frontend-only sections of the snapshot.
export function buildFrontendSections(
  scenario: Scenario,
  settings: QuoteSettings,
  detection: SnapshotDetection | null,
): string {
  const meta = scenario.meta;
  const location: string[] = [
    "## 1 Location & road detection",
    "",
    `- Address: ${meta.address || "(none)"}`,
    `- Lat/Lng: ${meta.lat}, ${meta.lng}`,
    `- Bearing (deg): ${meta.bearingDeg ?? "(unset)"}`,
    `- Site conditions: ${JSON.stringify(meta.siteConditions ?? {})}`,
    "",
  ];
  if (detection) {
    const classification = detection.classification;
    const moved = detection.lat !== meta.lat || detection.lng !== meta.lng;
    location.push(
      `Last road detection (captured at pin ${detection.lat}, ${detection.lng}):`,
      "",
      ...(moved
        ? [
            "**STALE WARNING: the scenario's pin has moved since this " +
              "detection ran — the detection below may describe a " +
              "different road.**",
            "",
          ]
        : []),
      `- Road name/ref: ${classification.raw.roadName ?? "(none)"} / ${classification.raw.roadRef ?? "(none)"}`,
      `- OSM class: ${classification.raw.class} (place: ${classification.raw.placeName ?? "(none)"})`,
      `- Detected roadType: ${classification.fields.roadType.value} (${classification.fields.roadType.confidence}, ${classification.fields.roadType.source})`,
      `- Detected speed: ${classification.fields.speed.value ?? "(none)"} (${classification.fields.speed.confidence}, ${classification.fields.speed.source})`,
      `- Detected lanes: ${classification.fields.lanes.value ?? "(none)"} (${classification.fields.lanes.confidence}, ${classification.fields.lanes.source})`,
      `- Detected divided: ${classification.fields.divided.value} (${classification.fields.divided.confidence}, ${classification.fields.divided.source})`,
      `- Raw OSM tags: lanes=${classification.raw.osmLanesTag ?? "-"} maxspeed=${classification.raw.osmMaxspeedTag ?? "-"} oneway=${classification.raw.oneway}`,
    );
  } else {
    location.push(
      "No road detection ran this session (values below may be manual or loaded from a saved plan).",
    );
  }

  const defaults = defaultFor(scenario.kind) as unknown as Record<
    string,
    unknown
  >;
  const scenarioSection = [
    "## 2 Scenario configuration",
    "",
    `- kind: ${scenario.kind}`,
    `- meta (user-provided, no default): project=${cell(meta.project)}`,
    "",
    diffTable(
      scenario as unknown as Record<string, unknown>,
      defaults,
      new Set(["kind", "meta"]),
    ),
    "",
    "Quote settings (vs DEFAULT_QUOTE_SETTINGS):",
    "",
    diffTable(
      settings as unknown as Record<string, unknown>,
      DEFAULT_QUOTE_SETTINGS as unknown as Record<string, unknown>,
      new Set(),
    ),
  ];

  return [
    `# Replication snapshot — ${meta.project || "untitled"} (${new Date().toISOString()})`,
    "",
    "> Dev-only diagnostic dump (Refs #102). The plan-sheet PDF's visual",
    "> rendering is deliberately excluded; its textual content (TA, case,",
    "> parameters, sign schedule) appears in the audit projection below.",
    "",
    ...location,
    "",
    ...scenarioSection,
    "",
  ].join("\n");
}

export function DebugSnapshotButton({ scenario, settings, detection }: Props) {
  // Gate read from window.location after mount rather than
  // useSearchParams(): the hook forces a Suspense boundary on every
  // statically prerendered page that mounts the shell (next build fails
  // without one). Server render and first client paint are null either
  // way — the gate fails closed.
  const [debugEnabled, setDebugEnabled] = useState(false);
  useEffect(() => {
    setDebugEnabled(
      new URLSearchParams(window.location.search).get("debug") === "1",
    );
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!debugEnabled) return null;

  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/replication-snapshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario, settings }),
      });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text().catch(() => "")}`);
      }
      const backendSections = await res.text();
      const full =
        buildFrontendSections(scenario, settings, detection) +
        "\n" +
        backendSections;
      const blob = new Blob([full], { type: "text/markdown;charset=utf-8" });
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      const base = (scenario.meta.project || "plan")
        .replace(/[^a-zA-Z0-9 _-]+/g, "_")
        .replace(/\s+/g, "_");
      anchor.download = `${base || "plan"}.replication.md`;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-6 py-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="font-mono text-[10px] uppercase tracking-[0.12em] border border-dashed border-amber-500 text-amber-500 px-3 py-1.5 disabled:opacity-50"
        title="Dev-only: download a full replication snapshot (.md) for this scenario"
      >
        {busy ? "Building snapshot…" : "⬇ Replication snapshot (dev)"}
      </button>
      {error && (
        <p className="font-mono text-[10px] text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
}
