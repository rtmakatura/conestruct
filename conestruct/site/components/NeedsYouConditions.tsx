"use client";

// NEEDS YOU's site-condition rows that are NOT questions, and the
// "other conditions" row under the block.
//
// History: #288 clause 1 moved the corrections block here from the setup
// strip; R96 C / R99 classified its rows once (lib/needs-you-conditions.ts).
//
// #437 (UX group 2, Option B; rulings.md rulings 3, 8 and S5) — DECLARED
// BEHAVIOUR CHANGE (Rule 5):
//   · A detected scanned condition is no longer a row with Dismiss and a
//     reason picker.  It is a yes/no question (components/
//     NeedsYouQuestion.tsx), so the picker, its reason chips and its note
//     field leave this file.
//   · What stays here is every LISTED row that is not a question: an
//     applied assert on a condition the scan found none of, a staged
//     intent on one, and an asserted (or staged) manual key.  Each is a
//     one-line record with Undo (P15).
//   · The none-found rows and the unasserted manual keys fold into ruling
//     8's one row, "✓ N other conditions checked. Nothing else needs
//     you." with "Show them", which replaces "✓ 3 none found · ◌ 2 not
//     asserted · SHOW 5".  Their Assert actions are unchanged inside it.
//   · The Apply row and the scan footer leave (ruling 6, D9): Apply is the
//     question card's last button, and the scan time and duration moved
//     into each question's Details (ruling 7).
// Every write still stages through the shell's one list (#254).

import { useState, type ReactNode } from "react";

import type { Scenario } from "@/lib/scenarios";
import type {
  SiteAdjustmentRecord,
  SiteScanCorrection,
  SiteScanProvenance,
} from "@/lib/render-types";
import { TIER_WORDS } from "@/lib/needs-you";
import { siteAdjustmentCounts } from "@/lib/needs-you-items";
import { conditionRows, isListed, type ConditionRow } from "@/lib/needs-you-conditions";
import { symClass } from "@/lib/design/symbols";
import { SCAN_BUCKET_TO_FLAG, type ScanBucketWire } from "@/lib/tiering";
import {
  DISMISS_REASONS,
  MANUAL_FLAG_LABELS,
  SCANNED_FLAG_LABELS,
  assertMarker,
  isAckStaged,
  isFieldStaged,
  isManualStaged,
  isScannedFlag,
  stage,
  unstage,
  type FlagStaged,
} from "@/lib/scenarios/site-corrections";
import type { ManualSiteFlag, ScannedSiteFlag, StagedCorrection } from "@/lib/scenarios/types";

/** Does this scan give NEEDS YOU any condition to show?  Pure; the shell
 *  reads it before it classifies (Rule 10: no scan, no rows). */
export function hasConditionRows(siteScan: SiteScanProvenance | null): boolean {
  if (!siteScan) return false;
  const corrections = (siteScan.corrections ?? []).filter((c) => isScannedFlag(c.flag));
  if (corrections.length > 0) return true;
  if (siteScan.status !== "ok") return false;
  const buckets = (siteScan.buckets ?? {}) as Record<string, ScanBucketWire | undefined>;
  return SCAN_BUCKET_TO_FLAG.some(([bucket, flag]) => Boolean(buckets[bucket]) && isScannedFlag(flag));
}

interface RowsProps {
  scenario: Scenario;
  siteScan: SiteScanProvenance;
  inFlight: boolean;
  staged: StagedCorrection[];
  setStaged: (next: StagedCorrection[]) => void;
  /** The plan's site adjustments, merged into the row of the same flag. */
  adjustments?: SiteAdjustmentRecord[];
  /** The flags the question flow owns; their rows render there. */
  questionFlags: ReadonlySet<string>;
}

