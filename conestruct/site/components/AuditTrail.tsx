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
import type { AuditResponse, AuditState } from "@/lib/render-types";

const SITE_ADJUSTMENT_DETAIL: Record<
  SiteConditionFlag,
  { label: string; rule: string; action: string }
> = {
  limited_sight_distance: {
    label: "Limited sight distance",
    rule: "MUTCD § 6C.04",
    action:
      "Advance warning signs moved 50% farther upstream to compensate for restricted sight lines.",
  },
  adjacent_intersection: {
    label: "Intersection within work zone",
    rule: "MUTCD § 6C.10",
    action:
      "Two W20-1 ROAD WORK AHEAD signs added facing cross-street approaches.",
  },
  adjacent_interchange: {
    label: "Adjacent interchange (highway ramps)",
    rule: "MUTCD §§ 6C.10 + 6F.60",
    action:
      "1 W20-3 LANE CLOSED AHEAD sign and 1 PCMS added to warn upstream ramp traffic of the closure.",
  },
  driveways_present: {
    label: "Driveways present",
    rule: "MUTCD § 6C.09",
    action:
      "Maintain access gaps in channelization. Do not place devices across driveway entrances (advisory only).",
  },
  pedestrian_facility: {
    label: "Pedestrian sidewalks present",
    rule: "MUTCD § 6D.01",
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

export function AuditTrail({ scenario, audit, onRetry, generated }: Props) {
  const [openIdx, setOpenIdx] = useState<number>(0);
  const toggle = (i: number) => setOpenIdx(openIdx === i ? -1 : i);
  const r = (n: number | string) => (generated ? String(n) : "—");

  // Main per-scenario body items: every section reads from backend audit
  // data via the shared item helpers (``taperItem``, ``bufferItem``,
  // ``spacingItem``, ``advanceItem``, ``coloradoItem``, ``referenceItem``).
  // Per-scenario builders thread ``audit`` through.  The only remaining
  // TS-side heuristic is ``bufferFor`` for the flagger SSD block — gated
  // off in V1 (ENABLED_SCENARIO_KINDS).
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

  const siteItem = siteAdjustmentsItem(scenario.meta.siteConditions);

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
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-on-dark-faint)]">
          <span className="text-[color:var(--cyan)]">03</span> · SHOW THE WORK
        </span>
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

function buildShoulderItems(
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
    referenceItem(audit, "TA-2", "S-630-1", r(caseId), triggerCondition),
  ];
}

