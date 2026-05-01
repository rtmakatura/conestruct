"use client";

import { useState } from "react";
import {
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
      label: "Intersection within work zone",
      desc: "Adds 2 cross-street W20-1 ROAD WORK AHEAD signs.",
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
  sidewalks: "pedestrian_facility",
  bike_facilities: "bicycle_facility",
  schools: "school_zone",
};

type DetectionBucket = {
  detected?: boolean;
  count?: number;
  nearest_distance_m?: number;
  details?: string[];
};

type DetectionResult = Record<string, DetectionBucket | string | undefined> & {
  error?: string;
};

interface Props {
  meta: ScenarioMeta;
  setMeta: (m: ScenarioMeta) => void;
}

export function SiteConditionsField({ meta, setMeta }: Props) {
  const flags: SiteConditions = meta.siteConditions ?? {};
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const hasCoords = !!(meta.lat && meta.lng);

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
      const r = await fetch("/api/render/detect-site", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lat: meta.lat, lng: meta.lng, radius_m: 500 }),
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
      // Pre-fill matching flags. Manual overrides remain — the user can
      // uncheck a false positive or check something detection missed.
      const next: SiteConditions = { ...flags };
      for (const [detKey, flagKey] of Object.entries(DETECTION_TO_FLAG)) {
        const bucket = result[detKey];
        if (bucket && typeof bucket === "object" && bucket.detected) {
          next[flagKey] = true;
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
        {detecting ? "Scanning OpenStreetMap…" : "Detect from location"}
      </button>

      {detectError && (
        <div className="mb-3 px-3 py-2 text-[11px] text-[color:var(--ink-on-dark-faint)] border border-[color:var(--rule)]">
          {detectError}
        </div>
      )}

      {detection && !detection.error && (
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--cyan)]">
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
