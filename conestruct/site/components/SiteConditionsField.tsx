"use client";

import { useState } from "react";
import {
  type Scenario,
  type ScenarioKind,
  type ScenarioMeta,
  type SiteConditionFlag,
  type SiteConditions,
} from "@/lib/scenarios";
import { CheckRow, FieldGroup } from "./GeneratorFormPrimitives";

const FLAG_LABELS: Record<SiteConditionFlag, { label: string; desc: string }> =
  {
    limited_sight_distance: {
      label: "Limited sight distance",
      desc: "Curve, hill crest — moves advance signs 50% farther upstream.",
    },
    adjacent_intersection: {
      label: "Adjacent at-grade intersection",
      desc: "Signal/stop/uncontrolled cross street — adds 2 W20-1 ROAD WORK AHEAD signs facing cross-street traffic.",
    },
    adjacent_interchange: {
      label: "Adjacent interchange (highway ramps)",
      desc: "Highway on/off-ramps within or adjacent to work zone — adds 1 W20-3 LANE CLOSED AHEAD sign and 1 PCMS for upstream ramp signaling.",
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
}

export function SiteConditionsField({ scenario, setMeta }: Props) {
  const meta = scenario.meta;
  const flags: SiteConditions = meta.siteConditions ?? {};
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const hasCoords = !!(meta.lat && meta.lng);
  const hasBearing = typeof meta.bearingDeg === "number";

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
      const body: Record<string, number | string> = {
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
    <FieldGroup label="Site Conditions" ix="· OPT">
      <button
        type="button"
        onClick={detect}
        disabled={!hasCoords || detecting}
        className="w-full mb-3 px-3 py-2 text-[12px] border border-[color:var(--rule)] hover:border-[color:var(--cyan)] disabled:opacity-50 disabled:cursor-not-allowed text-[color:var(--ink-on-dark)] transition-colors"
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
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--cyan)]">
          {detection.mode === "corridor" ? "Corridor scan: " : "Point scan: "}
          {Object.values(DETECTION_TO_FLAG).filter((f) => flags[f]).length}{" "}
          flag(s) auto-checked
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {(Object.keys(FLAG_LABELS) as SiteConditionFlag[]).map((key) => (
          <CheckRow
            key={key}
            on={!!flags[key]}
            label={FLAG_LABELS[key].label}
            desc={FLAG_LABELS[key].desc}
            onToggle={() => toggle(key)}
          />
        ))}
      </div>
    </FieldGroup>
  );
}
