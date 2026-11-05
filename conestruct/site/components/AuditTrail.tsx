"use client";

import { formulaPairs, type RowDetail } from "@/lib/row-detail";
import type {
  FlaggerLaneClosureScenario,
  LaneClosureDividedScenario,
  MobileOp2LaneScenario,
  MobileOpMultilaneScenario,
  Scenario,
  ShoulderScenario,
  SiteConditionFlag,
  WorkBeyondShoulderScenario,
} from "@/lib/scenarios";
import type {
  AuditResponse,
  AuditState,
  SiteAdjustmentRecord,
} from "@/lib/render-types";

// #97 — the taper/buffer/spacing cite header + footer chip now come from
// the backend ``section.citation`` field (single source; the backend prose
// ``source`` already feeds the body text and was always 11th-edition).
// These constants are the deploy-window fallback ONLY: during the brief
// window where Vercel ships this frontend before ``modal deploy`` lands the
// new field, ``section.citation`` is absent and we fall back to these —
// which are the CORRECT 11th-edition strings, never the old 2009 chrome, so
// the panel can never display a stale citation regardless of deploy order.
// The guard (AuditTrail.test.tsx) asserts both the field-present and
// field-absent branches render clean.
const TAPER_CITATION_FALLBACK = {
  cite: "MUTCD § 6B.08",
  footer: "MUTCD 2023 EDITION · CHAPTER 6B · TABLE 6B-3",
} as const;
const BUFFER_CITATION_FALLBACK = {
  cite: "MUTCD § 6B.06",
  footer: "MUTCD § 6B.06 · STOPPING SIGHT DISTANCE",
} as const;
const SPACING_CITATION_FALLBACK = {
  cite: "MUTCD § 6K.01",
  footer: "MUTCD § 6K.01 · CHANNELIZING DEVICE SPACING",
} as const;
// #286 (R144): the advance row reads ``sections.advance.citation`` now.  Its
// footer used to be written here as "MUTCD § 6B-1", a section that doesn't
// exist (citation defect 20); §6H.02 places the signs by Table 6B-1.
const ADVANCE_CITATION_FALLBACK = {
  cite: "MUTCD TABLE 6B-1",
  footer: "MUTCD § 6H.02 · TABLE 6B-1 · ADVANCE WARNING SIGN SPACING",
} as const;

// #286 (R144 Q1, Rule 3): a calculation row's result and formula lines are
// the backend's ``result_text`` / ``formula_text``, rendered as received.
// The panel adds no label and does no arithmetic.  Before the plan is
// generated, or when the field is absent (a backend older than this
// frontend, in the deploy window), the result is "—" (Rule 10).
function wireResult(text: unknown, generated: boolean): string {
  return generated && typeof text === "string" ? text : "—";
}
function wireLines(lines: unknown): string[] {
  return Array.isArray(lines)
    ? lines.filter((l): l is string => typeof l === "string")
    : [];
}

// Read the backend ``section.citation`` ({cite, footer}); fall back to the
// corrected constant above when the field is absent (deploy window).
function sectionCitation(
  section: Record<string, unknown> | undefined,
  fallback: { cite: string; footer: string },
): { cite: string; footer: string } {
  const c = section?.citation as
    | { cite?: string; footer?: string }
    | undefined;
  return {
    cite: c?.cite ?? fallback.cite,
    footer: c?.footer ?? fallback.footer,
  };
}

// #104 — per-flag ``rule`` citations now read the backend's
// ``sections.site_adjustments[].citation`` when present (single source:
// site_adjustments.py), following the sectionCitation pattern above. This
// table is the deploy-window fallback only — its citation values are
// byte-identical to what the backend derives, so the panel displays the
// same chip regardless of deploy order. ``label`` and ``action`` remain
// panel copy (the backend's ``action`` prose is worded differently, and
// converting it would visibly change the panel — a value change kept out
// of the #104 structural migration).  A flag whose device count depends on
// the road carries no ``action`` here, and the panel prints the backend's
// sentence: pedestrian_facility's barricade count is the backend's to
// state (2, the work-side pair, on every road since #311 R113; #308 R94
// had made it road-dependent).
export const SITE_ADJUSTMENT_DETAIL: Record<
  SiteConditionFlag,
  { label: string; rule: string; action?: string }
> = {
  limited_sight_distance: {
    label: "Limited sight distance",
    rule: "MUTCD § 6B.04",
    // #331: no panel copy; the move's distance depends on the speed and
    // the road, so the panel prints the backend's sentence.
  },
  adjacent_intersection: {
    label: "Intersection within work zone",
    // #16 — page-cited by real subject (11th Ed. "Work within the
    // Traveled Way at an Intersection"); byte-identical to the chip the
    // backend derives from site_adjustments.py's rule string.
    rule: "MUTCD § 6N.12 p. 848",
    action:
      "No devices added: the cross-street approach layout isn't generated. See the pending-verification disclosure.",
  },
  adjacent_interchange: {
    label: "Adjacent interchange (highway ramps)",
    // #16 — page-cited by real subject (11th Ed. "Interchanges"); the
    // "+ Ch. 6H" rider is dropped (Ch. 6H is TTC Zone Warning Signs
    // generally, not interchange signing).
    rule: "MUTCD § 6N.16 p. 851",
    action:
      "No devices added: the per-ramp interchange layout isn't generated. See the pending-verification disclosure.",
  },
  driveways_present: {
    label: "Driveways present",
    // #97 — 11th-edition renumber (§6C.09 → §6K.01, channelizing-device
    // spacing); the backend crew narrative already cites §6K.01.
    rule: "MUTCD § 6K.01",
    action:
      "Maintain access gaps in channelization. Do not place devices across driveway entrances (advisory only).",
  },
  pedestrian_facility: {
    label: "Pedestrian sidewalks present",
    rule: "MUTCD § 6C.02",
  },
  bicycle_facility: {
    label: "Bike lane / cycleway present",
    rule: "MUTCD § 9C.101",
    action:
      "2 M4-9a BIKE DETOUR signs added at the upstream and downstream ends.",
  },
  school_zone: {
    label: "School zone nearby",
    rule: "MUTCD § 7B.08",
    action:
      "2 S1-1 SCHOOL signs added upstream of the standard advance warning set.",
  },
};

