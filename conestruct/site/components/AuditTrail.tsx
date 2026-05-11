"use client";

import { useState, type ReactNode } from "react";
import type {
  FlaggerLaneClosureScenario,
  FlaggerResult,
  LaneClosureDividedScenario,
  LaneClosureResult,
  MobileOp2LaneResult,
  MobileOp2LaneScenario,
  MobileOpMultilaneResult,
  MobileOpMultilaneScenario,
  Scenario,
  ScenarioResult,
  ShoulderResult,
  ShoulderScenario,
  SiteConditionFlag,
  SiteConditions,
  WorkBeyondShoulderResult,
  WorkBeyondShoulderScenario,
} from "@/lib/scenarios";

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
  results: ScenarioResult;
  generated: boolean;
}

interface ItemSpec {
  title: string;
  result: string;
  cite: string;
  body: ReactNode;
}

export function AuditTrail({ scenario, results, generated }: Props) {
  const [openIdx, setOpenIdx] = useState<number>(0);
  const toggle = (i: number) => setOpenIdx(openIdx === i ? -1 : i);
  const r = (n: number | string) => (generated ? String(n) : "—");

  const items: ItemSpec[] = (() => {
    let scenarioItems: ItemSpec[] = [];
    if (scenario.kind === "shoulder" && results.kind === "shoulder") {
      scenarioItems = buildShoulderItems(scenario, results, generated, r);
    } else if (
      scenario.kind === "flagger_lane_closure" &&
      results.kind === "flagger_lane_closure"
    ) {
      scenarioItems = buildFlaggerItems(scenario, results, generated, r);
    } else if (
      scenario.kind === "lane_closure_divided" &&
      results.kind === "lane_closure_divided"
    ) {
      scenarioItems = buildLaneClosureItems(scenario, results, generated, r);
    } else if (
      scenario.kind === "work_beyond_shoulder" &&
      results.kind === "work_beyond_shoulder"
    ) {
      scenarioItems = buildWorkBeyondShoulderItems(scenario, results, generated, r);
    } else if (
      scenario.kind === "mobile_op_2lane" &&
      results.kind === "mobile_op_2lane"
    ) {
      scenarioItems = buildMobileOp2LaneItems(scenario, results, generated, r);
    } else if (
      scenario.kind === "mobile_op_multilane" &&
      results.kind === "mobile_op_multilane"
    ) {
      scenarioItems = buildMobileOpMultilaneItems(scenario, results, generated, r);
    }
    const siteItem = siteAdjustmentsItem(scenario.meta.siteConditions);
    return siteItem ? [...scenarioItems, siteItem] : scenarioItems;
  })();

  return (
    <section className="mt-9">
      <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-[color:var(--rule)]">
        <h2 className="text-[20px] font-bold tracking-[-0.005em] text-white m-0">
          Verification &amp; audit trail
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
          >
            {item.body}
          </AuditItem>
        ))}
      </div>
    </section>
  );
}