function buildFlaggerItems(
  scenario: FlaggerLaneClosureScenario,
  audit: AuditState,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec[] {
  const sightDistance = bufferFor(scenario.speed);
  const flaggerStations = scenario.afad ? 0 : 2;
  const afadDevices = scenario.afad ? 2 : 0;
  const pilotCarVehicles = scenario.pilotCar ? 1 : 0;
  const flaggerSummary = generated
    ? scenario.afad
      ? `${afadDevices} AFAD`
      : `${flaggerStations} flagger`
    : "—";

  return [
    taperItem(audit, generated, r),
    bufferItem(audit, generated, r),
    spacingItem(audit, generated, r),
    {
      title: "Flagger station sight distance",
      result: generated ? `${sightDistance} ft` : "—",
      cite: "MUTCD § 6E.06",
      body: (
        <>
          <p>
            Each flagger station must have a clear sight distance of at least
            the stopping sight distance for the posted speed (MUTCD Table
            6E-1), so approaching drivers can stop on the open lane.
          </p>
          <div className="formula">
            <span>SSD</span>
            <span className="op">@</span>
            <span className="var">{scenario.speed}</span>
            <span className="op">mph</span>
            <span className="op">=</span>
            <span className="res">{r(sightDistance)} ft</span>
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
            MUTCD TABLE 6E-1 · STOPPING SIGHT DISTANCE
          </div>
        </>
      ),
    },
    advanceItem(audit, generated, r),
    coloradoItem(audit, "S-630-2"),
    referenceItem(audit, "TA-10", "S-630-2", r("Case 2B")),
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
      cite: "MUTCD § 6C.08",
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
  const lengthFt = Math.round(data.summary.taper_length_ft);
  const formulaChoice = taper.formula_choice as string | undefined;

  // Backend formats the math strings with ASCII "x" and one-decimal
  // precision (L_third = `{:.1f}`).  Display fixes both: substitute the
  // proper "×" glyph, and round the FINAL line's trailing value so the
  // body agrees with the chip.  Which line is "final" depends on
  // closure type — for shoulder, L_third; for lane, L (no L/3 row is
  // shown).  The intermediate L row for shoulder keeps backend
  // precision so the W × S product stays mathematically accurate.
  const xify = (s: string) => s.replace(/ x /g, " × ");
  const roundTrailing = (s: string) =>
    s.replace(/[\d.]+ ft$/, `${lengthFt} ft`);

  const lCalcRaw = (taper.L_calc_text as string | undefined) ?? "";
  const lThirdRaw = taper.L_third_calc_text as string | undefined;
  const lCalcText = isShoulder
    ? xify(lCalcRaw)
    : xify(roundTrailing(lCalcRaw));
  const lThirdCalcText =
    isShoulder && lThirdRaw ? xify(roundTrailing(lThirdRaw)) : undefined;

  return {
    title: "Taper length calculation",
    result: `${labelPrefix} = ${r(lengthFt)}${generated ? " ft" : ""}`,
    cite: "MUTCD § 6C.08",
    body: (
      <>
        {formulaChoice && <p>{formulaChoice}</p>}
        {lCalcText && <div className="formula">{lCalcText}</div>}
        {isShoulder && lThirdCalcText && (
          <div className="formula">{lThirdCalcText}</div>
        )}
        <div className="citation">
          <span className="check">✓</span>
          MUTCD 2023 EDITION · CHAPTER 6C · TABLE 6C-3
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
      cite: "MUTCD § 6C.06",
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
  return {
    title: "Buffer space calculation",
    result: `B = ${r(bufferFt)} ft`,
    cite: "MUTCD § 6C.06",
    body: (
      <>
        <p>
          Buffer space is the longitudinal clear distance between traffic and
          workers, sized for stopping sight distance at the posted speed.
        </p>
        <div className="formula">{lookupText}</div>
        <div className="citation">
          <span className="check">✓</span>
          MUTCD § 6C.06 · STOPPING SIGHT DISTANCE
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
      cite: "MUTCD § 6C.09",
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
  return {
    title: "Channelizing device spacing",
    result: `${r(totalDevices)} devices · ${r(inTaperFt)}/${r(onTangentFt)} ft o.c.`,
    cite: "MUTCD § 6C.09",
    body: (
      <>
        <p>{inTaperText}</p>
        <p>{onTangentText}</p>
        <div className="formula">{taperCountText}</div>
        <div className="formula">{tangentCountText}</div>
        <div className="citation">
          <span className="check">✓</span>
          MUTCD § 6C.09 · CHANNELIZING DEVICE SPACING
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

function coloradoItem(
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
  const fails = checks.filter((c) => !c.pass).length;
  return {
    title: "Colorado supplement requirements",
    result: allPass ? "ALL CHECKS PASS" : `${fails} of ${checks.length} FAIL`,
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
  const url = (data?.sections.case as { url?: string } | undefined)?.url;
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

function siteAdjustmentsItem(
  flags: SiteConditions | undefined,
): ItemSpec | null {
  const checked = (Object.keys(SITE_ADJUSTMENT_DETAIL) as SiteConditionFlag[])
    .filter((k) => flags?.[k]);
  if (checked.length === 0) return null;
  return {
    title: "Site adjustments",
    result: `${checked.length} flag${checked.length === 1 ? "" : "s"}`,
    cite: "MUTCD § 6C / § 6D",
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
                <span className="check-list-src">{d.rule}</span>
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
    corridorValidationItem(data.sections.corridor_validation),
    geometryValidationItem(data.sections.geometry_validation),
    finesDoubleItem(data.sections.fines_double),
    pendingVerificationItem(data.pending_verification),
  ];
  return items.filter((x): x is ItemSpec => x !== null);
}

interface FinesDoubleEnvelope {
  r2_10_station_ft: number;
  r2_11_station_ft: number;
  length_ft: number;
  n_assemblies: number;
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
          assemblies at 2,640 ft intervals; the downstream R2-1 restores
          posted speed past R2-11.
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

function geometryValidationItem(
  geo: Record<string, unknown>,
): ItemSpec | null {
  const violations = (geo.violations as ViolationSpec[] | undefined) ?? [];
  if (violations.length === 0) return null;
  const hasError = violations.some((v) => v.severity === "error");
  return {
    title: "Geometry validation",
    result: hasError ? "✕ FAILED" : "⚠ WARNINGS",
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
// Display heuristic — flagger SSD only.
//
// All shoulder/lane-closure render paths are fully backend-sourced.
// ``bufferFor`` survives solely for the flagger station sight-distance
// lookup in ``buildFlaggerItems`` (cite §6E.06).  Flagger is gated off in
// V1 (ENABLED_SCENARIO_KINDS = ["shoulder"]); the SSD migration is
// deferred to whenever flagger ships.
// ---------------------------------------------------------------------------

const BUFFER_TABLE: Record<number, number> = {
  20: 115,
  25: 155,
  30: 200,
  35: 250,
  40: 305,
  45: 360,
  50: 425,
  55: 495,
  60: 570,
  65: 645,
  70: 730,
  75: 820,
};

function bufferFor(speed: number): number {
  // Round to nearest 5 mph; fall back to closest in-range if off-table.
  const rounded = Math.round(speed / 5) * 5;
  return BUFFER_TABLE[rounded] ?? 495;
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
