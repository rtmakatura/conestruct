"use client";

// #289 Phase 2 — the WHERE band (S1, S2), with the picker modal behind it.
//
// Authority: validation-artifacts/committed/issue-289-band-stack/rulings.md
// (c) "WHERE with the modal behind it: the three states as mapped" ·
// #281 Part 1 §2.1, §2.2, §4, §8.18-§8.19 · Part 2 rules 61-71, 114-115,
// 133, 135.
//
// ─────────────────────────────────────────────────────────────────────
// RULING 189, NOW WHOLE: THE BAND OWNS THE AERIAL (#301 piece 1)
//
// Ruling 189: "Phase 2: the Where band owns the aerial and the outcome;
// the picker modal stays for the decision work."  Phase 2 shipped the
// outcome and recorded the aerial as a deviation (no aerial outside the
// modal, a placeholder banned by rule 14, and a static-image route that
// did not exist).  #301 closes it: `BandAerial`, under the move ledger, is
// a read-only picture of the corridor drawn by the backend
// (POST /render/corridor-map — #302's one layout call, page 2's own
// overlay), so the side and the kind are confirmed with their consequence
// in view.  The modal keeps the decision work and stays one button away.
// R123 (#301's end state): "the modal is the map": the pin, the road
// pick (detection and candidates) and the cross-street pin.  The guesses
// R108 prefills live on WHAT, never in the modal.
// Authority: validation-artifacts/committed/issue-301-band-aerial/rulings.md,
// validation-artifacts/committed/issue-301-picker-pieces/rulings.md.
// ─────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { ReactNode } from "react";
import type { Scenario, ScenarioKind, ScenarioMeta } from "@/lib/scenarios";
import { ENABLED_SCENARIO_KINDS } from "@/lib/scenarios";
import { validateWorkZone, workLenIsEmpty, workLenIsRefused } from "@/lib/scenarios/validation";
import type { CorridorSpecLengths } from "@/lib/render-types";
import {
  CORRIDOR_ZONES,
  ZONE_LABEL,
  type CorridorZone,
} from "@/lib/corridor-zones";
import type { HandoffEvent } from "@/lib/scenarios/handoff-summary";
import { roadIsStale, whereProvenance } from "@/lib/scenarios/band-facts";
import { deriveMoveLedger, type MoveId, type MoveRow } from "@/lib/scenarios/move-ledger";
import {
  selectedSideOption,
  notMarkedLine,
  useCorridorGeometry,
  type GeometryFetch,
} from "@/lib/corridor-geometry";
import type { CrossStreetTag } from "@/lib/cross-street-tag";
import type { CrossStreetMark } from "@/lib/cross-street-mark";
import { crossStreetLabel } from "@/lib/road-detection/labels";
import { symClass } from "@/lib/design/symbols";
import { hasConfirmedSide, hasLocation, workLenIsDefault } from "@/lib/scenarios";
import { clearWorkLen, setWorkLen } from "@/lib/scenarios/what-writes";
import { isOperatorSet } from "@/lib/scenarios/guesses";
import { OpenBand } from "./BandPrimitives";
import { BandAerial, type AerialBar, type AerialRing } from "./BandAerial";
import { ManualFallback } from "./ManualFallback";
import { WhereQuestions } from "./WhereQuestions";
import { FieldErrorLine } from "../GeneratorFormPrimitives";
import { FieldCell } from "./FieldCell";
import { useWriteLock } from "../WriteLock";
import { candidateLabel } from "@/lib/road-detection/labels";

/** The five zones, in the order the corridor lays them out — the same
 *  labels `ZONE_LABEL` gave the retired bar's rows, read from the one
 *  table rather than re-listed.  `CORRIDOR_ZONES` runs downstream-first
 *  (the stroke-width ramp's order); the rows read the way traffic does,
 *  so they take it reversed — advance warning to downstream. */
const CORRIDOR_ROWS: ReadonlyArray<readonly [CorridorZone, string]> = [
  ...CORRIDOR_ZONES,
]
  .reverse()
  .map((z) => [z, ZONE_LABEL[z]] as const);

/** One zone's length.  Four come from the backend; the work zone is the
 *  operator's own typed extent, which is why it is passed separately
 *  rather than looked for in a response that never carries it. */
