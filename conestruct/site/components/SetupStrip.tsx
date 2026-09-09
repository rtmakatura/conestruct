"use client";

// Generator restage (Endeavor A) — Zone 1's slim post-generation
// presentation.  One cell per scenario fact.  The edit split is the
// design's contract (4-states §"Zone 1 strip edit split"):
//   * SIMPLE values (speed, lane width, work-zone length, date, hours)
//     edit inline and recompute immediately — the shell already
//     refetches breakdown + audit on every scenario change.
//   * STRUCTURAL values (scenario kind, road type, location) reopen the
//     full setup panel — they gate which form renders.
// Presentation only: every edit writes the same Scenario fields the
// full panel writes; no new state shape, no new requests.

import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { SCENARIO_KINDS, type RoadType, type Scenario } from "@/lib/scenarios";
import type { SiteScanCorrection, SiteScanProvenance } from "@/lib/render-types";
import { SCAN_BUCKET_TO_FLAG, scanEvidence, type ScanBucketWire } from "@/lib/tiering";
import {
  DISMISS_REASONS,
  SCANNED_FLAG_LABELS,
  SITE_CORRECTIONS_ANCHOR,
  assertMarker,
  dismissAllowed,
  dismissIsComplete,
  dismissMarker,
  fmtScanDuration,
  fmtScanStamp,
  isScannedFlag,
  withSiteCorrection,
  withoutSiteCorrection,
} from "@/lib/scenarios/site-corrections";
import type { ScannedSiteFlag, SiteDismissReason } from "@/lib/scenarios/types";
import {
  hhmm,
  JURISDICTION_OPTIONS,
  type JurisdictionBlock,
  type StreetClass,
} from "@/lib/jurisdiction";
import { useWriteLock } from "./WriteLock";

const STREET_CLASS_LABEL: Record<StreetClass, string> = {
  local: "Local",
  collector: "Collector",
  arterial: "Arterial",
};

const STREET_CLASSES: StreetClass[] = ["local", "collector", "arterial"];

const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  rural_undivided: "Rural — undivided",
  rural_divided: "Rural — divided",
  urban_arterial: "Urban arterial",
  freeway: "Freeway / interstate",
};

// Per-kind posted-speed ceiling — mirrors the full panel's slider
// bounds (ShoulderForm 25–75, FlaggerForm 25–55).  The strip must not
// offer a speed the panel itself refuses.
const SPEED_MAX: Partial<Record<Scenario["kind"], number>> = {
  shoulder: 75,
  flagger_lane_closure: 55,
};

const HALF_HOURS = Array.from({ length: 48 }, (_, i) => i * 0.5);

// #193: Simple/Structural live at module level ON PURPOSE.  As inner
// components they were re-created every render, so React remounted
// every cell on every keystroke — which detached the focused node
// (masked by autoFocus refiring) and made any focus restore target a
// dead button.  Stable identity keeps cells (and the caret) alive
// across scenario writes.
function Simple({
  id,
  k,
  val,
  edit,
  open,
  cellRefs,
  children,
}: {
  id: string;
  k: string;
  val: ReactNode;
  edit: string | null;
  open: (id: string) => void;
  cellRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  children: ReactNode;
}) {
  // #252: an opener leads to a write; under the lock it is one.  It
  // locks as ``aria-disabled`` (inert, dimmed by the same rule) rather
  // than ``disabled`` so it stays FOCUSABLE: an editor that commits
  // under the lock hands focus back to its opener (the effect below),
  // and a disabled button cannot take it (#193's failure class).
  const locked = useWriteLock();
  return edit === id ? (
    <div className="sv-editor">{children}</div>
  ) : (
    <button
      type="button"
      ref={(el) => {
        cellRefs.current[id] = el;
      }}
      className="sv"
      data-write=""
      aria-disabled={locked || undefined}
      onClick={() => {
        if (!locked) open(id);
      }}
      aria-label={`Edit ${k}`}
    >
      <span className="k">{k}</span>
      <span className="val">{val}</span>
      <span className="edit-ic" aria-hidden>
        ✎
      </span>
    </button>
  );
}

