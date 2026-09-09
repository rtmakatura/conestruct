"use client";

import { useState } from "react";
import Link from "next/link";
import type { Scenario } from "@/lib/scenarios";
import type { AuditSummary } from "@/lib/render-types";
import { stampMatches } from "@/lib/answer-stamp";
import { BUNDLE_PART_KINDS } from "@/lib/render-types";
import type { DeviceBreakdownState } from "./DeviceBreakdown";
import { lockedAnchorProps, useRenderRequest, useWriteLock } from "./WriteLock";

type RenderKind = "pdf" | "xlsx" | "markdown" | "crew-pdf" | "audit-pdf";

interface PublicMode {
  kind: "public";
  scenario: Scenario;
}
interface SavedMode {
  kind: "saved";
  planId: string | null;
  // #183: the on-screen scenario no longer matches the saved row (the
  // shell's #197 baseline-ref comparison).  The row-backed anchors give
  // way to a save-first affordance — an edited-but-unsaved plan must not
  // silently download stale output.
  dirty?: boolean;
}
type Mode = PublicMode | SavedMode;

interface Props {
  // Audit summary drives the plan-sheet spec sub-line (TA / CDOT sheet)
  // and the step count.  Null only during the very first audit fetch
  // (before any successful response); after that, GeneratorShell passes
  // the last-known summary even during refetches.
  summary: AuditSummary | null;
  generated: boolean;
  // #258 (P2/P3): true while the generated plan is DECLINED (the shell's
  // stamped-400 predicate).  The empty state then carries the headline
  // alone — the refusal container above it is the single instruction,
  // so "press generate" is not repeated at a plan the operator already
  // generated.  Never true pre-generate.
  declined?: boolean;
  mode: Mode;
  breakdown: DeviceBreakdownState;
  // The full MHT-package zip — the former Generate side effect, now an
  // explicit header control.  Rendered in public mode only: saved plans
  // have no bundle route, and a button that can't work shouldn't render.
  onDownloadAll?: () => void;
  bundling?: boolean;
  // #261: the audit card's "N checks" — the ✓ tier's count, assignTiers'
  // ledger.checked computed by the shell from the STAMPED audit (the
  // same token the audit-PDF cover prints; one mapping, Python mirror).
  // Null = no settled audit for the input on screen (first load, or the
  // audit failed): the quantity line prints empty at reserved height
  // and the audit button is disabled — an audit that has not answered
  // has no PDF.  Never a placeholder number (P16).
  auditChecked?: number | null;
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
  // Null: no quantity to state — the line renders empty (reserved
  // height, P1) and the label is omitted.
  qty: number | string | null;
  kind: RenderKind;
  // An optional second download offered on the same card (the crew card
  // offers the PDF as `kind` and the raw `.md` as `secondaryKind`).
  secondaryKind?: RenderKind;
  // The card's own reason to withhold its download (the audit card with
  // no settled audit).  Buttons only — a saved plan's row-backed anchors
  // point at a stored answer.
  unavailable?: boolean;
}

const LABELS: Record<RenderKind, string> = {
  pdf: "Download PDF",
  xlsx: "Download XLSX",
  markdown: "Download .md",
  "crew-pdf": "Download PDF",
  "audit-pdf": "Download PDF",
};

const SIGNUP_LABELS: Record<RenderKind, string> = {
  pdf: "Sign up to download PDF",
  xlsx: "Sign up to download XLSX",
  markdown: "Sign up to download .md",
  "crew-pdf": "Sign up to download PDF",
  "audit-pdf": "Sign up to download PDF",
};

// #252: what the band says while each file renders (RENDERING · …).
// "audit PDF" relocated here from TieredReference byte-identical (#261);
// lib/working-band.ts is untouched — the object string lives in the caller.
const RENDER_LABELS: Record<RenderKind, string> = {
  pdf: "plan sheet PDF",
  xlsx: "device list XLSX",
  markdown: "crew instructions MD",
  "crew-pdf": "crew instructions PDF",
  "audit-pdf": "audit PDF",
};