function zoneFt(
  spec: CorridorSpecLengths,
  zone: CorridorZone,
  workLen: number,
): number | undefined {
  switch (zone) {
    case "advance_warning":
      return spec.advance_warning_ft;
    case "transition":
      return spec.taper_ft;
    case "buffer":
      return spec.buffer_ft;
    case "work_zone":
      return workLen;
    case "downstream":
      return spec.corner_extension_ft ?? spec.downstream_taper_ft;
  }
}

/** #365: the row label reads which key the backend sent; it decides
 *  nothing.  A corner plan's run past the work zone is its corner
 *  extension, not a downstream taper. */
function zoneLabel(
  spec: CorridorSpecLengths,
  zone: CorridorZone,
  label: string,
): string {
  return zone === "downstream" && spec.corner_extension_ft !== undefined
    ? "Corner extension"
    : label;
}

/** A length, or "unavailable" when the response carries none (Rule 10:
 *  never a guessed number). */
function ftText(ft: number | undefined): string {
  return ft === undefined ? "unavailable" : `${ft.toLocaleString("en-US")} ft`;
}

/** R117 Q2 — the extent row's popover lines: the five zone lengths (four
 *  from the backend's `corridor_spec`, the work zone the operator's own
 *  typed extent), or the one honest note when there are none.  On a
 *  near-intersection plan the lengths are the mainline's only; the line
 *  under them says the cross-street approaches lay out separately, so five
 *  rows never read as the whole picture (Rule 10). */
export function CorridorExtentLines({
  lengths,
  workLen,
  kind,
  note,
}: {
  lengths: CorridorSpecLengths | null;
  workLen: number;
  kind: ScenarioKind;
  note: string | null;
}) {
  const shown = lengths !== null && workLen > 0;
  return (
    <div className="a-extent" data-testid="corridor-extent">
      {shown ? (
        <>
          <span className="tr-prov a-extent-head">Corridor at this length</span>
          {CORRIDOR_ROWS.map(([zone, label]) => (
            <span key={zone} className="tr-prov" data-testid={`zone-${zone}`}>
              {zoneLabel(lengths, zone, label)} · {ftText(zoneFt(lengths, zone, workLen))}
            </span>
          ))}
          {kind === "near_intersection" && (
            <span className="tr-prov" data-testid="corridor-extent-approaches">
              the cross-street approaches lay out separately
            </span>
          )}
        </>
      ) : (
        <span className="tr-prov" data-testid="corridor-extent-note">
          {note}
        </span>
      )}
    </div>
  );
}

/** #439 ruling 3: Edit re-opens today's three rows, with their actions. */
const EDIT_ROWS: ReadonlySet<MoveId> = new Set<MoveId>(["spot", "start", "extent"]);

/** C5 — the move ledger (rules 67-70).  It renders `deriveMoveLedger()`'s
 *  rows and decides nothing (rule 71). */
function MoveLedgerRows({
  scenario,
  jurisdictionName,
  kindConfirmed,
  sideLabel,
  notMarkedLine,
  crossStreetTag,
  onOpenPicker,
  locked,
}: {
  scenario: Scenario;
  jurisdictionName: string | null;
  kindConfirmed: boolean;
  sideLabel: string | null;
  /** R131: the side control's own line while the crossing isn't marked. */
  notMarkedLine: string | null;
  /** #285: the backend's nearest-cross-street tag, or null. */
  crossStreetTag: string | null;
  onOpenPicker: () => void;
  locked: boolean;
}) {
  const ledger = deriveMoveLedger(
    scenario,
    jurisdictionName,
    kindConfirmed,
    sideLabel,
    notMarkedLine,
    crossStreetTag,
  );
  const row = (r: MoveRow) => (
    <div
      key={r.id}
      className={`a-move${r.id === ledger.currentId ? " is-current" : ""}`}
      data-testid={`move-${r.id}`}
      data-move-state={r.state}
    >
      <span
        className="a-sym"
        aria-hidden
        style={{
          color:
            r.state === "done"
              ? "var(--pass)"
              : r.state === "attention"
                ? "var(--warn)"
                : "var(--none)",
        }}
      >
        {r.glyph}
      </span>
      <div className="a-mid">
        <span className="tr-field">{r.label}</span>
        {r.value !== null && <span className="a-lead" aria-hidden />}
        {r.value !== null && <span className="a-val">{r.value}</span>}
      </div>
      {r.verb ? (
        <button
          type="button"
          className="act-btn"
          data-write=""
          aria-disabled={locked || undefined}
          onClick={() => {
            if (!locked) onOpenPicker();
          }}
          data-testid={`move-action-${r.id}`}
        >
          {r.verb}
        </button>
      ) : (
        <span className="tr-prov">{r.word}</span>
      )}
      {r.subline && <div className="a-sub tr-prov">{r.subline}</div>}
    </div>
  );
  return (
    <div className="a-moves" data-testid="move-ledger">
      {ledger.rows.filter((r) => EDIT_ROWS.has(r.id)).map(row)}
    </div>
  );
}