function Structural({
  k,
  val,
  onReopen,
}: {
  k: string;
  val: ReactNode;
  onReopen: () => void;
}) {
  const locked = useWriteLock();
  return (
    <button
      type="button"
      className="sv structural"
      data-write=""
      aria-disabled={locked || undefined}
      onClick={() => {
        if (!locked) onReopen();
      }}
      title="Reopen full setup to change"
      aria-label={`${k} — reopen full setup to change`}
    >
      <span className="k">{k}</span>
      <span className="val">{val}</span>
      <span className="edit-ic" aria-hidden>
        ⤢
      </span>
    </button>
  );
}

function kindLabel(kind: Scenario["kind"]): string {
  return SCENARIO_KINDS.find((k) => k.v === kind)?.l ?? kind;
}

function fmtWorkDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// #224 phase 4 (s2-arc18, ruling a) — "Site conditions — scanned": the
// post-generate home for operator corrections.  Five read-only rows from
// the SERVED scan (sections.site_scan.buckets, the stamped view), each
// with one explicit action: Dismiss on a detected row (reason required),
// Assert on an absent row.  A click writes meta.siteConditionOverrides —
// an explicit operator action (suggest-never-set), and a scenario edit,
// so the wire scenario re-derives and both fetches refire: the plan
// re-generates, the results zone reads VERIFYING meanwhile.  A corrected
// row re-renders in place as the #227 resolved record (✓ / × + the
// backend's disclosure sentence as ONE text node + Undo); undo removes
// the marker (#179 shape) and re-generates the same way.  Section 03
// discloses, never writes.
// #248 (s2-arc20) made the block a grid; #249 (s2-arc21) re-laid it as
// the variation-4 ledger — two tracks (ledger · action), one row per
// condition, the open picker exactly one extra row, the record a row in
// the same tracks, a footer that reads as the ledger's last line.
// ---------------------------------------------------------------------------

interface SiteCorrectionsProps {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  siteScan: SiteScanProvenance;
  /** Spec 34 (#249): a re-generation is in flight for the scenario on
   *  screen — every button in the block is disabled (any correction
   *  re-generates the whole plan), the block stays mounted. */
  inFlight: boolean;
}