/** The staged intent in words, for a staged record's line. */
function intentText(s: StagedCorrection): string {
  if (isFieldStaged(s)) return `${s.label} → ${String(s.to)}`;
  if (isAckStaged(s)) return s.set ? "acknowledge" : "withdraw";
  if (isManualStaged(s)) return s.on ? "assert" : "undo";
  if (s.marker === null) return "undo";
  if (s.marker.action === "assert") return "assert";
  if (s.marker.action === "confirm") return "confirm";
  if (s.marker.reason === "other") return `dismiss: other (${s.marker.note ?? ""})`;
  const r = DISMISS_REASONS.find((x) => x.v === s.marker!.reason);
  return `dismiss: ${(r?.l ?? s.marker.reason ?? "").toLowerCase()}`;
}

function labelFor(flag: string): string {
  return isScannedFlag(flag)
    ? SCANNED_FLAG_LABELS[flag as ScannedSiteFlag]
    : (MANUAL_FLAG_LABELS[flag as ManualSiteFlag]?.label ?? flag);
}

function useRowParts(adjustments: SiteAdjustmentRecord[] | undefined) {
  const adjFor = new Map((adjustments ?? []).map((r) => [r.flag, r] as const));
  const adjLine = (flag: string): string | undefined => {
    const rec = adjFor.get(flag);
    if (!rec) return undefined;
    const counts = siteAdjustmentCounts(rec);
    return counts ? `${TIER_WORDS.changed} · ${counts}` : "no devices added";
  };
  const adjCite = (flag: string, base: string): string => {
    const cite = adjFor.get(flag)?.citation;
    return cite ? `${cite} · ${base}` : base;
  };
  return { adjLine, adjCite };
}

function row(
  key: string,
  cls: string,
  glyph: string,
  tone: string,
  label: string,
  word: string,
  evidence: string,
  cite: string,
  action: ReactNode,
  extra?: string,
) {
  return (
    <li key={key} className={`ny-item ny-cond ${cls}`}>
      <span className={`ny-glyph tr-field ${tone}`} aria-hidden>
        {glyph}
      </span>
      <div className="ny-mid">
        <span className="ny-body sc-name">{label}</span>
        <p className="ny-prov tr-note">
          <span className={`sc-result ${tone}`}>{word}</span>
          {evidence ? " · " : ""}
          <span className="sc-evidence">{evidence}</span>
        </p>
        {extra ? <p className="ny-prov tr-note sc-adjustment">{extra}</p> : null}
      </div>
      <div className="ny-right">
        <span className="ny-cite">{cite}</span>
        <span className="ny-acts">{action}</span>
      </div>
    </li>
  );
}

