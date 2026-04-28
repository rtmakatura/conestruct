import Link from "next/link";
import type { ScenarioResult } from "@/lib/scenarios";

interface Props {
  results: ScenarioResult;
  generated: boolean;
}

const SIGNUP_HREF = "/app";

export function OutputCards({ results, generated }: Props) {
  if (!generated) {
    return (
      <div className="empty-state">
        <span className="big">No package yet</span>
        Describe the work zone <span className="arrow">→</span> press generate
        <span className="arrow">→</span> sign up to download
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <OutputCard
        ix="A"
        n="01"
        title="Plan sheet"
        meta={`PDF · 11×17 · ${results.ta} · ${results.cdotSheet}`}
        statLbl="Devices"
        statVal={results.totalDevices}
        ctaLabel="Sign up to download PDF"
      />
      <OutputCard
        ix="B"
        n="02"
        title="Device list"
        meta="XLSX · CDOT BID-READY"
        statLbl="Unique types"
        statVal={results.uniqueTypes}
        ctaLabel="Sign up to download XLSX"
      />
      <OutputCard
        ix="C"
        n="03"
        title="Crew instructions"
        meta="MARKDOWN · SETUP + TAKEDOWN"
        statLbl="Steps"
        statVal={results.steps}
        ctaLabel="Sign up to download .md"
      />
    </div>
  );
}

interface CardProps {
  ix: string;
  n: string;
  title: string;
  meta: string;
  statLbl: string;
  statVal: number;
  ctaLabel: string;
}

function OutputCard({ ix, n, title, meta, statLbl, statVal, ctaLabel }: CardProps) {
  return (
    <div className="output-card">
      <span className="corner tl" />
      <span className="corner br" />
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink-faint)] mb-1.5">
        <span className="text-[color:var(--orange)]">{ix}</span> · DELIVERABLE {n}
      </div>
      <h3 className="text-[16px] font-bold text-[color:var(--heading-on-paper)] m-0 mb-1.5 tracking-[-0.01em]">
        {title}
      </h3>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)] mb-3.5">
        {meta}
      </div>
      <div className="flex justify-between items-baseline my-3.5 py-2.5 border-t border-b border-dashed border-[color:var(--paper-line)]">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)]">
          {statLbl}
        </span>
        <span className="font-mono text-[22px] text-[color:var(--orange)] font-semibold">
          {statVal}
        </span>
      </div>
      <Link
        href={SIGNUP_HREF}
        className="w-full font-sans font-semibold text-[13px] bg-[color:var(--canvas)] text-white px-3 py-3 cursor-pointer flex items-center justify-center gap-2.5 hover:bg-[color:var(--cyan-deep)] transition-colors"
      >
        {ctaLabel}
        <span className="font-mono">↓</span>
      </Link>
    </div>
  );
}