function SiteCorrections({ scenario, setScenario, siteScan, inFlight }: SiteCorrectionsProps) {
  // Which flag's dismiss reason picker is open, and its draft.
  const [dismissing, setDismissing] = useState<ScannedSiteFlag | null>(null);
  const [reason, setReason] = useState<SiteDismissReason | null>(null);
  const [note, setNote] = useState("");

  const buckets =
    siteScan.status === "ok"
      ? ((siteScan.buckets as Record<string, ScanBucketWire> | undefined) ?? {})
      : null;
  const corrections = (siteScan.corrections ?? []).filter((c) => isScannedFlag(c.flag));
  const byFlag = new Map<string, SiteScanCorrection>(corrections.map((c) => [c.flag, c]));
  if (buckets === null && corrections.length === 0) return null;

  const write = (meta: Scenario["meta"]) => {
    setDismissing(null);
    setReason(null);
    setNote("");
    setScenario({ ...scenario, meta } as Scenario);
  };
  const undo = (flag: ScannedSiteFlag) => write(withoutSiteCorrection(scenario.meta, flag));
  const confirmDismiss = (flag: ScannedSiteFlag) => {
    if (reason === null || !dismissIsComplete(reason, note)) return;
    write(withSiteCorrection(scenario.meta, dismissMarker(flag, reason, note)));
  };
  const assertFlag = (flag: ScannedSiteFlag) =>
    write(withSiteCorrection(scenario.meta, assertMarker(flag)));

  // #249 (s2-arc21) — the variation-4 ledger.  One grid, two tracks
  // (ledger · action).  Column 1 is a flex line — the state symbol, the
  // condition name, an elastic dotted leader, then the right group
  // (result word + evidence) — so the verdict column is scannable down
  // the left edge (spec K77) and the action column shares one right
  // edge in every state.  Glyph + word in every state (rule 13); the
  // words trace to the audit PDF's Result column
  // (src/rendering/audit_blocks.py _site_scan_ok_blocks).  The detected
  // hue is --dim — the tier set's "changed this plan" mark, already ▲
  // in section 03 (GO ruling a; the spec's #e0a63c is off-palette); the
  // none word is body ink, not green (spec 24 / K78).  The issue's ●/○
  // are not in the reconciled vocabulary (◌ means unevaluated).
  const lead = (glyph: string, tone: string, label: string, word: string, evidence: string) => (
    <div className="sc-lead">
      <span className={`sc-glyph ${tone}`} aria-hidden>
        {glyph}
      </span>
      <span className="sc-name tr-field">{label}</span>
      <span className="sc-leader" aria-hidden />
      <span className="sc-right">
        <span className={`sc-result ${tone}`}>{word}</span>
        <span className="sc-evidence">{evidence}</span>
      </span>
    </div>
  );

  // The #227 resolved record as a ledger row: the row IS the system-
  // event container (state changes reuse the container they replace,
  // PDF p.4) — left rule + glyph by state (the vocabulary's colors, not
  // the spec's flat gray: spec 48 deviation, recorded); the backend's
  // disclosure sentence is the whole readout (spec 25/50 — no result
  // word, no evidence) and stays ONE text node (#198).
  const record = (c: SiteScanCorrection) => {
    const flag = c.flag as ScannedSiteFlag;
    const variant = c.status === "moot" ? "warn" : c.action === "dismiss" ? "dismissed" : "confirmed";
    const glyph = c.status === "moot" ? "⚠" : c.action === "dismiss" ? "×" : "✓";
    return (
      <div key={`corr-${flag}`} className={`sc-row sc-record sys-event ${variant} site-correction`}>
        <div className="sc-lead">
          <span className="sys-glyph" aria-hidden>
            {glyph}
          </span>
          <span className="sc-disclosure">{c.disclosure}</span>
        </div>
        <span className="sc-action">
          <button type="button" className="ghost sc-text-btn" data-write="" disabled={inFlight} onClick={() => undo(flag)}>
            Undo
          </button>
        </span>
      </div>
    );
  };

  const closePicker = () => {
    setDismissing(null);
    setReason(null);
    setNote("");
  };
  // Spec 46: only a detected row may enter the reason state.  Guarded
  // at the state transition (dismissAllowed reads the served bucket),
  // not by which button the view happened to draw.
  const openPicker = (flag: ScannedSiteFlag) => {
    if (!dismissAllowed(buckets, flag)) return;
    setDismissing(flag);
    setReason(null);
    setNote("");
  };

  const rows: ReactNode[] = [];
  if (buckets !== null) {
    for (const [bucketName, flagName] of SCAN_BUCKET_TO_FLAG) {
      const b = buckets[bucketName];
      // A bucket missing from the wire renders nothing (rule 10).
      if (!b || !isScannedFlag(flagName)) continue;
      const flag: ScannedSiteFlag = flagName;
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
        <div key={`row-${flag}`} className="sc-row site-correction-row">
          {detected
            ? lead("▲", "sc-detected", label, "detected", evidence)
            : lead("✓", "sc-absent", label, "none along the corridor", "")}
          <span className="sc-action">
            {open ? (
              <button type="button" className="ghost sc-text-btn" data-write="" disabled={inFlight} onClick={closePicker}>
                Cancel
              </button>
            ) : detected ? (
              <button type="button" className="ghost" data-write="" disabled={inFlight} onClick={() => openPicker(flag)}>
                Dismiss
              </button>
            ) : (
              <button type="button" className="ghost" data-write="" disabled={inFlight} onClick={() => assertFlag(flag)}>
                Assert
              </button>
            )}
          </span>
        </div>,
      );
      if (open) {
        rows.push(
          <div key={`dismiss-${flag}`} className="sc-row sc-sub site-correction-picker">
            {/* #245: the reason is an in-DOM radio-chip group, never a
                native <select> — the UA's white field under the
                inherited light ink measured 1.54:1 and its popup renders
                outside the DOM where nothing measures it.  The chosen
                state is border + wash + ink + a ✓ glyph + the native
                :checked state (rule 13, never hue alone); no aria-pressed
                (a radio carries its own checked semantics).  The legend
                keeps the accessible name.
                #249: exactly one extra grid row spanning both tracks —
                legend, chips (+ the note), then Confirm last in the same
                flex line (spec 38/42); Cancel took the condition row's
                action slot (spec 44).  Supersedes arc-20 ruling f. */}
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
                        onChange={() => setReason(r.v)}
                      />
                      <span className="reason-glyph" aria-hidden>
                        {chosen ? "✓" : ""}
                      </span>
                      <span className="reason-text">{r.l}</span>
                    </label>
                  );
                })}
              </fieldset>
              {reason === "other" && (
                <input
                  type="text"
                  className="site-correction-note"
                  data-write=""
                  disabled={inFlight}
                  aria-label="Say what"
                  maxLength={200}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="say what"
                />
              )}
              <button
                type="button"
                className="confirm"
                data-write=""
                disabled={inFlight || !dismissIsComplete(reason, note)}
                onClick={() => confirmDismiss(flag)}
              >
                Confirm dismiss
              </button>
            </div>
          </div>,
        );
      }
    }
  } else {
    // No ok scan (a proceeded outage): only the records, with undo.
    for (const c of corrections) rows.push(record(c));
  }
  if (rows.length === 0) return null;
  // Footer (spec 61–65, GO ruling e / a′): the label, an elastic leader
  // (the footer reads as the ledger's last line), then the sentence —
  // the scan mode from the wire, the stamp as day · hh:mm utc by pure
  // slicing of the ISO measured_at (fmtScanStamp: no clock, no
  // arithmetic), the full ISO on the <time> for copy and audit.
  // #251 (ruling d): then the scan's own duration (ms → s, one decimal)
  // and the word "memoised" when the backend re-served a prior fetch —
  // the two facts that let two Generates of one corridor be compared.
  const stamp = siteScan.measured_at ?? null;
  const duration = fmtScanDuration(siteScan.duration_ms);
  return (
    // #246: the block is the jump target of the results-head line and
    // the section 03 signposts (id + jump-anchor scroll margin; tabIndex
    // -1 so jumpToAnchor's focus lands here, never in the Tab order).
    <div
      id={SITE_CORRECTIONS_ANCHOR}
      tabIndex={-1}
      aria-busy={inFlight || undefined}
      className={`jbar-suggest live site-corrections jump-anchor outline-none mb-3${inFlight ? " sc-inflight" : ""}`}
    >
      {/* Spec 2: header → 10px → rows → 10px → the footer's rule. */}
      <div className="tr-section mb-2.5">Site conditions — scanned</div>
      {/* #249: one grid, two tracks — ledger · action; every row is a
          subgrid row.  No column heads: the ledger reads symbol → name
          → leader → verdict (arc-20 ruling e superseded, recorded). */}
      <div className="sc-grid">{rows}</div>
      <div className="sc-foot tr-prov mt-2.5">
        <span className="sc-foot-label">scan</span>
        <span className="sc-leader" aria-hidden />
        <span className="sc-foot-text">
          {siteScan.mode ? `${siteScan.mode} scan` : "site scan"}
          {stamp ? " · " : ""}
          {stamp ? (
            <time className="sc-time" dateTime={stamp} title={stamp}>
              {fmtScanStamp(stamp)}
            </time>
          ) : null}
          {duration ? ` · ${duration}` : ""}
          {siteScan.memo_hit === true ? " · memoised" : ""}
          {" · a correction re-generates the plan"}
        </span>
      </div>
    </div>
  );
}