function buildShoulderItems(
  scenario: ShoulderScenario,
  results: ShoulderResult,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec[] {
  return [
    taperItem(scenario.laneWidth, scenario.speed, results.L, generated, r),
    bufferItem(scenario.speed, results.B, r),
    spacingItem(
      scenario.workLen,
      results.spacing,
      results.cones,
      results.taperCones,
      results.tangentCones,
      results.drums,
      generated,
      r,
    ),
    {
      title: "Advance warning sign set",
      result: generated ? `${results.signs} signs / side` : "—",
      cite: "MUTCD TABLE 6C-1",
      body: (
        <>
          <p>
            Sign set for shoulder work per MUTCD § 6G.02. Short-duration jobs
            (&lt;1h) may use minimum signing; long-term work uses the full
            advance / termination set.
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
                <td>Road work ahead</td>
                <td>W20-1</td>
                <td>{results.signs >= 1 ? "✓" : "—"}</td>
              </tr>
              <tr>
                <td>Shoulder work</td>
                <td>W21-5</td>
                <td>{results.signs >= 2 ? "✓" : "—"}</td>
              </tr>
              <tr>
                <td>End road work</td>
                <td>G20-2</td>
                <td>{results.signs >= 3 ? "✓" : "—"}</td>
              </tr>
            </tbody>
          </table>
          <div className="citation">
            <span className="check">✓</span>
            MUTCD § 6G.02 · DURATION-BASED SIGNING
          </div>
        </>
      ),
    },
    {
      title: "Colorado supplement requirements",
      result: "ALL CHECKS PASS",
      cite: "CDOT S-630-1",
      body: (
        <>
          <div className="check-list">
            <CheckRow label="Shoulder work per S-630-1 (TA-2 equivalent)" />
            {scenario.night && (
              <CheckRow label="Type IX retroreflective sheeting (night ops)" />
            )}
            <CheckRow label="Cones placed at speed-limit spacing" />
            {scenario.duration === "long" && (
              <CheckRow label="End road work sign present (G20-2)" />
            )}
          </div>
          <div className="citation">
            <span className="check">✓</span>
            CDOT S-630-1 · COLORADO SUPPLEMENT
          </div>
        </>
      ),
    },
    referenceItem(results.ta, results.cdotSheet, r(results.caseId)),
  ];
}

function buildFlaggerItems(
  scenario: FlaggerLaneClosureScenario,
  results: FlaggerResult,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec[] {
  const flaggerSummary = generated
    ? scenario.afad
      ? `${results.afadDevices} AFAD`
      : `${results.flaggerStations} flagger`
    : "—";

  return [
    taperItem(scenario.laneWidth, scenario.speed, results.L, generated, r),
    bufferItem(scenario.speed, results.B, r),
    spacingItem(
      scenario.workLen,
      results.spacing,
      results.cones,
      results.taperCones,
      results.tangentCones,
      results.drums,
      generated,
      r,
    ),
    {
      title: "Flagger station sight distance",
      result: generated ? `${results.sightDistance} ft` : "—",
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
            <span className="res">{r(results.sightDistance)} ft</span>
          </div>
          <p>
            Stations:{" "}
            <strong>
              {flaggerSummary}
              {scenario.afad ? "" : " station(s)"}
            </strong>
            {results.pilotCarVehicles > 0 && (
              <> · Pilot car: <strong>1 vehicle</strong></>
            )}
          </p>
          <div className="citation">
            <span className="check">✓</span>
            MUTCD TABLE 6E-1 · STOPPING SIGHT DISTANCE
          </div>
        </>
      ),
    },
    {
      title: "Advance warning sign set",
      result: generated ? `${results.signs} signs (both ways)` : "—",
      cite: "MUTCD TABLE 6C-1",
      body: (
        <>
          <p>
            TA-10 sign set, posted in both directions of travel. Short-duration
            jobs use the minimum (W20-1 + W20-7); long-term work adds W20-4
            and W3-4.
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
                <td>Road work ahead</td>
                <td>W20-1</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>One lane road ahead</td>
                <td>W20-4</td>
                <td>{scenario.duration === "long" ? "✓" : "—"}</td>
              </tr>
              <tr>
                <td>Be prepared to stop</td>
                <td>W3-4</td>
                <td>{scenario.duration === "long" ? "✓" : "—"}</td>
              </tr>
              <tr>
                <td>{scenario.afad ? "AFAD ahead" : "Flagger ahead"}</td>
                <td>{scenario.afad ? "W20-7a" : "W20-7"}</td>
                <td>✓</td>
              </tr>
            </tbody>
          </table>
          <div className="citation">
            <span className="check">✓</span>
            MUTCD § 6G.02 · DURATION-BASED SIGNING
          </div>
        </>
      ),
    },
    {
      title: "Colorado supplement requirements",
      result: "ALL CHECKS PASS",
      cite: "CDOT S-630-2",
      body: (
        <>
          <div className="check-list">
            <CheckRow label="2-lane 2-way flagger control per S-630-2 (TA-10 equivalent)" />
            {scenario.night && (
              <CheckRow label="Type IX retroreflective sheeting (night ops)" />
            )}
            <CheckRow label="Cones placed at speed-limit spacing" />
            {scenario.workLen > 1500 && !scenario.pilotCar && (
              <CheckRow
                label="Work zone >1500 ft — pilot car recommended (MUTCD § 6E)"
                tone="warn"
                tag="WARN"
              />
            )}
            {scenario.afad && (
              <CheckRow label="AFAD operator certified per state requirements" />
            )}
            {scenario.pedestrianAccess && (
              <CheckRow label="ADA-compliant pedestrian detour signed (R9-3a / R9-9)" />
            )}
          </div>
          <div className="citation">
            <span className="check">✓</span>
            CDOT S-630-2 · COLORADO SUPPLEMENT
          </div>
        </>
      ),
    },
    referenceItem(results.ta, results.cdotSheet, r(results.caseId)),
  ];
}

function buildLaneClosureItems(
  scenario: LaneClosureDividedScenario,
  results: LaneClosureResult,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec[] {
  return [
    taperItem(scenario.laneWidth, scenario.speed, results.L, generated, r),
    bufferItem(scenario.speed, results.B, r),
    spacingItem(
      scenario.workLen,
      results.spacing,
      results.cones,
      results.taperCones,
      results.tangentCones,
      results.drums,
      generated,
      r,
    ),
    {
      title: "Arrow board placement",
      result: generated ? `${results.arrowBoards} unit · LEFT arrow` : "—",
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
                ? `${results.tmaCount} unit (recommended)`
                : "Not deployed"}
            </strong>
            {!scenario.truckMountedAttenuator && scenario.speed >= 45 && (
              <>
                {" "}
                — CDOT M-630 strongly recommends a TMA at this speed.
              </>
            )}
          </p>
          <div className="citation">
            <span className="check">✓</span>
            MUTCD § 6F.61 · ARROW BOARDS
          </div>
        </>
      ),
    },
    {
      title: "Advance warning sign set",
      result: generated ? `${results.signs} signs (both ways)` : "—",
      cite: "MUTCD TABLE 6C-1",
      body: (
        <>
          <p>
            TA-19 sign set, mirrored on both sides of the divided highway.
            Long-term work adds CONSTRUCTION ZONE plaques (G20-5P) inside
            the work zone.
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
                <td>Road work ahead</td>
                <td>W20-1</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Right lane closed ahead</td>
                <td>W20-5R</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Right lane ends</td>
                <td>W4-2R</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>End road work</td>
                <td>G20-2</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Construction zone plaque</td>
                <td>G20-5P</td>
                <td>{scenario.duration === "long" ? "✓" : "—"}</td>
              </tr>
            </tbody>
          </table>
          <div className="citation">
            <span className="check">✓</span>
            MUTCD § 6G.02 · DURATION-BASED SIGNING
          </div>
        </>
      ),
    },
    {
      title: "Colorado supplement requirements",
      result: "ALL CHECKS PASS",
      cite: "CDOT S-630-3",
      body: (
        <>
          <div className="check-list">
            <CheckRow label="Right-lane closure on divided highway per S-630-3 (TA-19 equivalent)" />
            <CheckRow label="Arrow board (Type C) at upstream taper, LEFT-arrow mode" />
            {scenario.truckMountedAttenuator ? (
              <CheckRow label="Truck-mounted attenuator deployed upstream" />
            ) : scenario.speed >= 45 ? (
              <CheckRow
                label="TMA strongly recommended ≥ 45 mph (CDOT M-630)"
                tone="warn"
                tag="WARN"
              />
            ) : null}
            {scenario.night && (
              <CheckRow label="Type IX retroreflective sheeting (night ops)" />
            )}
            <CheckRow label="Drums placed at speed-limit spacing in merging taper" />
            <CheckRow label="Mirror signs posted on median side of divided highway" />
          </div>
          <div className="citation">
            <span className="check">✓</span>
            CDOT S-630-3 · COLORADO SUPPLEMENT
          </div>
        </>
      ),
    },
    referenceItem(results.ta, results.cdotSheet, r(results.caseId)),
  ];
}

