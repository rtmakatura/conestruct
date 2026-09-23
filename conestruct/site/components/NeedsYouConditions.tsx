"use client";

// #288 Phase 1 clause 1 — THE CORRECTIONS BLOCK, MOVED INTO NEEDS YOU.
//
// Authority: validation-artifacts/committed/issue-288-results-stack/rulings.md
// (the Phase 1 finish ruling, clause 1) with Part 1 §8.5 and §8.25, and
// #281 comment 1 rules 74–79 and 133.
//
// This is a MOVE, not a rewrite.  Every predicate, every string and every
// write below came out of SetupStrip.tsx's `SiteCorrections` unchanged:
// the staging contract (#254), the dismiss picker's always-mounted note
// field (#255), the disabled-at-zero Apply with its reason on `title`
// (#254), the #227 resolved record with the backend sentence as ONE text
// node (#198), the spec-46 dismiss guard, the spec-34 held-scan
// behaviour, and the scan footer's sliced stamp (#251/#258).  "Disclose
// rather than lock" survives with them: the block never blocks a
// download, it only offers the correction.
//
// WHAT CHANGED, and it is these three things (Rule 5 — declared, not
// explained afterwards):
//
//   1. THE ROW SHAPE.  The #249 two-track ledger (`.sc-row`: ledger ·
//      action) becomes rule 74's three tracks — 20 px glyph /
//      minmax(0,1fr) body / auto action — because the rows are now item
//      rows of NEEDS YOU and rule 74 is what an item row is.  The
//      condition's name, its result word and its evidence keep their
//      words and their order; the elastic dotted leader goes, because a
//      leader that ran to a right-edge verdict column has no column to
//      run to once the verdict sits under the name (rule 75's provenance
//      line).  Every action keeps ONE right edge (rule 77) — that is what
//      the fixed auto track is for, here as there.
//
//   2. THE APPLY ROW'S ZERO-STATE SENTENCE GAINS ITS SECOND CLAUSE.
//      Rule 78 gives the zero state a two-clause standing sentence; the
//      strip printed the first clause only (`stagedSentence(0)`), so what
//      the rule asks for was half-present.  The second clause is appended
//      HERE rather than inside `stagedSentence`, because that helper is
//      also the results-head chip's suffix and changing it would put one
//      sentence in two voices (P2).
//
//      THE WORDS DIVERGE FROM THE RULE, DELIBERATELY.  Rule 78 writes the
//      first clause as "no changes staged"; this block says "no
//      corrections staged" — #254's noun, and the one the backend's
//      `corrections` wire field and `corrections_advisory` string use.
//      The built sentence is therefore
//        "no corrections staged · staging costs nothing, Apply re-generates once"
//      — rule 78's second clause verbatim, the codebase's noun in the
//      first.  Rule 78's "APPLY 0 CHANGES" label diverges the same way and
//      is likewise not adopted: the button reads "Apply 0 corrections".
//      Both divergences are recorded in rulings.md under "Where the build
//      DIVERGES from rule 78's words, and why", next to the rule's own
//      verbatim text — which is quoted into that file precisely so this
//      citation is checkable against the tracked record.
//
//      Consequence, stated rather than discovered: three assertions in
//      GeneratorShell.batch-corrections.test.tsx and two in this block's
//      own suite now read the FULL sentence, still by exact match — the
//      string got longer, it did not stop being exact.
//
//   3. THE TWO MANUAL KEYS JOIN, and they stage.  Part 1 §8.25 moves
//      "Site conditions you assert" into NEEDS YOU "as rows with an
//      ASSERT action".  They stage rather than write on click, because
//      rule 78 gives this block exactly one write and a key that wrote on
//      its own click would re-generate the plan while a staged set sat
//      unapplied beside it.  The pre-generate checkbox pair
//      (SiteConditionsField) is Phase 2's surface and is untouched.
//
// ONE THING THE MOVE DROPS, and it is a token not a fact: the footer's
// standalone "scan" label span and the dotted leader that separated it
// from the sentence.  The leader retired with the ledger (claim 6's
// --sc-leader), and a label whose whole content is the first word of the
// sentence beside it ("corridor scan · 4 sep · 12:00 utc · …") is a
// second voice for one fact (P2).  No value and no word left the page.
//
// The rows carry a citation (rule 76) naming the SOURCE of the fact —
// OPENSTREETMAP for a scanned bucket, OPERATOR for a correction or a
// manual assertion.  Nothing here invents a citation: those are the two
// tags section 03 already prints beside the same facts.

