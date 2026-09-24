"use client";

// #289 Phase 2 — the WHERE band (S1, S2), with the picker modal behind it.
//
// Authority: validation-artifacts/committed/issue-289-band-stack/rulings.md
// (c) "WHERE with the modal behind it: the three states as mapped" ·
// #281 Part 1 §2.1, §2.2, §4, §8.18-§8.19 · Part 2 rules 61-71, 114-115,
// 133, 135.
//
// ─────────────────────────────────────────────────────────────────────
// A RECORDED DEVIATION FROM RULING 189, AND ITS REASON
//
// Ruling 189: "Phase 2: the Where band owns the aerial and the outcome;
// the picker modal stays for the decision work."  This band owns the
// OUTCOME — the move ledger, the extent, the kind, the confirmed road's
// provenance.  It does NOT own the aerial, and that is a deviation
// recorded here rather than papered over:
//
//   · There is no aerial component outside `LocationPickerModal.tsx`.
//     The map, its sources, its layers and its whole interaction model
//     are 3,293 lines of modal state; lifting them into the band is the
//     migration ruling 189 phases ("it migrates piece by piece in Phase 3
//     and after"), not a detail of this ship.
//   · Rule 14 forbids the obvious cheat.  A striped placeholder is
//     Part 1 §7.17's own device for a document that cannot generate
//     imagery; on a live surface it is a placeholder bar, which rule 14
//     bans anywhere.  So the band shows no aerial rather than a fake one.
//   · `lib/corridor-map.ts` builds a Mapbox Static Images URL and its
//     header names `app/api/corridor-map/route.ts` as its consumer.
//     That route DOES NOT EXIST (checked at e60c91c).  A static aerial is
//     therefore a route plus a token path plus its own failure states,
//     which is its own commit.
//
// What the band does instead is say so, in the one place a reader looks:
// the band's provenance carries the pin's coordinates (Part 1 §7.15
// reserves the lat/lng for provenance lines), and the picker is one
// button away.  Nothing claims a map is coming.
// ─────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { ReactNode } from "react";
import type { Scenario, ScenarioKind, ScenarioMeta } from "@/lib/scenarios";
import {
  ENABLED_SCENARIO_KINDS,
  SCENARIO_KINDS,
  isScenarioKindEnabled,
} from "@/lib/scenarios";
import { validateWorkZone } from "@/lib/scenarios/validation";
import type { CorridorSpecLengths } from "@/lib/render-types";
import {
  CORRIDOR_ZONES,
  ZONE_LABEL,
  type CorridorZone,
} from "@/lib/corridor-zones";
import type { HandoffEvent } from "@/lib/scenarios/handoff-summary";
import {
  kindCitation,
  kindLabel,
  roadIsStale,
  whereProvenance,
} from "@/lib/scenarios/band-facts";
import { deriveMoveLedger, type MoveRow } from "@/lib/scenarios/move-ledger";
import { KIND_BLOCKER } from "@/lib/scenarios/rail";
import { hasLocation } from "@/lib/scenarios";
import { OpenBand } from "./BandPrimitives";
import { ManualFallback } from "./ManualFallback";
import { FieldErrorLine } from "../GeneratorFormPrimitives";
import { useWriteLock } from "../WriteLock";

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
): number {
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
      return spec.downstream_taper_ft;
  }
}

/** C5 — the move ledger (rules 67-70).  It renders `deriveMoveLedger()`'s
 *  rows and decides nothing (rule 71). */
function MoveLedgerRows({
  scenario,
  jurisdictionName,
  kindConfirmed,
  onOpenPicker,
  locked,
}: {
  scenario: Scenario;
  jurisdictionName: string | null;
  kindConfirmed: boolean;
  onOpenPicker: () => void;
  locked: boolean;
}) {
  const ledger = deriveMoveLedger(scenario, jurisdictionName, kindConfirmed);
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
      {ledger.rows.map(row)}
    </div>
  );
}

/**
 * Rule 135 — the kind chips, horizontal, same labels and TA/sheet
 * citations as the vertical list they replace (§8.18), same
 * carry-across-kinds behaviour on switch.
 *
 * R2, ruled 2026-09-22: the four gated kinds are NOT rendered, and the
 * provenance line below the row names what is missing and why.  Rule 135
 * says gated kinds are "not rendered at all today"; Rule 10 says an
 * absence renders as an absence rather than as nothing at all, and #277's
 * surviving bullet wants the gate named.  One line does both.
 *
 * Suggest-never-set: a chip CONFIRMS the kind.  Nothing proposes one —
 * the "✓ proposed" citation suffix has no producer this phase (#281's own
 * audit ruling), so no chip carries it.
 *
 * #289 hand-check, 2026-09-23, defect 1: `value` is null until a person
 * clicks a chip, and then NO chip is pressed.  `scenario.kind` is not
 * passed here raw, because it always holds a value — the default's
 * included — and pressing that chip for the operator was the defect.
 */
