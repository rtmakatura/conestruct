"use client";

import { useState } from "react";
import { TaperViz } from "./TaperViz";

const BUFFER_TABLE: Record<number, number> = {
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

function taperLength(W: number, S: number) {
  if (S >= 45) return W * S;
  return (W * S * S) / 60;
}

function bufferLength(S: number) {
  const k = Math.round(S / 5) * 5;
  return BUFFER_TABLE[k] ?? 645;
}

function deviceSpacing(S: number) {
  return Math.round(S);
}

function CalcItem({
  n,
  label,
  value,
  cite,
  desc,
}: {
  n: string;
  label: string;
  value: string;
  cite: string;
  desc: string;
}) {
  return (
    <div className="grid grid-cols-[36px_1fr_auto] gap-4 py-[18px] border-b border-line items-baseline">
      <span className="font-mono text-[11px] text-orange font-semibold">{n}</span>
      <div>
        <div className="text-[16px] font-semibold text-navy mb-0.5">{label}</div>
        <div className="font-mono text-[11px] text-ink-faint uppercase tracking-[0.08em]">
          {desc}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[13px] font-semibold text-orange">{value}</div>
        <div className="font-mono text-[10px] text-ink-faint uppercase tracking-[0.08em]">
          {cite}
        </div>
      </div>
    </div>
  );
}

export function MathSection() {
  const [W, setW] = useState(12);
  const [S, setS] = useState(65);
  const L = Math.round(taperLength(W, S));
  const B = bufferLength(S);
  const sp = deviceSpacing(S);

  return (
    <section id="math" className="py-24 md:py-24">
      <div className="max-w-page mx-auto px-6 md:px-12">
        {/* section head */}
        <div className="flex items-baseline justify-between mb-10 pb-4 border-b border-line">
          <h2 className="font-sans font-bold text-[36px] tracking-tighter text-navy m-0 max-w-[640px] leading-[1.1]">
            The math is the
            <br />
            product.
          </h2>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            <span className="text-orange">02</span> · SHOW THE WORK
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-12 items-start">
          {/* Formula card */}
          <div className="relative bg-white border border-line p-8">
            {/* corner ticks */}
            <span className="absolute -top-px -left-px w-3.5 h-3.5 border-[1.5px] border-orange border-r-0 border-b-0" />
            <span className="absolute -top-px -right-px w-3.5 h-3.5 border-[1.5px] border-orange border-l-0 border-b-0" />
            <span className="absolute -bottom-px -left-px w-3.5 h-3.5 border-[1.5px] border-orange border-r-0 border-t-0" />
            <span className="absolute -bottom-px -right-px w-3.5 h-3.5 border-[1.5px] border-orange border-l-0 border-t-0" />

            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint mb-2">
              MUTCD <span className="text-orange">§ 6B.08</span> · MERGING TAPER
              LENGTH
            </div>

            <div className="font-mono text-[28px] text-navy py-6 border-t border-b border-line flex items-center flex-wrap gap-1">
              <span className="text-orange font-semibold">L</span>
              <span className="text-ink-mute mx-1.5">=</span>
              <span className="text-orange font-semibold">W</span>
              <span className="text-ink-mute mx-1.5">×</span>
              <span className="text-orange font-semibold">S</span>
              <span className="text-ink-mute mx-1.5">=</span>
              <span>{W}</span>
              <span className="text-ink-mute mx-1.5">×</span>
              <span>{S}</span>
              <span className="text-ink-mute mx-1.5">=</span>
              <span className="text-green font-semibold ml-2">{L} ft</span>
            </div>

            <div className="grid grid-cols-2 gap-6 mt-7">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint mb-2.5">
                  Lane width (W)
                  <span className="float-right text-navy font-semibold">
                    {W} ft
                  </span>
                </label>
                <input
                  type="range"
                  min={9}
                  max={14}
                  value={W}
                  onChange={(e) => setW(+e.target.value)}
                  className="range-orange"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint mb-2.5">
                  Speed limit (S)
                  <span className="float-right text-navy font-semibold">
                    {S} mph
                  </span>
                </label>
                <input
                  type="range"
                  min={25}
                  max={75}
                  step={5}
                  value={S}
                  onChange={(e) => setS(+e.target.value)}
                  className="range-orange"
                />
              </div>
            </div>

            {/* taper viz */}
            <div className="relative bg-paper border border-line px-6 pt-8 pb-14 mt-7 min-h-[280px] overflow-hidden">
              <div className="absolute inset-0 pointer-events-none blueprint-grid-faint" />
              <span className="absolute top-3 left-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint z-[2]">
                TAPER GEOMETRY · NOT TO SCALE
              </span>
              <span className="absolute top-3 right-4 font-mono text-[11px] font-semibold text-orange z-[2]">
                L = {L} ft · B = {B} ft
              </span>
              <div className="relative z-[1]">
                <TaperViz W={W} S={S} L={L} B={B} sp={sp} />
              </div>
            </div>

            {/* citations */}
            <div className="flex gap-6 mt-6 pt-4 border-t border-dashed border-line flex-wrap">
              {["MUTCD § 6B.08", "MUTCD TABLE 6B-4", "CDOT S-630-1"].map((c) => (
                <div
                  key={c}
                  className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute"
                >
                  <span className="inline-flex items-center justify-center w-3 h-3 bg-green text-white text-[9px] font-bold">
                    ✓
                  </span>
                  {c}
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div>
            <p className="text-[17px] leading-[1.5] text-ink-mute m-0 mb-8 [text-wrap:pretty] max-w-[440px]">
              Every dimension on a Conestruct plan is computed from MUTCD
              formulas, cited, and shown on the audit trail. Drag the sliders —
              watch the plan recompute in real time.
            </p>

            <div className="flex flex-col border-t border-line">
              <CalcItem
                n="01"
                label="Merging taper length"
                value={`${L} ft`}
                cite="MUTCD § 6B.08"
                desc="W × S for ≥ 45 mph"
              />
              <CalcItem
                n="02"
                label="Buffer space"
                value={`${B} ft`}
                cite="MUTCD TABLE 6B-2"
                desc="Stopping sight distance @ S"
              />
              <CalcItem
                n="03"
                label="Channelizing device spacing"
                value={`${sp} ft o.c.`}
                cite="MUTCD § 6K.01"
                desc="≤ S ft in taper · ≤ 2×S on tangent"
              />
              <CalcItem
                n="04"
                label="Advance warning sign placement"
                value="500 / 1000 / 1500 ft"
                cite="MUTCD TABLE 6B-1"
                desc="Three-sign series · rural highway"
              />
              <CalcItem
                n="05"
                label="S-630-1 case match"
                value="Case 11"
                cite="CDOT S-630-1 · SHEET 7"
                desc="Shoulder closure · divided highway"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
