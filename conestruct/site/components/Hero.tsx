"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScenarioCard, SCENARIO_FIELDS } from "./ScenarioCard";
import { PlanSheet } from "./PlanSheet";

type Phase = "typing" | "generating" | "revealed";
type Stage = 0 | 1 | 2 | 3 | 4;

const TAGLINE_WORDS = ["Plan.", "Generate.", "Go."];

export function Hero() {
  const [phase, setPhase] = useState<Phase>("typing");
  const [activeIdx, setActiveIdx] = useState(0);
  const [partial, setPartial] = useState("");
  const [progress, setProgress] = useState(0);
  const [revealStage, setRevealStage] = useState<Stage>(0);

  // Type out scenario fields
  useEffect(() => {
    if (phase !== "typing") return;
    if (activeIdx >= SCENARIO_FIELDS.length) {
      setPhase("generating");
      return;
    }
    const target = SCENARIO_FIELDS[activeIdx].val;
    if (partial.length < target.length) {
      const t = setTimeout(
        () => setPartial(target.slice(0, partial.length + 1)),
        38,
      );
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setActiveIdx((i) => i + 1);
      setPartial("");
    }, 240);
    return () => clearTimeout(t);
  }, [phase, activeIdx, partial]);

  // Generating phase: progress + reveal stages
  useEffect(() => {
    if (phase !== "generating") return;
    let pct = 0;
    setProgress(0);
    setRevealStage(0);
    const id = setInterval(() => {
      pct += 4;
      setProgress(Math.min(100, pct));
      if (pct === 12) setRevealStage(1);
      else if (pct === 36) setRevealStage(2);
      else if (pct === 64) setRevealStage(3);
      else if (pct === 88) setRevealStage(4);
      if (pct >= 100) {
        clearInterval(id);
        setTimeout(() => setPhase("revealed"), 800);
      }
    }, 70);
    return () => clearInterval(id);
  }, [phase]);

  // Loop after revealed
  useEffect(() => {
    if (phase !== "revealed") return;
    const t = setTimeout(() => {
      setActiveIdx(0);
      setPartial("");
      setProgress(0);
      setRevealStage(0);
      setPhase("typing");
    }, 5500);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <section className="grid grid-cols-1 md:grid-cols-[1fr_1.15fr] gap-16 md:gap-16 pt-20 pb-16 items-center max-md:gap-20">
      {/* Left column */}
      <div className="relative">
        <div className="eyebrow mb-6">01 · MHT GENERATOR · COLORADO</div>
        <h1 className="font-sans font-bold text-[40px] md:text-[56px] leading-[1.02] tracking-tightest text-navy mb-6 [text-wrap:balance]">
          MUTCD-compliant{" "}
          <span className="text-orange">traffic control plans</span> in under
          two minutes.
        </h1>
        <div className="flex flex-wrap gap-3.5 font-mono text-[13px] tracking-[0.04em] text-ink-mute mb-7">
          {TAGLINE_WORDS.map((w) => (
            <span key={w} className="inline-flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 bg-orange" />
              {w}
            </span>
          ))}
        </div>
        <p className="text-[18px] leading-[1.55] text-ink-mute mb-9 max-w-[460px] [text-wrap:pretty]">
          Describe a work zone. Conestruct computes the taper, buffer, device
          count and sign placement — then ships a stamped-ready PDF, Excel
          device list and crew narrative.
        </p>
        <div className="flex items-center gap-5">
          <Link href="/app" className="btn-primary">
            Try the generator
            <span className="font-mono">→</span>
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
            Free · No card · ~90 sec
          </span>
        </div>
      </div>

      {/* Right column: animated demo */}
      <div className="relative max-md:mt-10">
        <ScenarioCard
          phase={phase}
          activeIdx={activeIdx}
          partial={partial}
          progress={progress}
        />
        <PlanSheet revealStage={revealStage} />
      </div>
    </section>
  );
}