interface Props {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  onReopen: () => void;
  /**
   * #224 phase 2 — the settled audit's ``sections.site_scan`` for the
   * input on screen (the STAMPED view: null while a refetch is in
   * flight, so a prior input's disclosure never renders as current).
   * The panel prints the NOT-CHECKED disclosure for a proceed-anyway
   * plan as a #227 system event; every other scan state prints nothing.
   */
  siteScan?: SiteScanProvenance | null;
  /**
   * Spec 34 (#249): the shell's one in-flight derivation (the same
   * predicate as the results-head wait line).  While true the
   * correction block renders ``siteScanHeld`` — the LAST READY scan,
   * the #192 stale-while-revalidate shape — with every button
   * disabled, instead of unmounting; the NOT-CHECKED container above
   * still reads only the stamped ``siteScan`` (a prior outage never
   * re-announces as current).
   */
  siteScanInFlight?: boolean;
  siteScanHeld?: SiteScanProvenance | null;
  // Surface B (#152): a late jurisdiction / street-class change is a
  // real estimator move, so the post-generate strip edits them inline —
  // the Speed-edit treatment.  The evaluated block (when loaded) names
  // the jurisdiction; the setters write the same scenario fields the
  // full panel does.
  jurisdiction?: JurisdictionBlock | null;
  setJurisdictionKey?: (k: string | null) => void;
  setStreetClass?: (c: StreetClass) => void;
}