export interface ItemSpec {
  title: string;
  result: string;
  cite: string;
  /** #443 ruling 2: the row's flat detail, as data (lib/row-detail). */
  detail: RowDetail;
  /** When true, the item renders with dimmed styling (used for the
   *  pending-verification rollup that closes out the audit list). */
  dim?: boolean;
}

export function auditFilename(name: string | undefined): string {
  const cleaned = (name ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9 _-]+/g, "_")
    .replace(/\s+/g, "_");
  return `${cleaned || "plan"}.audit.pdf`;
}

// #187 — the loading-only stale-while-revalidate rule (the #197 idiom's
// principle applied to carried-forward answers).  ``lastReady`` carries
// no input-identity stamp, so the ONLY state in which presenting it is
// honest is ``loading``, where the "(refreshing…)" cue marks it as
// mid-refresh.  On ``error`` — a refusal or failure for the input on
// screen — a prior input's numbers must not render beneath the banner:
// builders receive null and blank their values with a stated reason.
export function settledData(audit: AuditState): AuditResponse | null {
  return audit.state === "ready"
    ? audit.data
    : audit.state === "loading"
      ? audit.lastReady
      : null;
}

// The row-level placeholder must distinguish "no answer yet" from
// "answer refused/failed" (#192's masking rule, applied at row scope).
function placeholderDetail(audit: AuditState): RowDetail {
  return {
    sentences: [
      audit.state === "error"
        ? "Values unavailable. The audit for this input didn't succeed. See the notice above."
        : "Computing…",
    ],
  };
}

// (#219 — the "Verification & audit trail" chip is retired: Zone 3's
// TieredReference composes the exported item builders below into the
// ruled consequence tiers, hosts the Audit-PDF download and the
// declined/failed banners (the #180 one-voice and rule-10 visible-
// Retry contracts move with them, byte-preserved), and derives its
// row set from lib/tiering.ts.)

// ---------------------------------------------------------------------------
// Per-scenario builders — TS-side display heuristics.
//
// These reproduce the OLD AuditTrail's per-scenario rendering verbatim.
// Each function takes only ``scenario`` (no backend data) and computes
// the displayed values inline using the heuristics ported from
// lib/scenarios/shared.ts.  After PR 3 deletes shared.ts these helpers
// remain self-contained here.
// ---------------------------------------------------------------------------

