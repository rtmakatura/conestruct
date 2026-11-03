"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Scenario } from "@/lib/scenarios";
import { bundleLabel, type AuditSummary } from "@/lib/render-types";
import type { PrimaryOwner } from "@/lib/results-primary";
import { stampMatches } from "@/lib/answer-stamp";
import { downloadSavedPart, extractValidationMessage } from "@/lib/download-error";
import type { DeviceBreakdownState } from "./DeviceBreakdown";
import { useRenderRequest, useWriteLock } from "./WriteLock";
import { planFilename } from "@/lib/download-name";

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
  /** #288 clause 3 — WHICH SURFACE owns the results area's one primary,
   *  from the single derivation (lib/results-primary.ts).  This row does
   *  not decide it: NEEDS YOU's count does, and both surfaces read the
   *  same answer so acceptance line 2 ("one primary per state") cannot be
   *  broken by the two disagreeing. */
  primary?: PrimaryOwner;
  /** #437 ruling 11 / D6: the questions not yet applied (unanswered plus
   *  answered-but-staged, `openQuestionCount`).  Above zero, the warning
   *  row says the files are the plan before those answers.  The files
   *  stay live either way (P8: disclose, don't lock). */
  pendingAnswers?: number;
  /** #437 ruling 13: the price quote's collapsed row, which joins the
   *  downloads as their last row.  The shell hands it in. */
  quote?: ReactNode;
}

const SIGNUP_HREF = "/app";

// Map a backend-pulled stat into a display value: the number once the
// breakdown is ready, otherwise null — the quantity line renders EMPTY
// (reserved height), never "…" or "—" (#261, P16 / Rule 10).  The error
// state is the card set's, not one stat's: `failed` below prints the
// honest word and withholds every download.  No TS-derived fallback.
function statFromBreakdown(
  breakdown: DeviceBreakdownState,
  pick: (data: { total_devices: number; unique_types: number }) => number,
): number | null {
  return breakdown.state === "ready" ? pick(breakdown.data) : null;
}

interface DlCardDef {
  title: string;
  /** #437 ruling 12: one plain line of what the file is for. */
  lead: string;
  format: string;
  /** The count's noun, singular and plural, and the words after it. */
  qtyLbl: readonly [string, string];
  qtyTail?: string;
  // Null: no quantity to state — the line renders empty (reserved
  // height, P1) and the label is omitted.
  qty: number | null;
  kind: RenderKind;
  // An optional second download offered on the same card (the crew card
  // offers the PDF as `kind` and the raw `.md` as `secondaryKind`).
  secondaryKind?: RenderKind;
  // The card's own reason to withhold its download (the audit card with
  // no settled audit).  Buttons only — a saved plan's row-backed anchors
  // point at a stored answer.
  unavailable?: boolean;
}

// #437 ruling 12: a single-file card's button reads "Download ↓"; the
// card's title and format tag already name the file.  The accessible
// name keeps the whole action (``soloAriaLabel``).
const LABELS: Record<RenderKind, string> = {
  pdf: "Download",
  xlsx: "Download",
  markdown: "Download",
  "crew-pdf": "Download",
  "audit-pdf": "Download",
};