function actBtn(label: string, onClick: () => void, inFlight: boolean) {
  return (
    <button
      type="button"
      className="act tr-step"
      data-write=""
      disabled={inFlight}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

/** The listed rows the question flow does not own, as records with Undo. */
export function SiteConditionRows({
  scenario,
  siteScan,
  inFlight,
  staged,
  setStaged,
  adjustments,
  questionFlags,
}: RowsProps) {
  const { adjLine, adjCite } = useRowParts(adjustments);
  const all = conditionRows(siteScan, staged, scenario.meta.siteConditions ?? {});
  const listed = all.filter((r) => isListed(r) && !questionFlags.has(r.flag));
  if (listed.length === 0) return null;
  const stageIntent = (entry: StagedCorrection) => setStaged(stage(staged, entry));

  const record = (c: SiteScanCorrection) => {
    const flag = c.flag as ScannedSiteFlag;
    const variant = c.status === "moot" ? "warn" : c.action === "dismiss" ? "dismissed" : "confirmed";
    const glyph = c.status === "moot" ? "⚠" : c.action === "dismiss" ? "×" : "✓";
    return (
      <li key={`corr-${flag}`} className={`ny-item ny-cond sc-record sys-event ${variant} site-correction`}>
        <span className="ny-glyph tr-field sys-glyph" aria-hidden>
          {glyph}
        </span>
        <div className="ny-mid">
          {/* #198: the backend's sentence, one text node. */}
          <span className="ny-body sc-disclosure">{c.record_clause ?? c.disclosure}</span>
          {adjLine(flag) ? <p className="ny-prov tr-note sc-adjustment">{adjLine(flag)}</p> : null}
        </div>
        <div className="ny-right">
          <span className="ny-cite">{adjCite(flag, "OPERATOR")}</span>
          <span className="ny-acts">
            {actBtn("Undo", () => stageIntent({ flag, marker: null }), inFlight)}
          </span>
        </div>
      </li>
    );
  };
  const stagedRow = (s: FlagStaged) =>
    row(
      `staged-${s.flag}`,
      "sc-staged site-correction-staged",
      "◌",
      "sc-staged",
      labelFor(s.flag),
      "staged, not yet applied",
      intentText(s),
      adjCite(s.flag, "OPERATOR"),
      actBtn("Undo", () => setStaged(unstage(staged, s.flag)), inFlight),
      adjLine(s.flag),
    );
  const render = (r: ConditionRow): ReactNode => {
    switch (r.kind) {
      case "staged":
        return stagedRow(r.staged);
      case "record":
        return record(r.correction);
      case "manual-on":
        return row(
          `manual-${r.flag}`,
          "site-condition-manual",
          "✓",
          "sc-absent",
          labelFor(r.flag),
          "asserted by you",
          MANUAL_FLAG_LABELS[r.flag as ManualSiteFlag].desc,
          adjCite(r.flag, "OPERATOR"),
          actBtn(
            "Undo",
            () => stageIntent({ flag: r.flag, on: false } as StagedCorrection),
            inFlight,
          ),
          adjLine(r.flag),
        );
      default:
        return null;
    }
  };
  return <>{listed.map(render)}</>;
}

/** Ruling 8: the conditions that need nothing, folded into one row.  The
 *  count is the folded rows (none found + not asserted, D8); "Show them"
 *  opens them with their Assert actions unchanged. */
export function OtherConditions({
  scenario,
  siteScan,
  inFlight,
  staged,
  setStaged,
  adjustments,
  nothingElse,
}: Omit<RowsProps, "questionFlags"> & {
  /** Rule 10: "Nothing else needs you." only when that is true. */
  nothingElse: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { adjLine, adjCite } = useRowParts(adjustments);
  const all = conditionRows(siteScan, staged, scenario.meta.siteConditions ?? {});
  const folded = all.filter((r) => !isListed(r));
  if (folded.length === 0) return null;
  const n = folded.length;
  const render = (r: ConditionRow): ReactNode => {
    if (r.kind === "absent") {
      const flag = r.flag as ScannedSiteFlag;
      return row(
        `row-${flag}`,
        "site-correction-row",
        "✓",
        "sc-absent",
        SCANNED_FLAG_LABELS[flag],
        "none along the corridor",
        "",
        adjCite(flag, "OPENSTREETMAP"),
        actBtn("Assert", () => setStaged(stage(staged, { flag, marker: assertMarker(flag) })), inFlight),
        adjLine(flag),
      );
    }
    if (r.kind === "manual-off") {
      return row(
        `manual-${r.flag}`,
        "site-condition-manual",
        "◌",
        "sc-unset",
        labelFor(r.flag),
        "not asserted",
        MANUAL_FLAG_LABELS[r.flag as ManualSiteFlag].desc,
        adjCite(r.flag, "OPERATOR"),
        actBtn(
          "Assert",
          () => setStaged(stage(staged, { flag: r.flag, on: true } as StagedCorrection)),
          inFlight,
        ),
        adjLine(r.flag),
      );
    }
    return null;
  };
  return (
    <section className="ny-other" aria-label="Other conditions checked">
      <div className="ny-other-row">
        <span className={`ny-other-glyph ${symClass("✓")}`} aria-hidden>
          ✓
        </span>
        <span className="ny-other-text tr-help">
          {n} other condition{n === 1 ? "" : "s"} checked.
          {nothingElse ? " Nothing else needs you." : ""}
        </span>
        {/* A read: it stays live under the write lock (P13). */}
        <button
          type="button"
          className="ny-other-toggle"
          data-read=""
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Hide them" : "Show them"}
        </button>
      </div>
      {open ? <ul className="ny-items ny-other-rows">{folded.map(render)}</ul> : null}
    </section>
  );
}