/**
 * #439 ruling 3 — the done summary row: one line, ✓, the values that are
 * done joined with " · " (an unset one is not printed, Rule 10).  Edit
 * re-opens today's three rows in place (with the address and length
 * fields, W9); Details shows the header's old provenance line (ruling 2,
 * P19: nothing in it is deleted).
 */
export function summaryParts(
  scenario: Scenario,
  crossStreetTag: string | null,
): string[] {
  const parts: string[] = [];
  const road = scenario.meta.confirmedRoad;
  if (road && !roadIsStale(scenario)) {
    const l = candidateLabel(road.candidate);
    parts.push(`${l.primary} ${l.direction.toLowerCase()}`);
  }
  if (crossStreetTag) parts.push(`starts ${crossStreetTag}`);
  if (!workLenIsEmpty(scenario) && !workLenIsRefused(scenario) && scenario.workLen > 0) {
    parts.push(
      `${scenario.workLen.toLocaleString("en-US")} ft${workLenIsDefault(scenario) ? " (default)" : ""}`,
    );
  }
  return parts;
}

function WhereSummary({
  parts,
  provenance,
  editOpen,
  setEditOpen,
}: {
  parts: string[];
  provenance: string;
  editOpen: boolean;
  setEditOpen: (v: boolean) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <div className="wq-sum-wrap">
      <div className="wq-sum" data-testid="where-summary">
        {parts.length > 0 && (
          <span className={`wq-sum-glyph ${symClass("✓")}`} aria-hidden="true">
            ✓
          </span>
        )}
        <span className="wq-sum-text tr-help" data-testid="where-summary-text">
          {parts.join(" · ")}
        </span>
        <button
          type="button"
          className="wq-link"
          data-read=""
          aria-expanded={editOpen}
          aria-controls="where-edit"
          onClick={() => setEditOpen(!editOpen)}
          data-testid="where-edit"
        >
          Edit
        </button>
        {provenance && (
          <button
            type="button"
            className="wq-link"
            data-read=""
            aria-expanded={detailsOpen}
            aria-controls="where-details"
            onClick={() => setDetailsOpen(!detailsOpen)}
            data-testid="where-details"
          >
            Details
          </button>
        )}
      </div>
      {provenance && (
        <p
          id="where-details"
          className="tr-prov wq-sum-details"
          data-testid="where-provenance"
          hidden={!detailsOpen}
        >
          {provenance}
        </p>
      )}
    </div>
  );
}

