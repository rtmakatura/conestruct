"use client";

import { useRef, useState, type ReactNode } from "react";
import type { SectionSlot } from "./JurisdictionSection";
import {
  applyClassification,
  carryAcrossKinds,
  clearDetectionRelays,
  defaultFor,
  hasLocation,
  type AutoApplyDelta,
  type Scenario,
  type ScenarioKind,
  type ScenarioMeta,
} from "@/lib/scenarios";
import { applyOverridesToScenario } from "@/lib/scenarios/overrides";
import { withPin, withoutSide } from "@/lib/scenarios/site-corrections";
import {
  summarizeHandoff,
  type HandoffEvent,
} from "@/lib/scenarios/handoff-summary";
import { deriveRail } from "@/lib/scenarios/rail";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import type { RoadClassification } from "@/lib/road-detection/types";
import { approachesFromCrossStreet } from "@/lib/road-detection/cross-street";
import type { CorridorSpecLengths, Refusal } from "@/lib/render-types";
import { Field, FieldGroup, LabelRow } from "./GeneratorFormPrimitives";
import { FlaggerForm } from "./FlaggerForm";
import { LaneClosureForm } from "./LaneClosureForm";
import { WorkBeyondShoulderForm } from "./WorkBeyondShoulderForm";
import { MobileOp2LaneForm } from "./MobileOp2LaneForm";
import { MobileOpMultilaneForm } from "./MobileOpMultilaneForm";
import { NearIntersectionForm } from "./NearIntersectionForm";
import { ScheduleField, ScheduleWindows } from "./ScheduleField";
import {
  LocationPickerModal,
  type LocationPickerResult,
} from "./LocationPickerModal";
import { BandStack, type OpenRequest } from "./BandStack";
import type { KindState } from "@/lib/scenarios/band-facts";

interface Props {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  generating: boolean;
  onGenerate: () => void;
  // Engine-removal PR D, reshaped by #180: the backend's refusal of the
  // current input — the audit fetch's HTTP 400, stamped for the scenario
  // on screen.  Null while a fetch is in flight.  The full 400 text is
  // never rendered here (#180: the StatusBar owns the single verbatim
  // render when no affordance exists); the under-Generate line is a
  // short pointer only.
  refusal: Refusal | null;
  // #196: true while the audit is re-fetching AND the previous settled
  // answer was a refusal.  The window is up to ~5.5 s on a Modal cold
  // start (measured — the old "sub-second race" assumption here was
  // wrong), long enough for a Generate click that latches the
  // post-generate layout and leaves the SECOND refusal pointing at an
  // unmounted confirm row.  The CTA stays gated until the next verdict
  // settles; the server still re-validates every render call — this
  // gate closes the dead-end UX, it is not the safety boundary.
  refusalPending: boolean;
  // Engine-removal PR D: backend-computed corridor zone lengths off the
  // audit response (sections.corridor_spec).  Null before the first
  // audit resolves or when the field is absent (deploy window) — the
  // preview then reads unavailable; it is never computed locally.
  corridorSpecLengths: CorridorSpecLengths | null;
  // Surface B (#152), rehomed by #227: the interactive jurisdiction +
  // street-class controls, rendered as the full-width band directly
  // below the Location step so the causality still reads pin ->
  // suggestions -> confirm.  Built by the shell (which owns the
  // suggestion state); this component only places it.
  jurisdictionControls?: SectionSlot;
  // #227 fact strip: the evaluated jurisdiction's display name (the
  // device-breakdown block's ``name``), null before it loads or when no
  // jurisdiction is named.  The strip falls back to the option label /
  // "Not set" — a real answer, never blank.
  jurisdictionName?: string | null;
  // #227 schedule reference block: the full evaluated block — window
  // set + hours_eval — for the Schedule step's window rows.
  jurisdictionBlock?: JurisdictionBlock | null;
  // #289 ruling 196 / #276: the jurisdiction cell's three states need to
  // tell "not yet" from "did not answer", and only the shell knows which
  // — it owns the breakdown fetch.  Passed rather than re-derived.
  jurisdictionLoading?: boolean;
  /** #152 D / correction 2: a same-key refetch is in flight.  The held
   *  block stays as CONTENT; its hours verdict may not render as
   *  current (rule 10).  Passed straight through to ScheduleField. */
  jurisdictionRevalidating?: boolean;
  jurisdictionErrored?: boolean;
  // #201: the pin suggestion, rendered INSIDE the WHAT grid's
  // jurisdiction cell so a confirm sits beside the control it applies to.
  // #289 WHAT density: a render function of the section the cell asks for.
  jurisdictionSuggest?: SectionSlot;
  // #228: how many suggestion proposals await Confirm/Dismiss (0–2),
  // computed by the shell from the slots' own render expressions —
  // feeds the rail's Location info subline and nothing else.
  pendingSuggestions?: number;
  // Dev-only replication snapshot (Refs #102, TEMPORARY): surfaces the raw
  // picker classification (plus the pin it was captured at, so a later
  // location edit is detectable as staleness) up to the shell — it
  // otherwise evaporates at the handoff. Delete with DebugSnapshotButton.
  onClassification?: (
    c: RoadClassification | null,
    at: { lat: number; lng: number },
  ) => void;
  /** #289 hand-check, 2026-09-23, defect 1 — the kind choice, owned by
   *  the shell so it survives this component unmounting post-generate.
   *  Defaults to "confirmed" for a caller that does not track it. */
  kindState?: KindState;
  onKindPicked?: () => void;
  onKindConfirmed?: () => void;
  /** Defect 2 — which band a setup-line value link asked for. */
  openRequest?: OpenRequest | null;
}

