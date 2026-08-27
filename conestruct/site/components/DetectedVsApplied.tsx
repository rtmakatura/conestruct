"use client";

// #227 surface 7 — the detected-vs-applied reference block (closes
// #214).  Detection source, detected value, and applied value are
// three facts of the same kind, previously scattered as annotations;
// here they answer the inspector's question in one place, at the top
// of the Road step.
//
// Data is entirely client-side: ``meta.confirmedRoad`` carries the
// picked candidate (way, name, bearing, tags) and the classification
// synthesized at confirm time; applied values are the scenario fields
// the operator can still edit below.  No wire change.
//
// Rule 10 throughout: the block renders ONLY when a confirmed road
// exists at the CURRENT pin (the pinLat/pinLng staleness key — a stale
// road never speaks, the #149 failure class); a fact OSM never
// reported renders no row; the no-road/manual path keeps today's
// surfaces untouched (#214 acceptance: manual-path behavior
// byte-identical).
//
// The #214 close lives in the bearing row's provenance line: with road
// geometry on file the drawing follows the geometry's own bearings and
// the typed value is consumed sign-only (centerline.ts ±90° test), so
// the block SAYS so — before the user types anything.

import type { Scenario } from "@/lib/scenarios";
import type { RoadType } from "@/lib/scenarios";

const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  rural_undivided: "Rural — undivided",
  rural_divided: "Rural — divided",
  urban_arterial: "Urban arterial",
  freeway: "Freeway / interstate",
};

interface Row {
  label: string;
  detected: string;
  applied: string;
}

export function DetectedVsApplied({ scenario }: { scenario: Scenario }) {
  const meta = scenario.meta;
  const road = meta.confirmedRoad ?? null;
  const fresh =
    road && road.pinLat === meta.lat && road.pinLng === meta.lng
      ? road
      : null;
  if (!fresh) return null;

  const cand = fresh.candidate;
  const cls = fresh.classification;
  const geomDrives = (cand.geometry?.length ?? 0) > 1;

  const rows: Row[] = [];
  rows.push({
    label: "Bearing",
    detected: `${Math.round(cand.bearing)}°`,
    applied:
      meta.bearingDeg !== undefined ? `${Math.round(meta.bearingDeg)}°` : "—",
  });
  if (cls.speedLimitMph !== undefined && "speed" in scenario) {
    rows.push({
      label: "Speed limit",
      detected: `${cls.speedLimitMph} mph`,
      applied: `${scenario.speed} mph`,
    });
  }
  if (cls.lanesPerDirection !== undefined && "lanes" in scenario) {
    rows.push({
      label: "Lanes per direction",
      detected: String(cls.lanesPerDirection),
      applied: String((scenario as { lanes: number }).lanes),
    });
  }
  if ("roadType" in scenario) {
    rows.push({
      label: "Road type",
      detected: ROAD_TYPE_LABELS[cls.roadType],
      applied: ROAD_TYPE_LABELS[(scenario as { roadType: RoadType }).roadType],
    });
  }
  if ("divided" in scenario) {
    rows.push({
      label: "Divided",
      detected: cls.divided ? "Divided" : "Undivided",
      applied: (scenario as { divided: boolean }).divided
        ? "Divided"
        : "Undivided",
    });
  }

  const roadName = cand.name ?? cand.ref ?? `way ${cand.way_id}`;

  return (
    <div className="dva">
      <div className="tr-section mb-1">Detected vs applied</div>
      <div className="tr-prov mb-1.5">
        OSM detection · {roadName} · way {cand.way_id} ·{" "}
        {fresh.method === "auto_single"
          ? "sole match auto-adopted"
          : "operator pick"}
      </div>
      <div className="dva-grid">
        <span />
        <span className="tr-step">Detected</span>
        <span className="tr-step">Applied</span>
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <span className="tr-field">{r.label}</span>
            <span className="font-mono text-[11px] text-[color:var(--ink-on-dark-faint)] tabular-nums text-right">
              {r.detected}
            </span>
            <span className="font-mono text-[11px] text-white tabular-nums text-right">
              {r.applied}
            </span>
          </div>
        ))}
      </div>
      {/* #214: the bearing field's actual role, disclosed before the
          user types.  Both sentences are facts of the current state —
          which input wins is never left unsaid. */}
      <div className="tr-prov mt-1.5">
        {geomDrives
          ? "road geometry governs the drawing — the typed bearing sets the travel-direction sign only"
          : "no road geometry on file — the typed bearing drives the drawing"}
      </div>
    </div>
  );
}