// Exported for the #223 parity pin (file pattern: every tested item
// helper is exported).
export function buildScenarioItems(
  scenario: Scenario,
  audit: AuditState,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec[] {
  if (scenario.kind === "shoulder")
    return buildShoulderItems(scenario, audit, generated, r);
  if (scenario.kind === "flagger_lane_closure")
    return buildFlaggerItems(scenario, audit, generated, r);
  if (scenario.kind === "lane_closure_divided")
    return buildLaneClosureItems(scenario, audit, generated, r);
  if (scenario.kind === "work_beyond_shoulder")
    return buildWorkBeyondShoulderItems(scenario, audit, generated, r);
  if (scenario.kind === "mobile_op_2lane")
    return buildMobileOp2LaneItems(scenario, audit, generated, r);
  if (scenario.kind === "mobile_op_multilane")
    return buildMobileOpMultilaneItems(scenario, audit, generated, r);
  if (scenario.kind === "near_intersection")
    return buildNearIntersectionItems(audit, generated, r);
  return [];
}

// #223 — NI trace parity.  The backend has always shipped the full
// trace set for this kind (audit_projection passes ``sections``
// unmodified; build_audit_trail computes taper/buffer/spacing/advance
// for NI like every lane closure) — the gap was solely this missing
// branch.  Composition is the flagger set minus the SSD row (no
// flagger stations on this kind), reading ``summary.ta`` / ``case_id``
// from the backend (side-aware TA-21/TA-22, Case 18/19) — never
// literals (rule 3).  The approaches section stays an additive item.
export function buildNearIntersectionItems(
  audit: AuditState,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec[] {
  const data = settledData(audit);
  const caseId = data?.summary.case_id ?? "—";
  return [
    taperItem(audit, generated, r),
    bufferItem(audit, generated, r),
    spacingItem(audit, generated, r),
    advanceItem(audit, generated, r),
    coloradoItem(audit, "S-630-1"),
    referenceItem(audit, data?.summary.ta ?? "—", "S-630-1", r(caseId)),
  ];
}

export function buildShoulderItems(
  _scenario: ShoulderScenario,
  audit: AuditState,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec[] {
  // V1-Wide S1: read the case label and (when present) Sheet 14
  // trigger condition from the backend audit summary instead of the
  // historical TS-side Case 1A/1B placeholder, which silently masked
  // the Case 11 vs Case 26/27 routing distinction.
  const data = settledData(audit);
  const caseId = data?.summary.case_id ?? "—";
  const triggerCondition = data?.summary.trigger_condition;
  return [
    taperItem(audit, generated, r),
    bufferItem(audit, generated, r),
    spacingItem(audit, generated, r),
    advanceItem(audit, generated, r),
    coloradoItem(audit, "S-630-1"),
    // Refs #100: the TA is road-type-aware (TA-3 generally, TA-5 on a
    // freeway) and comes from the backend summary — same single-source
    // pattern as case_id above.  Never re-derive it here (rule #3).
    referenceItem(
      audit,
      data?.summary.ta ?? "—",
      "S-630-1",
      r(caseId),
      triggerCondition,
    ),
  ];
}

// Engine-removal PR C — the flagger sight-distance row is backend-fed:
// ``sections.flagger.sight_distance_ft`` + ``sight_distance_citation``
// (§ 6D.06 → Table 6B-2, verified by subject against the FHWA PDF in
// PR B).  When the field is absent (deploy/rollback window) the row is
// OMITTED, never computed — the retired frontend BUFFER_TABLE served
// this number under a fabricated "§ 6E.06 / Table 6E-1" citation, and
// a silently-computed fallback would recreate exactly that violation
// (unlike the #104 string fallbacks, which are byte-identical text).
const SSD_CITATION_FALLBACK = {
  cite: "MUTCD § 6D.06",
  footer: "MUTCD § 6D.06 · TABLE 6B-2 · STOPPING SIGHT DISTANCE",
} as const;

export function flaggerSightDistanceItem(
  data: AuditResponse | null,
  scenario: FlaggerLaneClosureScenario,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec | null {
  const flagger = data?.sections.flagger as Record<string, unknown> | undefined;
  const ssd = flagger?.sight_distance_ft;
  if (typeof ssd !== "number") return null;
  const citation = sectionCitation(
    { citation: flagger?.sight_distance_citation },
    SSD_CITATION_FALLBACK,
  );
  // #319 (Rule 3): the station line is the audit's, counted from the plan
  // the layout placed (flagger stations, AFADs) plus the relayed pilot car.
  // This row used to write "2 flagger" / "2 AFAD" from the form's switch.
  const stationsText = wireResult(flagger?.stations_text, generated);
  const pilotCarText =
    generated && typeof flagger?.pilot_car_text === "string"
      ? flagger.pilot_car_text
      : null;
  // #286 (R144 Q5): the result and the SSD line are the audit's own, at
  // the speed the audit used (this row used to build the line from the
  // form's speed).
  return {
    title: "Flagger station sight distance",
    result: wireResult(flagger?.sight_distance_result_text, generated),
    cite: citation.cite,
    detail: {
      sentences: [
        "Each flagger station must be located so approaching drivers have at least the stopping sight distance for the posted speed (MUTCD § 6D.06, which points to Table 6B-2), so they can stop on the open lane.",
      ],
      pairs: [
        ...formulaPairs(wireLines(flagger?.sight_distance_formula_text)),
        { label: "Stations", value: stationsText },
        ...(pilotCarText !== null ? [{ label: "Pilot car", value: pilotCarText }] : []),
      ],
      source: citation.footer,
    },
  };
}

export function buildFlaggerItems(
  scenario: FlaggerLaneClosureScenario,
  audit: AuditState,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec[] {
  // PR 3: read the case label from the backend audit summary (same S1
  // pattern as buildShoulderItems) instead of the historical "Case 2B"
  // placeholder, which never corresponded to a real S-630-1 case.
  const flaggerData = settledData(audit);
  const flaggerCaseId = flaggerData?.summary.case_id ?? "—";
  const ssdItem = flaggerSightDistanceItem(flaggerData, scenario, generated, r);

  return [
    taperItem(audit, generated, r),
    bufferItem(audit, generated, r),
    spacingItem(audit, generated, r),
    ...(ssdItem ? [ssdItem] : []),
    advanceItem(audit, generated, r),
    coloradoItem(audit, "S-630-1"),
    // Same summary.ta read as the shoulder card (backend sends TA-10).
    referenceItem(audit, flaggerData?.summary.ta ?? "—", "S-630-1", r(flaggerCaseId)),
  ];
}

function buildLaneClosureItems(
  scenario: LaneClosureDividedScenario,
  audit: AuditState,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec[] {
  const arrowBoards = 1;
  const tmaCount = scenario.truckMountedAttenuator ? 1 : 0;
  return [
    taperItem(audit, generated, r),
    bufferItem(audit, generated, r),
    spacingItem(audit, generated, r),
    {
      title: "Arrow board placement",
      result: generated ? `${arrowBoards} unit · LEFT arrow` : "—",
      cite: "MUTCD § 6F.61",
      detail: {
        sentences: [
          "A Type C arrow board is required for lane closures on multi-lane roadways at speeds ≥ 40 mph (MUTCD § 6F.61). Mounted at the upstream start of the merging taper, set to LEFT-arrow mode so drivers in the closed lane merge into the open lane.",
          ...(!scenario.truckMountedAttenuator && scenario.speed >= 45
            ? ["CDOT M-630 strongly recommends a TMA at this speed."]
            : []),
        ],
        pairs: [
          {
            label: "Truck-mounted attenuator (TMA)",
            value: scenario.truckMountedAttenuator
              ? `${tmaCount} unit (recommended)`
              : "Not deployed",
          },
        ],
        source: "MUTCD § 6F.61 · ARROW BOARDS",
      },
    },
    advanceItem(audit, generated, r),
    coloradoItem(audit, "S-630-3"),
    referenceItem(audit, "TA-19", "S-630-3", r("Case 3A")),
  ];
}

function buildWorkBeyondShoulderItems(
  scenario: WorkBeyondShoulderScenario,
  audit: AuditState,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec[] {
  const signs = scenario.duration === "long" ? 2 : 1;
  return [
    {
      title: "Signing scope (no devices on roadway)",
      result: generated ? `${signs} sign(s)` : "—",
      cite: "MUTCD § 6G.04",
      detail: {
        sentences: [
          "Work beyond the shoulder occurs entirely outside the travelway and roadway shoulder. Per MUTCD § 6G.04, only minimal advance signing is required: no taper, no buffer, and no channelizing devices on the road itself.",
        ],
        list: {
          noun: { one: "sign", many: "signs" },
          lines: [
            { text: "Shoulder work", value: "W21-5" },
            ...(scenario.duration === "long" ? [{ text: "End road work", value: "G20-2" }] : []),
          ],
        },
        source: "MUTCD § 6G.04 · WORK OUTSIDE SHOULDER",
      },
    },
    {
      title: "Worker exposure check",
      result: "OFF-ROADWAY",
      cite: "MUTCD § 6D.01",
      detail: {
        sentences: [
          "Workers operate beyond the roadway shoulder, with the shoulder itself acting as a buffer. No worker-on-pavement exposure; roadway traffic is unaffected.",
          ...(scenario.speed >= 55
            ? [
                `High-speed adjacent traffic (${scenario.speed} mph): consider PCMS upstream if work materially affects sight lines or driver attention (chip seal trucks, large equipment, etc.).`,
              ]
            : []),
        ],
        source: "MUTCD § 6D.01 · WORKER PROTECTION",
      },
    },
    coloradoItem(audit, "S-630-1"),
    referenceItem(audit, "TA-1", "S-630-1", r("Case 1")),
  ];
}

function buildMobileOp2LaneItems(
  scenario: MobileOp2LaneScenario,
  audit: AuditState,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec[] {
  const signs = 1;
  const arrowBoards = scenario.arrowBoardOnShadow ? 1 : 0;
  const shadowVehicles = 1;
  const tmaCount = 1;
  const totalDevices = signs + arrowBoards + shadowVehicles + tmaCount + 1;
  return [
    {
      title: "Mobile operation profile",
      result: generated ? `${totalDevices} devices · moving` : "—",
      cite: "MUTCD § 6G.05",
      detail: {
        sentences: [
          `Slow-moving operation with no static taper. The shadow vehicle trails the work truck at ${scenario.workLen} ft; protection moves with the work. Per MUTCD § 6G.05, mobile ops on two-lane roads use a vehicle-mounted W21-1A sign and an optional arrow board on the shadow.`,
        ],
        pairs: [
          {
            label: "Active warning",
            value: scenario.arrowBoardOnShadow
              ? "Arrow board on shadow (caution mode)"
              : "Vehicle-mounted W21-1A only",
          },
        ],
        source: "MUTCD § 6G.05 · MOBILE OPERATIONS",
      },
    },
    {
      title: "Shadow vehicle protection",
      result: generated ? `${shadowVehicles} shadow · ${tmaCount} TMA` : "—",
      cite: "MUTCD § 6F.55",
      detail: {
        sentences: [
          `One shadow vehicle with a truck-mounted attenuator (NCHRP 350 / MASH-rated) provides upstream protection. Trailing distance of ${scenario.workLen} ft gives following traffic a sight cue without losing crash-cushion proximity.`,
          ...(scenario.speed >= 45
            ? [
                `High-speed two-lane (${scenario.speed} mph): shoulder use for evasive maneuvers may be limited. Keep shadow-to-truck spacing tight (≤ 200 ft) and brief drivers on emergency-stop coordination.`,
              ]
            : []),
        ],
        source: "MUTCD § 6F.55 · TRUCK-MOUNTED ATTENUATORS",
      },
    },
    coloradoItem(audit, "S-630-1"),
    referenceItem(audit, "TA-35", "S-630-1", r("Case 4A")),
  ];
}

function buildMobileOpMultilaneItems(
  scenario: MobileOpMultilaneScenario,
  audit: AuditState,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec[] {
  const arrowBoards = 1;
  const tmaCount = (scenario.secondTMA ? 2 : 1) + 1;
  const totalDevices = arrowBoards + tmaCount;
  return [
    {
      title: "Mobile operation profile",
      result: generated ? `${totalDevices} devices · moving` : "—",
      cite: "MUTCD § 6G.06",
      detail: {
        sentences: [
          `Slow-moving operation on multi-lane carriageway. Shadow vehicle trails the work truck at ${scenario.workLen} ft with mandatory TMA + arrow board (LEFT-arrow mode for right-lane mobile op).`,
          ...(scenario.secondTMA
            ? [
                "Second TMA deployed approximately 1000 ft upstream of the shadow for additional protection, as CDOT M-630 recommends at speeds ≥ 55 mph.",
              ]
            : []),
        ],
        source: "MUTCD § 6G.06 · MULTI-LANE MOBILE OPS",
      },
    },
    {
      title: "Shadow vehicle + arrow board",
      result: generated ? `${tmaCount} TMA · ${arrowBoards} board` : "—",
      cite: "MUTCD § 6F.55 / § 6F.61",
      detail: {
        sentences: [
          "Shadow vehicle with NCHRP 350 / MASH-rated TMA provides crash-cushion protection. Arrow board (Type C) on the shadow indicates merge direction at posted distance: LEFT arrow for the right-lane operation.",
          ...(scenario.speed >= 55 && !scenario.secondTMA
            ? [
                "⚠ Speed ≥ 55 mph without upstream second TMA: CDOT M-630 strongly recommends a second TMA upstream for high-speed mobile ops to absorb high-energy hits.",
              ]
            : []),
        ],
        source: "MUTCD § 6F.55 · TRUCK-MOUNTED ATTENUATORS",
      },
    },
    coloradoItem(audit, "S-630-3"),
    referenceItem(audit, "TA-26", "S-630-3", r("Case 4B")),
  ];
}

// ---------------------------------------------------------------------------
// Shared per-section helpers — TS-side display, unchanged from the OLD
// AuditTrail.  Each takes already-computed numbers from the per-scenario
// builder.
// ---------------------------------------------------------------------------

function taperItem(
  audit: AuditState,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec {
  // Stale-while-revalidate is loading-only (#187): during refetch the row
  // keeps last-known good data under the (refreshing…) cue; on error the
  // row blanks — a prior input's numbers never render under a declined
  // or failed banner.
  const data = settledData(audit);

  if (!data) {
    return {
      title: "Taper length calculation",
      result: "—",
      cite: TAPER_CITATION_FALLBACK.cite,
      detail: placeholderDetail(audit),
    };
  }

  // `?? {}` (the tier-sources precedent): search builds every row while the
  // section is closed, so an absent wire section must draw "—", not throw.
  const taper = (data.sections.taper ?? {}) as Record<string, unknown>;
  const formulaChoice = taper.formula_choice as string | undefined;

  // #286 (R144 Q1): the "L/3"/"L" label, the "×" glyph and which formula
  // lines show (L/3 on a shoulder closure only) are the backend's
  // (``result_text`` / ``formula_text`` in src/api/audit.py).  The row
  // renders them as received.
  const citation = sectionCitation(taper, TAPER_CITATION_FALLBACK);
  return {
    title: "Taper length calculation",
    result: wireResult(taper.result_text, generated),
    cite: citation.cite,
    detail: {
      sentences: formulaChoice ? [formulaChoice] : [],
      pairs: formulaPairs(wireLines(taper.formula_text)),
      source: citation.footer,
    },
  };
}

function bufferItem(
  audit: AuditState,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec {
  const data = settledData(audit);
  if (!data) {
    return {
      title: "Buffer space calculation",
      result: "—",
      cite: BUFFER_CITATION_FALLBACK.cite,
      detail: placeholderDetail(audit),
    };
  }
  const buffer = (data.sections.buffer ?? {}) as Record<string, unknown>;
  const lookupText = buffer.lookup_text;
  const citation = sectionCitation(buffer, BUFFER_CITATION_FALLBACK);
  return {
    title: "Buffer space calculation",
    // #286: the "B =" label is the backend's (``result_text``).
    result: wireResult(buffer.result_text, generated),
    cite: citation.cite,
    detail: {
      sentences: [
        "Buffer space is the longitudinal clear distance between traffic and workers, sized for stopping sight distance at the posted speed.",
      ],
      pairs: formulaPairs(wireLines([lookupText])),
      source: citation.footer,
    },
  };
}

function spacingItem(
  audit: AuditState,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec {
  const data = settledData(audit);
  if (!data) {
    return {
      title: "Channelizing device spacing",
      result: "—",
      cite: SPACING_CITATION_FALLBACK.cite,
      detail: placeholderDetail(audit),
    };
  }
  const spacing = (data.sections.spacing ?? {}) as Record<string, unknown>;
  const inTaperText = spacing.in_taper_text;
  const onTangentText = spacing.on_tangent_text;
  const citation = sectionCitation(spacing, SPACING_CITATION_FALLBACK);
  return {
    title: "Channelizing device spacing",
    // #286 (R144 Q1, Rule 3): the device total is the backend's; this row
    // used to add the taper drums and tangent cones itself.  The count
    // lines (taper, tangent, then the #96 downstream line when the layout
    // places one) are ``formula_text``.
    result: wireResult(spacing.result_text, generated),
    cite: citation.cite,
    detail: {
      sentences: wireLines([inTaperText, onTangentText]),
      pairs: formulaPairs(wireLines(spacing.formula_text)),
      source: citation.footer,
    },
  };
}

interface AdvanceSignRow {
  Position: string;
  Code: string;
  "Station (ft)": string;
  "Distance from Taper (ft)": string;
}

function advanceItem(
  audit: AuditState,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec {
  const data = settledData(audit);
  if (!data) {
    return {
      title: "Advance warning sign set",
      result: "—",
      cite: ADVANCE_CITATION_FALLBACK.cite,
      detail: placeholderDetail(audit),
    };
  }
  const advance = (data.sections.advance ?? {}) as Record<string, unknown>;
  const roadTypeText = advance.road_type_text;
  const spacingText = advance.spacing_text;
  const signTable = (advance.sign_table as AdvanceSignRow[]) ?? [];
  // #286 (R144 Q1): the sign count and both citation strings are the
  // backend's; the footer this row used to write was "MUTCD § 6B-1".
  const citation = sectionCitation(advance, ADVANCE_CITATION_FALLBACK);
  return {
    title: "Advance warning sign set",
    result: wireResult(advance.result_text, generated),
    cite: citation.cite,
    detail: {
      sentences: wireLines([roadTypeText, spacingText]),
      list: {
        noun: { one: "sign", many: "signs" },
        lines: signTable.map((row) => ({
          text: row.Position,
          value: row.Code,
          sub: `Station (ft): ${row["Station (ft)"]} · From taper (ft): ${row["Distance from Taper (ft)"]}`,
        })),
      },
      source: citation.footer,
    },
  };
}

interface ColoradoCheck {
  pass: boolean;
  label: string;
  citation: string;
  detail: string;
}

interface ColoradoInfoItem {
  info: boolean;
  label: string;
  citation: string;
  detail: string;
}

// Exported for the PR C fail_count sentinel tests (file pattern: every
// tested item helper is exported).
export function coloradoItem(
  audit: AuditState,
  cdotSheet: string,
): ItemSpec {
  const data = settledData(audit);
  if (!data) {
    return {
      title: "Colorado requirements (CDOT S-630-1)",
      result: "— checks",
      cite: `CDOT ${cdotSheet}`,
      detail: placeholderDetail(audit),
    };
  }
  const colorado = (data.sections.colorado ?? {}) as Record<string, unknown>;
  const checks = (colorado.checks as ColoradoCheck[]) ?? [];
  const infoItems = (colorado.info_items as ColoradoInfoItem[]) ?? [];
  const allPass = colorado.all_pass as boolean;
  // Engine-removal PR C: the fail count is the backend's
  // ``fail_count`` (PR B), not a frontend re-derivation.  Field absent
  // (deploy/rollback window): a failing state still names the failure
  // without inventing a count.
  const failCount =
    typeof colorado.fail_count === "number" ? colorado.fail_count : null;
  return {
    title: "Colorado requirements (CDOT S-630-1)",
    result: allPass
      ? "ALL CHECKS PASS"
      : failCount !== null
        ? `${failCount} of ${checks.length} FAIL`
        : "CHECKS FAILED",
    cite: `CDOT ${cdotSheet}`,
    detail: {
      list: {
        noun: { one: "check", many: "checks" },
        lines: [
          ...checks.map((c) => ({ text: `${c.label}: ${c.detail}`, sub: c.citation })),
          ...infoItems.map((c) => ({ text: `${c.label}: ${c.detail}`, sub: c.citation })),
        ],
      },
      source: `CDOT ${cdotSheet} · STANDARD PLAN`,
    },
  };
}

export function referenceItem(
  audit: AuditState,
  ta: string,
  cdotSheet: string,
  caseId: string,
  triggerCondition?: string,
): ItemSpec {
  const data = settledData(audit);
  // UX-19: the backend case section carries two narrative strings the UI
  // previously dropped — ``narrative`` (which CDOT case this matches and
  // how closely; e.g. the flagger closest-analog framing) and
  // ``narrative_2`` (layout-conformance + spacing note).  Both render as
  // their own paragraph below the generic lead-in.  Presence-guarded:
  // when a payload omits either (malformed / a kind that bypasses the
  // case section), the body degrades to the prior generic-sentence form
  // rather than rendering ``undefined``.  The collapsed chip (caseId) is
  // unchanged.
  const caseSection = data?.sections.case as
    | { url?: string; narrative?: string; narrative_2?: string }
    | undefined;
  const url = caseSection?.url;
  const narrative = caseSection?.narrative;
  const narrative2 = caseSection?.narrative_2;
  return {
    title: `${ta} · ${cdotSheet} reference`,
    result: caseId,
    cite: `CDOT ${cdotSheet}`,
    detail: {
      sentences: [
        `Plan matched against MUTCD Typical Application ${ta} and CDOT Standard Plan ${cdotSheet}, CDOT's standard plan set for temporary traffic control.`,
        ...(narrative ? [narrative] : []),
        ...(narrative2 ? [narrative2] : []),
        ...(url ? [] : ["Loading reference…"]),
      ],
      pairs: triggerCondition ? [{ label: "Trigger", value: triggerCondition }] : [],
      links: url ? [{ href: url, label: `↗ Open ${cdotSheet} PDF on CDOT.gov` }] : [],
      source: `CDOT ${cdotSheet}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Additive backend items — only render when the backend explicitly
// reports the condition.  Empty for SHOULDER default scenario in v1.
// ---------------------------------------------------------------------------
// Additive backend items — only render when the backend explicitly
// reports the condition.  (#219: composed per tier by lib/reference-sections;
// the old buildAdditiveItems aggregator is retired.)
// ---------------------------------------------------------------------------


// Backend shape: src/api/audit.py approaches_section (near_intersection
// kind, #117).  Mirrors the fields the PDF builder reads
// (src/rendering/audit_blocks.py _approaches_blocks) so the panel and
// the audit PDF speak the same section.
interface ApproachRow {
  id: string;
  speed_mph: number;
  road_type: string;
  signalized: boolean;
  key_text: string;
  sign_table: Array<Record<string, string>>;
}

const APPROACH_SIGN_COLUMNS = [
  "Code",
  "Station (ft from curb line)",
  "Placement rule",
] as const;

export function approachesItem(
  section: Record<string, unknown> | undefined,
): ItemSpec | null {
  // Absent for every kind except near_intersection — self-suppress.
  if (!section) return null;
  const rows = (section.approaches as ApproachRow[] | undefined) ?? [];
  const side = typeof section.side === "string" ? section.side : "—";
  const alongFt =
    typeof section.along_station_ft === "number"
      ? section.along_station_ft
      : null;
  const narrative =
    typeof section.narrative === "string" ? section.narrative : "";
  const source = typeof section.source === "string" ? section.source : "";
  const nSignalized = rows.filter((r) => r.signalized).length;
  const turnBay = section.turn_bay as { text?: unknown } | undefined;
  const turnBayText = typeof turnBay?.text === "string" ? turnBay.text : "";

  return {
    title: "Cross-street approaches",
    result: `${rows.length} leg${rows.length === 1 ? "" : "s"} · ${side}-side work`,
    cite: "MUTCD § 6N.12",
    detail: {
      sentences: [
        `Intersection on the ${side} side of the work zone${
          alongFt !== null
            ? ` (centerline crossing at mainline station ${alongFt.toLocaleString("en-US")} ft)`
            : ""
        }.`,
        ...(narrative ? [narrative] : []),
        ...rows.map(
          (ap) =>
            `Approach ‘${ap.id}’: ${ap.speed_mph} mph, ${ap.road_type}${
              ap.signalized ? ", SIGNALIZED (signal operation review required)" : ""
            }. ${ap.key_text}.`,
        ),
        // #323 R153: TA-23's left-turn bay, the backend's sentence (the
        // storage "entered by operator"); absent on every other plan.
        ...(turnBayText ? [turnBayText] : []),
      ],
      list: {
        noun: { one: "sign", many: "signs" },
        lines: rows.flatMap((ap) =>
          ap.sign_table.map((row) => ({
            text: `${ap.id}: ${row[APPROACH_SIGN_COLUMNS[0]] ?? "—"}`,
            sub: `${APPROACH_SIGN_COLUMNS[1]}: ${row[APPROACH_SIGN_COLUMNS[1]] ?? "—"} · ${row[APPROACH_SIGN_COLUMNS[2]] ?? "—"}`,
          })),
        ),
      },
      source: source || "MUTCD § 6N.12; CDOT S-630-1 SHEET 10",
    },
  };
}

interface FinesDoubleEnvelope {
  r2_10_station_ft: number;
  r2_11_station_ft: number;
  length_ft: number;
  n_assemblies: number;
  entrance_r2_1_station_ft: number;
  entrance_r2_1_label: string;
  downstream_r2_1_station_ft: number;
  downstream_r2_1_label: string;
}

interface FinesDoubleNote {
  citation: string;
  action: string;
}

export function finesDoubleItem(
  section: Record<string, unknown> | undefined,
): ItemSpec | null {
  // No section → no Fines Double envelope (no work-zone speed reduction
  // in effect). Renderer suppresses entirely.
  if (!section) return null;

  const applicable = section.applicable === true;

  // Flagger carve-out: applicable=false with reason. Sheet 12 scopes
  // Fines Double to freeway/expressway; the estimator-facing audit
  // surfaces the carve-out so it's visible, not silently missed.
  if (!applicable) {
    const reason =
      typeof section.reason === "string"
        ? section.reason
        : "Fines Double envelope not applicable for this scenario.";
    return {
      title: "Fines Double envelope",
      result: "NOT APPLICABLE",
      cite: "S-630-1 Sheet 12",
      dim: true,
      detail: {
        sentences: [reason],
        source: "CDOT S-630-1 SHEET 12 · FINES DOUBLE SIGNING NOTES",
      },
    };
  }

  // (The Item 3 PR-1 interim branch — applicable=true without
  // envelope, "REQUIRED — MANUAL HANDLING (V1)" — was removed in PR 2:
  // the flagger generator emits the envelope, so every applicable=true
  // section now carries geometry. A cached PR-1-era flagger body falls
  // through to the envelope branch and renders with em-dash fallbacks.)

  // Applicable=true: envelope geometry + Sheet 12 operational notes.
  const envelope = section.envelope as FinesDoubleEnvelope | undefined;
  const notes = (section.operational_notes as FinesDoubleNote[] | undefined) ?? [];
  const citation =
    typeof section.citation === "string"
      ? section.citation
      : "CDOT S-630-1 (July 2026) Sheet 12, Fines Double Signing Notes";

  const r210 = envelope?.r2_10_station_ft;
  const r211 = envelope?.r2_11_station_ft;
  const envLen = envelope?.length_ft;
  const nAsm = envelope?.n_assemblies;
  const entR21 = envelope?.entrance_r2_1_station_ft;
  const entR21Label = envelope?.entrance_r2_1_label;
  const dsR21 = envelope?.downstream_r2_1_station_ft;
  const dsR21Label = envelope?.downstream_r2_1_label;

  // Defensive snapshot: notes is empty when the backend ships an
  // applicable=true section with no operational_notes array. Shouldn't
  // happen with current code (audit.py always populates the four
  // Sheet 12 rules) but the render path stays safe.
  const station = (ft: number | undefined) =>
    ft !== undefined ? Math.round(ft).toLocaleString() : "—";
  const noteCount = notes.length;
  const result =
    noteCount > 0
      ? `${nAsm ?? "—"} assemblies · ${noteCount} ops note${noteCount === 1 ? "" : "s"}`
      : `${nAsm ?? "—"} assemblies`;

  return {
    title: "Fines Double envelope",
    result,
    cite: "S-630-1 Sheet 12",
    detail: {
      sentences: [
        "Work-zone posted speed is reduced: Fines Double signing applies per CDOT S-630-1 Sheet 12, Fines Double Signing Notes. The R2-10/R2-11 envelope spans the work zone with G20-5P/R2-6P assemblies at 2,640 ft intervals; the entrance R2-1 posts the reduced limit as drivers enter the zone, and the downstream R2-1 restores posted speed past R2-11.",
      ],
      pairs:
        envLen !== undefined
          ? [{ label: "Envelope length", value: `${Math.round(envLen).toLocaleString()} ft`, mono: true }]
          : [],
      list: {
        noun: { one: "line", many: "lines" },
        lines: [
          ...(envelope
            ? [
                { text: `R2-1: ${entR21Label ?? "SPEED LIMIT (work-zone posting)"}`, value: station(entR21) },
                { text: "R2-10: BEGIN DOUBLE FINES ZONE (upstream)", value: station(r210) },
                {
                  text: `G20-5P / R2-6P: ${nAsm !== undefined ? nAsm : "—"} assembl${nAsm === 1 ? "y" : "ies"} every 2,640 ft`,
                  value: "—",
                },
                { text: "R2-11: END DOUBLE FINES ZONE (downstream)", value: station(r211) },
                { text: `R2-1: ${dsR21Label ?? "SPEED LIMIT (restoration)"}`, value: station(dsR21) },
              ]
            : []),
          ...notes.map((n) => ({ text: n.action, sub: n.citation })),
        ],
      },
      source: citation.toUpperCase(),
    },
  };
}

interface CorridorWarning {
  flag: string;
  level: string;
  message: string;
}

export function corridorValidationItem(
  corridor: Record<string, unknown>,
): ItemSpec | null {
  const checked = corridor.checked === true;
  const warnings = (corridor.warnings as CorridorWarning[] | undefined) ?? [];
  if (!checked) {
    // #213 V5: an unavailable check is a stated absence of verdict,
    // never silence.  The not-run case (no coords/bearing — and any
    // legacy reasonless dict) stays unrendered: there was nothing to
    // check.  ▲ + words per rule 13, existing warn ink only.
    if (corridor.reason !== "check_unavailable") return null;
    return {
      title: "Site corridor validation",
      result: "▲ CHECK UNAVAILABLE",
      cite: "OpenStreetMap",
      detail: {
        sentences: [
          "OpenStreetMap couldn't be reached at generation. Road-network warnings weren't evaluated.",
          "Anchor and bearing agreement with OSM ground truth was not checked. Re-generate to retry.",
        ],
      },
    };
  }
  if (warnings.length === 0) return null;
  return {
    title: "Site corridor validation",
    result: `⚠ ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`,
    cite: "OpenStreetMap",
    detail: {
      sentences: ["Soft check against OSM. Warnings don't block plan generation."],
      list: {
        noun: { one: "warning", many: "warnings" },
        lines: warnings.map((w) => ({ text: w.message, sub: w.flag.replace(/_/g, " ").toUpperCase() })),
      },
    },
  };
}

/**
 * #224 phase 2 (ruling 9) — the NOT-CHECKED disclosure in section 03.
 * Renders ONLY for a plan generated with proceed-anyway after a refused
 * site scan: the backend-authored ``disclosure`` string verbatim as one
 * text node (one voice — src/api/site_scan.py owns it), ▲ + words (rule
 * 13, existing warn ink), the scan's own error/attempt facts.  An
 * UNCOUNTED attention item, exactly the corridorValidationItem
 * precedent: assignTiers and the shared expectation JSON are untouched
 * (a counted fact is phase 3's).  Every other scan state renders
 * nothing here: ok-scan facts are phase-3 tier rows; not_run is not a
 * finding; a refused scan never reaches a rendered plan.
 */
export function siteScanNotCheckedItem(
  scan: Record<string, unknown> | undefined,
): ItemSpec | null {
  if (!scan || scan.status !== "unavailable" || scan.proceeded_anyway !== true) {
    return null;
  }
  const disclosure = typeof scan.disclosure === "string" ? scan.disclosure : null;
  if (!disclosure) return null;
  const facts = [
    typeof scan.error === "string" ? scan.error : null,
    typeof scan.measured_at === "string" ? `attempted ${scan.measured_at}` : null,
  ].filter((f): f is string => f !== null);
  return {
    title: "Site conditions",
    result: "▲ NOT CHECKED",
    cite: "OpenStreetMap",
    detail: {
      sentences: [
        disclosure,
        "School zones, sidewalks, bicycle facilities, intersections and interchanges along the corridor weren't verified. Site adjustments reflect operator-set flags only. Re-generate to retry the scan.",
      ],
      pairs: facts.length > 0 ? [{ label: "Scan", value: facts.join(" · ") }] : [],
    },
  };
}

interface ViolationSpec {
  rule_id: string;
  severity: string;
  message: string;
  mutcd_section: string;
}

export function geometryValidationItem(
  geo: Record<string, unknown>,
): ItemSpec | null {
  const violations = (geo.violations as ViolationSpec[] | undefined) ?? [];
  if (violations.length === 0) return null;
  // The overall verdict is the backend's — ``all_pass`` (audit.py:
  // all(v.severity != "error")) — not re-derived here from severities
  // (frontend-engine-removal PR A).  In a 200 response error-severity
  // violations can't occur (the API raises 400 first), so the
  // absent-field default of WARNINGS matches every reachable case.
  const failed = geo.all_pass === false;
  return {
    title: "Geometry validation",
    result: failed ? "✕ FAILED" : "⚠ WARNINGS",
    cite: "MUTCD § 6C",
    detail: {
      sentences: typeof geo.source === "string" && geo.source ? [geo.source] : [],
      list: {
        noun: { one: "violation", many: "violations" },
        lines: violations.map((v) => ({ text: v.message, sub: `MUTCD § ${v.mutcd_section}` })),
      },
    },
  };
}

export function pendingVerificationItem(
  pending: AuditResponse["pending_verification"],
): ItemSpec | null {
  if (pending.count === 0) return null;
  // When ``items`` is present (Item 1+), iterate each pending entry with
  // its own label + clickable tracking link. When absent (no-pending
  // case, or a body produced before items[] shipped), fall back to the
  // flat note + tracking_issue fields.
  const items = pending.items;
  const useItems = items && items.length > 0;
  return {
    title: "Verification status",
    result: `${pending.count} reference${pending.count === 1 ? "" : "s"} pending`,
    cite: "PENDING",
    dim: true,
    detail: useItems
      ? {
          sentences: items!.map((item) => item.label),
          links: items!.flatMap((item) =>
            item.tracking_issue
              ? [
                  {
                    href: item.tracking_issue,
                    label: `↗ Tracking issue (${item.kind.replace(/_/g, " ")})`,
                  },
                ]
              : [],
          ),
        }
      : {
          sentences: [pending.note],
          links: pending.tracking_issue
            ? [{ href: pending.tracking_issue, label: "↗ Tracking issue" }]
            : [],
        },
  };
}