export function SetupStrip({
  scenario,
  setScenario,
  onReopen,
  siteScan = null,
  siteScanInFlight = false,
  siteScanHeld = null,
  jurisdiction = null,
  setJurisdictionKey,
  setStreetClass,
}: Props) {
  // #252 (ruling b): every inline editor is a write control.
  const locked = useWriteLock();
  const [edit, setEdit] = useState<string | null>(null);
  // #193: closing an editor unmounts the focused control (autoFocus
  // handled the way IN; nothing handled the way out — focus fell to
  // <body> on every inline edit).  Remember which cell opened the
  // editor and put focus back on its button once it remounts.
  const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const restoreRef = useRef<string | null>(null);
  const done = () => {
    restoreRef.current = edit;
    setEdit(null);
  };
  // #252: the work-zone editor's draft (see the input): the scenario is
  // written once, at commit; an unchanged or unparsable draft writes
  // nothing (suggest-never-set).
  const [workLenDraft, setWorkLenDraft] = useState<string | null>(null);
  const commitWorkLen = () => {
    if (workLenDraft !== null) {
      const n = parseInt(workLenDraft, 10);
      const next = Number.isFinite(n) ? n : 0;
      if (next !== scenario.workLen) setScenario({ ...scenario, workLen: next } as Scenario);
      setWorkLenDraft(null);
    }
    done();
  };
  useEffect(() => {
    if (edit !== null || restoreRef.current === null) return;
    const id = restoreRef.current;
    restoreRef.current = null;
    // Restore only when the close actually dropped focus (change/blur
    // to nowhere) — a user who tabbed or clicked onto another control
    // moved focus deliberately, and yanking it back would be its own
    // focus bug.
    const active = document.activeElement;
    if (!active || active === document.body) cellRefs.current[id]?.focus();
  }, [edit]);

  const schedule = scenario.schedule ?? null;
  const dateLabel =
    schedule && schedule.date_mode !== "tbd" && schedule.work_date
      ? fmtWorkDate(schedule.work_date)
      : "TBD";
  const hoursLabel =
    schedule &&
    schedule.date_mode !== "tbd" &&
    schedule.start_time != null &&
    schedule.end_time != null
      ? `${hhmm(schedule.start_time)}–${hhmm(schedule.end_time)}${
          schedule.end_time < schedule.start_time ? " (+1 day)" : ""
        }`
      : "—";

  const setSchedule = (
    patch: Partial<NonNullable<Scenario["schedule"]>>,
  ): void => {
    setScenario({
      ...scenario,
      schedule: { date_mode: "single", ...(schedule ?? {}), ...patch },
    } as Scenario);
  };

  const roadType =
    "roadType" in scenario ? (scenario.roadType as RoadType) : null;

  const jurisdictionKey = scenario.jurisdiction_key ?? null;
  const jurisdictionLabel = jurisdictionKey
    ? (jurisdiction?.name ??
      JURISDICTION_OPTIONS.find((o) => o.key === jurisdictionKey)?.label ??
      jurisdictionKey)
    : // #257 (P11): one word for the unset state on every surface — the
      // strip's own class cell, the fact strip, the XLSX Summary and the
      // crew header all print "Not set".
      "Not set";
  const streetClass = scenario.street_class ?? null;
  const classLabelText = streetClass
    ? STREET_CLASS_LABEL[streetClass]
    : "Not set";
  const speedMax = SPEED_MAX[scenario.kind] ?? 75;
  const speeds: number[] = [];
  for (let s = 25; s <= speedMax; s += 5) speeds.push(s);

  // #224 phase 2 (rule 10): the disclosure is loud — the #227 system-
  // event container above the fact strip, ⚠ + words, the backend string
  // as ONE text node (one voice), provenance on line 2.  Only for a
  // proceed-anyway plan (status unavailable + proceeded_anyway + the
  // string itself).
  const notChecked =
    siteScan &&
    siteScan.status === "unavailable" &&
    siteScan.proceeded_anyway === true &&
    typeof siteScan.disclosure === "string"
      ? siteScan
      : null;
  return (
    <>
      {notChecked && (
        <div className="sys-event warn site-not-checked mb-3">
          <div className="tr-section mb-1.5">Site conditions</div>
          <div className="flex items-start gap-2">
            <span className="sys-glyph" aria-hidden="true">
              ⚠
            </span>
            <span>{notChecked.disclosure}</span>
          </div>
          {/* #258 (P11/P12): the same sliced stamp as the block footer
              and the refusal container — one formatter; ISO on <time>. */}
          <div className="tr-prov mt-1.5">
            site scan
            {notChecked.error ? ` · ${notChecked.error}` : ""}
            {notChecked.measured_at ? (
              <>
                {" · attempted "}
                <time dateTime={notChecked.measured_at} title={notChecked.measured_at}>
                  {fmtScanStamp(notChecked.measured_at)}
                </time>
              </>
            ) : null}
            {" · re-generate to retry"}
          </div>
        </div>
      )}
      {(() => {
        // Spec 34: the block's scan is the stamped view when settled,
        // the held (last ready) scan while a re-generation is in
        // flight; nothing on a first generate or an error.
        const blockScan = siteScan ?? (siteScanInFlight ? siteScanHeld : null);
        return (
          blockScan && (
            <SiteCorrections
              scenario={scenario}
              setScenario={setScenario}
              siteScan={blockScan}
              inFlight={siteScanInFlight}
            />
          )
        );
      })()}
    <div className="setup-strip">
      <Structural
        k="Scenario"
        val={kindLabel(scenario.kind)}
        onReopen={onReopen}
      />
      {roadType && (
        <Structural
          k="Road"
          val={ROAD_TYPE_LABELS[roadType]}
          onReopen={onReopen}
        />
      )}

      {setJurisdictionKey && (
        <Simple
          id="jurisdiction"
          k="Jurisdiction"
          val={jurisdictionLabel}
          edit={edit}
          open={setEdit}
          cellRefs={cellRefs}
        >
          <label className="k" htmlFor="strip-jurisdiction">
            Jurisdiction
          </label>
          <select
            id="strip-jurisdiction"
            data-write=""
            disabled={locked}
            autoFocus
            value={jurisdictionKey ?? ""}
            onChange={(e) => {
              setJurisdictionKey(e.target.value || null);
              done();
            }}
            onBlur={done}
          >
            <option value="">None — baseline</option>
            {JURISDICTION_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </Simple>
      )}

      {setStreetClass && (
        <Simple
          id="class"
          k="Class"
          val={classLabelText}
          edit={edit}
          open={setEdit}
          cellRefs={cellRefs}
        >
          <span className="k">Street class</span>
          <div
            role="group"
            aria-label="Street classification"
            className="classpick"
          >
            {STREET_CLASSES.map((v) => (
              <button
                key={v}
                type="button"
                data-write=""
                disabled={locked}
                aria-pressed={streetClass === v}
                onClick={() => {
                  setStreetClass(v);
                  done();
                }}
                className={streetClass === v ? "on" : ""}
              >
                {STREET_CLASS_LABEL[v]}
              </button>
            ))}
          </div>
        </Simple>
      )}

      <Simple
        id="speed"
        k="Speed"
        val={`${scenario.speed} mph`}
        edit={edit}
        open={setEdit}
        cellRefs={cellRefs}
      >
        <label className="k" htmlFor="strip-speed">
          Speed
        </label>
        <select
          id="strip-speed"
          data-write=""
          disabled={locked}
          autoFocus
          value={scenario.speed}
          onChange={(e) => {
            setScenario({ ...scenario, speed: +e.target.value } as Scenario);
            done();
          }}
          onBlur={done}
        >
          {speeds.map((s) => (
            <option key={s} value={s}>
              {s} mph
            </option>
          ))}
        </select>
      </Simple>

      {"laneWidth" in scenario && (
        <Simple
          id="width"
          k="Lane W"
          val={`${scenario.laneWidth} ft`}
          edit={edit}
          open={setEdit}
          cellRefs={cellRefs}
        >
          <label className="k" htmlFor="strip-width">
            Lane width
          </label>
          <select
            id="strip-width"
            data-write=""
            disabled={locked}
            autoFocus
            value={scenario.laneWidth}
            onChange={(e) => {
              setScenario({
                ...scenario,
                laneWidth: +e.target.value,
              } as Scenario);
              done();
            }}
            onBlur={done}
          >
            {[9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14].map((w) => (
              <option key={w} value={w}>
                {w} ft
              </option>
            ))}
          </select>
        </Simple>
      )}

      <Simple
        id="work"
        k="Work zone"
        val={`${scenario.workLen.toLocaleString("en-US")} ft`}
        edit={edit}
        open={setEdit}
        cellRefs={cellRefs}
      >
        <label className="k" htmlFor="strip-worklen">
          Work zone (ft)
        </label>
        {/* #252: the value commits on blur / Enter, not per keystroke —
            each keystroke used to write the scenario and open a request,
            and under the lock the first digit would have disabled the
            field under the cursor.  One edit, one request (declared). */}
        <input
          id="strip-worklen"
          data-write=""
          disabled={locked}
          autoFocus
          type="number"
          step={10}
          min={0}
          value={workLenDraft ?? (scenario.workLen || "")}
          style={{ width: 90 }}
          onChange={(e) => setWorkLenDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitWorkLen();
          }}
          onBlur={commitWorkLen}
        />
      </Simple>

      <Simple
        id="date"
        k="Date"
        val={dateLabel}
        edit={edit}
        open={setEdit}
        cellRefs={cellRefs}
      >
        <label className="k" htmlFor="strip-date">
          Work date
        </label>
        <input
          id="strip-date"
          data-write=""
          disabled={locked}
          autoFocus
          type="date"
          value={
            schedule?.date_mode !== "tbd" ? (schedule?.work_date ?? "") : ""
          }
          onChange={(e) =>
            setSchedule({ date_mode: "single", work_date: e.target.value })
          }
          onBlur={done}
        />
      </Simple>

      <Simple
        id="hours"
        k="Hours"
        val={hoursLabel}
        edit={edit}
        open={setEdit}
        cellRefs={cellRefs}
      >
        <label className="k" htmlFor="strip-start">
          Hours
        </label>
        {/* The selects display exactly what the scenario holds — the old
            7:00/15:30 placeholder values were never written, so the strip
            showed a schedule the payload didn't carry (#188 defect 3). */}
        <select
          id="strip-start"
          data-write=""
          disabled={locked}
          autoFocus
          value={schedule?.start_time ?? ""}
          onChange={(e) => {
            const v = e.target.value === "" ? undefined : +e.target.value;
            setSchedule(
              v != null && schedule?.end_time === v
                ? { start_time: v, end_time: undefined }
                : { start_time: v },
            );
          }}
        >
          <option value="">—</option>
          {HALF_HOURS.map((h) => (
            <option key={h} value={h}>
              {hhmm(h)}
            </option>
          ))}
        </select>
        <span aria-hidden>–</span>
        <select
          aria-label="End time"
          data-write=""
          disabled={locked}
          value={schedule?.end_time ?? ""}
          onChange={(e) => {
            setSchedule({
              end_time: e.target.value === "" ? undefined : +e.target.value,
            });
            done();
          }}
          onBlur={done}
        >
          <option value="">—</option>
          {/* end < start wraps past midnight (#188); only end == start is
              excluded (ambiguous, rejected at the wire). */}
          {HALF_HOURS.filter((h) => h !== schedule?.start_time).map((h) => (
            <option key={h} value={h}>
              {schedule?.start_time != null && h < schedule.start_time
                ? `${hhmm(h)} (next day)`
                : hhmm(h)}
            </option>
          ))}
        </select>
      </Simple>

      <button
        type="button"
        className="strip-edit-all"
        data-write=""
        aria-disabled={locked || undefined}
        onClick={() => {
          if (!locked) onReopen();
        }}
      >
        Edit full setup <span aria-hidden>⤢</span>
      </button>
    </div>
    </>
  );
}