import { useRef, useState, type ReactNode } from "react";

import type { StagedFieldEdit } from "@/lib/scenarios/types";
import type { Scenario } from "@/lib/scenarios";
import type { SiteScanCorrection, SiteScanProvenance } from "@/lib/render-types";
import { SCAN_BUCKET_TO_FLAG, scanEvidence, type ScanBucketWire } from "@/lib/tiering";
import {
  DISMISS_REASONS,
  MANUAL_FLAGS,
  MANUAL_FLAG_LABELS,
  SCANNED_FLAG_LABELS,
  applyStaged,
  assertMarker,
  dismissAllowed,
  dismissIsComplete,
  dismissMarker,
  fmtScanDuration,
  fmtScanStamp,
  isFieldStaged,
  isManualStaged,
  isScannedFlag,
  stage,
  stagedEnumeration,
  stagedSentence,
  unstage,
} from "@/lib/scenarios/site-corrections";
import { applyStagedFields } from "@/lib/scenarios/what-writes";
import type {
  ManualSiteFlag,
  ScannedSiteFlag,
  SiteDismissReason,
  StagedCorrection,
} from "@/lib/scenarios/types";

export interface SiteConditionRowsProps {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  /** The scan the block reads — the STAMPED view when settled, the
   *  last-ready one while a re-generation is in flight (spec 34). */
  siteScan: SiteScanProvenance;
  /** Spec 34 (#249): a re-generation is in flight for the scenario on
   *  screen — every button in the block is disabled, the block stays
   *  mounted. */
  inFlight: boolean;
  /** #254: the SHELL-held staged set (one owner). */
  staged: StagedCorrection[];
  setStaged: (next: StagedCorrection[]) => void;
  /** #288 clause 3: does NEEDS YOU own the results area's one primary?
   *  Read from the single derivation, never decided here.  When it does
   *  not, Apply renders as a plain `.act` — the class itself is withheld
   *  rather than merely unstyled, so "carries is-on" and "renders as the
   *  primary" cannot drift apart (they did: the CSS was scoped to the
   *  owner while the markup emitted the class unconditionally, and a
   *  page-wide count of filled controls read 2 in a state that shows 1). */
  ownsPrimary?: boolean;
}

/** Does this scan give the block anything to render?  The same predicate
 *  the block itself applies, exported so NEEDS YOU can decide whether it
 *  has a body before it renders a header (Rule 10: an empty block would
 *  claim the plan was examined and found wanting).  Pure. */
export function hasConditionRows(siteScan: SiteScanProvenance | null): boolean {
  if (!siteScan) return false;
  const corrections = (siteScan.corrections ?? []).filter((c) => isScannedFlag(c.flag));
  if (corrections.length > 0) return true;
  if (siteScan.status !== "ok") return false;
  const buckets = (siteScan.buckets ?? {}) as Record<string, ScanBucketWire | undefined>;
  // A served scan with no KEYED bucket gives the block nothing — and the
  // two manual keys do not make a block on their own: they ride the
  // scanned rows (the same `rows.length === 0` gate the block applies).
  return SCAN_BUCKET_TO_FLAG.some(([bucket, flag]) => Boolean(buckets[bucket]) && isScannedFlag(flag));
}