function KindChips({
  value,
  onChange,
  locked,
}: {
  value: ScenarioKind | null;
  onChange: (k: ScenarioKind) => void;
  locked: boolean;
}) {
  const live = SCENARIO_KINDS.filter((k) => isScenarioKindEnabled(k.v));
  const gated = SCENARIO_KINDS.length - live.length;
  return (
    <div>
      <div className="a-chips" role="group" aria-label="Kind of work">
        {live.map((k) => (
          <button
            key={k.v}
            type="button"
            className="a-chip"
            data-write=""
            aria-pressed={value === k.v}
            aria-disabled={locked || undefined}
            onClick={() => {
              if (!locked) onChange(k.v);
            }}
            data-testid={`kind-chip-${k.v}`}
          >
            <span className="tr-field">{k.l}</span>
            <span className="tr-prov">{kindCitation(k.v)}</span>
          </button>
        ))}
      </div>
      {gated > 0 && (
        <div className="tr-prov mt-2" data-testid="kind-gate-note">
          {gated} more kinds are not enabled — each waits on its typical
          sheet being validated against the generator.
        </div>
      )}
    </div>
  );
}

export function WhereBand({
  scenario,
  setScenario,
  setMeta,
  onOpenPicker,
  onKindChange,
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
  /** A chip click — the ONLY writer of the kind choice (defect 1). */
  onKindChange: (k: ScenarioKind) => void;
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
    const n = parseInt(wzDraft, 10);
    const next = Number.isFinite(n) ? n : 0;
    if (next !== scenario.workLen) {
      setScenario({ ...scenario, workLen: next } as Scenario);
    }
    setWzDraft(null);
  };

  return (
    <OpenBand
      stepIndex={stepIndex}
      head="WHERE"
      provenance={whereProvenance(scenario)}
      question="Where is the work?"
      questionProvenance={
        located
          ? "The segment below is what the plan is built from. Change what is wrong; the map is in the picker."
          : "An address, or a cross-street pair — the way an 811 ticket describes it. You can also drop a pin."
      }
    >
      {/* Rule 114's producer row: the field and its 132 px button, both
          44 px, stacking at 380 (rule 164).  The button opens the picker
          rather than geocoding in place: the picker is where the search,
          the candidates and the road pick live (ruling 189), and giving
          the band its own geocoder would be a second door onto the pin. */}
      <div className="a-findrow">
        <input
          className="a-fld"
          data-write=""
          aria-label="Address or cross streets"
          placeholder="Address or cross streets"
          value={scenario.meta.address}
          disabled={locked}
          onChange={(e) => setMeta({ ...scenario.meta, address: e.target.value })}
        />
        <button
          type="button"
          className="a-pri"
          data-write=""
          aria-disabled={locked || undefined}
          onClick={() => {
            if (!locked) onOpenPicker();
          }}
          data-testid="where-open-picker"
        >
          {/* #289 post-fidelity hand-check, finding 1 (Ryan, 2026-09-24):
              "Pick Location on Map" wrapped to two lines in rule 114's
              132 px.  RULED: "Pick on map", one line, nowrap, in rule
              130's type.  The located label had the same box and would
              overflow it once the box refuses to wrap, so it takes the
              ruling's form too — "Edit on map" is this build's choice,
              flagged, not a ruled string. */}
          {located ? "Edit on map" : "Pick on map"}
        </button>
      </div>
      {/* #289 fidelity F4 (X5): the "map · road detect · work zone in one
          step" caption is gone.  Rule 64's body order is question →
          provenance → producers → primary, with no caption slot, and rule
          114's S1 is the field and FIND alone; the caption described the
          picker modal (ruling 189 keeps it), which the button already
          names. */}

      {/* #288's finding class, applied here: a stale road is a fact the
          band states rather than a silence.  `deriveRail()` owns the
          predicate; this reads it (band-facts.roadIsStale). */}
      {stale && (
        <div className="tr-prov mt-2" style={{ color: "var(--warn)" }}>
          ⚠ detection stale — the confirmed road was picked at a different
          pin
        </div>
      )}

      {located && (
        <>
          <MoveLedgerRows
            scenario={scenario}
            jurisdictionName={jurisdictionName}
            kindConfirmed={kindConfirmed}
            onOpenPicker={onOpenPicker}
            locked={locked}
          />

          {/* Move 3's producer.  §4.3 puts the extent in the WHERE band,
              and this is the ONE work-zone length field in setup now: the
              three per-kind forms' copies are deleted in this commit, so
              `workLen` has one door here and one in the picker. */}
          {/* Rule 135's kind chips — BELOW the location, and only once a
              road is confirmed.
              #289 hand-check on prod, 2026-09-22: "The kind chips move
              below the location and render only once a road is confirmed
              (S2), per Part 1 §2.2 and §4.4 — the WHERE question is
              answered by a pin, not a kind."

              §4.4 is why the gate is a CONFIRMED ROAD and not a pin: move
              4 is the system proposing a side from what the tap hit, and
              a tap that has not resolved to a road has proposed nothing.
              Until Phase 3 builds that producer the chips render with no
              "✓ proposed" on any citation — #281's own audit ruling —
              so what the operator sees is three kinds and no opinion.

              RULE 5, and it is a real consequence: on a fresh session the
              kind is no longer settable before the picker opens, and the
              picker's capture flow reads it (`initial.scenarioKind`, and
              `near_intersection` asks for a second pin).  Reaching that
              kind is now: open the picker, save a road, pick the chip,
              reopen the picker.  Recorded in the arc README as the one
              flow this correction lengthens. */}
          {/* #289 hand-check, 2026-09-23, defect 1 — AND A STATED
              WIDENING OF THE GATE ABOVE.  The kind is now owed before
              Generate, so a pin no picker save ever touched — the
              manual-entry path, which has no detection at all — would
              have no chips and no way to answer the question the column
              is waiting on.  Until this fix that pin generated on the
              silent default, which is the defect.  So the row renders
              for a confirmed road (the ruled case, which already
              included a save that resolved no road) AND for a pin with
              no picker save on record.  A STALE road still hides it:
              that pin has a road to re-confirm, and the warning above
              says so.  Flagged for a ruling in rulings.md. */}
          {chipsShown && (
            <div className="mt-4">
              <KindChips
                value={kindPicked ? scenario.kind : null}
                onChange={onKindChange}
                locked={locked}
              />
            </div>
          )}

          <div className="a-cell mt-4" style={{ maxWidth: 260 }}>
            <label className="tr-field" htmlFor="band-worklen">
              Work zone length (ft)
            </label>
            <input
              id="band-worklen"
              type="number"
              step={10}
              min={0}
              className="a-fld"
              data-write=""
              disabled={locked}
              value={wzDraft ?? (scenario.workLen || "")}
              onChange={(e) => setWzDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitWorkLen();
              }}
              onBlur={commitWorkLen}
            />
            {wzTouched && !wz.ok ? (
              <FieldErrorLine>{wz.message}</FieldErrorLine>
            ) : (
              <span className="tr-prov">typed · the extent the plan is built for</span>
            )}

          {/* The corridor's zone lengths — §8.19 folds them into the
              aerial, and this phase has no aerial (see the deviation at
              the top of this file).  They are real backend facts about
              the extent the user just typed, so they stay, under the
              field they describe, rather than disappearing with the
              surface that used to draw them.

              #289 fidelity F4 (ruled Q3): they ARE the field's provenance
              now — lines in the extent cell's own stack (rule 137: a field
              explains itself under itself).  The block that held them — a
              "CORRIDOR EXTENT" section header and a dotted top rule, a
              form inside a band — is gone; the rows, their words and their
              honest notes are unchanged.

              The BAR retires: it drew a proportion, which is a picture of
              these numbers and not a fact of its own.  The rows are the
              record — which is what the bar's own test said when it
              called the bar aria-hidden. */}
          <div className="a-extent" data-testid="corridor-extent">
            {corridorSpecLengths && scenario.workLen > 0 ? (
              CORRIDOR_ROWS.map(([zone, label]) => (
                <span key={zone} className="tr-prov" data-testid={`zone-${zone}`}>
                  {label} ·{" "}
                  {zoneFt(corridorSpecLengths, zone, scenario.workLen).toLocaleString(
                    "en-US",
                  )}{" "}
                  ft
                </span>
              ))
            ) : (
              <span className="tr-prov" data-testid="corridor-extent-note">
                {scenario.workLen <= 0
                  ? "set the work-zone length to compute"
                  : !kindConfirmed
                    ? // #289 finding 1: the lengths are the kind's, and
                      // no check is fired for a kind nobody confirmed.
                      "corridor lengths wait on the kind of work"
                    : // Rule 3 / rule 10: an audit response without the
                      // lengths degrades to an honest note, never a
                      // locally-computed extent.
                      "corridor extent unavailable — awaiting verification"}
              </span>
            )}
          </div>
          </div>

          {/* #289 hand-check, 2026-09-23, correction 3: the "Applied
              from picker" box is gone.  Its sentences did not go with it
              — every one of them is now a provenance line under the WHAT
              cell whose value it is about (handoffNotesByCell), which is
              where rule 137 already says a field explains itself, and is
              the cell the operator would change to undo it. */}

          {/* Rule 115's primary, naming the choice.  It confirms; it
              never infers (suggest-never-set), and it writes nothing to
              the scenario — the chip already did.

              Defect 1: until a chip is clicked there is no choice to
              name, so the primary is DISABLED and says why, in the
              rail's own words (rule 139).  `aria-disabled`, not
              `disabled`, so it stays focusable and the reason stays
              reachable (#252's convention for a write control). */}
          <button
            type="button"
            className="a-pri a-confirm"
            aria-disabled={locked || !kindPicked || undefined}
            aria-describedby={kindPicked ? undefined : "where-confirm-reason"}
            onClick={() => {
              if (!locked && kindPicked) onConfirm();
            }}
            data-testid="where-confirm"
          >
            {kindPicked
              ? `Confirm — ${kindLabel(scenario.kind).toLowerCase()}`
              : "Confirm"}
          </button>
          {!kindPicked && (
            <div
              id="where-confirm-reason"
              className="tr-prov mt-2"
              data-testid="where-confirm-reason"
            >
              {KIND_BLOCKER.toLowerCase()}
            </div>
          )}
        </>
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
