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
// and explains itself — or refuses honestly.
//
// #224 phase 3 (s2-arc17, ruling a): the five scanned checkboxes retired
// too.  They were dead input on a generated plan — the scan owns those
// keys by phase-1 ruling 1 and overwrote them (disclosed in
// manual_flags_discarded) — and their facts now render as section 03's
// counted tier rows with the s2-arc4 evidence.  What stays is the slim
// control: the two conditions no scan can see, operator-asserted, still
// writing meta.siteConditions and passing through the scan untouched.
// Post-generate edits go through Reopen like every other setup field;
// overrides of the scanned keys are phase 4's.
//
// #186 doctrine, carried: pre-generation these rows render no evidence
// — no counts, no distances, no phantom numbers.

type ManualFlag = Extract<SiteConditionFlag, "limited_sight_distance" | "driveways_present">;

const MANUAL_FLAGS: readonly ManualFlag[] = ["limited_sight_distance", "driveways_present"];

const FLAG_LABELS: Record<ManualFlag, { label: string; desc: string }> = {
  limited_sight_distance: {
    label: "Limited sight distance",
    desc: "Curve, hill crest — moves advance signs 50% farther upstream.",
  },
  driveways_present: {
    label: "Driveways present",
    desc: "Advisory: maintain access gaps in channelization.",
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
    <FieldGroup label="Site conditions you assert" step={step} pending={stepsPending}>
      {/* #226 provenance role: a static statement of where detection
          happens now — not a state, not a claim about this site. */}
      <div className="mb-3 tr-prov">
        Site conditions are scanned along the corridor when you generate
        (OpenStreetMap). These two are yours to assert — no scan can see
        them.
      </div>

      <div className="check-list flex flex-col gap-1.5">
        {MANUAL_FLAGS.map((key) => (
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