export function SiteConditionRows({
  scenario,
  setScenario,
  siteScan,
  inFlight,
  staged,
  setStaged,
  ownsPrimary = true,
}: SiteConditionRowsProps) {
  // Which flag's dismiss reason picker is open, and its draft.
  const [dismissing, setDismissing] = useState<ScannedSiteFlag | null>(null);
  const [reason, setReason] = useState<SiteDismissReason | null>(null);
  const [note, setNote] = useState("");
  // #255: Confirm is enabled once a reason is chosen; an Other with an
  // empty note is answered AT the note on the click (focus, aria-invalid,
  // the required placeholder) — the button never moves, never dead.
  const [noteInvalid, setNoteInvalid] = useState(false);
  const noteRef = useRef<HTMLInputElement | null>(null);

  const buckets =
    siteScan.status === "ok"
      ? ((siteScan.buckets as Record<string, ScanBucketWire> | undefined) ?? {})
      : null;
  const corrections = (siteScan.corrections ?? []).filter((c) => isScannedFlag(c.flag));
  const byFlag = new Map<string, SiteScanCorrection>(corrections.map((c) => [c.flag, c]));
  // #289 S7: the staged list now also carries FIELD edits (ruling e —
  // one staging mechanism).  This block is about site conditions, so it
  // indexes the entries that have a flag and ignores the rest; APPLY
  // still carries the whole list, which is ruling 191's point.
  const stagedFor = new Map<string, Exclude<StagedCorrection, StagedFieldEdit>>(
    staged
      .filter((s): s is Exclude<StagedCorrection, StagedFieldEdit> => !isFieldStaged(s))
      .map((s) => [s.flag, s]),
  );
  if (buckets === null && corrections.length === 0) return null;

  // #254: every click on a row is an INTENT held in the shell; the one
  // scenario write is Apply (one request, one band cycle).  Undo on an
  // applied record stages a null marker; Undo on a staged row un-stages.
  const closePicker = () => {
    setDismissing(null);
    setReason(null);
    setNote("");
    setNoteInvalid(false);
  };
  const stageIntent = (entry: StagedCorrection) => {
    closePicker();
    setStaged(stage(staged, entry));
  };
  const undo = (flag: ScannedSiteFlag) => stageIntent({ flag, marker: null });
  const confirmDismiss = (flag: ScannedSiteFlag) => {
    if (reason === null) return;
    if (!dismissIsComplete(reason, note)) {
      // Other with an empty note: the click answers at the note (#255).
      setNoteInvalid(true);
      noteRef.current?.focus();
      return;
    }
    stageIntent({ flag, marker: dismissMarker(flag, reason, note) });
  };
  const assertFlag = (flag: ScannedSiteFlag) => stageIntent({ flag, marker: assertMarker(flag) });
  const applyAll = () => {
    if (staged.length === 0) return;
    closePicker();
    // #289 finding 2 — AND A DEFECT IT EXPOSED.  This Apply folded only
    // the corrections (`applyStaged` writes meta) and then cleared the
    // WHOLE list, so a field staged in S7 was silently dropped when the
    // operator applied from here.  Once the sentence below enumerates "1
    // field · 1 correction", a button that wrote only the correction
    // would be a promise it breaks.  So it folds both halves, through the
    // same two producers S7's APPLY uses (ruling e: "APPLY folds staged
    // fields and corrections into one write").
    const withFields = applyStagedFields(scenario, staged);
    setScenario({
      ...withFields,
      meta: applyStaged(withFields.meta, staged),
    } as Scenario);
    setStaged([]);
  };
  // The staged row's evidence cell: the intent in the vocabulary's words.
  const intentText = (s: StagedCorrection): string => {
    // A field edit never reaches a condition row; the guard is for the
    // type, and it names the value so a stray one would be legible
    // rather than a crash.
    if (isFieldStaged(s)) return `${s.label} → ${String(s.to)}`;
    if (isManualStaged(s)) return s.on ? "assert" : "undo";
    if (s.marker === null) return "undo";
    if (s.marker.action === "assert") return "assert";
    if (s.marker.reason === "other") return `dismiss · other — ${s.marker.note ?? ""}`;
    const r = DISMISS_REASONS.find((x) => x.v === s.marker!.reason);
    return `dismiss · ${(r?.l ?? s.marker.reason ?? "").toLowerCase()}`;
  };

  // Rule 74's item row, with the condition's words in rule 75's order:
  // the name on the body line, then the result word and the evidence the
  // wire carried on the provenance line.  Rule 76: the citation sits
  // above the action, and every action shares the auto track's right
  // edge (rule 77).
  const row = (
    key: string,
    cls: string,
    glyph: string,
    tone: string,
    label: string,
    word: string,
    evidence: string,
    cite: string,
    action: ReactNode,
  ) => (
    <li key={key} className={`ny-item ny-cond ${cls}`}>
      <span className={`ny-glyph tr-field ${tone}`} aria-hidden>
        {glyph}
      </span>
      <div className="ny-mid">
        <span className="ny-body tr-field sc-name">{label}</span>
        {/* The evidence span is ALWAYS present, empty when the wire
            carried none — the separator is what is conditional.  Same
            contract as the ledger it replaces, so "an absent row's
            evidence cell is EMPTY" stays a measurable claim. */}
        <p className="ny-prov tr-prov">
          <span className={`sc-result ${tone}`}>{word}</span>
          {evidence ? " · " : ""}
          <span className="sc-evidence">{evidence}</span>
        </p>
      </div>
      <div className="ny-right">
        <span className="ny-cite tr-step">{cite}</span>
        <span className="ny-acts">{action}</span>
      </div>
    </li>
  );

  const actBtn = (label: string, onClick: () => void, extra?: string) => (
    <button
      type="button"
      // Rule 133's .act.  The size rides .tr-step — rule 133 asks for
      // mono 9.5 px .14em uppercase, and #283's role table snaps that to
      // the 10 px step role, so this block declares no font-size and
      // adds no row to #263's census.
      className={`act tr-step${extra ? ` ${extra}` : ""}`}
      data-write=""
      disabled={inFlight}
      onClick={onClick}
    >
      {label}
    </button>
  );

  // The #227 resolved record as an item row: the backend's disclosure
  // sentence is the whole readout (spec 25/50 — no result word, no
  // evidence) and stays ONE text node (#198).
  const record = (c: SiteScanCorrection) => {
    const flag = c.flag as ScannedSiteFlag;
    const variant = c.status === "moot" ? "warn" : c.action === "dismiss" ? "dismissed" : "confirmed";
    const glyph = c.status === "moot" ? "⚠" : c.action === "dismiss" ? "×" : "✓";
    return (
      <li
        key={`corr-${flag}`}
        className={`ny-item ny-cond sc-record sys-event ${variant} site-correction`}
      >
        <span className="ny-glyph tr-field sys-glyph" aria-hidden>
          {glyph}
        </span>
        <div className="ny-mid">
          {/* #255: the clause alone — the advisory prints once in the
              footer.  ``disclosure`` (the whole sentence) is the wire
              before the split shipped; never a fabricated value. */}
          <span className="ny-body tr-field sc-disclosure">
            {c.record_clause ?? c.disclosure}
          </span>
        </div>
        <div className="ny-right">
          <span className="ny-cite tr-step">OPERATOR</span>
          <span className="ny-acts">{actBtn("Undo", () => undo(flag))}</span>
        </div>
      </li>
    );
  };

  // #254: a STAGED row — ◌ (--none) + the condition + "staged — not yet
  // applied" + the intent, Undo un-stages (no request).
  const stagedRow = (s: Exclude<StagedCorrection, StagedFieldEdit>) =>
    row(
      `staged-${s.flag}`,
      "sc-staged site-correction-staged",
      "◌",
      "sc-staged",
      isManualStaged(s)
        ? MANUAL_FLAG_LABELS[s.flag].label
        : SCANNED_FLAG_LABELS[s.flag],
      "staged — not yet applied",
      intentText(s),
      "OPERATOR",
      actBtn("Undo", () => setStaged(unstage(staged, s.flag))),
    );

  // Spec 46: only a detected row may enter the reason state.  Guarded
  // at the state transition (dismissAllowed reads the served bucket),
  // not by which button the view happened to draw.
  const openPicker = (flag: ScannedSiteFlag) => {
    if (!dismissAllowed(buckets, flag)) return;
    setDismissing(flag);
    setReason(null);
    setNote("");
    setNoteInvalid(false);
  };

  const rows: ReactNode[] = [];
  // ─── THE SUB-HEADER (Ryan's hand-check at f44377e, fix 4) ───
  //
  // The block's header count is ruling 185's SUM of ▲ + ⚠ — three, on the
  // pin the legs use.  Below it the block showed ten rows, because the
  // corrections block moved in whole (clause 1) and brought seven
  // condition rows with it.  A header reading "3" above ten rows is a
  // count that does not describe what is under it.
  //
  // Two ways to reconcile that were on the table.  This is the second,
  // and the reasoning is in rulings.md: a second numeral in the header
  // ("3 · 7 site conditions") is exactly what ruling 185 declined — "the
  // sum is the count, the decomposition is provenance" — and it would
  // put a number on the header that the header's own numeral does not
  // include.  A sub-header instead GROUPS the rows the count is not
  // about, so the count stays true of everything above the sub-header
  // and the condition rows keep the name they arrived with.
  //
  // The name is the corrections block's own, from §8.5 ("Site conditions
  // — scanned"): clause 1 dropped it when the block moved, and the ported
  // suite recorded that as churn at the time.  It comes back here, which
  // is where it belongs — a label for the rows it labels, not a header
  // for a block it no longer owns.
  rows.push(
    <li key="cond-head" className="ny-item ny-subhead">
      <span className="ny-glyph" aria-hidden />
      <div className="ny-mid">
        <span className="tr-section">Site conditions — scanned</span>
      </div>
    </li>,
  );
  if (buckets !== null) {
    for (const [bucketName, flagName] of SCAN_BUCKET_TO_FLAG) {
      const b = buckets[bucketName];
      // A bucket missing from the wire renders nothing (rule 10).
      if (!b || !isScannedFlag(flagName)) continue;
      const flag: ScannedSiteFlag = flagName;
      const st = stagedFor.get(flag);
      if (st) {
        rows.push(stagedRow(st));
        continue;
      }
      const c = byFlag.get(flag);
      if (c) {
        rows.push(record(c));
        continue;
      }
      const detected = b.detected === true;
      const label = SCANNED_FLAG_LABELS[flag];
      // Count + nearest only: details[0] leaves this surface (arc-20
      // ruling b); section 03 and the audit PDF keep the full string.
      // An absent row's evidence cell is EMPTY (GO ruling b: the wire
      // carries no scan radius, and the relevance thresholds are three
      // different tests — nothing is printed as one).
      const evidence = detected ? scanEvidence(b, { details: false, anchorSuffix: false }) : "";
      const open = dismissing === flag;
      rows.push(
        row(
          `row-${flag}`,
          "site-correction-row",
          detected ? "▲" : "✓",
          detected ? "sc-detected" : "sc-absent",
          label,
          detected ? "detected" : "none along the corridor",
          evidence,
          "OPENSTREETMAP",
          open
            ? actBtn("Cancel", closePicker)
            : detected
              ? actBtn("Dismiss", () => openPicker(flag))
              : actBtn("Assert", () => assertFlag(flag)),
        ),
      );
      if (open) {
        rows.push(
          <li key={`dismiss-${flag}`} className="ny-item ny-sub site-correction-picker">
            {/* #245: the reason is an in-DOM radio-chip group, never a
                native <select> — the UA's white field under the
                inherited light ink measured 1.54:1 and its popup renders
                outside the DOM where nothing measures it.  The chosen
                state is border + wash + ink + a ✓ glyph + the native
                :checked state (rule 13, never hue alone); no aria-pressed
                (a radio carries its own checked semantics).  The legend
                keeps the accessible name. */}
            <span className="ny-glyph" aria-hidden />
            <div className="ny-mid">
              <div className="sc-picker">
                <fieldset className="site-correction-reasons" role="radiogroup">
                  <legend>
                    Reason for dismissing <b className="sugg-name">{label}</b>
                  </legend>
                  {DISMISS_REASONS.map((r) => {
                    const chosen = reason === r.v;
                    return (
                      <label key={r.v} className={`reason-chip${chosen ? " chosen" : ""}`}>
                        <input
                          type="radio"
                          name={`dismiss-reason-${flag}`}
                          data-write=""
                          disabled={inFlight}
                          value={r.v}
                          checked={chosen}
                          onChange={() => {
                            setReason(r.v);
                            setNoteInvalid(false);
                          }}
                        />
                        <span className="reason-glyph" aria-hidden>
                          {chosen ? "✓" : ""}
                        </span>
                        <span className="reason-text">{r.l}</span>
                      </label>
                    );
                  })}
                </fieldset>
                {/* #255 (P1): the note slot is ALWAYS mounted — a fixed
                    reservation in the flex line, void (hidden, disabled,
                    out of the tree and the Tab order) until the reason is
                    Other — so choosing Other never moves Confirm.
                    Validated on the Confirm click, not by disabling. */}
                <input
                  ref={noteRef}
                  type="text"
                  className={`site-correction-note${reason === "other" ? "" : " is-void"}`}
                  data-write=""
                  disabled={inFlight || reason !== "other"}
                  aria-hidden={reason === "other" ? undefined : true}
                  tabIndex={reason === "other" ? undefined : -1}
                  aria-label="Say what"
                  aria-invalid={noteInvalid || undefined}
                  maxLength={200}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setNoteInvalid(false);
                  }}
                  placeholder={noteInvalid ? "say what — required" : "say what"}
                />
              </div>
            </div>
            {/* #270: Confirm is the sub-row's ACTION cell — the right
                edge every Dismiss / Assert / Undo / Apply shares — never
                an item of the wrapping line above, so its place and the
                row's height do not depend on the legend's length. */}
            <div className="ny-right">
              <span className="ny-acts">
                <button
                  type="button"
                  className={`act tr-step${ownsPrimary ? " is-on" : ""}`}
                  data-write=""
                  disabled={inFlight || reason === null}
                  title={reason === null ? "choose a reason" : undefined}
                  onClick={() => confirmDismiss(flag)}
                >
                  Confirm dismiss
                </button>
              </span>
            </div>
          </li>,
        );
      }
    }
  } else {
    // No ok scan (a proceeded outage): only the records, with undo.
    for (const c of corrections) {
      const st = stagedFor.get(c.flag);
      rows.push(st ? stagedRow(st) : record(c));
    }
  }
  if (rows.length === 0) return null;

  // Part 1 §8.25 — the two keys no scan can see, as rows with an ASSERT
  // action.  Their standing description is the provenance line (it is
  // what the retired checkbox printed under the label), and the wire
  // carries no evidence for them, so none is invented (rule 10).
  const manualFlags = scenario.meta.siteConditions ?? {};
  for (const flag of MANUAL_FLAGS) {
    const st = stagedFor.get(flag);
    if (st) {
      rows.push(stagedRow(st));
      continue;
    }
    const on = manualFlags[flag] === true;
    rows.push(
      row(
        `manual-${flag}`,
        "site-condition-manual",
        on ? "✓" : "◌",
        // A distinct tone class, not the staged one: `.sc-staged` is the
        // STAGED-row marker every staging assertion counts, and reusing
        // it for an unasserted manual key made four of them where there
        // were none.  Caught by the shell's own staging suite.
        on ? "sc-absent" : "sc-unset",
        MANUAL_FLAG_LABELS[flag].label,
        on ? "asserted by you" : "not asserted",
        MANUAL_FLAG_LABELS[flag].desc,
        "OPERATOR",
        on
          ? actBtn("Undo", () => stageIntent({ flag, on: false } as StagedCorrection))
          : actBtn("Assert", () => stageIntent({ flag, on: true } as StagedCorrection)),
      ),
    );
  }

  // Rule 78 — the Apply row, ALWAYS present post-scan, as the last data
  // line: the standing sentence ("no corrections staged" / "N staged ·
  // not yet applied"), then the block's one write, disabled at zero with
  // the reason on its title, disabled under the lock like every write.
  const n = staged.length;
  rows.push(
    <li key="apply" className="ny-item ny-apply sc-apply">
      <span className="ny-glyph" aria-hidden />
      <div className="ny-mid">
        <span className="sc-apply-text tr-prov">
          {/* #289 finding 2: the list, not the count — "1 field", "1
              correction", "1 field · 1 correction". */}
          {stagedSentence(staged)}
          {n === 0 ? " · staging costs nothing, Apply re-generates once" : ""}
        </span>
      </div>
      <div className="ny-right">
        <span className="ny-acts">
          {/* Ruling 182 + clause 3: Apply is this block's write, and it
              wears the filled "recommended action" treatment only while
              NEEDS YOU OWNS the primary.  The owner is the block's
              `.owns-primary` class (set from the one derivation), so the
              filled pair is scoped in CSS rather than decided again
              here — two surfaces reading one answer, not two deciding
              it.  At count 0 the zip is the page's primary and this
              button is a plain .act, so no state shows two. */}
          <button
            type="button"
            className={`act tr-step${ownsPrimary ? " is-on" : ""}`}
            data-write=""
            disabled={inFlight || n === 0}
            title={n === 0 ? "stage a correction first" : undefined}
            onClick={applyAll}
          >
            {/* Finding 2: the button names what it writes, from the
                same producer as the sentence beside it.  At zero it
                keeps its recorded label (rule 78's divergence above). */}
            {n === 0 ? "Apply 0 corrections" : `Apply ${stagedEnumeration(staged)}`}
          </button>
        </span>
      </div>
    </li>,
  );

  // The scan's own provenance, moved with the block (spec 61–65): mode,
  // the stamp as day · hh:mm utc by pure slicing of the ISO measured_at
  // (fmtScanStamp: no clock, no arithmetic) with the full ISO on the
  // <time> for copy and audit, then the duration and "memoised".
  const stamp = siteScan.measured_at ?? null;
  const duration = fmtScanDuration(siteScan.duration_ms);
  rows.push(
    <li key="foot" className="ny-item ny-foot sc-foot">
      <span className="ny-glyph" aria-hidden />
      <div className="ny-mid">
        <span className="sc-foot-text tr-prov">
          {siteScan.mode ? `${siteScan.mode} scan` : "site scan"}
          {stamp ? " · " : ""}
          {stamp ? (
            <time className="sc-time" dateTime={stamp} title={stamp}>
              {fmtScanStamp(stamp)}
            </time>
          ) : null}
          {duration ? ` · ${duration}` : ""}
          {siteScan.memo_hit === true ? " · memoised" : ""}
          {" · apply re-generates the plan"}
        </span>
        {/* #255: the backend's verify advisory ONCE per plan.  Absent on
            the wire = absent here (rule 10). */}
        {typeof siteScan.corrections_advisory === "string" && siteScan.corrections_advisory ? (
          <span className="sc-foot-advisory tr-prov">{siteScan.corrections_advisory}</span>
        ) : null}
      </div>
    </li>,
  );

  return <>{rows}</>;
}
