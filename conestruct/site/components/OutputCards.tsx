"use client";

import { useState } from "react";
import Link from "next/link";
import type { Scenario, ScenarioResult } from "@/lib/scenarios";

type RenderKind = "pdf" | "xlsx" | "markdown";

interface PublicMode {
  kind: "public";
  scenario: Scenario;
}
interface SavedMode {
  kind: "saved";
  planId: string | null;
}
type Mode = PublicMode | SavedMode;

interface Props {
  results: ScenarioResult;
  generated: boolean;
  mode: Mode;
}

const SIGNUP_HREF = "/app";

export function OutputCards({ results, generated, mode }: Props) {
  if (!generated) {
    return (
      <div className="empty-state">
        <span className="big">No package yet</span>
        Describe the work zone <span className="arrow">→</span> press generate
        <span className="arrow">→</span> download the package
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
        kind="pdf"
        mode={mode}
      />
      <OutputCard
        ix="B"
        n="02"
        title="Device list"
        meta="XLSX · CDOT BID-READY"
        statLbl="Unique types"
        statVal={results.uniqueTypes}
        kind="xlsx"
        mode={mode}
      />
      <OutputCard
        ix="C"
        n="03"
        title="Crew instructions"
        meta="MARKDOWN · SETUP + TAKEDOWN"
        statLbl="Steps"
        statVal={results.steps}
        kind="markdown"
        mode={mode}
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
  kind: RenderKind;
  mode: Mode;
}

const LABELS: Record<RenderKind, string> = {
  pdf: "Download PDF",
  xlsx: "Download XLSX",
  markdown: "Download .md",
};

const SIGNUP_LABELS: Record<RenderKind, string> = {
  pdf: "Sign up to download PDF",
  xlsx: "Sign up to download XLSX",
  markdown: "Sign up to download .md",
};

const EXT: Record<RenderKind, string> = {
  pdf: "pdf",
  xlsx: "xlsx",
  markdown: "md",
};

function safeFilename(name: string | undefined, ext: string): string {
  const cleaned = (name ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9 _-]+/g, "_")
    .replace(/\s+/g, "_");
  return `${cleaned || "plan"}.${ext}`;
}

function OutputCard({
  ix,
  n,
  title,
  meta,
  statLbl,
  statVal,
  kind,
  mode,
}: CardProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ctaLabel =
    mode.kind === "saved" && !mode.planId ? SIGNUP_LABELS[kind] : LABELS[kind];

  const onPublicDownload = async () => {
    if (mode.kind !== "public") return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/render/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario: mode.scenario }),
      });
      if (!res.ok) {
        setErr(`Render failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFilename(mode.scenario.meta?.project, EXT[kind]);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  };

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
      {mode.kind === "public" ? (
        <button
          type="button"
          onClick={onPublicDownload}
          disabled={busy}
          className="w-full font-sans font-semibold text-[13px] bg-[color:var(--canvas)] text-white px-3 py-3 cursor-pointer flex items-center justify-center gap-2.5 hover:bg-[color:var(--cyan-deep)] transition-colors disabled:opacity-60"
        >
          {busy ? "Rendering…" : err ?? ctaLabel}
          <span className="font-mono">↓</span>
        </button>
      ) : mode.planId ? (
        <a
          href={`/api/plans/${mode.planId}/${kind}`}
          download
          className="w-full font-sans font-semibold text-[13px] bg-[color:var(--canvas)] text-white px-3 py-3 cursor-pointer flex items-center justify-center gap-2.5 hover:bg-[color:var(--cyan-deep)] transition-colors"
        >
          {ctaLabel}
          <span className="font-mono">↓</span>
        </a>
      ) : (
        <Link
          href={SIGNUP_HREF}
          className="w-full font-sans font-semibold text-[13px] bg-[color:var(--canvas)] text-white px-3 py-3 cursor-pointer flex items-center justify-center gap-2.5 hover:bg-[color:var(--cyan-deep)] transition-colors"
        >
          {ctaLabel}
          <span className="font-mono">↓</span>
        </Link>
      )}
    </div>
  );
}
