"use client";

import { useState } from "react";
import {
  type Scenario,
  type ScenarioKind,
  type ScenarioMeta,
  type SiteConditionFlag,
  type SiteConditions,
} from "@/lib/scenarios";
import { withRelayedCenterline } from "@/lib/scenarios/centerline-relay";
import { CheckRow, FieldGroup } from "./GeneratorFormPrimitives";

const FLAG_LABELS: Record<SiteConditionFlag, { label: string; desc: string }> =
  {
    limited_sight_distance: {
      label: "Limited sight distance",
      desc: "Curve, hill crest — moves advance signs 50% farther upstream.",
    },
    adjacent_intersection: {
      label: "Adjacent at-grade intersection",
      desc: "Signal/stop/uncontrolled cross street — flags the plan for TCS review; the cross-street layout is not generated and no devices are added.",
    },
    adjacent_interchange: {
      label: "Adjacent interchange (highway ramps)",
      desc: "Highway on/off-ramps within or adjacent to work zone — flags the plan for TCS review; the per-ramp layout is not generated and no devices are added.",
    },
    driveways_present: {
      label: "Driveways present",
      desc: "Advisory: maintain access gaps in channelization.",
    },
    pedestrian_facility: {
      label: "Pedestrian sidewalks present",
      desc: "Adds 4 Type III barricades and 2 R9-9 SIDEWALK CLOSED signs.",
    },
    bicycle_facility: {
      label: "Bike lane / cycleway present",
      desc: "Adds 2 M4-9a BIKE DETOUR signs.",
    },
    school_zone: {
      label: "School zone nearby",
      desc: "Adds 2 S1-1 SCHOOL signs upstream of advance warnings.",
    },
  };

// Maps the detection-result categories from /api/render/detect-site onto the
// adjustment flags this UI manages. Categories with no rule-engine action
// (railroad_crossings, hospitals) are intentionally omitted.
const DETECTION_TO_FLAG: Record<string, SiteConditionFlag> = {
  intersections: "adjacent_intersection",
  interchanges: "adjacent_interchange",
  sidewalks: "pedestrian_facility",
  bike_facilities: "bicycle_facility",
  schools: "school_zone",
};

// Inverse of DETECTION_TO_FLAG, for looking up a row's bucket (#16).
const FLAG_TO_DETECTION: Partial<Record<SiteConditionFlag, string>> =
  Object.fromEntries(
    Object.entries(DETECTION_TO_FLAG).map(([det, flag]) => [flag, det]),
  );

// ScenarioKind → closure_type accepted by build_corridor in
// src/rules/corridor.py.  Each mapped value must belong to one of the
// frozensets _resolve_taper_ft consults (corridor.py:58-61):
//   _SHOULDER_KINDS = {"shoulder", "shoulder_divided", "shoulder_undivided"}
//   _LANE_KINDS     = {"lane_closure", "lane_closure_divided", "lane"}
//   _FLAGGER_KINDS  = {"flagger", "flagger_alternating_2lane"}
//   _MOBILE_KINDS   = {"mobile_op_2lane", "mobile_op_multilane", "mobile"}
// "flagger_lane_closure" → "flagger" because the scenario kind isn't in
// _FLAGGER_KINDS directly.  "work_beyond_shoulder" → "shoulder" because
// off-shoulder work uses a shoulder-width offset taper with no travel
// lane lost.  If any mapped value falls out of the frozensets above,
// build_corridor raises ValueError and the endpoint falls back to legacy
// point-and-radius detection — see render_api.render_detect_site.
const SCENARIO_KIND_TO_CLOSURE_TYPE: Record<ScenarioKind, string> = {
  shoulder: "shoulder",
  flagger_lane_closure: "flagger",
  lane_closure_divided: "lane_closure_divided",
  work_beyond_shoulder: "shoulder",
  mobile_op_2lane: "mobile_op_2lane",
  mobile_op_multilane: "mobile_op_multilane",
  // Full merging taper L ("lane" is in _LANE_KINDS) — matches the
  // near_intersection layout's taper choice.
  near_intersection: "lane",
};

type DetectionBucket = {
  detected?: boolean;
  count?: number;
  nearest_distance_m?: number;
  details?: string[];
};

type DetectionResult = Record<string, DetectionBucket | string | undefined> & {
  error?: string;
  mode?: "corridor" | "point";
};

interface Props {
  scenario: Scenario;
  setMeta: (m: ScenarioMeta) => void;
  // The panel's numbered-step index for this section. Site conditions is
  // the final step, so its number shifts with the active scenario kind —
  // the parent computes it.
  step: number;
  /** #222: pre-pin, this kind's steps render pending (dim + inert +
   *  focusable summary) until a location exists. */
  stepsPending?: boolean;
}

