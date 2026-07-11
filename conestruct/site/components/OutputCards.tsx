"use client";

import { useState } from "react";
import Link from "next/link";
import type { Scenario } from "@/lib/scenarios";
import type { AuditSummary } from "@/lib/render-types";
import type { DeviceBreakdownState } from "./DeviceBreakdown";

type RenderKind = "pdf" | "xlsx" | "markdown" | "crew-pdf";

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
  // Audit summary drives the per-card TA / CDOT-sheet labels and the
  // step count.  Null only during the very first audit fetch (before
  // any successful response); after that, GeneratorShell passes the
  // last-known summary even during refetches.  Each card renders a
  // brief placeholder while summary is null.
  summary: AuditSummary | null;
  generated: boolean;
  mode: Mode;
  breakdown: DeviceBreakdownState;
}

const SIGNUP_HREF = "/app";

// Map a backend-pulled stat into the card's display value. While the
// breakdown is loading, show an ellipsis (matches the panel's loading
// state); on error, fall back to "—" so the card doesn't surface a stale
// number — same principle as the Plan Details panel: no TS-derived
// silent fallback.
function statFromBreakdown(
  breakdown: DeviceBreakdownState,
  pick: (data: { total_devices: number; unique_types: number }) => number,
): number | string {
  if (breakdown.state === "ready") return pick(breakdown.data);
  if (breakdown.state === "loading") return "…";
  return "—";
}

export function OutputCards({ summary, generated, mode, breakdown }: Props) {
  if (!generated) {
    return (
      <div className="empty-state">
        <span className="big">No package yet</span>
        Describe the work zone <span className="arrow">→</span> press generate
        <span className="arrow">→</span> download the package
      </div>
    );
  }
  const planMeta = summary
    ? `PDF · 11×17 · ${summary.ta} · ${summary.cdot_sheet}`
    : "PDF · 11×17";
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <OutputCard
        ix="A"
        n="01"
        title="Plan sheet"
        meta={planMeta}
        statLbl="Devices"
        statVal={statFromBreakdown(breakdown, (d) => d.total_devices)}
        kind="pdf"
        mode={mode}
      />
      <OutputCard
        ix="B"
        n="02"
        title="Device list"
        meta="XLSX · CDOT BID-READY"
        statLbl="Unique types"
        statVal={statFromBreakdown(breakdown, (d) => d.unique_types)}
        kind="xlsx"
        mode={mode}
      />
      <OutputCard
        ix="C"
        n="03"
        title="Crew instructions"
        meta="PDF + MD · SETUP + TAKEDOWN"
        statLbl="Steps"
        statVal={summary?.step_count ?? "—"}
        kind="crew-pdf"
        secondaryKind="markdown"
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
  statVal: number | string;
  kind: RenderKind;
  // An optional second download offered on the same card (the crew card
  // offers the PDF as `kind` and the raw `.md` as `secondaryKind`).
  secondaryKind?: RenderKind;
  mode: Mode;
}

const LABELS: Record<RenderKind, string> = {
  pdf: "Download PDF",
  xlsx: "Download XLSX",
  markdown: "Download .md",
  "crew-pdf": "Download PDF",
};

const SIGNUP_LABELS: Record<RenderKind, string> = {
  pdf: "Sign up to download PDF",
  xlsx: "Sign up to download XLSX",
  markdown: "Sign up to download .md",
  "crew-pdf": "Sign up to download PDF",
};

const EXT: Record<RenderKind, string> = {
  pdf: "pdf",
  xlsx: "xlsx",
  markdown: "md",
  // Distinct from the plan-sheet PDF so the browser doesn't dedupe the
  // two downloads to "<plan> (1).pdf".
  "crew-pdf": "crew.pdf",
};

function safeFilename(name: string | undefined, ext: string): string {
  const cleaned = (name ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9 _-]+/g, "_")
    .replace(/\s+/g, "_");
  return `${cleaned || "plan"}.${ext}`;
}

// Pull a user-facing message out of a 400 response body.  The render
// service raises HTTPException(400, detail={"error": ..., "message":
// "...", "violations": [...]}); FastAPI serialises that as
// {"detail": {...}}.  Some validators raise with a string detail, in
// which case we fall back to that.  Anything we can't parse becomes
// the safe default "Invalid scenario".
async function extractValidationMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      detail?: { message?: unknown } | string;
    };
    if (body.detail && typeof body.detail === "object") {
      const m = body.detail.message;
      if (typeof m === "string" && m.length > 0) return m;
    }
    if (typeof body.detail === "string" && body.detail.length > 0) {
      return body.detail;
    }
  } catch {
    // Body wasn't JSON — fall through to default.
  }
  return "Invalid scenario";
}

