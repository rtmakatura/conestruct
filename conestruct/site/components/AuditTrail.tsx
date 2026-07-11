"use client";

import { useState, type ReactNode } from "react";
import type {
  FlaggerLaneClosureScenario,
  LaneClosureDividedScenario,
  MobileOp2LaneScenario,
  MobileOpMultilaneScenario,
  Scenario,
  ShoulderScenario,
  SiteConditionFlag,
  SiteConditions,
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
// of the #104 structural migration).
const SITE_ADJUSTMENT_DETAIL: Record<
  SiteConditionFlag,
  { label: string; rule: string; action: string }
> = {
  limited_sight_distance: {
    label: "Limited sight distance",
    rule: "MUTCD § 6B.04",
    action:
      "Advance warning signs moved 50% farther upstream to compensate for restricted sight lines.",
  },
  adjacent_intersection: {
    label: "Intersection within work zone",
    rule: "MUTCD § 6N.12",
    action:
      "No devices added — the cross-street approach layout is not generated; see the pending-verification disclosure.",
  },
  adjacent_interchange: {
    label: "Adjacent interchange (highway ramps)",
    rule: "MUTCD § 6N.16 + Ch. 6H",
    action:
      "No devices added — the per-ramp interchange layout is not generated; see the pending-verification disclosure.",
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
    action:
      "4 Type III barricades and 2 R9-9 SIDEWALK CLOSED signs added at the upstream and downstream ends.",
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

interface Props {
  scenario: Scenario;
  audit: AuditState;
  onRetry: () => void;
  /** Mirrors the OLD AuditTrail's prop of the same name: when false
   *  (during bundle-zip generation), value fields render as "—" instead
   *  of the computed number.  Decoupled from ``audit.state`` so the
   *  refresh UX cue (dim header + (refreshing…) badge) for scenario
   *  edits stays distinct from the bundle-generation "—" gating. */
  generated: boolean;
}

export interface ItemSpec {
  title: string;
  result: string;
  cite: string;
  body: ReactNode;
  /** When true, the item renders with dimmed styling (used for the
   *  pending-verification rollup that closes out the audit list). */
  dim?: boolean;
}

function auditFilename(name: string | undefined): string {
  const cleaned = (name ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9 _-]+/g, "_")
    .replace(/\s+/g, "_");
  return `${cleaned || "plan"}.audit.pdf`;
}

export function AuditTrail({ scenario, audit, onRetry, generated }: Props) {
  const [openIdx, setOpenIdx] = useState<number>(0);
  const toggle = (i: number) => setOpenIdx(openIdx === i ? -1 : i);
  const r = (n: number | string) => (generated ? String(n) : "—");

  // Audit-PDF export — POSTs the live scenario to the same public render
  // route the other downloads use; works wherever AuditTrail renders
  // (it always has the scenario), so it needs no mode/planId threading.
  const [auditDl, setAuditDl] = useState<"idle" | "busy" | "error">("idle");
  const onDownloadAuditPdf = async () => {
    if (!generated || auditDl === "busy") return;
    setAuditDl("busy");
    try {
      const res = await fetch("/api/render/audit-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      if (!res.ok) {
        setAuditDl("error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = auditFilename(scenario.meta?.project);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setAuditDl("idle");
    } catch {
      setAuditDl("error");
    }
  };

  // Main per-scenario body items: every section reads from backend audit
  // data via the shared item helpers (``taperItem``, ``bufferItem``,
  // ``spacingItem``, ``advanceItem``, ``coloradoItem``, ``referenceItem``).
  // Per-scenario builders thread ``audit`` through.  As of engine-removal
  // PR C this component computes NO MUTCD values: the last TS-side
  // heuristic (the flagger SSD ``bufferFor`` table) is deleted and the
  // row reads ``sections.flagger.sight_distance_ft`` — absent field →
  // absent row, never a computed fallback.
  const scenarioItems = buildScenarioItems(scenario, audit, generated, r);

  // Conditional additive items from the backend audit response.  These
  // are strictly new — they never appeared in the OLD AuditTrail.  Each
  // renders only when the backend explicitly reports the condition:
  //   - corridor_validation: only when OSM check ran AND produced warnings
  //   - geometry_validation: only when validators produced violations
  //   - pending_verification: only when audit has scrubbed TODO Case # refs
  // For SHOULDER closures in v1 with default coords, all three are empty.
  // Read from ``ready.data`` only (not lastReady) so error states never
  // surface stale validation flags from a previous good fetch.
  const additiveItems: ItemSpec[] =
    audit.state === "ready" ? buildAdditiveItems(audit.data) : [];

  // #104 — thread the backend site-adjustment records into the item so
  // its per-flag citations are backend-fed. ``lastReady`` keeps the
  // backend values through refetch/error (stale-while-revalidate); on the
  // very first load — or during the deploy window where the backend
  // doesn't ship the field yet — the static fallback renders identical
  // values, so there is no flicker.
  const siteRecords =
    audit.state === "ready"
      ? audit.data.sections.site_adjustments
      : audit.lastReady?.sections.site_adjustments;
  const siteItem = siteAdjustmentsItem(scenario.meta.siteConditions, siteRecords);

  const items: ItemSpec[] = [
    ...scenarioItems,
    ...(siteItem ? [siteItem] : []),
    ...additiveItems,
  ];

  // Stale-while-revalidate UX cues: dim header + "(refreshing…)" badge
  // when a refetch is in flight with prior data still visible; error
  // banner above the list when the latest fetch failed.  The main body
  // items keep rendering through both states because they're TS-derived
  // and never depend on the in-flight backend call.
  const isRefreshing =
    audit.state === "loading" && audit.lastReady !== null;
  const isFirstLoad =
    audit.state === "loading" && audit.lastReady === null;

  return (
    <section className="mt-9">
      <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-[color:var(--rule)]">
        <h2
          className={`text-[20px] font-bold tracking-[-0.005em] text-white m-0 transition-opacity ${isRefreshing ? "opacity-60" : ""}`}
        >
          Verification &amp; audit trail
          {isRefreshing && (
            <span className="ml-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--ink-on-dark-faint)] normal-case">
              (refreshing…)
            </span>
          )}
        </h2>
        <div className="flex items-baseline gap-4">
          <button
            type="button"
            onClick={onDownloadAuditPdf}
            disabled={!generated || auditDl === "busy"}
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--cyan)] hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-default cursor-pointer"
          >
            {auditDl === "busy"
              ? "Rendering…"
              : auditDl === "error"
                ? "Try again"
                : "↓ Audit PDF"}
          </button>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-on-dark-faint)]">
            <span className="text-[color:var(--cyan)]">03</span> · SHOW THE WORK
          </span>
        </div>
      </div>
      <div className="font-sans text-[13px] text-[color:var(--ink-on-dark-faint)] mb-4 max-w-[620px]">
        Every calculation is traced to its MUTCD or Colorado Supplement source.
        Verify before stamping.
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--ink-on-dark-faint)] opacity-80 mb-5 max-w-[620px] leading-relaxed">
        Scope: federal MUTCD + Colorado Supplement. Other jurisdictions may
        impose additional requirements not yet captured.
      </div>

      {audit.state === "error" && (
        <div className="flex items-baseline gap-3 mb-5 px-4 py-3 border-l-2 border-[color:var(--orange)] font-mono text-[12px] text-[color:var(--orange)]">
          <span>Audit trail failed: {audit.message}</span>
          <button
            type="button"
            onClick={onRetry}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--cyan)] hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {isFirstLoad && items.length === 0 && (
        <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-6">
          Computing audit trail…
        </div>
      )}

      <div className="audit-list">
        {items.map((item, i) => (
          <AuditItem
            key={item.title}
            num={String(i + 1).padStart(2, "0")}
            title={item.title}
            result={item.result}
            cite={item.cite}
            open={openIdx === i}
            onClick={() => toggle(i)}
            dim={item.dim}
          >
            {item.body}
          </AuditItem>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Per-scenario builders — TS-side display heuristics.
//
// These reproduce the OLD AuditTrail's per-scenario rendering verbatim.
// Each function takes only ``scenario`` (no backend data) and computes
// the displayed values inline using the heuristics ported from
// lib/scenarios/shared.ts.  After PR 3 deletes shared.ts these helpers
// remain self-contained here.
// ---------------------------------------------------------------------------

function buildScenarioItems(
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
  return [];
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
  const data = audit.state === "ready" ? audit.data : audit.lastReady;
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
  const flaggerStations = scenario.afad ? 0 : 2;
  const afadDevices = scenario.afad ? 2 : 0;
  const pilotCarVehicles = scenario.pilotCar ? 1 : 0;
  const flaggerSummary = generated
    ? scenario.afad
      ? `${afadDevices} AFAD`
      : `${flaggerStations} flagger`
    : "—";
  return {
    title: "Flagger station sight distance",
    result: generated ? `${ssd} ft` : "—",
    cite: citation.cite,
    body: (
      <>
        <p>
          Each flagger station must be located so approaching drivers have
          at least the stopping sight distance for the posted speed (MUTCD
          § 6D.06, which points to Table 6B-2), so they can stop on the
          open lane.
        </p>
        <div className="formula">
          <span>SSD</span>
          <span className="op">@</span>
          <span className="var">{scenario.speed}</span>
          <span className="op">mph</span>
          <span className="op">=</span>
          <span className="res">{r(ssd)} ft</span>
        </div>
        <p>
          Stations:{" "}
          <strong>
            {flaggerSummary}
            {scenario.afad ? "" : " station(s)"}
          </strong>
          {pilotCarVehicles > 0 && (
            <>
              {" "}
              · Pilot car: <strong>1 vehicle</strong>
            </>
          )}
        </p>
        <div className="citation">
          <span className="check">✓</span>
          {citation.footer}
        </div>
      </>
    ),
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
  const flaggerData = audit.state === "ready" ? audit.data : audit.lastReady;
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
      body: (
        <>
          <p>
            A Type C arrow board is required for lane closures on multi-lane
            roadways at speeds ≥ 40 mph (MUTCD § 6F.61). Mounted at the
            upstream start of the merging taper, set to LEFT-arrow mode so
            drivers in the closed lane merge into the open lane.
          </p>
          <p>
            Truck-mounted attenuator (TMA):{" "}
            <strong>
              {scenario.truckMountedAttenuator
                ? `${tmaCount} unit (recommended)`
                : "Not deployed"}
            </strong>
            {!scenario.truckMountedAttenuator && scenario.speed >= 45 && (
              <> — CDOT M-630 strongly recommends a TMA at this speed.</>
            )}
          </p>
          <div className="citation">
            <span className="check">✓</span>
            MUTCD § 6F.61 · ARROW BOARDS
          </div>
        </>
      ),
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
      body: (
        <>
          <p>
            Work beyond the shoulder occurs entirely outside the travelway
            and roadway shoulder. Per MUTCD § 6G.04, only minimal advance
            signing is required — no taper, no buffer, no channelizing
            devices on the road itself.
          </p>
          <table>
            <thead>
              <tr>
                <th>Sign</th>
                <th>Code</th>
                <th>Used</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Shoulder work</td>
                <td>W21-5</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>End road work</td>
                <td>G20-2</td>
                <td>{scenario.duration === "long" ? "✓" : "—"}</td>
              </tr>
            </tbody>
          </table>
          <div className="citation">
            <span className="check">✓</span>
            MUTCD § 6G.04 · WORK OUTSIDE SHOULDER
          </div>
        </>
      ),
    },
    {
      title: "Worker exposure check",
      result: "OFF-ROADWAY",
      cite: "MUTCD § 6D.01",
      body: (
        <>
          <p>
            Workers operate beyond the roadway shoulder, with the shoulder
            itself acting as a buffer. No worker-on-pavement exposure;
            roadway traffic is unaffected.
          </p>
          {scenario.speed >= 55 && (
            <p>
              <strong>
                High-speed adjacent traffic ({scenario.speed} mph):
              </strong>{" "}
              consider PCMS upstream if work materially affects sight lines
              or driver attention (chip seal trucks, large equipment, etc.).
            </p>
          )}
          <div className="citation">
            <span className="check">✓</span>
            MUTCD § 6D.01 · WORKER PROTECTION
          </div>
        </>
      ),
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
      body: (
        <>
          <p>
            Slow-moving operation with no static taper. The shadow vehicle
            trails the work truck at <strong>{scenario.workLen} ft</strong>;
            protection moves with the work. Per MUTCD § 6G.05, mobile ops on
            two-lane roads use a vehicle-mounted W21-1A sign and an optional
            arrow board on the shadow.
          </p>
          <p>
            Active warning:{" "}
            <strong>
              {scenario.arrowBoardOnShadow
                ? "Arrow board on shadow (caution mode)"
                : "Vehicle-mounted W21-1A only"}
            </strong>
          </p>
          <div className="citation">
            <span className="check">✓</span>
            MUTCD § 6G.05 · MOBILE OPERATIONS
          </div>
        </>
      ),
    },
    {
      title: "Shadow vehicle protection",
      result: generated ? `${shadowVehicles} shadow · ${tmaCount} TMA` : "—",
      cite: "MUTCD § 6F.55",
      body: (
        <>
          <p>
            One shadow vehicle with a truck-mounted attenuator (NCHRP 350
            / MASH-rated) provides upstream protection. Trailing distance
            of <strong>{scenario.workLen} ft</strong> gives following
            traffic a sight cue without losing crash-cushion proximity.
          </p>
          {scenario.speed >= 45 && (
            <p>
              <strong>
                High-speed two-lane ({scenario.speed} mph):
              </strong>{" "}
              shoulder use for evasive maneuvers may be limited — keep
              shadow-to-truck spacing tight (≤ 200 ft) and brief drivers
              on emergency-stop coordination.
            </p>
          )}
          <div className="citation">
            <span className="check">✓</span>
            MUTCD § 6F.55 · TRUCK-MOUNTED ATTENUATORS
          </div>
        </>
      ),
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
      body: (
        <>
          <p>
            Slow-moving operation on multi-lane carriageway. Shadow vehicle
            trails the work truck at <strong>{scenario.workLen} ft</strong>{" "}
            with mandatory TMA + arrow board (LEFT-arrow mode for right-lane
            mobile op).
          </p>
          {scenario.secondTMA && (
            <p>
              Second TMA deployed approximately <strong>1000 ft</strong>{" "}
              upstream of the shadow for additional protection — recommended
              at speeds ≥ 55 mph (CDOT M-630).
            </p>
          )}
          <div className="citation">
            <span className="check">✓</span>
            MUTCD § 6G.06 · MULTI-LANE MOBILE OPS
          </div>
        </>
      ),
    },
    {
      title: "Shadow vehicle + arrow board",
      result: generated ? `${tmaCount} TMA · ${arrowBoards} board` : "—",
      cite: "MUTCD § 6F.55 / § 6F.61",
      body: (
        <>
          <p>
            Shadow vehicle with NCHRP 350 / MASH-rated TMA provides
            crash-cushion protection. Arrow board (Type C) on the shadow
            indicates merge direction at posted distance —{" "}
            <strong>LEFT</strong> arrow for the right-lane operation.
          </p>
          {scenario.speed >= 55 && !scenario.secondTMA && (
            <p>
              <strong>
                ⚠ Speed ≥ 55 mph without upstream second TMA:
              </strong>{" "}
              CDOT M-630 strongly recommends a second TMA upstream for
              high-speed mobile ops to absorb high-energy hits.
            </p>
          )}
          <div className="citation">
            <span className="check">✓</span>
            MUTCD § 6F.55 · TRUCK-MOUNTED ATTENUATORS
          </div>
        </>
      ),
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
  // Stale-while-revalidate: fall back to the previous successful response
  // during refetch / error so the row keeps rendering with last-known
  // good data while the global header shows the (refreshing…) cue.
  const data = audit.state === "ready" ? audit.data : audit.lastReady;

  if (!data) {
    return {
      title: "Taper length calculation",
      result: "L = —",
      cite: TAPER_CITATION_FALLBACK.cite,
      body: (
        <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
          Computing…
        </p>
      ),
    };
  }

  const taper = data.sections.taper as Record<string, unknown>;
  const isShoulder = taper.closure_type === "shoulder";
  const labelPrefix = isShoulder ? "L/3" : "L";
  const lengthFt = data.summary.taper_length_ft;
  const formulaChoice = taper.formula_choice as string | undefined;

  // Backend emits every value in this family as whole feet (``_ft`` in
  // src/api/audit.py) — the summary chip and the trailing number of
  // each calc line are the same integer by construction.  Display work
  // here is glyph-only: substitute "×" for the backend's ASCII " x ".
  // (Frontend-engine-removal PR A deleted a client-side Math.round +
  // trailing-number regex rewrite of the backend's derivation text —
  // both numeric no-ops that duplicated the backend's rounding
  // contract; the audit prose now renders as received.)
  const xify = (s: string) => s.replace(/ x /g, " × ");
  const lCalcText = xify((taper.L_calc_text as string | undefined) ?? "");
  const lThirdRaw = taper.L_third_calc_text as string | undefined;
  const lThirdCalcText =
    isShoulder && lThirdRaw ? xify(lThirdRaw) : undefined;

  const citation = sectionCitation(taper, TAPER_CITATION_FALLBACK);
  return {
    title: "Taper length calculation",
    result: `${labelPrefix} = ${r(lengthFt)}${generated ? " ft" : ""}`,
    cite: citation.cite,
    body: (
      <>
        {formulaChoice && <p>{formulaChoice}</p>}
        {lCalcText && <div className="formula">{lCalcText}</div>}
        {isShoulder && lThirdCalcText && (
          <div className="formula">{lThirdCalcText}</div>
        )}
        <div className="citation">
          <span className="check">✓</span>
          {citation.footer}
        </div>
      </>
    ),
  };
}

function bufferItem(
  audit: AuditState,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec {
  const data = audit.state === "ready" ? audit.data : audit.lastReady;
  if (!data) {
    return {
      title: "Buffer space calculation",
      result: "B = — ft",
      cite: BUFFER_CITATION_FALLBACK.cite,
      body: (
        <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
          Computing…
        </p>
      ),
    };
  }
  const buffer = data.sections.buffer as Record<string, unknown>;
  const lookupText = buffer.lookup_text as string;
  const bufferFt = data.summary.buffer_space_ft;
  const citation = sectionCitation(buffer, BUFFER_CITATION_FALLBACK);
  return {
    title: "Buffer space calculation",
    result: `B = ${r(bufferFt)} ft`,
    cite: citation.cite,
    body: (
      <>
        <p>
          Buffer space is the longitudinal clear distance between traffic and
          workers, sized for stopping sight distance at the posted speed.
        </p>
        <div className="formula">{lookupText}</div>
        <div className="citation">
          <span className="check">✓</span>
          {citation.footer}
        </div>
      </>
    ),
  };
}

function spacingItem(
  audit: AuditState,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec {
  const data = audit.state === "ready" ? audit.data : audit.lastReady;
  if (!data) {
    return {
      title: "Channelizing device spacing",
      result: "— devices",
      cite: SPACING_CITATION_FALLBACK.cite,
      body: (
        <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
          Computing…
        </p>
      ),
    };
  }
  const spacing = data.sections.spacing as Record<string, unknown>;
  const nDrums = spacing.n_taper_drums_required as number;
  const nCones = spacing.n_tangent_cones_required as number;
  const totalDevices = nDrums + nCones;
  const inTaperFt = data.summary.device_spacing_taper_ft;
  const onTangentFt = data.summary.device_spacing_tangent_ft;
  const inTaperText = spacing.in_taper_text as string;
  const onTangentText = spacing.on_tangent_text as string;
  const taperCountText = spacing.taper_count_text as string;
  const tangentCountText = spacing.tangent_count_text as string;
  // #96 — downstream-taper derivation line; absent until the backend
  // deploy lands (Vercel-leads-Modal window), so render conditionally.
  const downstreamCountText = spacing.downstream_count_text as
    | string
    | undefined;
  const citation = sectionCitation(spacing, SPACING_CITATION_FALLBACK);
  return {
    title: "Channelizing device spacing",
    result: `${r(totalDevices)} devices · ${r(inTaperFt)}/${r(onTangentFt)} ft o.c.`,
    cite: citation.cite,
    body: (
      <>
        <p>{inTaperText}</p>
        <p>{onTangentText}</p>
        <div className="formula">{taperCountText}</div>
        <div className="formula">{tangentCountText}</div>
        {downstreamCountText ? (
          <div className="formula">{downstreamCountText}</div>
        ) : null}
        <div className="citation">
          <span className="check">✓</span>
          {citation.footer}
        </div>
      </>
    ),
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
  const data = audit.state === "ready" ? audit.data : audit.lastReady;
  if (!data) {
    return {
      title: "Advance warning sign set",
      result: "— signs",
      cite: "MUTCD TABLE 6B-1",
      body: (
        <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
          Computing…
        </p>
      ),
    };
  }
  const advance = data.sections.advance as Record<string, unknown>;
  const roadTypeText = advance.road_type_text as string;
  const spacingText = advance.spacing_text as string;
  const signTable = (advance.sign_table as AdvanceSignRow[]) ?? [];
  return {
    title: "Advance warning sign set",
    result: `${r(signTable.length)} signs`,
    cite: "MUTCD TABLE 6B-1",
    body: (
      <>
        <p>{roadTypeText}</p>
        <p>{spacingText}</p>
        <table>
          <thead>
            <tr>
              <th>Position</th>
              <th>Code</th>
              <th>Station (ft)</th>
              <th>Distance from Taper (ft)</th>
            </tr>
          </thead>
          <tbody>
            {signTable.map((row, i) => (
              <tr key={i}>
                <td>{row.Position}</td>
                <td>{row.Code}</td>
                <td>{row["Station (ft)"]}</td>
                <td>{row["Distance from Taper (ft)"]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="citation">
          <span className="check">✓</span>
          MUTCD § 6B-1 · ADVANCE WARNING SIGN SPACING
        </div>
      </>
    ),
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
  const data = audit.state === "ready" ? audit.data : audit.lastReady;
  if (!data) {
    return {
      title: "Colorado supplement requirements",
      result: "— checks",
      cite: `CDOT ${cdotSheet}`,
      body: (
        <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
          Computing…
        </p>
      ),
    };
  }
  const colorado = data.sections.colorado as Record<string, unknown>;
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
    title: "Colorado supplement requirements",
    result: allPass
      ? "ALL CHECKS PASS"
      : failCount !== null
        ? `${failCount} of ${checks.length} FAIL`
        : "CHECKS FAILED",
    cite: `CDOT ${cdotSheet}`,
    body: (
      <>
        <div className="check-list">
          {checks.map((c, i) => (
            <CheckRow
              key={`check-${i}`}
              label={c.label}
              detail={c.detail}
              tone={c.pass ? "pass" : "fail"}
              tag={c.citation}
            />
          ))}
          {infoItems.map((item, i) => (
            <CheckRow
              key={`info-${i}`}
              label={item.label}
              detail={item.detail}
              tone="info"
              tag={item.citation}
            />
          ))}
        </div>
        <div className="citation">
          <span className="check">✓</span>
          CDOT {cdotSheet} · COLORADO SUPPLEMENT
        </div>
      </>
    ),
  };
}

export function referenceItem(
  audit: AuditState,
  ta: string,
  cdotSheet: string,
  caseId: string,
  triggerCondition?: string,
): ItemSpec {
  const data = audit.state === "ready" ? audit.data : audit.lastReady;
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
    body: (
      <>
        <p>
          Plan matched against MUTCD Typical Application <strong>{ta}</strong>{" "}
          and CDOT Standard Plan <strong>{cdotSheet}</strong>, the official
          Colorado supplement to MUTCD Part 6.
        </p>
        {narrative && <p>{narrative}</p>}
        {narrative2 && <p>{narrative2}</p>}
        {triggerCondition && (
          <p className="font-mono text-[12px] uppercase tracking-[0.04em] text-[color:var(--ink-on-dark-faint)]">
            Trigger: &ldquo;{triggerCondition}&rdquo;
          </p>
        )}
        {url ? (
          <p>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[12px] tracking-[0.04em] uppercase text-[color:var(--cyan)] hover:underline"
            >
              ↗ Open {cdotSheet} PDF on CDOT.gov
            </a>
          </p>
        ) : (
          <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
            Loading reference…
          </p>
        )}
      </>
    ),
  };
}

export function siteAdjustmentsItem(
  flags: SiteConditions | undefined,
  records?: SiteAdjustmentRecord[],
): ItemSpec | null {
  const checked = (Object.keys(SITE_ADJUSTMENT_DETAIL) as SiteConditionFlag[])
    .filter((k) => flags?.[k]);
  if (checked.length === 0) return null;
  // #104 — per-flag citation reads the backend record when present (same
  // deploy-window fallback contract as sectionCitation above). The static
  // values are byte-identical to the backend derivation, so either source
  // renders the same chip.
  const citationFor = (k: SiteConditionFlag): string =>
    records?.find((r) => r.flag === k)?.citation ??
    SITE_ADJUSTMENT_DETAIL[k].rule;
  return {
    title: "Site adjustments",
    result: `${checked.length} flag${checked.length === 1 ? "" : "s"}`,
    // The 7 rules span MUTCD Parts 6, 7, and 9, so no single aggregate
    // section is honest here — the per-flag chips below carry the real
    // citations (backend-fed).
    cite: "MUTCD — per-flag citations below",
    body: (
      <>
        <p>
          Site-condition flags from the sidebar layered onto the baseline
          MUTCD/CDOT layout. Each adjustment is traced to its source rule;
          the rendered PDF, device list, and crew narrative reflect every
          item below.
        </p>
        <div className="check-list">
          {checked.map((k) => {
            const d = SITE_ADJUSTMENT_DETAIL[k];
            return (
              <div className="check-list-item" key={k}>
                <span className="ck">✓</span>
                <span className="check-list-lbl">
                  <strong>{d.label}</strong> — {d.action}
                </span>
                <span className="check-list-src">{citationFor(k)}</span>
              </div>
            );
          })}
        </div>
        <div className="citation">
          <span className="check">✓</span>
          AUTO-DETECTION SOURCE · OPENSTREETMAP (OVERPASS API)
        </div>
      </>
    ),
  };
}

// ---------------------------------------------------------------------------
// Additive backend items — only render when the backend explicitly
// reports the condition.  Empty for SHOULDER default scenario in v1.
// ---------------------------------------------------------------------------

function buildAdditiveItems(data: AuditResponse): ItemSpec[] {
  const items: (ItemSpec | null)[] = [
    approachesItem(data.sections.approaches),
    corridorValidationItem(data.sections.corridor_validation),
    geometryValidationItem(data.sections.geometry_validation),
    finesDoubleItem(data.sections.fines_double),
    pendingVerificationItem(data.pending_verification),
  ];
  return items.filter((x): x is ItemSpec => x !== null);
}

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

  return {
    title: "Cross-street approaches",
    result: `${rows.length} leg${rows.length === 1 ? "" : "s"} · ${side}-side work`,
    cite: "MUTCD § 6N.12",
    body: (
      <>
        <p>
          Intersection on the {side} side of the work zone
          {alongFt !== null && (
            <>
              {" "}
              (centerline crossing at mainline station{" "}
              {alongFt.toLocaleString("en-US")} ft)
            </>
          )}
          .
        </p>
        {narrative && <p>{narrative}</p>}
        {rows.map((ap) => (
          <div key={ap.id}>
            <p>
              Approach &lsquo;{ap.id}&rsquo; — {ap.speed_mph} mph,{" "}
              {ap.road_type}
              {ap.signalized && (
                <span className="text-[color:var(--orange)]">
                  {" "}
                  — SIGNALIZED (signal operation review required)
                </span>
              )}
              . {ap.key_text}.
            </p>
            {ap.sign_table.length > 0 && (
              <table>
                <thead>
                  <tr>
                    {APPROACH_SIGN_COLUMNS.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ap.sign_table.map((row, i) => (
                    <tr key={i}>
                      {APPROACH_SIGN_COLUMNS.map((c) => (
                        <td key={c}>{row[c] ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
        <div className="citation">
          <span className="check">{nSignalized > 0 ? "⚠" : "✓"}</span>
          {source || "MUTCD § 6N.12; CDOT S-630-1 SHEET 10"}
        </div>
      </>
    ),
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
      body: (
        <>
          <p>{reason}</p>
          <div className="citation">
            <span className="check">ℹ</span>
            CO SUPPLEMENT § 2B.13 · S-630-1 SHEET 12
          </div>
        </>
      ),
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
      : "CO Supplement Sec 2B.13 + S-630-1 Sheet 12";

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
  const noteCount = notes.length;
  const result =
    noteCount > 0
      ? `${nAsm ?? "—"} assemblies · ${noteCount} ops note${noteCount === 1 ? "" : "s"}`
      : `${nAsm ?? "—"} assemblies`;

  return {
    title: "Fines Double envelope",
    result,
    cite: "S-630-1 Sheet 12",
    body: (
      <>
        <p>
          Work-zone posted speed is reduced — Fines Double signing
          applies per CO Supplement § 2B.13 and CDOT S-630-1 Sheet 12.
          The R2-10/R2-11 envelope spans the work zone with G20-5P/R2-6P
          assemblies at 2,640 ft intervals; the entrance R2-1 posts the
          reduced limit as drivers enter the zone, and the downstream
          R2-1 restores posted speed past R2-11.
        </p>
        {envelope && (
          <table>
            <thead>
              <tr>
                <th>Sign</th>
                <th>Station (ft)</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>R2-1</td>
                <td>{entR21 !== undefined ? Math.round(entR21).toLocaleString() : "—"}</td>
                <td>{entR21Label ?? "SPEED LIMIT (work-zone posting)"}</td>
              </tr>
              <tr>
                <td>R2-10</td>
                <td>{r210 !== undefined ? Math.round(r210).toLocaleString() : "—"}</td>
                <td>BEGIN DOUBLE FINES ZONE (upstream)</td>
              </tr>
              <tr>
                <td>G20-5P / R2-6P</td>
                <td>—</td>
                <td>
                  {nAsm !== undefined ? nAsm : "—"} assembl
                  {nAsm === 1 ? "y" : "ies"} every 2,640 ft
                </td>
              </tr>
              <tr>
                <td>R2-11</td>
                <td>{r211 !== undefined ? Math.round(r211).toLocaleString() : "—"}</td>
                <td>END DOUBLE FINES ZONE (downstream)</td>
              </tr>
              <tr>
                <td>R2-1</td>
                <td>{dsR21 !== undefined ? Math.round(dsR21).toLocaleString() : "—"}</td>
                <td>{dsR21Label ?? "SPEED LIMIT (restoration)"}</td>
              </tr>
            </tbody>
          </table>
        )}
        {envLen !== undefined && (
          <p>
            Envelope length: <strong>{Math.round(envLen).toLocaleString()} ft</strong>
          </p>
        )}
        {notes.length > 0 && (
          <>
            <p>
              <strong>Sheet 12 operational rules</strong> (field crew):
            </p>
            <div className="check-list">
              {notes.map((n, i) => (
                <CheckRow
                  key={`note-${i}`}
                  label={n.action}
                  tone="info"
                  tag={n.citation}
                />
              ))}
            </div>
          </>
        )}
        <div className="citation">
          <span className="check">✓</span>
          {citation.toUpperCase()}
        </div>
      </>
    ),
  };
}

interface CorridorWarning {
  flag: string;
  level: string;
  message: string;
}

function corridorValidationItem(
  corridor: Record<string, unknown>,
): ItemSpec | null {
  const checked = corridor.checked === true;
  const warnings = (corridor.warnings as CorridorWarning[] | undefined) ?? [];
  if (!checked || warnings.length === 0) return null;
  return {
    title: "Site corridor validation",
    result: `⚠ ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`,
    cite: "OpenStreetMap",
    body: (
      <>
        <p>Soft check against OSM — warnings do not block plan generation.</p>
        <div className="check-list">
          {warnings.map((w, i) => (
            <CheckRow
              key={`${w.flag}-${i}`}
              label={w.message}
              tone={w.level === "error" ? "fail" : "warn"}
              tag={w.flag.replace(/_/g, " ").toUpperCase()}
            />
          ))}
        </div>
      </>
    ),
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
    body: (
      <>
        <p>{typeof geo.source === "string" ? geo.source : ""}</p>
        <div className="check-list">
          {violations.map((v, i) => (
            <CheckRow
              key={`${v.rule_id}-${i}`}
              label={v.message}
              tone={v.severity === "error" ? "fail" : "warn"}
              tag={`MUTCD § ${v.mutcd_section}`}
            />
          ))}
        </div>
      </>
    ),
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
    body: useItems ? (
      <ul className="list-none p-0 m-0 space-y-2">
        {items!.map((item, i) => (
          <li key={`pending-${i}`}>
            <p>{item.label}</p>
            {item.tracking_issue && (
              <p>
                <a
                  href={item.tracking_issue}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[12px] tracking-[0.04em] uppercase text-[color:var(--cyan)] hover:underline"
                >
                  ↗ Tracking issue ({item.kind.replace(/_/g, " ")})
                </a>
              </p>
            )}
          </li>
        ))}
      </ul>
    ) : (
      <>
        <p>{pending.note}</p>
        {pending.tracking_issue && (
          <p>
            <a
              href={pending.tracking_issue}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[12px] tracking-[0.04em] uppercase text-[color:var(--cyan)] hover:underline"
            >
              ↗ Tracking issue
            </a>
          </p>
        )}
      </>
    ),
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ItemProps {
  num: string;
  title: string;
  result: string;
  cite: string;
  open: boolean;
  onClick: () => void;
  children: ReactNode;
  dim?: boolean;
}

function AuditItem({
  num,
  title,
  result,
  cite,
  open,
  onClick,
  children,
  dim = false,
}: ItemProps) {
  return (
    <div
      className={`audit-item ${open ? "open" : ""} ${dim ? "opacity-70" : ""}`}
    >
      <button type="button" className="audit-head" onClick={onClick}>
        <span className="num">{num}</span>
        <span className="title">{title}</span>
        <span className="result">{result}</span>
        <span className="cite">{cite}</span>
        <span className="chev">›</span>
      </button>
      {open && <div className="audit-body">{children}</div>}
    </div>
  );
}

function CheckRow({
  label,
  detail,
  tone = "pass",
  tag = "PASS",
}: {
  label: string;
  detail?: string;
  tone?: "pass" | "warn" | "fail" | "info";
  tag?: string;
}) {
  const ckClass = tone === "pass" ? "ck" : `ck ${tone}`;
  const symbol =
    tone === "warn"
      ? "!"
      : tone === "fail"
        ? "✕"
        : tone === "info"
          ? "ℹ"
          : "✓";
  return (
    <div className="check-list-item">
      <span className={ckClass}>{symbol}</span>
      <span className="check-list-lbl">
        {detail ? (
          <>
            <strong>{label}</strong> — {detail}
          </>
        ) : (
          label
        )}
      </span>
      <span className="check-list-src">{tag}</span>
    </div>
  );
}