export function SiteConditionsField({ scenario, setMeta, step, stepsPending = false }: Props) {
  const meta = scenario.meta;
  const flags: SiteConditions = meta.siteConditions ?? {};
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const hasCoords = !!(meta.lat && meta.lng);
  const hasBearing = typeof meta.bearingDeg === "number";

  // #16 — the margin display.  Backend-relayed numbers only (Rule 3:
  // count / nearest_distance_m / details verbatim, no frontend math),
  // rendered only under a detection-driven row whose bucket reported a
  // relevant feature AND whose checkbox is currently on.  Every other
  // state — no detect yet, bucket empty, detection error, manual-only
  // row, row unchecked — renders nothing (#186: no phantom numbers).
  // Session-scoped by design: the checkbox persists in meta, the
  // evidence lives with this mount's detection result.
  const evidenceFor = (key: SiteConditionFlag): string[] | undefined => {
    if (!detection || detection.error || !flags[key]) return undefined;
    const detKey = FLAG_TO_DETECTION[key];
    if (!detKey) return undefined;
    const bucket = detection[detKey];
    if (!bucket || typeof bucket !== "object" || !bucket.detected)
      return undefined;
    const found = `${bucket.count ?? 0} found`;
    const lines = [
      bucket.nearest_distance_m != null
        ? `${found}, nearest ~${bucket.nearest_distance_m} m`
        : found,
    ];
    for (const detail of (bucket.details ?? []).slice(0, 2)) {
      lines.push(detail);
    }
    return lines;
  };

  const toggle = (key: SiteConditionFlag) => {
    const next: SiteConditions = { ...flags, [key]: !flags[key] };
    if (!next[key]) delete next[key];
    setMeta({ ...meta, siteConditions: next });
  };

  const detect = async () => {
    if (!hasCoords) return;
    setDetecting(true);
    setDetectError(null);
    try {
      const body: Record<string, number | string | Array<[number, number]>> = {
        lat: meta.lat,
        lng: meta.lng,
        radius_m: 500,
      };
      if (hasBearing && meta.bearingDeg !== undefined) {
        body.bearing_deg = meta.bearingDeg;
        body.speed_mph = scenario.speed;
        body.work_zone_ft = scenario.workLen;
        body.closure_type = SCENARIO_KIND_TO_CLOSURE_TYPE[scenario.kind];
        body.road_type = scenario.roadType;
        body.lane_width_ft = scenario.laneWidth;
        // #207: relay the confirmed road's geometry so corridor-mode
        // detection classifies in the road's station frame — the same
        // wire-only, staleness-guarded materialization the render
        // payloads use (exact pin match; never stored).
        const wireCenterline = withRelayedCenterline(scenario).meta.centerline;
        if (wireCenterline) {
          body.centerline = wireCenterline;
        }
      }
      const r = await fetch("/api/render/detect-site", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        setDetectError(`Detection failed (${r.status}).`);
        return;
      }
      const result = (await r.json()) as DetectionResult;
      setDetection(result);
      if (result.error) {
        setDetectError(`Detection failed: ${String(result.error)}.`);
        return;
      }
      // For each detection-driven flag, set true when the bucket reports a
      // relevant feature and clear when it doesn't — so re-running detect
      // after moving the pin unsets stale auto-checks instead of letting
      // false positives accumulate.  Manual-only flags
      // (limited_sight_distance, driveways_present — not in
      // DETECTION_TO_FLAG) are preserved across reruns.
      const next: SiteConditions = { ...flags };
      for (const [detKey, flagKey] of Object.entries(DETECTION_TO_FLAG)) {
        const bucket = result[detKey];
        const detected = !!(
          bucket &&
          typeof bucket === "object" &&
          bucket.detected
        );
        if (detected) {
          next[flagKey] = true;
        } else {
          delete next[flagKey];
        }
      }
      setMeta({ ...meta, siteConditions: next });
    } catch (err) {
      setDetectError(`Detection error: ${(err as Error).message}.`);
    } finally {
      setDetecting(false);
    }
  };

  return (
    <FieldGroup label="Site conditions" step={step} pending={stepsPending}>
      <button
        type="button"
        onClick={detect}
        disabled={!hasCoords || detecting}
        className="w-full mb-3 px-3 py-2 text-[12px] border border-[color:var(--rule)] hover:border-[color:var(--act)] disabled:opacity-50 disabled:cursor-not-allowed text-[color:var(--ink-on-dark)] transition-colors"
        title={
          hasCoords
            ? "Query OpenStreetMap for nearby intersections, sidewalks, schools…"
            : "Enter latitude and longitude above to enable auto-detection"
        }
      >
        {detecting
          ? "Scanning OpenStreetMap…"
          : "Detect nearby site conditions"}
      </button>

      {hasCoords && !hasBearing && (
        <div className="mb-3 px-3 py-2 text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] border border-[color:var(--rule)]">
          Set road direction above for corridor-aware scanning — without it,
          detection runs in legacy point-and-radius mode and may flag
          parallel-street features.
        </div>
      )}

      {detectError && (
        <div className="mb-3 px-3 py-2 text-[11px] text-[color:var(--ink-on-dark-faint)] border border-[color:var(--rule)]">
          {detectError}
        </div>
      )}

      {detection && !detection.error && (
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--act)]">
          {detection.mode === "corridor" ? "Corridor scan: " : "Point scan: "}
          {Object.values(DETECTION_TO_FLAG).filter((f) => flags[f]).length}{" "}
          flag(s) auto-checked
        </div>
      )}

      <div className="check-list flex flex-col gap-1.5">
        {(Object.keys(FLAG_LABELS) as SiteConditionFlag[]).map((key) => (
          <CheckRow
            key={key}
            on={!!flags[key]}
            label={FLAG_LABELS[key].label}
            desc={FLAG_LABELS[key].desc}
            evidence={evidenceFor(key)}
            onToggle={() => toggle(key)}
          />
        ))}
      </div>
    </FieldGroup>
  );
}
