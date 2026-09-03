"use client";

import {
  type Scenario,
  type ScenarioMeta,
  type SiteConditionFlag,
  type SiteConditions,
} from "@/lib/scenarios";
import { CheckRow, FieldGroup } from "./GeneratorFormPrimitives";

// #224 phase 2 (s2-arc16): the manual detect section retired.  Detection
// is the in-generate site scan (src/api/site_scan.py, phase 1): the plan
// finds out what applies at Generate, against its own final geometry,
// and explains itself — or refuses honestly.  The "Detect nearby site
// conditions" button, its point-mode note, the "N flag(s) auto-checked"
// line and the #16 evidence lines (all computed from the button's
// result — and carrying two input drifts the phase-1 README records)
// are gone.  What survives to phase 3 (ruling 6): this group and its
// seven checkbox rows writing meta.siteConditions, untouched.  Scan
// precedence is the backend's (phase 1, ruling 1): the scan owns the
// five detection keys; manual-only keys pass through.
//
// #186 doctrine, carried: pre-generation these rows render no evidence
// — no counts, no distances, no phantom numbers.  Evidence for applied
// conditions becomes phase 3's tier rows.

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

  const toggle = (key: SiteConditionFlag) => {
    const next: SiteConditions = { ...flags, [key]: !flags[key] };
    if (!next[key]) delete next[key];
    setMeta({ ...meta, siteConditions: next });
  };

  return (
    <FieldGroup label="Site conditions" step={step} pending={stepsPending}>
      {/* #226 provenance role: a static statement of where detection
          happens now — not a state, not a claim about this site. */}
      <div className="mb-3 tr-prov">
        Site conditions are scanned along the corridor when you generate
        (OpenStreetMap).
      </div>

      <div className="check-list flex flex-col gap-1.5">
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
