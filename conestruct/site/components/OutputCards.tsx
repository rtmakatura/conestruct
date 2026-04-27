import Link from "next/link";
import type { ScenarioResults } from "@/lib/compute";

interface Props {
  results: ScenarioResults;
  generated: boolean;
}

const SIGNUP_HREF =
  "/app";

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
        title="Plan sheet"
        meta={`PDF · 11×17 LANDSCAPE · ${results.caseId}`}
        statLbl="Devices"
        statVal={results.totalDevices}
        ctaLabel="Sign up to download PDF"
      />
      <OutputCard
        ix="B"
        title="Device list"
        meta="XLSX · CDOT BID-READY"
        statLbl="Unique types"
        statVal={results.uniqueTypes}
        ctaLabel="Sign up to download XLSX"
      />
      <OutputCard
        ix="C"
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
  title: string;
  meta: string;
  statLbl: string;
  statVal: number;
  ctaLabel: string;
}

function OutputCard({ ix, title, meta, statLbl, statVal, ctaLabel }: CardProps) {
  return (
    <div className="output-card">
      <span className="corner tl" />
      <span className="corner br" />
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-1.5">
        <span className="text-orange">{ix}</span> · DELIVERABLE 0
        {ix === "A" ? "1" : ix === "B" ? "2" : "3"}
      </div>
      <h3 className="text-[17px] font-bold text-navy m-0 mb-1.5 tracking-[-0.01em]">
        {title}
      </h3>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint mb-3.5">
        {meta}
      </div>
      <div className="flex justify-between items-baseline my-3.5 py-2.5 border-t border-b border-dashed border-line">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
          {statLbl}
        </span>
        <span className="font-mono text-[22px] text-orange font-semibold">
          {statVal}
        </span>
      </div>
      <Link
        href={SIGNUP_HREF}
        className="w-full font-sans font-semibold text-[13px] bg-navy text-white px-3 py-3 cursor-pointer flex items-center justify-center gap-2.5 hover:bg-orange transition-colors"
      >
        {ctaLabel}
        <span className="font-mono">→</span>
      </Link>
    </div>
  );
}