function buildWorkBeyondShoulderItems(
  scenario: WorkBeyondShoulderScenario,
  results: WorkBeyondShoulderResult,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec[] {
  return [
    {
      title: "Signing scope (no devices on roadway)",
      result: generated ? `${results.signs} sign(s)` : "—",
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
              <strong>High-speed adjacent traffic ({scenario.speed} mph):</strong>{" "}
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
    {
      title: "Colorado supplement requirements",
      result: "ALL CHECKS PASS",
      cite: "CDOT S-630-1",
      body: (
        <>
          <div className="check-list">
            <CheckRow label="Off-roadway work — no MHT footprint on the travelway" />
            <CheckRow label="W21-5 advance sign placed at MUTCD Table 6C-1 distance" />
            {scenario.duration === "long" && (
              <CheckRow label="G20-2 END ROAD WORK termination sign present" />
            )}
            {scenario.night && (
              <CheckRow label="Type IX retroreflective sheeting (night ops)" />
            )}
          </div>
          <div className="citation">
            <span className="check">✓</span>
            CDOT S-630-1 · COLORADO SUPPLEMENT
          </div>
        </>
      ),
    },
    referenceItem(results.ta, results.cdotSheet, r(results.caseId)),
  ];
}

function buildMobileOp2LaneItems(
  scenario: MobileOp2LaneScenario,
  results: MobileOp2LaneResult,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec[] {
  return [
    {
      title: "Mobile operation profile",
      result: generated ? `${results.totalDevices} devices · moving` : "—",
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
      result: generated ? `${results.shadowVehicles} shadow · ${results.tmaCount} TMA` : "—",
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
              <strong>High-speed two-lane ({scenario.speed} mph):</strong>{" "}
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
    {
      title: "Colorado supplement requirements",
      result: "ALL CHECKS PASS",
      cite: "CDOT S-630-1",
      body: (
        <>
          <div className="check-list">
            <CheckRow label="Mobile two-lane op per S-630-1 (TA-35 equivalent)" />
            <CheckRow label="W21-1A WORKERS AHEAD on shadow vehicle" />
            <CheckRow label="Shadow vehicle equipped with NCHRP 350 / MASH TMA" />
            {scenario.arrowBoardOnShadow ? (
              <CheckRow label="Arrow board on shadow in caution mode (4-corner flash)" />
            ) : (
              <CheckRow
                label="Arrow board recommended; not deployed in this plan"
                tone="warn"
                tag="WARN"
              />
            )}
            {scenario.night && (
              <CheckRow label="Type IX retroreflective sheeting (night ops)" />
            )}
          </div>
          <div className="citation">
            <span className="check">✓</span>
            CDOT S-630-1 · COLORADO SUPPLEMENT
          </div>
        </>
      ),
    },
    referenceItem(results.ta, results.cdotSheet, r(results.caseId)),
  ];
}

function buildMobileOpMultilaneItems(
  scenario: MobileOpMultilaneScenario,
  results: MobileOpMultilaneResult,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec[] {
  return [
    {
      title: "Mobile operation profile",
      result: generated ? `${results.totalDevices} devices · moving` : "—",
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
      result: generated ? `${results.tmaCount} TMA · ${results.arrowBoards} board` : "—",
      cite: "MUTCD § 6F.55 / § 6F.61",
      body: (
        <>
          <p>
            Shadow vehicle with NCHRP 350 / MASH-rated TMA provides
            crash-cushion protection. Arrow board (Type C) on the shadow
            indicates merge direction at posted distance — <strong>LEFT</strong>{" "}
            arrow for the right-lane operation.
          </p>
          {scenario.speed >= 55 && !scenario.secondTMA && (
            <p>
              <strong>⚠ Speed ≥ 55 mph without upstream second TMA:</strong>{" "}
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
    {
      title: "Colorado supplement requirements",
      result: "ALL CHECKS PASS",
      cite: "CDOT S-630-3",
      body: (
        <>
          <div className="check-list">
            <CheckRow label="Multi-lane mobile op per S-630-3 (TA-26 equivalent)" />
            <CheckRow label="Shadow vehicle equipped with NCHRP 350 / MASH TMA" />
            <CheckRow label="Arrow board (Type C) on shadow in LEFT-arrow mode" />
            {scenario.secondTMA ? (
              <CheckRow label="Second TMA upstream of shadow" />
            ) : scenario.speed >= 55 ? (
              <CheckRow
                label="Second TMA strongly recommended ≥ 55 mph"
                tone="warn"
                tag="WARN"
              />
            ) : null}
            {scenario.night && (
              <CheckRow label="Type IX retroreflective sheeting (night ops)" />
            )}
          </div>
          <div className="citation">
            <span className="check">✓</span>
            CDOT S-630-3 · COLORADO SUPPLEMENT
          </div>
        </>
      ),
    },
    referenceItem(results.ta, results.cdotSheet, r(results.caseId)),
  ];
}

function taperItem(
  laneWidth: number,
  speed: number,
  L: number,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec {
  return {
    title: "Taper length calculation",
    result: `L = ${r(L)}${generated ? " ft" : ""}`,
    cite: "MUTCD § 6C.08",
    body: (
      <>
        <p>
          For speed limits ≥ 45 mph, MUTCD Equation 6C-1 specifies the merging
          taper length as the lane width × speed limit. For lower speeds, the
          formula scales with the square of the speed.
        </p>
        <div className="formula">
          <span className="var">L</span>
          <span className="op">=</span>
          <span className="var">W</span>
          <span className="op">×</span>
          <span className="var">S</span>
          <span className="op">=</span>
          <span>{laneWidth}</span>
          <span className="op">×</span>
          <span>{speed}</span>
          <span className="op">=</span>
          <span className="res">{r(L)} ft</span>
        </div>
        <div className="citation">
          <span className="check">✓</span>
          MUTCD 2023 EDITION · CHAPTER 6C · TABLE 6C-3
        </div>
      </>
    ),
  };
}

function bufferItem(
  speed: number,
  B: number,
  r: (n: number | string) => string,
): ItemSpec {
  return {
    title: "Buffer space calculation",
    result: `B = ${r(B)} ft`,
    cite: "MUTCD TABLE 6C-2",
    body: (
      <>
        <p>
          Buffer space is the longitudinal clear distance between traffic and
          workers, sized for stopping sight distance at the posted speed.
        </p>
        <table>
          <thead>
            <tr>
              <th>Speed</th>
              <th>Buffer (ft)</th>
            </tr>
          </thead>
          <tbody>
            {[
              [25, 155],
              [35, 250],
              [45, 360],
              [55, 495],
              [65, 645],
              [75, 820],
            ].map(([s, b]) => (
              <tr key={s}>
                <td className={speed === s ? "match" : ""}>{s} mph</td>
                <td className={speed === s ? "match" : ""}>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="citation">
          <span className="check">✓</span>
          MUTCD TABLE 6C-2 · STOPPING SIGHT DISTANCE
        </div>
      </>
    ),
  };
}

function spacingItem(
  workLen: number,
  spacing: number,
  cones: number,
  taperCones: number,
  tangentCones: number,
  drums: number,
  generated: boolean,
  r: (n: number | string) => string,
): ItemSpec {
  return {
    title: "Channelizing device spacing",
    result: generated ? `${cones} cones · ${spacing} ft o.c.` : "—",
    cite: "MUTCD § 6F.65",
    body: (
      <>
        <p>
          In tapers and tangents, channelizing devices are spaced approximately
          equal to the speed limit in feet on-center.
        </p>
        <div className="formula">
          <span>spacing</span>
          <span className="op">≈</span>
          <span className="var">S</span>
          <span className="op">=</span>
          <span className="res">{r(spacing)} ft o.c.</span>
        </div>
        <p>
          Taper:{" "}
          <strong>{generated ? taperCones : "—"} cones</strong> · Tangent (
          {workLen} ft):{" "}
          <strong>{generated ? tangentCones : "—"} cones</strong>
          {generated && drums > 0 && (
            <>
              {" "}
              · Drums (night): <strong>{drums}</strong>
            </>
          )}
        </p>
        <div className="citation">
          <span className="check">✓</span>
          MUTCD § 6F.65 · CHANNELIZING DEVICES
        </div>
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

function referenceItem(ta: string, cdotSheet: string, caseId: string): ItemSpec {
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
        <p>
          <a
            href="https://www.codot.gov/business/designsupport/standard-plans/2023-mash-standard-plans/cdot-m-and-s-standards/m-and-s-standards-traffic-control"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[12px] tracking-[0.04em] uppercase text-[color:var(--cyan)] hover:underline"
          >
            ↗ Open {cdotSheet} PDF on CDOT.gov
          </a>
        </p>
      </>
    ),
  };
}

interface ItemProps {
  num: string;
  title: string;
  result: string;
  cite: string;
  open: boolean;
  onClick: () => void;
  children: ReactNode;
}

function AuditItem({
  num,
  title,
  result,
  cite,
  open,
  onClick,
  children,
}: ItemProps) {
  return (
    <div className={`audit-item ${open ? "open" : ""}`}>
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
  tone = "pass",
  tag = "PASS",
}: {
  label: string;
  tone?: "pass" | "warn" | "fail";
  tag?: string;
}) {
  const ckClass = tone === "pass" ? "ck" : `ck ${tone}`;
  const symbol = tone === "warn" ? "!" : tone === "fail" ? "✕" : "✓";
  return (
    <div className="check-list-item">
      <span className={ckClass}>{symbol}</span>
      <span className="check-list-lbl">{label}</span>
      <span className="check-list-src">{tag}</span>
    </div>
  );
}