// Shared button/anchor shape; the primary is solid, a secondary CTA is
// rendered as a lighter outline so the two reads as primary + alternate.
const CTA_BASE =
  "w-full font-sans font-semibold text-[13px] px-3 py-3 cursor-pointer flex items-center justify-center gap-2.5 transition-colors";
const CTA_PRIMARY =
  "bg-[color:var(--act)] text-[color:var(--on-act)] hover:bg-[color:var(--act-bright)]";
const CTA_SECONDARY =
  "bg-transparent text-[color:var(--ink)] border border-[color:var(--rule)] hover:border-[color:var(--act)] hover:text-[color:var(--act)]";

function ctaClass(idx: number): string {
  return `${CTA_BASE} ${idx === 0 ? CTA_PRIMARY : CTA_SECONDARY}`;
}

function OutputCard({
  ix,
  n,
  title,
  meta,
  statLbl,
  statVal,
  kind,
  secondaryKind,
  mode,
}: CardProps) {
  const [busyKind, setBusyKind] = useState<RenderKind | null>(null);
  const [error, setError] = useState<{ kind: RenderKind; msg: string } | null>(
    null,
  );

  const kinds: RenderKind[] = secondaryKind ? [kind, secondaryKind] : [kind];

  const labelFor = (k: RenderKind) =>
    mode.kind === "saved" && !mode.planId ? SIGNUP_LABELS[k] : LABELS[k];

  const onPublicDownload = async (dlKind: RenderKind) => {
    if (mode.kind !== "public") return;
    setBusyKind(dlKind);
    setError(null);
    try {
      const res = await fetch(`/api/render/${dlKind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario: mode.scenario }),
      });
      if (!res.ok) {
        // 400 = structured validation error from the render service
        // (e.g., work zone shorter than required taper).  Pull the
        // user-facing message out of detail.message instead of showing
        // a generic "Render failed (400)" — the message names the
        // specific taper length / speed limit the user must satisfy.
        const msg =
          res.status === 400
            ? await extractValidationMessage(res)
            : `Render failed (${res.status})`;
        setError({ kind: dlKind, msg });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFilename(mode.scenario.meta?.project, EXT[dlKind]);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError({ kind: dlKind, msg: "Network error" });
    } finally {
      setBusyKind(null);
    }
  };

  return (
    <div className="output-card">
      <span className="corner tl" />
      <span className="corner br" />
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink-faint)] mb-1.5">
        <span className="text-[color:var(--dim)]">{ix}</span> · DELIVERABLE {n}
      </div>
      <h3 className="text-[16px] font-bold text-[color:var(--heading-on-paper)] m-0 mb-1.5 tracking-[-0.01em]">
        {title}
      </h3>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)] mb-3.5">
        {meta}
      </div>
      <div className="flex justify-between items-baseline my-3.5 py-2.5 border-t border-b border-dashed border-[color:var(--rule-soft)]">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)]">
          {statLbl}
        </span>
        <span className="font-mono text-[22px] text-[color:var(--dim)] font-semibold">
          {statVal}
        </span>
      </div>
      {mode.kind === "public" ? (
        <>
          <div className="flex flex-col gap-2">
            {kinds.map((k, idx) => (
              <button
                key={k}
                type="button"
                onClick={() => onPublicDownload(k)}
                disabled={busyKind !== null}
                className={`${ctaClass(idx)} disabled:opacity-60`}
              >
                {busyKind === k
                  ? "Rendering…"
                  : error?.kind === k
                    ? "Try again"
                    : labelFor(k)}
                <span className="font-mono">↓</span>
              </button>
            ))}
          </div>
          {error && (
            <div className="mt-2 text-[12px] leading-snug text-[color:var(--fail)] font-sans">
              {error.msg}
            </div>
          )}
        </>
      ) : mode.planId ? (
        <div className="flex flex-col gap-2">
          {kinds.map((k, idx) => (
            <a
              key={k}
              href={`/api/plans/${mode.planId}/${k}`}
              download
              className={ctaClass(idx)}
            >
              {labelFor(k)}
              <span className="font-mono">↓</span>
            </a>
          ))}
        </div>
      ) : (
        <Link href={SIGNUP_HREF} className={ctaClass(0)}>
          {labelFor(kind)}
          <span className="font-mono">↓</span>
        </Link>
      )}
    </div>
  );
}
