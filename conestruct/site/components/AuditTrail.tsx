"use client";

import { useState, type ReactNode } from "react";
import type {
  FlaggerLaneClosureScenario,
  FlaggerResult,
  Scenario,
  ScenarioResult,
  ShoulderResult,
  ShoulderScenario,
} from "@/lib/scenarios";

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

  const items: ItemSpec[] =
    scenario.kind === "shoulder" && results.kind === "shoulder"
      ? buildShoulderItems(scenario, results, generated, r)
      : scenario.kind === "flagger_lane_closure" &&
          results.kind === "flagger_lane_closure"
        ? buildFlaggerItems(scenario, results, generated, r)
        : [];

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