const EXT: Record<RenderKind, string> = {
  pdf: "pdf",
  xlsx: "xlsx",
  markdown: "md",
  // Distinct from the plan-sheet PDF so the browser doesn't dedupe the
  // two downloads to "<plan> (1).pdf".
  "crew-pdf": "crew.pdf",
  // = AuditTrail.tsx auditFilename's suffix (the retired tier link's
  // filename), for the same reason.
  "audit-pdf": "audit.pdf",
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
  declined = false,
  mode,
  breakdown,
  onDownloadAll,
  bundling,
  auditChecked = null,
}: Props) {
  const locked = useWriteLock(); // #252 (ruling b)
  if (!generated) {
    return (
      <div className="empty-state">
        <span className="big">No package yet</span>
        {!declined && (
          <>
            Describe the work zone <span className="arrow">→</span> press
            generate <span className="arrow">→</span> download the package
          </>
        )}
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
    // #261 (P11): the audit PDF wears the same card and button as every
    // other download — it was a mono text link inside a collapsed tier.
    // Not in the zip (BUNDLE_PART_KINDS), so the header count is unmoved.
    {
      title: "Audit trail",
      spec: "EVERY CHECK CITED",
      format: "PDF",
      qtyLbl: "checks",
      qty: auditChecked,
      kind: "audit-pdf",
      unavailable: auditChecked === null,
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
            data-write=""
            onClick={onDownloadAll}
            disabled={bundling || locked}
            className="font-sans font-semibold text-[12px] px-3 py-2 cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap bg-transparent text-[color:var(--ink)] border border-[color:var(--rule)] hover:border-[color:var(--act)] hover:text-[color:var(--act)] transition-colors disabled:opacity-60"
          >
            <span className="font-mono">↓</span> All (.zip)
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
  const locked = useWriteLock(); // #252 (ruling b)
  const [busyKind, setBusyKind] = useState<RenderKind | null>(null);
  // #197: the error is an answer — stamped with the scenario the failed
  // request POSTed (``for``), and presented only while that scenario is
  // still the one on screen.  Without the stamp a 400's message (and its
  // "Try again" label) survived every subsequent edit, contradicting the
  // now-valid inputs.
  const [error, setError] = useState<{
    kind: RenderKind;
    msg: string;
    for: unknown;
  } | null>(null);
  const currentError =
    error !== null &&
    mode.kind === "public" &&
    stampMatches([error.for], [mode.scenario])
      ? error
      : null;

  const kinds: RenderKind[] = card.secondaryKind
    ? [card.kind, card.secondaryKind]
    : [card.kind];

  const labelFor = (k: RenderKind) =>
    mode.kind === "saved" && !mode.planId ? SIGNUP_LABELS[k] : LABELS[k];

  const beginRender = useRenderRequest();
  const onPublicDownload = async (dlKind: RenderKind) => {
    if (mode.kind !== "public") return;
    setBusyKind(dlKind);
    setError(null);
    // #252: the band names the file while it renders; the lock holds.
    const endRender = beginRender(RENDER_LABELS[dlKind]);
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
        setError({ kind: dlKind, msg, for: mode.scenario });
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
      setError({ kind: dlKind, msg: "Network error", for: mode.scenario });
    } finally {
      endRender();
      setBusyKind(null);
    }
  };

  // #261 (P4/P11): the card's actions are ONE bottom-anchored row
  // (`.dl-actions`, the card's last child) — the crew card's PDF and .md
  // sit side by side in it — so every card's first button shares one top
  // and one bottom edge.  Any note (a 400's message, the unsaved-edits
  // line) prints ABOVE the row, so the edge never moves (P1).
  const actions =
    mode.kind === "public"
      ? kinds.map((k) => (
          <button
            key={k}
            type="button"
            className="dl-btn"
            data-write=""
            onClick={() => onPublicDownload(k)}
            disabled={busyKind !== null || locked || card.unavailable === true}
          >
            {/* #252: no per-button "Rendering…" — the band is the one
                working voice; "Try again" is an outcome, kept. */}
            {currentError?.kind === k ? "Try again" : labelFor(k)}
            <span className="font-mono">↓</span>
          </button>
        ))
      : mode.planId
        ? mode.dirty
          ? kinds.map((k) => (
              <button key={k} type="button" className="dl-btn" data-write="" disabled>
                {labelFor(k)}
                <span className="font-mono">↓</span>
              </button>
            ))
          : kinds.map((k) => (
              <a
                key={k}
                href={`/api/plans/${mode.planId}/${k}`}
                download
                className="dl-btn"
                data-write=""
                {...lockedAnchorProps(locked)}
              >
                {labelFor(k)}
                <span className="font-mono">↓</span>
              </a>
            ))
        : [
            <Link key={card.kind} href={SIGNUP_HREF} className="dl-btn">
              {labelFor(card.kind)}
              <span className="font-mono">↓</span>
            </Link>,
          ];

  const note =
    mode.kind === "public" ? (
      currentError ? (
        <div className="text-[12px] leading-snug text-[color:var(--fail)] font-sans">
          {currentError.msg}
        </div>
      ) : null
    ) : mode.planId && mode.dirty ? (
      <div className="text-[12px] leading-snug text-[color:var(--ink-faint)] font-sans">
        Unsaved edits — Save to download the plan on screen. The saved copy
        no longer matches it.
      </div>
    ) : null;

  return (
    <div className="dl-card">
      <div className="top">
        <h3>{card.title}</h3>
        <span className="fmt">{card.format}</span>
      </div>
      <div className="desc">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
          {card.spec}
        </span>
        {/* The quantity line is always present at its own height (P1):
            a null quantity leaves it empty — never a placeholder. */}
        <span className="qty">
          {card.qty !== null && (
            <>
              <b>{card.qty}</b> {card.qtyLbl}
            </>
          )}
        </span>
      </div>
      {note}
      <div className="dl-actions">{actions}</div>
    </div>
  );
}
