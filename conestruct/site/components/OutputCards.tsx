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
  // Re-download of the full MHT-package zip — GeneratorShell's existing
  // bundle handler (the Generate button's action), threaded here so the
  // header button reuses it verbatim.  Rendered in public mode only:
  // saved plans have no bundle route, and a button that can't work
  // shouldn't render.
  onDownloadAll?: () => void;
  bundling?: boolean;
}

const SIGNUP_HREF = "/app";

// Map a backend-pulled stat into the row's Qty value. While the
// breakdown is loading, show an ellipsis (matches the panel's loading
// state); on error, fall back to "—" so the row doesn't surface a stale
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

// Mono column-header treatment per the sheet-index spec.
const TH =
  "font-mono font-normal text-[9.5px] uppercase tracking-[0.14em] text-[color:var(--ink-faint)] text-left px-5 py-2.5 border-b border-[color:var(--rule)] whitespace-nowrap";

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
  const rows: SheetRowDef[] = [
    {
      letter: "A",
      title: "Plan sheet",
      spec: summary ? `11×17 · ${summary.ta} · ${summary.cdot_sheet}` : "11×17",
      format: "PDF",
      qtyLbl: "Devices",
      qty: statFromBreakdown(breakdown, (d) => d.total_devices),
      kind: "pdf",
    },
    {
      letter: "B",
      title: "Device list",
      spec: "CDOT BID-READY",
      format: "XLSX",
      qtyLbl: "Types",
      qty: statFromBreakdown(breakdown, (d) => d.unique_types),
      kind: "xlsx",
    },
    {
      letter: "C",
      title: "Crew instructions",
      spec: "SETUP + TAKEDOWN",
      format: "PDF + MD",
      qtyLbl: "Steps",
      qty: summary?.step_count ?? "—",
      kind: "crew-pdf",
      secondaryKind: "markdown",
    },
  ];
  return (
    <div className="mb-8 border border-[color:var(--rule)] bg-[color:var(--canvas-tint)]">
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-[color:var(--rule)]">
        <div>
          <h3 className="m-0 text-[13px] font-bold tracking-[0.02em] text-[color:var(--heading-on-paper)]">
            SHEET INDEX
          </h3>
          {/* File count derives from the actual zip contents
              (BUNDLE_PART_KINDS), not the visible row count: the bundle
              also carries quote.xlsx, which lives in the QuotePanel
              below rather than in this index.  "3 SHEETS" beside a
              button that downloads 4 files would be a false label. */}
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink-faint)]">
            MHT PACKAGE · {BUNDLE_PART_KINDS.length} FILES
          </div>
        </div>
        {mode.kind === "public" && onDownloadAll && (
          <button
            type="button"
            onClick={onDownloadAll}
            disabled={bundling}
            className={`${BTN_BASE} ${BTN_GHOST} disabled:opacity-60`}
          >
            <span className="font-mono">↓</span> All (.zip)
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[color:var(--canvas)]">
              <th scope="col" className={TH}>
                Sheet
              </th>
              <th scope="col" className={TH}>
                Deliverable
              </th>
              <th scope="col" className={TH}>
                Format
              </th>
              <th scope="col" className={`${TH} text-right`}>
                Qty
              </th>
              <th scope="col" className={`${TH} text-right`}>
                File
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <SheetRow key={row.letter} row={row} mode={mode} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SheetRowDef {
  letter: string;
  title: string;
  spec: string;
  format: string;
  qtyLbl: string;
  qty: number | string;
  kind: RenderKind;
  // An optional second download offered on the same row (the crew row
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

// Shared button/anchor shape; the primary is solid, a secondary CTA is
// rendered as a lighter outline so the two read as primary + alternate.
const BTN_BASE =
  "font-sans font-semibold text-[12px] px-3 py-2 cursor-pointer inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap";
const BTN_PRIMARY =
  "bg-[color:var(--act)] text-[color:var(--on-act)] hover:bg-[color:var(--act-bright)]";
const BTN_GHOST =
  "bg-transparent text-[color:var(--ink)] border border-[color:var(--rule)] hover:border-[color:var(--act)] hover:text-[color:var(--act)]";

// Uniform control size for every row download: one height, one width
// sized to the longest label ("Download XLSX"), so the three rows'
// buttons read as a column of equal controls.  Signup mode carries
// longer labels ("Sign up to download XLSX") and gets its own uniform
// width — same height.
const BTN_SIZE = "h-[34px] w-[152px]";
const BTN_SIGNUP_SIZE = "h-[34px] w-[228px]";

function ctaClass(idx: number): string {
  return `${BTN_BASE} ${BTN_SIZE} ${idx === 0 ? BTN_PRIMARY : BTN_GHOST}`;
}

// One fixed height for every row, sized to the tallest case — row C's
// stacked button pair (34px + 34px + 6px gap = 74px content) plus
// breathing room — so A and B grow to match rather than C standing
// taller.  Table cells treat height as a minimum, so an inline error
// message can still grow its row rather than clip.  Content
// middle-aligned; 20px horizontal padding per the sheet-index spec.
const TD = "h-[96px] px-5 align-middle";

function SheetRow({ row, mode }: { row: SheetRowDef; mode: Mode }) {
  const [busyKind, setBusyKind] = useState<RenderKind | null>(null);
  const [error, setError] = useState<{ kind: RenderKind; msg: string } | null>(
    null,
  );

  const kinds: RenderKind[] = row.secondaryKind
    ? [row.kind, row.secondaryKind]
    : [row.kind];

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
    <tr className="border-b border-[color:var(--rule-soft)] last:border-b-0 hover:bg-[color:var(--paper)] transition-colors">
      {/* Sheet letter in neutral ink, deliberately NOT --dim: the color
          system (1c7bde5) reserves orange for generated numbers, and a
          sheet letter is a label.  --ink-mute measures 8.5:1 on
          --canvas-tint and 7.2:1 on the --paper row hover. */}
      <td
        className={`${TD} font-mono text-[13px] text-[color:var(--ink-mute)]`}
      >
        {row.letter}
      </td>
      <td className={TD}>
        <div className="text-[15px] font-bold tracking-[-0.01em] text-[color:var(--heading-on-paper)]">
          {row.title}
        </div>
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)] whitespace-nowrap">
          {row.spec}
        </div>
      </td>
      <td
        className={`${TD} font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--ink-mute)] whitespace-nowrap`}
      >
        {row.format}
      </td>
      <td className={`${TD} text-right`}>
        <div className="font-mono text-[18px] font-semibold leading-none text-[color:var(--dim)]">
          {row.qty}
        </div>
        <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)]">
          {row.qtyLbl}
        </div>
      </td>
      <td className={`${TD} text-right`}>
        {mode.kind === "public" ? (
          <>
            {/* Stacked, not side by side: two 152px buttons in one line
                pushed the table past a 1440px viewport into horizontal
                scroll.  Row height is uniform anyway — every cell pins
                the stacked-pair height (see TD). */}
            <div className="flex flex-col items-end gap-1.5">
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
          <div className="flex flex-col items-end gap-1.5">
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
          <Link
            href={SIGNUP_HREF}
            className={`${BTN_BASE} ${BTN_SIGNUP_SIZE} ${BTN_PRIMARY}`}
          >
            {labelFor(row.kind)}
            <span className="font-mono">↓</span>
          </Link>
        )}
      </td>
    </tr>
  );
}