export function WhereBand({
  scenario,
  setScenario,
  setMeta,
  onOpenPicker,
  onMarkIntersection,
  geometry: shellGeometry,
  crossStreet = null,
  crossMark,
  sidesChanged = false,
  onKindChange,
  onKindCleared,
  kindPicked = true,
  // Rule 10: the safe default is "not chosen" — an omitted prop must not
  // read as a confirmed kind.  BandStack passes the real value.
  kindConfirmed = false,
  onConfirm,
  handoff,
  stepIndex,
  corridorSpecLengths = null,
  jurisdictionName = null,
}: {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  setMeta: (m: ScenarioMeta) => void;
  onOpenPicker: () => void;
  /** #317 (R129 Q1): the side control's Mark on map — the picker, ready to
   *  mark the crossing. */
  onMarkIntersection?: () => void;
  /** R131: the shell's geometry answer (one read for the band and the
   *  rail).  Absent — a band mounted alone — the band asks itself. */
  geometry?: GeometryFetch;
  /** #285: the shell's nearest-cross-street answer (asked once, handed
   *  down like `geometry`).  Null leaves the tag on the road name. */
  crossStreet?: CrossStreetTag | null;
  /** #440: the cross-street mark (GeneratorSidebar owns its state). */
  crossMark?: CrossStreetMark;
  /** #440 X20: a kind change cleared the side. */
  sidesChanged?: boolean;
  /** A chip click — the ONLY writer of the kind choice (defect 1). */
  onKindChange: (k: ScenarioKind) => void;
  /** #439 W6: Undo on the kind returns it to unchosen. */
  onKindCleared?: () => void;
  /** Has a person clicked a chip?  False renders the chips with none
   *  pressed and the primary disabled with the rail's reason. */
  kindPicked?: boolean;
  /** Finding 1: is the kind CONFIRMED (not just picked)?  The corridor
   *  rows' note says they wait on it — the shell fires no check before. */
  kindConfirmed?: boolean;
  /** Rule 115's primary: confirming the kind closes the band and opens
   *  WHAT.  It writes nothing to the scenario — the chip already wrote
   *  the kind — but it IS the confirmation #289's defect 1 requires: the
   *  WHAT band and Generate wait on it. */
  onConfirm: () => void;
  handoff: HandoffEvent[];
  stepIndex: string;
  /** Engine-removal PR D — the backend's corridor zone lengths off the
   *  audit response.  Null before the first audit resolves or when the
   *  field is absent (deploy window): the rows then read unavailable,
   *  and nothing is computed locally (rule 3). */
  corridorSpecLengths?: CorridorSpecLengths | null;
  /** §8.16's demoted project metadata — title-block fields, not part of
   *  the required path, so they stay a disclosure. */
  projectDetails?: ReactNode;
  /** The EVALUATED jurisdiction name — the third clause of "Found the
   *  spot" (#289 hand-check, correction 3).  Null until the check
   *  answers, and then the clause is simply absent (rule 10). */
  jurisdictionName?: string | null;
}): ReactNode {
  const locked = useWriteLock();
  const located = hasLocation(scenario.meta);
  const stale = roadIsStale(scenario);
  // #290: the backend's geometry for this pin — the side control's worded
  // choices (and, once the side is set, its answer's words for the
  // ledger).  Asked only for a located work-start pin.  It is a read, not
  // a check: no verdict is formed from it, and the choices do not depend
  // on the kind, so it is asked before the kind is confirmed too.
  const workStart = scenario.meta.pinModel === "work_start";
  const ownGeometry = useCorridorGeometry(
    shellGeometry ? null : located && workStart && !stale ? scenario : null,
  );
  const geometry = shellGeometry ?? ownGeometry;
  const sideLabel =
    selectedSideOption(geometry.geometry?.side_options ?? [], scenario.meta.work)?.label ?? null;
  const sided = hasConfirmedSide(scenario.meta);
  // §2.2's S2: a road confirmed AT THIS PIN.  A stale road is not a
  // confirmation of anything here (the #149 failure class), so it does
  // not arm the chips either.
  const roadConfirmed = scenario.meta.confirmedRoad !== undefined && !stale;
  // Defect 1's widening — see the chip row below.  NB `roadConfirmed`
  // above is already true for a picker save that resolved NO road: that
  // save writes `confirmedRoad: null`, and null !== undefined.  What it
  // excludes is `undefined` — a pin no picker save ever touched, which is
  // the manual-entry path.  The widening adds exactly that case.
  const chipsShown = roadConfirmed || (located && scenario.meta.confirmedRoad === undefined);
  // #289 hand-check, 2026-09-22, correction 2: the manual-entry toggle
  // comes off the WHERE band.
  //
  // It is NOT deleted, because it is the degraded-environment path: with
  // no Mapbox token the picker degrades to a numeric-only form, and this
  // is then the only way to set a pin at all.  So it renders exactly
  // where it is the answer — when there is no token — and nowhere else.
  // Already open when it renders, for the same reason `UnsetLocation`
  // auto-expanded it: there is no map to fall back FROM.
  //
  // RULE 5, STATED, and it is a narrowing: the panel also offered it as
  // a recovery when the modal failed to LOAD with a token present.  That
  // second case loses its affordance here.  Recorded rather than traded
  // silently; if it should survive, it wants its own trigger (an error
  // boundary on the modal) rather than a permanent row on the band.
  const mapboxToken = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "").length > 0;
  const [showManual, setShowManual] = useState(!mapboxToken);
  const [wzTouched, setWzTouched] = useState(false);
  const wz = validateWorkZone(scenario);
  // #252, and this arc re-earned it: the extent commits on blur or
  // Enter, NOT per keystroke.
  //
  // Written per keystroke, each digit wrote the scenario and opened a
  // request; the request mounts the working band, the band locks the
  // column (rule 60), and the lock collapses every band to a fact line —
  // so the field disappeared under the cursor on the first digit.  That
  // is #252's own sentence about the strip's work-zone editor, and the
  // band reproduced it exactly.  Caught by the #193 focus suite, which
  // is the suite that exists for it.
  //
  // One edit, one request (declared).  An unchanged or unparsable draft
  // writes nothing (suggest-never-set).  The same shape rule 95.2 gives
  // every field in S7.
  const [wzDraft, setWzDraft] = useState<string | null>(null);
  const commitWorkLen = () => {
    setWzTouched(true);
    if (wzDraft === null) return;
    // #432: parseFloat, not parseInt, so a typed decimal reaches the
    // validator ("Use whole feet") instead of being cut to a whole number.
    const n = parseFloat(wzDraft);
    // #428: an emptied box is no length (0, the record dropped), apart
    // from a typed 0, which is the operator's number and stays in the box.
    if (!Number.isFinite(n)) {
      if (!workLenIsEmpty(scenario)) setScenario(clearWorkLen(scenario));
      setWzDraft(null);
      return;
    }
    const next = n;
    // #397: a committed length is the operator's ("typed", "✓ yours"),
    // recorded so the starting length can say "default" until then.  A
    // committed draft that repeats the value (1000 typed over the starting
    // 1,000) is still the operator's answer: it writes the record once
    // (stated: that one write opens one request, as any edit does).
    if (next !== scenario.workLen || !isOperatorSet(scenario, "workLen")) {
      setScenario(setWorkLen(scenario, next));
    }
    setWzDraft(null);
  };

  // #439 W9: the Edit fold.  It opens by itself while the length is unset
  // or refused: an open item keeps its control on screen (P5).
  const [editChoice, setEditChoice] = useState<boolean | null>(null);
  const lengthOwed = workLenIsEmpty(scenario) || workLenIsRefused(scenario) || !wz.ok;
  const editOpen = editChoice ?? lengthOwed;
  const openMap = () => {
    if (locked) return;
    onOpenPicker();
  };

  // Rule 114's producer row: the field and its button, both 44 px,
  // stacking at 380 (rule 164).  The button opens the picker rather than
  // geocoding in place (ruling 189: one door onto the pin).  #439 ruling 1:
  // under the heading before a pin; inside Edit after one, with "Edit on
  // map" on the aerial's corner.
  const findRow = (withButton: boolean) => (
    <div className={withButton ? "a-findrow" : "a-findrow wq-findrow"}>
      <input
        className="a-fld"
        data-write=""
        aria-label="Address or cross streets"
        placeholder="Address or cross streets"
        value={scenario.meta.address}
        disabled={locked}
        onChange={(e) => setMeta({ ...scenario.meta, address: e.target.value })}
        onKeyDown={(e) => {
          // #402: Enter is the field's "go": the same picker the button
          // opens, handed the typed text.  Not while composing.
          if (e.key !== "Enter" || e.nativeEvent.isComposing || locked) return;
          e.preventDefault();
          onOpenPicker();
        }}
      />
      {withButton && (
        <button
          type="button"
          className="a-pri"
          data-write=""
          aria-disabled={locked || undefined}
          onClick={openMap}
          data-testid="where-open-picker"
        >
          {/* #289 post-fidelity hand-check, finding 1: one line, nowrap. */}
          Pick on map
        </button>
      )}
    </div>
  );
  const aerialShown = workStart && !stale;
  // #440 rulings 3-5: the question on screen in the CONFIRM card.  While
  // it is the cross-street question the aerial is the pin picture (X3); it
  // takes a tap while no crossing is marked, or after Move (X11), and never
  // while a lookup runs.  After Confirm the card closes (no question on
  // screen), so the aerial is #439's again.  A saved plan reopened with its
  // kind confirmed and no crossing lands on this question, armed.
  const [currentQ, setCurrentQ] = useState<string | null>(null);
  const crossOpen =
    chipsShown &&
    workStart &&
    kindPicked &&
    scenario.kind === "near_intersection" &&
    currentQ === "cross";
  const marked = scenario.meta.intersection ?? null;
  const armed =
    crossOpen &&
    !locked &&
    crossMark !== undefined &&
    crossMark.phase !== "resolving" &&
    (marked === null || crossMark.rearmed);
  const aerialMark =
    crossOpen && crossMark?.pixel && marked
      ? { ...crossMark.pixel, name: crossStreetLabel(marked.name) }
      : null;
  // #446 rulings 1-5: what the aerial's bar says, read off the same state as
  // the card (T3, T6).  Nothing new is read.
  const phase = crossMark?.phase ?? "idle";
  const aerialBar: AerialBar | null =
    !crossOpen || !crossMark
      ? null
      : phase === "resolving"
        ? { kind: "finding" }
        : phase === "error"
          ? { kind: "failed", onRetry: crossMark.retry }
          : phase === "none"
            ? { kind: "none" }
            : armed
              ? { kind: "armed" }
              : marked
                ? { kind: "found", name: crossStreetLabel(marked.name) }
                : null;
  const aerialRing: AerialRing | null =
    crossOpen && crossMark?.ring && phase !== "idle"
      ? { ...crossMark.ring, look: phase === "resolving" ? "solid" : "dashed" }
      : null;

  return (
    <OpenBand
      stepIndex={stepIndex}
      head="WHERE"
      // #439 ruling 2: the provenance line moves behind the summary row's
      // Details; the header is the step and WHERE only.
      provenance=""
      question="Where is the work?"
      // Ruling 1: after a pin nothing sits between the question and the
      // aerial.
      questionProvenance={
        located
          ? ""
          : "Type an address or two cross streets, the way an 811 ticket describes it. Or drop a pin on the map."
      }
    >
      {!located && findRow(true)}

      {/* #288's finding class: a stale road is a fact the band states
          rather than a silence (band-facts.roadIsStale). */}
      {stale && (
        <div className="tr-prov mt-2" style={{ color: "var(--warn)" }}>
          ⚠ detection stale: the confirmed road was picked at a different
          pin
        </div>
      )}
      {/* #290 ruling 10: a plan saved before the pin marked the work start
          opens with its pin kept and its side unset. */}
      {located && scenario.meta.pinModelFrom === "corridor_end" && !sided && (
        <div
          className="tr-prov mt-2"
          style={{ color: "var(--warn)" }}
          data-testid="pin-model-converted"
        >
          ⚠ saved before the pin marked the work start. Say which side is
          occupied to lay the work out from this pin
        </div>
      )}

      {located && (
        <div className="wq-stack">
          {/* #301 piece 1: the aerial, a read (data-read) that stays live
              under the write lock.  #439 ruling 1: first after the
              question, "Edit on map" on its corner, the key on it. */}
          {aerialShown ? (
            <BandAerial
              scenario={scenario}
              geometry={geometry}
              kindConfirmed={kindConfirmed}
              onEditMap={openMap}
              locked={locked}
              pinFrame={crossOpen}
              armed={armed}
              onTap={crossMark ? (t) => crossMark.tap(t) : undefined}
              onBigMap={onMarkIntersection}
              mark={aerialMark}
              bar={aerialBar}
              ring={aerialRing}
              failedCount={crossMark?.failedCount ?? 0}
            />
          ) : (
            // W11: no aerial (a stale road, a corridor-end pin): the
            // button stays reachable under the heading.
            <button
              type="button"
              className="a-pri wq-next wq-map-btn"
              data-write=""
              aria-disabled={locked || undefined}
              onClick={openMap}
              data-testid="where-open-picker"
            >
              Edit on map
            </button>
          )}

          <WhereSummary
            parts={summaryParts(scenario, crossStreet?.text ?? null)}
            provenance={whereProvenance(scenario, crossStreet?.provenance ?? null)}
            editOpen={editOpen}
            setEditOpen={(v) => setEditChoice(v)}
          />
          <div id="where-edit" className="wq-edit" hidden={!editOpen} data-testid="where-edit-fold">
            {findRow(false)}
            <MoveLedgerRows
              scenario={scenario}
              jurisdictionName={jurisdictionName}
              kindConfirmed={kindConfirmed}
              sideLabel={sideLabel}
              notMarkedLine={notMarkedLine(geometry)}
              crossStreetTag={crossStreet?.text ?? null}
              onOpenPicker={onOpenPicker}
              locked={locked}
            />
            {/* R117 Q2: the extent is a FieldCell with the corridor's zone
                lengths in its details.  #439 W9: it lives in the fold. */}
            <div className="a-cols">
              <div className="a-col">
                <FieldCell
                  label="Work zone length (ft)"
                  htmlFor="band-worklen"
                  testid="worklen"
                  provenance={
                    <span className="tr-prov" data-testid="prov-worklen">
                      {workLenIsEmpty(scenario)
                        ? "not set · the extent the plan is built for"
                        : workLenIsDefault(scenario)
                          ? // #397: the starting length, not an answer (Rule 10).
                            "default · the plan's starting length; enter the real one"
                          : "your answer · the extent the plan is built for"}
                    </span>
                  }
                  marker={
                    workLenIsEmpty(scenario)
                      ? { glyph: "◌", word: "not set", tone: "pending" }
                      : workLenIsRefused(scenario)
                        ? // #403/#428/#429: the operator's, but refused; no ✓.
                          { glyph: null, word: "yours", tone: "plain" }
                        : workLenIsDefault(scenario)
                          ? // Plain "default", no mark (Ryan, 2026-10-26).
                            { glyph: null, word: "default", tone: "plain" }
                          : { glyph: "✓", word: "yours", tone: "ok" }
                  }
                  alert={wzTouched && !wz.ok ? <FieldErrorLine>{wz.message}</FieldErrorLine> : null}
                  info={
                    <CorridorExtentLines
                      lengths={corridorSpecLengths ?? null}
                      workLen={scenario.workLen}
                      kind={scenario.kind}
                      note={
                        scenario.workLen <= 0
                          ? "set the work-zone length to compute"
                          : !kindConfirmed
                            ? // #289 finding 1: the lengths are the kind's.
                              "corridor lengths wait on the kind of work"
                            : !sided
                              ? // #290: nor for a side nobody gave.
                                "corridor lengths wait on the occupied side"
                              : // Rule 3 / rule 10: never a locally-computed extent.
                                "corridor extent unavailable, awaiting verification"
                      }
                    />
                  }
                >
                  <input
                    id="band-worklen"
                    type="number"
                    step={10}
                    min={0}
                    className="a-fld"
                    data-write=""
                    disabled={locked}
                    // #428: only an empty box shows empty; a typed 0 shows 0.
                    value={wzDraft ?? (workLenIsEmpty(scenario) ? "" : scenario.workLen)}
                    onChange={(e) => setWzDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitWorkLen();
                    }}
                    onBlur={commitWorkLen}
                  />
                </FieldCell>
              </div>
            </div>
          </div>

          {/* #439 rulings 4-6: the CONFIRM card, the side then the kind.
              Same arming as the old chips (#289 defect 1's widening): a
              road confirmed at this pin, or a manual pin with no picker
              save on record; a stale road hides it. */}
          {chipsShown && (
            <WhereQuestions
              scenario={scenario}
              setMeta={setMeta}
              geometry={geometry}
              showSide={workStart}
              kindPicked={kindPicked}
              kindConfirmed={kindConfirmed}
              onKindChange={onKindChange}
              onKindCleared={onKindCleared}
              onConfirm={onConfirm}
              onMarkIntersection={onMarkIntersection}
              crossMark={crossMark}
              sidesChanged={sidesChanged}
              crossTag={crossStreet}
              onCurrentChange={setCurrentQ}
              locked={locked}
            />
          )}
        </div>
      )}

      {!mapboxToken && (
        <>
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => setShowManual((s) => !s)}
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] hover:text-[color:var(--act)]"
            >
              {/* The existing labels, unchanged: "Enter manually" before a
                  pin and "Edit manually" after. */}
              {showManual
                ? "Hide manual entry"
                : located
                  ? "Edit manually"
                  : "Enter manually"}
            </button>
          </div>
          {showManual && (
            <div className="mt-3">
              <ManualFallback
                scenario={scenario}
                setMeta={setMeta}
                setScenario={setScenario}
              />
            </div>
          )}
        </>
      )}
    </OpenBand>
  );
}

/** Re-exported so a test can assert the chip row against the same table
 *  the row renders from, rather than against a copy of it. */
export { ENABLED_SCENARIO_KINDS };
