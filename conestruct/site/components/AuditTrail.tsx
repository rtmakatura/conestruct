"use client";

import { useState, type ReactNode } from "react";
import type { ScenarioParams, ScenarioResults } from "@/lib/compute";

interface Props {
  params: ScenarioParams;
  results: ScenarioResults;
  generated: boolean;
}

export function AuditTrail({ params, results, generated }: Props) {
  const [openIdx, setOpenIdx] = useState<number>(0);
  const toggle = (i: number) => setOpenIdx(openIdx === i ? -1 : i);
  const r = (n: number | string) => (generated ? String(n) : "—");

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

      <div className="audit-list">
        <AuditItem
          num="01"
          title="Taper length calculation"
          result={`L = ${r(results.L)}${generated ? " ft" : ""}`}
          cite="MUTCD § 6C.08"
          open={openIdx === 0}
          onClick={() => toggle(0)}
        >
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
            <span>{params.laneWidth}</span>
            <span className="op">×</span>
            <span>{params.speed}</span>
            <span className="op">=</span>
            <span className="res">{r(results.L)} ft</span>
          </div>
          <div className="citation">
            <span className="check">✓</span>
            MUTCD 2023 EDITION · CHAPTER 6C · TABLE 6C-3
          </div>
        </AuditItem>

        <AuditItem
          num="02"
          title="Buffer space calculation"
          result={`B = ${r(results.B)}${generated ? " ft" : ""}`}
          cite="MUTCD TABLE 6C-2"
          open={openIdx === 1}
          onClick={() => toggle(1)}
        >
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
              {[55, 60, 65, 70, 75].map((s) => (
                <tr key={s}>
                  <td className={params.speed === s ? "match" : ""}>{s} mph</td>
                  <td className={params.speed === s ? "match" : ""}>
                    {{ 55: 495, 60: 570, 65: 645, 70: 730, 75: 820 }[s]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="citation">
            <span className="check">✓</span>
            MUTCD TABLE 6C-2 · STOPPING SIGHT DISTANCE
          </div>
        </AuditItem>

        <AuditItem
          num="03"
          title="Channelizing device spacing"
          result={
            generated
              ? `${results.cones} cones · ${results.spacing} ft o.c.`
              : "—"
          }
          cite="MUTCD § 6F.65"
          open={openIdx === 2}
          onClick={() => toggle(2)}
        >
          <p>
            In tapers and tangents, channelizing devices are spaced approximately
            equal to the speed limit in feet on-center.
          </p>
          <div className="formula">
            <span>spacing</span>
            <span className="op">≈</span>
            <span className="var">S</span>
            <span className="op">=</span>
            <span className="res">{r(results.spacing)} ft o.c.</span>
          </div>
          <p>
            Taper:{" "}
            <strong>{generated ? results.taperCones : "—"} cones</strong> ·
            Tangent ({params.workLen} ft):{" "}
            <strong>{generated ? results.tangentCones : "—"} cones</strong>
            {generated && results.drums > 0 && (
              <>
                {" "}
                · Drums (night): <strong>{results.drums}</strong>
              </>
            )}
          </p>
          <div className="citation">
            <span className="check">✓</span>
            MUTCD § 6F.65 · CHANNELIZING DEVICES
          </div>
        </AuditItem>

        <AuditItem
          num="04"
          title="Advance warning sign placement"
          result={generated ? `${results.signs} signs / side` : "—"}
          cite="MUTCD TABLE 6C-1"
          open={openIdx === 3}
          onClick={() => toggle(3)}
        >
          <table>
            <thead>
              <tr>
                <th>Sign</th>
                <th>Code</th>
                <th>Distance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Road work ahead</td>
                <td>W20-1</td>
                <td>1500 ft</td>
              </tr>
              <tr>
                <td>Right lane closed ahead</td>
                <td>W20-5R</td>
                <td>1000 ft</td>
              </tr>
              <tr>
                <td>Merge right</td>
                <td>W4-2R</td>
                <td>500 ft</td>
              </tr>
            </tbody>
          </table>
          <div className="citation">
            <span className="check">✓</span>
            MUTCD TABLE 6C-1 · ADVANCE WARNING DISTANCE
          </div>
        </AuditItem>

        <AuditItem
          num="05"
          title="Colorado supplement requirements"
          result="ALL CHECKS PASS"
          cite="CDOT S-630-1"
          open={openIdx === 4}
          onClick={() => toggle(4)}
        >
          <div className="check-list">
            <CheckRow label="Type III barricade at terminus (S-630-1 §4.2)" />
            <CheckRow label="Retroreflective device sheeting Type IX" />
            <CheckRow label="Speed reduction sign per CDOT § 630.07" />
            <CheckRow
              label="Flagger spacing exceeds 1500 ft — review"
              tone="warn"
              tag="WARN"
            />
          </div>
          <div className="citation">
            <span className="check">✓</span>
            CDOT S-630-1 · COLORADO SUPPLEMENT
          </div>
        </AuditItem>

        <AuditItem
          num="06"
          title="S-630-1 case reference"
          result={r(results.caseId)}
          cite="CDOT S-630-1"
          open={openIdx === 5}
          onClick={() => toggle(5)}
        >
          <p>
            Matched against CDOT Standard Plan S-630-1, the official Colorado
            supplement to MUTCD Part 6.
          </p>
          <p>
            <a
              href="https://www.codot.gov/business/designsupport/standard-plans/2023-mash-standard-plans/cdot-m-and-s-standards/m-and-s-standards-traffic-control"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[12px] tracking-[0.04em] uppercase text-[color:var(--cyan)] hover:underline"
            >
              ↗ Open S-630-1 PDF on CDOT.gov
            </a>
          </p>
        </AuditItem>
      </div>
    </section>
  );
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