// Schedule then Site conditions close the panel, so their indices
// depend on whether the active per-kind form contributed a fifth step
// (Flagger / Protection) after the fixed Road (3) / Work (4).
// Scenario (1) and Location (2) are constant (#222 relabel: the
// visual order already ran Scenario-first; the numbers now agree).
const KIND_HAS_FIFTH_STEP: Record<ScenarioKind, boolean> = {
  shoulder: false,
  flagger_lane_closure: true, // Flagger
  lane_closure_divided: true, // Protection
  work_beyond_shoulder: false,
  mobile_op_2lane: true, // Protection
  mobile_op_multilane: true, // Protection
  near_intersection: true, // Cross street
};

function scheduleStep(kind: ScenarioKind): number {
  return KIND_HAS_FIFTH_STEP[kind] ? 6 : 5;
}

function siteStep(kind: ScenarioKind): number {
  return scheduleStep(kind) + 1;
}

// applyOverridesToScenario / applyRoadTypeOverride moved to
// lib/scenarios/overrides.ts (PR 4) so the speed-clamp behavior is
// unit-testable without the component/Mapbox dependency tree.

export function GeneratorSidebar({
  scenario,
  setScenario,
  generating,
  onGenerate,
  refusal,
  refusalPending,
  corridorSpecLengths,
  jurisdictionControls,
  jurisdictionName = null,
  jurisdictionBlock = null,
  jurisdictionLoading = false,
  jurisdictionRevalidating = false,
  jurisdictionErrored = false,
  jurisdictionSuggest,
  pendingSuggestions = 0,
  onClassification,
  kindState = "confirmed",
  onKindPicked,
  onKindConfirmed,
  openRequest = null,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // #193: focus target for the picker's close-restore when the opener
  // is gone (the first save swaps "Pick Location on Map" for the pin
  // summary).  Attached to the location block, which survives the swap.
  const locationBlockRef = useRef<HTMLDivElement | null>(null);
  // UX-01/UX-02: the transformations the picker → form handoff applied
  // (speed clamp/snap; later, low-confidence skip/accept).  Frontend-only
  // metadata held here and rendered in LocationSummary — never written to
  // scenario state or the backend payload.
  const [handoff, setHandoff] = useState<HandoffEvent[]>([]);
  // Needs-confirmation hold on detection-filled approach lane counts:
  // OSM lane totals near intersections routinely include turn pockets,
  // so a detected count is a proposal until the user confirms or edits
  // it — and the CTA stays gated while it's pending.
  const [approachConfirm, setApproachConfirm] = useState<{
    pending: boolean;
    reason: string | null;
  }>({ pending: false, reason: null });

  // #221: the CTA gate + reason AND the progress rail derive from one
  // pure function (lib/scenarios/rail.ts) — the schema-mirror
  // validations, the hold above, the shell's stamped refusal, and the
  // location sentinel, chained in the recorded rank order.  ``blocker``
  // is null exactly when the old seven-disjunct gate was open.
  const rail = deriveRail({
    scenario,
    approachConfirm,
    refusal,
    refusalPending,
    pendingSuggestions,
    // Defect 1: Generate waits on a person's confirmation of the kind.
    kindConfirmed: kindState === "confirmed",
  });
  // #222: pre-pin, every step after Location renders pending (dim +
  // inert + focusable summary) -- detection fills road facts from the
  // pin, so inviting that work first invites an overwrite.  The
  // Scenario picker stays live: the kind is UPSTREAM of the pin (it
  // decides the picker's capture flow) and detection never overwrites
  // it.  Post-pin everything is byte-identical to before.
  const stepsPending = !hasLocation(scenario.meta);

  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;

  // Content of the last classification applyClassification actually
  // applied, surviving picker re-opens.  Detection writes to the form
  // only when it is NEW information: a re-Apply with an unchanged
  // detection must not re-impose detected values over manual form edits
  // made since the last apply — that silently reverted a user's lane
  // selection to the detected count (the picker re-apply lanes bug).  A
  // moved pin or changed OSM result produces different content and still
  // applies; in-modal overrides always apply (explicit user actions).
  const lastAppliedDetectionRef = useRef<string | null>(null);
  // Same guard for the cross-street candidate (near_intersection):
  // a re-Apply with an unchanged detection must not re-impose the
  // proposed approaches over manual edits — the exact #112 clobber
  // class, one seam over.
  const lastAppliedCrossStreetRef = useRef<string | null>(null);
  // Same guard for the picker overrides (#190): the reopened modal
  // restores its saved overrides and re-emits them verbatim at Save, so
  // an unconditional apply re-imposed a picker-set value over a manual
  // form edit made since — the #112 clobber class through the overrides
  // channel.  Unchanged overrides on re-save are not new information; a
  // changed override (an explicit in-modal edit) still applies.
  const lastAppliedOverridesRef = useRef<string | null>(null);

  const onKindChange = (kind: ScenarioKind) => {
    if (kind === scenario.kind) return;
    // The new kind's form starts from its defaults, so the same
    // detection IS new information for it — the re-application below
    // re-arms the ref, and a later picker Apply still compares content.
    lastAppliedDetectionRef.current = null;
    lastAppliedCrossStreetRef.current = null;
    lastAppliedOverridesRef.current = null;
    setApproachConfirm({ pending: false, reason: null });
    // #181: a kind switch is not an erase site.  Shared inputs carry
    // (carryAcrossKinds), and the safety relays re-derive from the
    // confirmed detection so the new kind gets its own relay shape —
    // flagger gains `oneway` (#158) here even though the shoulder
    // branch never captured it.  No detection on record → no relays:
    // absence renders as absence (rule 10).
    let next = carryAcrossKinds(scenario, defaultFor(kind));
    const confirmed = scenario.meta.confirmedRoad;
    if (confirmed) {
      const prior = next;
      const applied = applyClassification(next, confirmed.classification);
      // The operator's in-effect speed outranks the re-applied detection
      // speed — same override-over-detection order as onPickerSave.  The
      // re-application exists to rebuild the relays for the new kind,
      // not to revert a value the operator already reviewed.
      next = applyOverridesToScenario(applied.scenario, {
        speedMph: scenario.speed,
      });
      lastAppliedDetectionRef.current = JSON.stringify(
        confirmed.classification,
      );
      // Fresh notes for the new kind's handoff (e.g. the speed clamp a
      // narrower domain forces) — the old kind's notes no longer apply.
      setHandoff(
        summarizeHandoff({
          prior,
          classification: confirmed.classification,
          overrides: { speedMph: scenario.speed },
          final: next,
          delta: applied.delta,
        }),
      );
    } else {
      // The notes describe the previous kind's handoff — drop them so a
      // stale clamp note can't follow the operator into a different kind.
      setHandoff([]);
    }
    setScenario(next);
  };

  const setMeta = (meta: ScenarioMeta) => {
    setScenario({ ...scenario, meta } as Scenario);
  };

  const onPickerSave = (r: LocationPickerResult) => {
    // Dev-only snapshot wiring (Refs #102): keep the raw detection alive.
    onClassification?.(r.classification ?? null, { lat: r.lat, lng: r.lng });
    const cur = scenarioRef.current;
    // #224 phase 4: a moved pin clears the operator's site-condition
    // corrections in the same patch that rewrites the detection relays —
    // their subject (this corridor's scan) no longer exists.  A re-save
    // at the same pin keeps them (a re-save is not a move).  withPin is
    // THE door: the manual Latitude / Longitude fields go through the
    // same helper (fix-224-manual-pin-move).
    // #290: the pin marks the work, and its direction is derived from the
    // road and the confirmed side — never typed, so the picker returns no
    // bearing and none is kept.  The side is keyed to the road AT the pin:
    // withPin drops it on a move, and a save that confirms a DIFFERENT way
    // drops it here (its travel direction named the old road's geometry).
    const moved = withPin(cur.meta, { lat: r.lat, lng: r.lng });
    const roadChanged =
      (cur.meta.confirmedRoad?.candidate.way_id ?? null) !==
      (r.confirmedRoad?.candidate.way_id ?? null);
    const { bearingDeg: _typed, ...keptMeta } = roadChanged ? withoutSide(moved) : moved;
    void _typed;
    let next: Scenario = {
      ...cur,
      meta: {
        ...keptMeta,
        address: r.address || cur.meta.address,
        // The committed road choice, persisted with the scenario so it
        // survives picker close/reopen and page reload (it rides the
        // saved plan verbatim).  Null overwrites deliberately: a save
        // with no resolved road invalidates a stale confirmation.
        confirmedRoad: r.confirmedRoad,
        // #234: the intersection as the picker saved it — persisted the
        // same way, so a reopen restores its marker and the WHERE fact
        // line names the same crossing.  Null overwrites deliberately:
        // a cleared pin clears the record.
        intersection: r.intersection ?? null,
      },
    } as Scenario;
    let delta: AutoApplyDelta | null = null;
    const detectionJson = r.classification ? JSON.stringify(r.classification) : null;
    const isNewDetection =
      detectionJson !== null && detectionJson !== lastAppliedDetectionRef.current;
    if (r.classification && isNewDetection) {
      const applied = applyClassification(next, r.classification);
      next = applied.scenario;
      delta = applied.delta;
      lastAppliedDetectionRef.current = detectionJson;
    } else if (!r.classification) {
      // #189-3 (Refs #197, clear-on-invalidate): a save with NO resolved
      // road invalidates the applied detection.  Without this branch the
      // previous pin's relays survived under the new coordinates — stale
      // facts riding the wire as if detected here, arming/disarming the
      // backend gates on a road nobody detected.  The relays are removed
      // (absence renders as absence) and the apply-guard resets so a
      // future detection of even the same road is new information.
      next = clearDetectionRelays(next);
      lastAppliedDetectionRef.current = null;
    }
    // #190: apply only CHANGED overrides — mirrors the classification
    // guard above.  A no-change re-save re-emits the restored overrides
    // byte-identically; re-imposing them would revert manual form edits.
    const overridesJson = JSON.stringify(r.overrides);
    const overridesChanged = overridesJson !== lastAppliedOverridesRef.current;
    if (overridesChanged) {
      next = applyOverridesToScenario(next, r.overrides);
      lastAppliedOverridesRef.current = overridesJson;
    }
    // Cross-street candidate → approaches (near_intersection, #117).
    // Fresh-content guard mirrors the classification guard above: an
    // unchanged candidate on re-Apply is NOT new information and must
    // not overwrite approach fields the user has edited since.
    if (next.kind === "near_intersection" && r.crossStreet) {
      const crossJson = JSON.stringify(r.crossStreet);
      if (crossJson !== lastAppliedCrossStreetRef.current) {
        next = {
          ...next,
          approaches: approachesFromCrossStreet(r.crossStreet),
          // Fresh cross-street detection supersedes any recorded
          // override (#177) — the old dispute was about approach relays
          // this patch just replaced.
          detectionOverrides: undefined,
        };
        lastAppliedCrossStreetRef.current = crossJson;
        setApproachConfirm({
          // #174 ruling (option d, 2026-08-03): confirm-on-default.  A
          // substituted count renders identically to a detected one, so
          // the no-tag case holds for confirmation too — the hold's
          // reason says the 1 was assumed, making the acknowledgment
          // (and the minLanes floor, when it bites) explicable.
          pending: true,
          reason:
            r.crossStreet.lanesPerDirection !== null
              ? r.crossStreet.lanesSuspectReason
              : "The map data carries no lane tag for the cross street — " +
                "the lane count was assumed 1 per direction, not detected. " +
                "Confirm it or set the real count.",
        });
      }
    }
    // Name what the handoff did to the values the operator reviewed, so
    // the clamp/skip isn't silent (UX-01/UX-02).  Derived from the raw
    // picker result + the applied scenario; pure frontend metadata.
    // A skipped (unchanged) detection is passed as null — its values were
    // not applied, so no note may claim they were.  Skipped (unchanged)
    // overrides get the same treatment (#190): pass {} so the summary
    // never names an application that didn't happen.
    setHandoff(
      summarizeHandoff({
        prior: cur,
        classification: isNewDetection ? r.classification : null,
        overrides: overridesChanged ? r.overrides : {},
        final: next,
        delta,
      }),
    );
    setScenario(next);
    setPickerOpen(false);
  };

  // R1 (ruled 2026-09-22) — the kind's own fields, as the WHAT band's
  // third row.  §8.22's "which fields render still switches on kind", with
  // the six standard cells above it in the grid.  Each form is the same
  // component it was, minus the cells the grid took; its recovery
  // confirms, its per-kind toggles and its legs are untouched.
  const kindFields = (
    <>
      {/* #289 hand-check, correction 1: the shoulder kind has no form
          left.  Its last four controls are the WHAT band's second group
          (bands/PlanDetails.tsx), so ShoulderForm is deleted rather than
          kept as an empty shell (#262 closes by deletion). */}
      {scenario.kind === "flagger_lane_closure" && (
        <FlaggerForm
          scenario={scenario}
          setScenario={setScenario}
          stepsPending={stepsPending}
        />
      )}
      {scenario.kind === "lane_closure_divided" && (
        <LaneClosureForm scenario={scenario} setScenario={setScenario} />
      )}
      {scenario.kind === "work_beyond_shoulder" && (
        <WorkBeyondShoulderForm
          scenario={scenario}
          setScenario={setScenario}
        />
      )}
      {scenario.kind === "mobile_op_2lane" && (
        <MobileOp2LaneForm scenario={scenario} setScenario={setScenario} />
      )}
      {scenario.kind === "mobile_op_multilane" && (
        <MobileOpMultilaneForm scenario={scenario} setScenario={setScenario} />
      )}
      {scenario.kind === "near_intersection" && (
        <NearIntersectionForm
          scenario={scenario}
          setScenario={setScenario}
          stepsPending={stepsPending}
          approachConfirm={approachConfirm}
          clearApproachConfirm={() =>
            setApproachConfirm({ pending: false, reason: null })
          }
        />
      )}
    </>
  );

  return (
    <>
      {/* #289 Phase 2 — THE BAND STACK REPLACES THE SETUP PANEL.
          §8.16: "Setup panel — dissolved into the band stack.  Its header
          ('Plan' + 'INPUT' tag) is dropped; each band now carries its own
          header."  §8.17: the progress rail is replaced by the move ledger
          inside the open band and by the pending fact lines for steps not
          yet reached — its derived-entry contract is kept, and its
          jump-to-section buttons are gone because there are no off-screen
          sections to jump to.  §8.18: the scenario picker is three kind
          chips inside WHERE.

          What did NOT move out of this file: every handler above.  The
          picker save, the kind switch with its carry-across and its three
          re-apply guards, the handoff summary, the approach-confirm hold
          and `deriveRail` all stay exactly where they were, because the
          redesign is of the surface and not of the wiring.  This component
          is now the pre-generate CONTAINER: state and handlers here, the
          column in `BandStack`. */}
      <BandStack
        scenario={scenario}
        setScenario={setScenario}
        setMeta={setMeta}
        onOpenPicker={() => setPickerOpen(true)}
        onKindChange={onKindChange}
        kindState={kindState}
        onKindPicked={onKindPicked}
        onKindConfirmed={onKindConfirmed}
        openRequest={openRequest}
        onGenerate={onGenerate}
        generating={generating}
        // Rule 139: one derivation feeds the verdict strip, the disabled
        // primary and the ledger's attention rows.  The stack is handed
        // the string; it never asks why.
        blockerReason={rail.blocker?.message ?? null}
        handoff={handoff}
        // Rule 60 / rule 117 — S4.  `generating` is the shell's own
        // in-flight flag, the one the working band reads, so the lock and
        // the band's motion are the same fact seen twice rather than two
        // predicates that can disagree.
        locked={generating}
        corridorSpecLengths={corridorSpecLengths}
        jurisdictionBlock={jurisdictionBlock}
        jurisdictionLoading={jurisdictionLoading}
        jurisdictionErrored={jurisdictionErrored}
        jurisdictionName={jurisdictionName}
        jurisdictionSuggest={jurisdictionSuggest}
        classificationFields={jurisdictionControls}
        kindFields={kindFields}
        // #289 hand-check, 2026-09-23, correction 1: the schedule is no
        // longer a SECTION pasted into the band.  Its controls are cells
        // in the second group's grid and its window block sits under
        // that grid — "the dates control", in Ryan's list of the inputs
        // the 3 × 2 grid does not hold.
        scheduleCells={
          <ScheduleField scenario={scenario} setScenario={setScenario} />
        }
        scheduleWindows={
          <ScheduleWindows
            scenario={scenario}
            jurisdiction={jurisdictionBlock ?? null}
            verifying={jurisdictionRevalidating}
          />
        }
      />
      {/* #193: the picker's close-restore fallback target.  The opener is
          a band control that survives every state, so this is belt and
          braces — kept because removing a focus fallback is the kind of
          deletion that is invisible until someone tabs. */}
      <div ref={locationBlockRef} tabIndex={-1} className="outline-none" />
      {pickerOpen && (
        <LocationPickerModal
          open={pickerOpen}
          initial={{
            address: scenario.meta.address,
            lat: scenario.meta.lat,
            lng: scenario.meta.lng,
            // #290: the overlay is the backend's geometry for this
            // scenario (ruling 7) — the typed bearing and the picker's own
            // length field are retired; the band's Extent is the one
            // length control.
            scenario,
            scenarioKind: scenario.kind,
            // #289 finding 1: the approaches draw only for a confirmed
            // kind, like every other live answer.
            kindConfirmed: kindState === "confirmed",
            speedMph: scenario.speed,
            // #267: the plan's own width facts, for the preview's taper.
            laneWidth: "laneWidth" in scenario ? (scenario.laneWidth as number) : undefined,
            divided: "divided" in scenario ? (scenario.divided as boolean) : undefined,
            confirmedRoad: scenario.meta.confirmedRoad ?? null,
            // #234: handed back so the picker restores the marker.
            intersection: scenario.meta.intersection ?? null,
          }}
          onCancel={() => setPickerOpen(false)}
          onSave={onPickerSave}
          restoreFallbackRef={locationBlockRef}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// #289 Phase 2 — WHAT WAS DELETED FROM THIS FILE, AND WHERE IT WENT
//
// The section components below this point rendered the setup panel, and
// the band stack renders the column now.  Nothing was dropped without a
// destination:
//
//   LocationCorridorSection / UnsetLocation / LocationSummary
//     → the WHERE band.  The pick CTA is rule 114's FIND row; the fact
//       strip's five cells (lat, lng, bearing, speed, jurisdiction) are
//       the move ledger's rows and the band's own provenance (§8.19).
//   SummaryRow / FactCell / CorridorRows / CorridorBar
//     → retired as layout.  The corridor's zone lengths are the extent
//       field's business and Phase 3's aerial; the bar drew a
//       proportion, not a fact.
//   ManualFallback  → components/bands/ManualFallback.tsx, verbatim,
//       because it is the degraded-environment path and the redesign
//       never drew one.
//   handoffNoteText / HandoffNote → components/bands/HandoffNotes.tsx,
//       byte-identical (#198).
//   ScenarioPicker / DisabledScenarioBanner → the kind chips (§8.18,
//       rule 135) and, for the four gated kinds, the one provenance
//       line R2 ruled in their place.
//   ProgressRail (the component) → the move ledger and the pending fact
//       lines (§8.17).  `deriveRail` above is untouched: its
//       derived-entry contract is what moved, not its derivation.
//
// ProjectGroup / ProjectDetailsDisclosure
//   → the WHAT grid's title-block row (#289 hand-check, 2026-09-22,
//     correction 2).  `meta.project` and `meta.locationDescription` are
//     cells with provenance lines; `meta.address` gets none, because it
//     is the WHERE band's search field and one value takes one writer.
// ---------------------------------------------------------------------------
