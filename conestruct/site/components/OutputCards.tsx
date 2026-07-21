"use client";

import { useState } from "react";
import Link from "next/link";
import type { Scenario } from "@/lib/scenarios";
import type { AuditSummary } from "@/lib/render-types";
import { BUNDLE_PART_KINDS } from "@/lib/render-types";
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
  // Audit summary drives the plan-sheet spec sub-line (TA / CDOT sheet)
  // and the step count.  Null only during the very first audit fetch
  // (before any successful response); after that, GeneratorShell passes
  // the last-known summary even during refetches.
  summary: AuditSummary | null;
  generated: boolean;
  mode: Mode;
  breakdown: DeviceBreakdownState;
  // The full MHT-package zip — the former Generate side effect, now an
  // explicit header control.  Rendered in public mode only: saved plans
  // have no bundle route, and a button that can't work shouldn't render.
  onDownloadAll?: () => void;
  bundling?: boolean;
}

const SIGNUP_HREF = "/app";

// Map a backend-pulled stat into a display value. While the breakdown
// is loading, show an ellipsis; on error, fall back to "—" so the card
// doesn't surface a stale number — no TS-derived silent fallback.
function statFromBreakdown(
  breakdown: DeviceBreakdownState,
  pick: (data: { total_devices: number; unique_types: number }) => number,
): number | string {
  if (breakdown.state === "ready") return pick(breakdown.data);
  if (breakdown.state === "loading") return "…";
  return "—";
}

interface DlCardDef {
  title: string;
  spec: string;
  format: string;
  qtyLbl: string;
  qty: number | string;
  kind: RenderKind;
  // An optional second download offered on the same card (the crew card
  // offers the PDF as `kind` and the raw `.md` as `secondaryKind`).
  secondaryKind?: RenderKind;
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

export function OutputCards({
  summary,
  generated,
  mode,
  breakdown,
  onDownloadAll,
  bundling,
}: Props) {
  if (!generated) {
    return (
      <div className="empty-state">
        <span className="big">No package yet</span>
        Describe the work zone <span className="arrow">→</span> press generate
        <span className="arrow">→</span> download the package
      </div>
    );
  }
  const cards: DlCardDef[] = [
    {
      title: "Plan sheet",
      spec: summary ? `11×17 · ${summary.ta} · ${summary.cdot_sheet}` : "11×17",
      format: "PDF",
      qtyLbl: "devices",
      qty: statFromBreakdown(breakdown, (d) => d.total_devices),
      kind: "pdf",
    },
    {
      title: "Device list",
      spec: "CDOT BID-READY",
      format: "XLSX",
      qtyLbl: "types",
      qty: statFromBreakdown(breakdown, (d) => d.unique_types),
      kind: "xlsx",
    },
    {
      title: "Crew instructions",
      spec: "SETUP + TAKEDOWN",
      format: "PDF + MD",
      qtyLbl: "steps",
      qty: summary?.step_count ?? "—",
      kind: "crew-pdf",
      secondaryKind: "markdown",
    },
  ];
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-4 px-1 pb-3">
        <div>
          {/* File count derives from the actual zip contents
              (BUNDLE_PART_KINDS), not the visible card count: the bundle
              also carries quote.xlsx, which lives in the pricing card
              below rather than in this grid.  "3 FILES" beside a button
              that downloads 4 would be a false label. */}
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink-faint)]">
            MHT PACKAGE · {BUNDLE_PART_KINDS.length} FILES
          </div>
        </div>
        {mode.kind === "public" && onDownloadAll && (
          <button
            type="button"
            onClick={onDownloadAll}
            disabled={bundling}
            className="font-sans font-semibold text-[12px] px-3 py-2 cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap bg-transparent text-[color:var(--ink)] border border-[color:var(--rule)] hover:border-[color:var(--act)] hover:text-[color:var(--act)] transition-colors disabled:opacity-60"
          >
            <span className="font-mono">↓</span>{" "}
            {bundling ? "Bundling…" : "All (.zip)"}
          </button>
        )}
      </div>
      <div className="dls">
        {cards.map((card) => (
          <DlCard key={card.kind} card={card} mode={mode} />
        ))}
      </div>
    </div>
  );
}

function DlCard({ card, mode }: { card: DlCardDef; mode: Mode }) {
  const [busyKind, setBusyKind] = useState<RenderKind | null>(null);
  const [error, setError] = useState<{ kind: RenderKind; msg: string } | null>(
    null,
  );

  const kinds: RenderKind[] = card.secondaryKind
    ? [card.kind, card.secondaryKind]
    : [card.kind];

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
    <div className="dl-card">
      <div className="top">
        <h4>{card.title}</h4>
        <span className="fmt">{card.format}</span>
      </div>
      <div className="desc">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
          {card.spec}
        </span>
        <br />
        <b>{card.qty}</b> {card.qtyLbl}
      </div>
      {mode.kind === "public" ? (
        <>
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              className="dl-btn"
              onClick={() => onPublicDownload(k)}
              disabled={busyKind !== null}
            >
              {busyKind === k
                ? "Rendering…"
                : error?.kind === k
                  ? "Try again"
                  : labelFor(k)}
              <span className="font-mono">↓</span>
            </button>
          ))}
          {error && (
            <div className="text-[12px] leading-snug text-[color:var(--fail)] font-sans">
              {error.msg}
            </div>
          )}
        </>
      ) : mode.planId ? (
        kinds.map((k) => (
          <a
            key={k}
            href={`/api/plans/${mode.planId}/${k}`}
            download
            className="dl-btn"
          >
            {labelFor(k)}
            <span className="font-mono">↓</span>
          </a>
        ))
      ) : (
        <Link href={SIGNUP_HREF} className="dl-btn">
          {labelFor(card.kind)}
          <span className="font-mono">↓</span>
        </Link>
      )}
    </div>
  );
}