// #329: a card offering two formats shares one row between two buttons
// (the crew card's PDF and .md); at desk width each is ~87 px, and the full
// "Download PDF" wrapped to two lines.  Those buttons say the format only,
// under the card's own title, and keep the whole action as their
// accessible name (``sharedAriaLabel``).
const SHARED_LABELS: Record<RenderKind, string> = {
  pdf: "PDF",
  xlsx: "XLSX",
  markdown: ".md",
  "crew-pdf": "PDF",
  "audit-pdf": "PDF",
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


export function OutputCards({
  summary,
  generated,
  declined = false,
  mode,
  breakdown,
  onDownloadAll,
  bundling,
  auditChecked = null,
  primary = "download-all",
  pendingAnswers = 0,
  quote = null,
}: Props) {
  const locked = useWriteLock(); // #252 (ruling b)
  // Rule 168 (R137 Q1, R145 self-ruled): at the phone width the four cards
  // sit closed behind the file-count line under the zip.  Closed by default.
  const [filesOpen, setFilesOpen] = useState(false);
  if (!generated) {
    // #289 hand-check, 2026-09-22, correction 4 — NO RESULTS ZONE BEFORE
    // GENERATE.  Part 1 §2.1 lists what S1 holds and then says what it
    // does not: "no results zone, no reference section, no quote, no
    // download empty-state panel, no intro paragraph.  The column is
    // three bands and a verdict."  This panel was the download
    // empty-state, and it rendered from load.
    //
    // It survives in exactly one state, and that state is S6: rule 120
    // puts "No package yet" under a refusal, because there a package was
    // asked for and refused, and the absence is an ANSWER.  Before
    // Generate nobody asked, so there is nothing to answer — and a
    // sentence explaining the flow ("describe the work zone → press
    // generate → …") is the intro paragraph §8.30 dropped, wearing a
    // dashed border.
    //
    // S4's placeholder (rule 117, "02 · RESULTS" + "No package yet — the
    // plan is being built.") is a DIFFERENT block with a different
    // sentence, and it belongs to the S4 commit.
    if (!declined) return null;
    return (
      <div className="empty-state">
        <span className="big">No package yet</span>
      </div>
    );
  }
  const cards: DlCardDef[] = [
    {
      title: "Plan sheet",
      lead: "The drawing for the crew and the permit.",
      format: "PDF",
      qtyLbl: ["device", "devices"],
      qty: statFromBreakdown(breakdown, (d) => d.total_devices),
      kind: "pdf",
    },
    {
      title: "Device list",
      lead: "What to load on the truck.",
      format: "XLSX",
      qtyLbl: ["type", "types"],
      // Repeats the card's old "CDOT BID-READY" claim in words (D5).
      qtyTail: ", CDOT bid items",
      qty: statFromBreakdown(breakdown, (d) => d.unique_types),
      kind: "xlsx",
    },
    {
      title: "Crew instructions",
      lead: "Setup and takedown, in order.",
      format: "PDF + MD",
      qtyLbl: ["step", "steps"],
      qty: summary?.step_count ?? null,
      kind: "crew-pdf",
      secondaryKind: "markdown",
    },
    // #261 (P11): the audit PDF wears the same card and button as every
    // other download — it was a mono text link inside a collapsed tier.
    // #401: in the zip (BUNDLE_PART_KINDS), so the count includes it.
    {
      title: "Audit trail",
      lead: "Every number and the rule behind it.",
      format: "PDF",
      qtyLbl: ["check", "checks"],
      qty: auditChecked,
      kind: "audit-pdf",
      unavailable: auditChecked === null,
    },
  ];
  // #288 clause 3 / Part 1 §8.29 — THE FILE COUNT, STATED ONCE.
  //
  // §8.29 dropped the next-steps strip and kept its rule: "the file count
  // is stated exactly once on the page".  Between f81daa6 (the strip's
  // removal) and this commit the count was stated ZERO times — recorded
  // as a gap in the arc README, not as a decision.  It lands here,
  // beside the control it describes, and it is counted from
  // BUNDLE_PART_KINDS — the zip's own parts (Rule 12: the number traces
  // to the thing it names, never to a literal).  #401: the zip holds every
  // card's file plus the quote, which no card offers, so the label names
  // it: "6 files, with the quote" (bundleLabel, lib/render-types.ts).
  const zipLabel = bundleLabel();
  const zipIsPrimary = primary === "download-all";
  // Rule 168 (R137 Q1): the phone hides the cards behind the file-count
  // line under the zip.  R145 self-ruled (phase4-380-arc/rulings.md): the
  // line is a disclosure that opens onto the cards.  It was ruled when the
  // crew PDF and the audit PDF were not bundle parts; since #401 they are,
  // and the disclosure stays, so each file can still be saved on its own.
  // Only where the zip renders: a saved plan has no zip, and its cards
  // stay.  At the desk the line is hidden by CSS and
  // the count stays beside the zip; at the phone the count beside the zip
  // is hidden and the line carries it, so it's stated once either way.
  const hasZip = mode.kind === "public" && Boolean(onDownloadAll);
  // #437 ruling 11 (D6): the warning row's sentence.  N is the
  // questions not yet applied; "your answer" for one (R145 G5).
  const warn =
    pendingAnswers > 0
      ? `These files match the plan before your ${
          pendingAnswers === 1 ? "answer" : `${pendingAnswers} answers`
        }. Answer first and they'll update.`
      : null;
  return (
    // #437 rulings 11-13: one block — the header (DOWNLOADS, the file
    // count, the zip), the warning row while answers are open, the four
    // cards, and the price quote's row last.
    <section className="dl-sec mb-3" aria-labelledby="downloads-h" data-testid="downloads">
      <div className="dl-head">
        <h3 id="downloads-h" className="tr-section dl-title">
          DOWNLOADS
        </h3>
        {/* The file count is stated ONCE per width (ruling 193): here at
            the desk, on the phone's file line below at ≤480.  It renders
            only where there is a zip to count. */}
        <p className="tr-note dl-head-count dl-all-count">{hasZip ? zipLabel : null}</p>
        {hasZip && (
          // Clause 3's derivation is unchanged: the zip is the PRIMARY
          // when nothing needs the operator, a ghost when something does.
          <div className={`dl-all${zipIsPrimary ? " is-primary" : ""}`}>
            <button
              type="button"
              data-write=""
              onClick={onDownloadAll}
              disabled={bundling || locked || auditChecked === null}
              className={zipIsPrimary ? "pri" : "act"}
            >
              Download all (.zip) <span className="font-mono">↓</span>
            </button>
          </div>
        )}
      </div>
      {warn !== null && (
        // Ruling 11: disclose, don't lock.  The buttons below stay live.
        <div className="dl-warn" data-testid="dl-warn">
          <span className="dl-warn-glyph sym-warn" aria-hidden="true">
            ⚠
          </span>
          <span className="tr-help">{warn}</span>
        </div>
      )}
      {hasZip && (
        <button
          type="button"
          className="dl-files tr-prov"
          data-read=""
          aria-expanded={filesOpen}
          aria-controls="dl-cards"
          onClick={() => setFilesOpen((o) => !o)}
        >
          <span>{zipLabel}</span>
          <span className="chev" aria-hidden="true">
            ›
          </span>
        </button>
      )}
      <div
        id="dl-cards"
        className={`dls${hasZip && !filesOpen ? " dl-phone-closed" : ""}`}
      >
        {cards.map((card) => (
          <DlCard
            key={card.kind}
            card={card}
            mode={mode}
            failed={breakdown.state === "error"}
          />
        ))}
      </div>
      {quote !== null ? <div className="dl-quote">{quote}</div> : null}
    </section>
  );
}

function DlCard({
  card,
  mode,
  failed,
}: {
  card: DlCardDef;
  mode: Mode;
  failed: boolean;
}) {
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
  // #203: a saved plan's error is stamped with the plan id and shows
  // while that plan is on screen unedited; an edit makes it dirty, which
  // disables the downloads, so the error dies on edit.
  const currentError =
    error === null
      ? null
      : mode.kind === "public"
        ? stampMatches([error.for], [mode.scenario])
          ? error
          : null
        : mode.planId !== null && error.for === mode.planId && !mode.dirty
          ? error
          : null;

  // A saved plan that goes dirty drops its error, so saving it again
  // (same id, clean) can't bring back an error about the old copy.
  const savedDirty = mode.kind === "saved" && mode.dirty === true;
  useEffect(() => {
    if (savedDirty) setError(null);
  }, [savedDirty]);

  const kinds: RenderKind[] = card.secondaryKind
    ? [card.kind, card.secondaryKind]
    : [card.kind];

  const shared = kinds.length > 1;
  const labelFor = (k: RenderKind) =>
    mode.kind === "saved" && !mode.planId
      ? SIGNUP_LABELS[k]
      : shared
        ? SHARED_LABELS[k]
        : LABELS[k];
  // #329: the short label's full action ("Download crew instructions
  // PDF"), which contains the visible text (WCAG 2.5.3).  Not while the
  // button reads "Try again": the name follows the visible label.
  // #437 ruling 12: every button's visible word is short ("Download",
  // "PDF", ".md"), so each keeps the whole action as its accessible name.
  const sharedAriaLabel = (k: RenderKind) =>
    currentError?.kind === k || (mode.kind === "saved" && !mode.planId)
      ? undefined
      : `Download ${card.title.toLowerCase()} ${SHARED_LABELS[k]}`;

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
      a.download = planFilename(mode.scenario, EXT[dlKind]); // #401
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

  // #203: the saved plan's row-backed download, fetched in the page so a
  // failure prints in the card instead of navigating the tab away.
  const onSavedDownload = async (dlKind: RenderKind) => {
    if (mode.kind !== "saved" || !mode.planId) return;
    const planId = mode.planId;
    setBusyKind(dlKind);
    setError(null);
    const endRender = beginRender(RENDER_LABELS[dlKind]);
    try {
      const msg = await downloadSavedPart(`/api/plans/${planId}/${dlKind}`, EXT[dlKind]);
      if (msg !== null) setError({ kind: dlKind, msg, for: planId });
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
            aria-label={sharedAriaLabel(k)}
            onClick={() => onPublicDownload(k)}
            disabled={busyKind !== null || locked || failed || card.unavailable === true}
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
              <button
                key={k}
                type="button"
                className="dl-btn"
                data-write=""
                aria-label={sharedAriaLabel(k)}
                disabled
              >
                {labelFor(k)}
                <span className="font-mono">↓</span>
              </button>
            ))
          : kinds.map((k) => (
              <button
                key={k}
                type="button"
                className="dl-btn"
                data-write=""
                // The route this button fetches (an anchor's href used
                // to carry it; tests and readers find the download by it).
                data-download={`/api/plans/${mode.planId}/${k}`}
                aria-label={sharedAriaLabel(k)}
                onClick={() => onSavedDownload(k)}
                disabled={busyKind !== null || locked || failed}
              >
                {currentError?.kind === k ? "Try again" : labelFor(k)}
                <span className="font-mono">↓</span>
              </button>
            ))
        : [
            <Link key={card.kind} href={SIGNUP_HREF} className="dl-btn">
              {labelFor(card.kind)}
              <span className="font-mono">↓</span>
            </Link>,
          ];

  // #203: a failed download prints here in both modes (the stamp above
  // already limits a saved plan's error to the unedited plan).
  const note = currentError ? (
    <div className="text-[12px] leading-snug text-[color:var(--fail)] font-sans">
      {currentError.msg}
    </div>
  ) : mode.kind === "saved" && mode.planId && mode.dirty ? (
    <div className="text-[12px] leading-snug text-[color:var(--ink-faint)] font-sans">
      Unsaved edits. Save to download the plan on screen. The saved copy
      no longer matches it.
    </div>
  ) : null;

  return (
    <div className="dl-card">
      <div className="top">
        {/* h4 under the block's h3 (axe heading-order, #261). */}
        <h4>{card.title}</h4>
        <span className="fmt">{card.format}</span>
      </div>
      {/* #437 ruling 12 / D5: what the file is for, then its count from
          the wire.  A count the wire has not given drops its sentence
          (Rule 10); a failed breakdown says so in words (P16). */}
      <p className="desc tr-note">
        {card.lead}
        {failed ? (
          " Not generated."
        ) : card.qty !== null ? (
          <>
            {" "}
            <b>{card.qty}</b> {card.qty === 1 ? card.qtyLbl[0] : card.qtyLbl[1]}
            {card.qtyTail ?? ""}.
          </>
        ) : null}
      </p>
      {/* #318 (R149): at the phone width an 11×17 sheet fits to ~1.8 px
          text (validation-artifacts/committed/issue-318-phone-drawings),
          so the Plan sheet card says how to read it.  Rendered on every
          width and shown only ≤480 px by CSS, so the desk card is
          unchanged; the button below stays one tap. */}
      {card.kind === "pdf" ? (
        <p className="dl-phone-note tr-prov" data-testid="dl-phone-note">
          This is an 11×17 drawing. Open it on a bigger screen or print it.
        </p>
      ) : null}
      {note}
      <div className="dl-actions">{actions}</div>
    </div>
  );
}
