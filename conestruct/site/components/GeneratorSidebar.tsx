"use client";

import {
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  applyClassification,
  carryAcrossKinds,
  clearDetectionRelays,
  defaultFor,
  hasLocation,
  ENABLED_SCENARIO_KINDS,
  isScenarioKindEnabled,
  SCENARIO_KINDS,
  type AutoApplyDelta,
  type RoadType,
  type Scenario,
  type ScenarioKind,
  type ScenarioMeta,
} from "@/lib/scenarios";
import { applyOverridesToScenario } from "@/lib/scenarios/overrides";
import {
  handoffEventIsCurrent,
  scenarioNoun,
  scenarioTa,
  summarizeHandoff,
  type HandoffEvent,
} from "@/lib/scenarios/handoff-summary";
import {
  MAX_LANES_PER_DIRECTION,
  validateWorkZone,
} from "@/lib/scenarios/validation";
import { deriveRail } from "@/lib/scenarios/rail";
import { JURISDICTION_OPTIONS } from "@/lib/jurisdiction";
import { ProgressRail } from "./ProgressRail";
import type { RoadClassification } from "@/lib/road-detection/types";
import { approachesFromCrossStreet } from "@/lib/road-detection/cross-street";
import type { CorridorSpecLengths, Refusal } from "@/lib/render-types";
import {
  buildCorridorPolyline,
  ZONE_LABEL,
  type CorridorPolyline,
  type CorridorZone,
} from "@/lib/corridor-polyline";
import { ZoneChannelSwatch } from "./ZoneChannelSwatch";
import { ZONE_COLOR } from "@/lib/corridor-zones";
import {
  Field,
  FieldErrorLine,
  FieldGroup,
  GenerateButton,
  LabelRow,
} from "./GeneratorFormPrimitives";
import { ShoulderForm } from "./ShoulderForm";
import { FlaggerForm } from "./FlaggerForm";
import { LaneClosureForm } from "./LaneClosureForm";
import { WorkBeyondShoulderForm } from "./WorkBeyondShoulderForm";
import { MobileOp2LaneForm } from "./MobileOp2LaneForm";
import { MobileOpMultilaneForm } from "./MobileOpMultilaneForm";
import { NearIntersectionForm } from "./NearIntersectionForm";
import { SiteConditionsField } from "./SiteConditionsField";
import { ScheduleField } from "./ScheduleField";
import {
  LocationPickerModal,
  type LocationPickerResult,
  type RoadFieldOverrides,
} from "./LocationPickerModal";

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
  jurisdictionControls?: ReactNode;
  // #227 fact strip: the evaluated jurisdiction's display name (the
  // device-breakdown block's ``name``), null before it loads or when no
  // jurisdiction is named.  The strip falls back to the option label /
  // "None — baseline" — a real answer, never blank.
  jurisdictionName?: string | null;
  // Dev-only replication snapshot (Refs #102, TEMPORARY): surfaces the raw
  // picker classification (plus the pin it was captured at, so a later
  // location edit is detectable as staleness) up to the shell — it
  // otherwise evaporates at the handoff. Delete with DebugSnapshotButton.
  onClassification?: (
    c: RoadClassification | null,
    at: { lat: number; lng: number },
  ) => void;
}

const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  rural_undivided: "Rural — undivided",
  rural_divided: "Rural — divided",
  urban_arterial: "Urban arterial",
  freeway: "Freeway / interstate",
};

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

function fmt6(n: number): string {
  return n.toFixed(6);
}

function fmtFt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
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
  onClassification,
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
  const rail = deriveRail({ scenario, approachConfirm, refusal, refusalPending });
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
    let next: Scenario = {
      ...cur,
      meta: {
        ...cur.meta,
        address: r.address || cur.meta.address,
        lat: r.lat,
        lng: r.lng,
        bearingDeg: r.bearingDeg,
        // The committed road choice, persisted with the scenario so it
        // survives picker close/reopen and page reload (it rides the
        // saved plan verbatim).  Null overwrites deliberately: a save
        // with no resolved road invalidates a stale confirmation.
        confirmedRoad: r.confirmedRoad,
      },
    } as Scenario;
    if (r.workZoneFt > 0) {
      next = { ...next, workLen: r.workZoneFt } as Scenario;
    }
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

  return (
    <>
      {/* Generator restage (Endeavor A): Zone 1's dominant pre-generation
          presentation.  The former 360px sticky sidebar becomes a
          full-width setup panel; the same sections render in a
          two-column grid (single column under 980px).  Post-generation
          the shell swaps this for the slim SetupStrip. */}
      <div className="setup-panel">
        <div className="flex justify-between items-baseline px-6 pt-6 pb-3">
          <h2 className="text-[15px] font-semibold text-white m-0 tracking-[-0.005em]">
            Plan
          </h2>
          {/* #226: same tag treatment as the STEP tags — step-index
              role, --act → dim (the tag is not interactive). */}
          <span className="tr-step">
            INPUT
          </span>
        </div>

        {/* #221: the progress rail — sticky steering line, pre-generate
            only (this panel unmounts post-generate; the tier ledger is
            the post-generate sibling).  Derivation shared with the
            Generate CTA below (one source, lib/scenarios/rail.ts). */}
        <ProgressRail rail={rail} generateAnchorId="rail-step-generate" />

        {/* The kind selection gates which form sections render, so
            the banner + picker span the full panel above the grid. */}
        <DisabledScenarioBanner kind={scenario.kind} />
        <ScenarioPicker value={scenario.kind} onChange={onKindChange} />

        <div className="setup-grid">
        {/* Step 2 — Location leads the grid; the optional project
            metadata (name / description / address) is demoted into a
            collapsed disclosure inside it. */}
        <LocationCorridorSection
          scenario={scenario}
          setMeta={setMeta}
          setScenario={setScenario}
          onOpenPicker={() => setPickerOpen(true)}
          handoff={handoff}
          corridorSpecLengths={corridorSpecLengths}
          jurisdictionName={jurisdictionName}
          blockRef={locationBlockRef}
        />

        {/* #227: the jurisdiction & classification band — the two
            decision cards as a full-width section directly below the
            pin they depend on (the single-column adoption of the PDF's
            row-one band).  Not a numbered step: it has no rail entry
            (#228 owns rail vocabulary) and renumbering Road/Work is out
            of scope.  Pre-pin it renders pending like every downstream
            step (GO standing) — the suggestions it hosts are
            pin-derived. */}
        {jurisdictionControls && (
          <FieldGroup label="Jurisdiction & classification" pending={stepsPending}>
            <div className="jctl-band">{jurisdictionControls}</div>
          </FieldGroup>
        )}

        {scenario.kind === "shoulder" && (
          <ShoulderForm
            scenario={scenario}
            setScenario={setScenario}
            stepsPending={stepsPending}
          />
        )}
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
          <MobileOpMultilaneForm
            scenario={scenario}
            setScenario={setScenario}
          />
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

        {/* Schedule entry lives in Setup (gen2 inc-8) — the hours chip
            reads the same scenario.schedule; the strip inline-edits it
            post-generation. */}
        <ScheduleField
          scenario={scenario}
          setScenario={setScenario}
          step={scheduleStep(scenario.kind)}
          stepsPending={stepsPending}
        />

        <SiteConditionsField
          scenario={scenario}
          setMeta={setMeta}
          step={siteStep(scenario.kind)}
          stepsPending={stepsPending}
        />
        </div>

        {/* id + tabIndex -1 (#221): the rail's trailing Generate entry
            jumps here; never in the Tab order. */}
        <div
          id="rail-step-generate"
          tabIndex={-1}
          className="px-6 pt-6 pb-6 border-t border-[color:var(--rule)] bg-gradient-to-b from-transparent to-black/20 outline-none"
        >
          {/* UX-21 / engine-removal PR D: generation is gated on the
              schema-bound client mirrors (required/ceiling, lanes,
              approaches) AND the backend's own invalid-input verdict —
              the audit fetch's 400 (taper floor and the rest of
              geometry validation).  #196: while that fetch is in flight
              AFTER a settled refusal the CTA stays gated too — the
              re-fetch window is ~5.5 s on a cold start, and a Generate
              click inside it dead-ends (post-generate layout, second
              refusal pointing at an unmounted row).  #186: and on a
              location existing at all — before a pin the package would
              certify lat 0 / lng 0 (the unset sentinel; hasLocation).
              Ranked last: problems with actual edits state their reason
              first.  The server still re-validates every render call.
              #221: the gate + the ranked reason chain moved verbatim to
              lib/scenarios/rail.ts — one source for this CTA and the
              progress rail. */}
          <GenerateButton
            generating={generating}
            onGenerate={onGenerate}
            disabled={rail.blocker !== null}
            disabledReason={rail.blocker?.message}
          />

          <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] text-center">
            Output requires TCS review
          </div>
        </div>
      </div>
      {pickerOpen && (
        <LocationPickerModal
          open={pickerOpen}
          initial={{
            address: scenario.meta.address,
            lat: scenario.meta.lat,
            lng: scenario.meta.lng,
            bearingDeg: scenario.meta.bearingDeg,
            workZoneFt: scenario.workLen,
            scenarioKind: scenario.kind,
            speedMph: scenario.speed,
            confirmedRoad: scenario.meta.confirmedRoad ?? null,
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

// Optional project metadata. Demoted from the top of the panel into a
// collapsed disclosure inside the Location step — it's title-block
// metadata, not part of the required path, so it no longer leads. Renders
// only the fields (no FieldGroup wrapper); the disclosure in
// LocationCorridorSection supplies the heading.
function ProjectGroup({
  scenario,
  setMeta,
}: {
  scenario: Scenario;
  setMeta: (m: ScenarioMeta) => void;
}) {
  const meta = scenario.meta;
  const set = <K extends keyof ScenarioMeta>(key: K, value: ScenarioMeta[K]) =>
    setMeta({ ...meta, [key]: value });
  return (
    <>
      <Field>
        <LabelRow htmlFor="proj-name">Project name</LabelRow>
        <input id="proj-name"
          type="text"
          className="field-input"
          value={meta.project}
          placeholder="I-25 NB MP 184 Resurfacing"
          onChange={(e) => set("project", e.target.value)}
        />
      </Field>

      <Field>
        <LabelRow htmlFor="proj-location">Location description</LabelRow>
        <input id="proj-location"
          type="text"
          className="field-input"
          value={meta.locationDescription ?? ""}
          placeholder="I-25 NB, MP 144.5–146, Colorado Springs"
          onChange={(e) => set("locationDescription", e.target.value)}
        />
      </Field>

      <Field>
        <LabelRow htmlFor="proj-address">Address / intersection</LabelRow>
        <input id="proj-address"
          type="text"
          className="field-input"
          value={meta.address}
          placeholder="US-85 & Bromley Ln, Brighton, CO"
          onChange={(e) => set("address", e.target.value)}
        />
        <div className="tr-prov mt-1.5">
          Title-block metadata — set the work location with the map pin
          above.
        </div>
      </Field>
    </>
  );
}

// Collapsed "Project details" disclosure — holds the optional project
// metadata inside the Location step. Mirrors the "Enter manually" toggle
// pattern used elsewhere in this panel; default collapsed.
function ProjectDetailsDisclosure({
  scenario,
  setMeta,
}: {
  scenario: Scenario;
  setMeta: (m: ScenarioMeta) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-[color:var(--rule)] pt-3 mt-1">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex justify-between items-center font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] hover:text-[color:var(--act)]"
      >
        <span>{open ? "Hide project details" : "Project details"}</span>
        {/* #226: tag = step-index role (dim, not act — ruling 4). */}
        <span className="tr-step">OPTIONAL</span>
      </button>
      {open && (
        <div className="mt-3">
          <ProjectGroup scenario={scenario} setMeta={setMeta} />
        </div>
      )}
    </div>
  );
}

// Top-level wrapper: either renders the "Pick on Map" CTA + manual
// fallback (no location set), or the read-only summary (location set).
function LocationCorridorSection({
  scenario,
  setMeta,
  setScenario,
  onOpenPicker,
  handoff,
  corridorSpecLengths,
  jurisdictionName,
  blockRef,
}: {
  scenario: Scenario;
  setMeta: (m: ScenarioMeta) => void;
  setScenario: (next: Scenario) => void;
  onOpenPicker: () => void;
  handoff: HandoffEvent[];
  corridorSpecLengths: CorridorSpecLengths | null;
  jurisdictionName?: string | null;
  blockRef?: MutableRefObject<HTMLDivElement | null>;
}) {
  const meta = scenario.meta;
  const hasPin = meta.lat !== 0 || meta.lng !== 0;
  return (
    <FieldGroup label="Location" step={2} anchorId="rail-step-location">
      {/* tabIndex -1: the picker's close-restore fallback (#193) —
          present in both pin states, never in the Tab order. */}
      <div ref={blockRef} tabIndex={-1} className="outline-none">
        {hasPin ? (
          <LocationSummary
            scenario={scenario}
            onOpenPicker={onOpenPicker}
            setMeta={setMeta}
            setScenario={setScenario}
            handoff={handoff}
            corridorSpecLengths={corridorSpecLengths}
            jurisdictionName={jurisdictionName ?? null}
          />
        ) : (
          <UnsetLocation
            scenario={scenario}
            setMeta={setMeta}
            setScenario={setScenario}
            onOpenPicker={onOpenPicker}
          />
        )}
      </div>
      <ProjectDetailsDisclosure scenario={scenario} setMeta={setMeta} />
    </FieldGroup>
  );
}

// State: no pin yet.  Primary CTA opens the modal; a smaller "Enter
// manually" link reveals the legacy lat/lng/bearing inputs for
// degraded environments (Mapbox token unset, JS error during modal
// load).
function UnsetLocation({
  scenario,
  setMeta,
  setScenario,
  onOpenPicker,
}: {
  scenario: Scenario;
  setMeta: (m: ScenarioMeta) => void;
  setScenario: (next: Scenario) => void;
  onOpenPicker: () => void;
}) {
  const tokenAvailable =
    (process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "").length > 0;
  // Auto-expand the manual fallback when there's no map to fall back
  // *from*.  Operator can still try the modal but it'll degrade to a
  // numeric-only form, so showing the inline inputs up-front saves a
  // click.
  const [showManual, setShowManual] = useState(!tokenAvailable);
  return (
    <div>
      <button
        type="button"
        onClick={onOpenPicker}
        className="w-full border border-[color:var(--act)] bg-transparent text-[color:var(--act)] font-mono text-[11px] uppercase tracking-[0.1em] py-3 hover:bg-[color:var(--act)] hover:text-[color:var(--on-act)] transition-colors flex items-center justify-center gap-2"
      >
        <svg width="13" height="15" viewBox="0 0 12 14" fill="none">
          <path
            d="M6 1C3.5 1 1.5 3 1.5 5.5C1.5 9 6 13 6 13C6 13 10.5 9 10.5 5.5C10.5 3 8.5 1 6 1Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <circle cx="6" cy="5.5" r="1.5" fill="currentColor" />
        </svg>
        Pick Location on Map
      </button>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] text-center">
        Map · road detect · work zone in one step
      </div>
      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => setShowManual((s) => !s)}
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] hover:text-[color:var(--act)]"
        >
          {showManual ? "Hide manual entry" : "Enter manually"}
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
    </div>
  );
}

// State: pin set.  Read-only summary with an Edit button.
function LocationSummary({
  scenario,
  onOpenPicker,
  setMeta,
  setScenario,
  handoff,
  corridorSpecLengths,
  jurisdictionName,
}: {
  scenario: Scenario;
  onOpenPicker: () => void;
  setMeta: (m: ScenarioMeta) => void;
  setScenario: (next: Scenario) => void;
  handoff: HandoffEvent[];
  corridorSpecLengths: CorridorSpecLengths | null;
  jurisdictionName: string | null;
}) {
  const meta = scenario.meta;
  const [showManual, setShowManual] = useState(false);

  // Only show notes that still describe the current scenario — a manual
  // speed edit after the handoff hides its now-stale clamp note.  If
  // nothing notable happened (clean high-confidence in-domain handoff),
  // this is empty and the summary row doesn't render at all.
  const handoffNotes = handoff.filter((e) =>
    handoffEventIsCurrent(e, scenario),
  );

  // #227 fact strip: the jurisdiction cell is a real answer in every
  // state — the evaluated block's name, the option label while that
  // block is in flight, or "None — baseline" (a valid answer, not an
  // empty; guess-correction on record).
  const jurisdictionCell =
    jurisdictionName ??
    (scenario.jurisdiction_key
      ? (JURISDICTION_OPTIONS.find((o) => o.key === scenario.jurisdiction_key)
          ?.label ?? scenario.jurisdiction_key)
      : "None — baseline");

  // Engine-removal PR D: zone lengths come from the backend
  // (sections.corridor_spec off the audit fetch the shell already makes
  // per change); only the geometry — anchor, bearing, the typed
  // work-zone length — is composed client-side.  When the lengths
  // haven't arrived (first load, deploy window) the preview reads
  // unavailable below; nothing is computed locally.
  //
  // #211 scope note: this sidebar renders LENGTH ROWS ONLY (CorridorRows
  // below) — no geometry is drawn, and totalLengthFt is a sum of the
  // backend zone lengths, independent of any coordinates.
  // buildCorridorPolyline is used purely as that summer, so no
  // centerline is passed and no coverage disclosure applies here (the
  // triage's "sidebar draws the chord" premise was refuted — #211).
  const corridor = useMemo<CorridorPolyline | null>(() => {
    if (!meta.lat || !meta.lng || !scenario.workLen) return null;
    if (!corridorSpecLengths) return null;
    return buildCorridorPolyline({
      anchorLat: meta.lat,
      anchorLng: meta.lng,
      bearingDeg: meta.bearingDeg ?? 0,
      advanceWarningFt: corridorSpecLengths.advance_warning_ft,
      taperFt: corridorSpecLengths.taper_ft,
      bufferFt: corridorSpecLengths.buffer_ft,
      workZoneFt: scenario.workLen,
      downstreamTaperFt: corridorSpecLengths.downstream_taper_ft,
    });
  }, [meta.lat, meta.lng, meta.bearingDeg, scenario.workLen, corridorSpecLengths]);

  return (
    <div className="flex flex-col gap-3">
      {/* #227 fact strip — the pin readout as instrument output, not
          fields (PDF p.3): bordered labeled cells for the read-only
          facts.  Renders in the PINNED state only (GO ruling 1 — the
          pre-pin surface keeps the pick CTA per #222; the deviation
          from the empty-state principle is recorded in the addendum).
          Cell labels take the step-index register (mono caps micro
          labels); values are mono instrument output.  A bearing nobody
          set renders "—" (rule 10). */}
      <SummaryRow label="Location">
        <div className="text-[13px] text-white leading-tight mb-1.5">
          {meta.address || "—"}
        </div>
        <div className="fact-strip">
          <FactCell label="Lat" value={fmt6(meta.lat)} />
          <FactCell label="Lng" value={fmt6(meta.lng)} />
          <FactCell
            label="Bearing"
            value={
              meta.bearingDeg !== undefined
                ? `${Math.round(meta.bearingDeg)}°`
                : "—"
            }
          />
          <FactCell label="Speed" value={`${scenario.speed} mph`} />
          <FactCell label="Jurisdiction" value={jurisdictionCell} />
        </div>
      </SummaryRow>

      {/* Applied-changes summary — names the transformations the picker →
          form handoff made to the values the operator reviewed (UX-01
          clamp/snap; UX-02 low-confidence skip/accept).  Renders only
          when something notable happened.  #227: promoted to the
          system-event container ("a value the user didn't set is a
          system event, not a field annotation") — amber rule, border,
          ⚠ glyph, provenance line 2.  The sentences are the #198
          byte-identity strings, kept as single text nodes. */}
      {handoffNotes.length > 0 && (
        <div className="sys-event warn">
          <div className="tr-section mb-1.5">Applied from picker</div>
          <div className="flex flex-col gap-1.5">
            {handoffNotes.map((e, i) => (
              <HandoffNote key={i} event={e} kind={scenario.kind} />
            ))}
          </div>
          <div className="tr-prov mt-1.5">picker → form handoff</div>
        </div>
      )}

      {/* Corridor extent rows */}
      {corridor && (
        <SummaryRow label="Corridor extent">
          <div className="flex items-baseline justify-between border-b border-[color:var(--rule)] pb-1 mb-1">
            {/* #226: labels the total readout — field-label role (the
                table's tabular restructure is #227). */}
            <span className="tr-field">
              Total
            </span>
            <span className="text-white font-semibold text-[14px] tabular-nums">
              {fmtFt(corridor.totalLengthFt)}
              <span className="text-[10px] font-normal text-[color:var(--ink-on-dark-faint)]">
                {" "}
                ft
              </span>
            </span>
          </div>
          <CorridorRows corridor={corridor} />
        </SummaryRow>
      )}
      {!corridor && (
        <SummaryRow label="Corridor extent">
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)]">
            {!scenario.workLen
              ? "Set work-zone length to compute"
              : // Lengths are backend-fed (PR D); an audit response
                // without them (first load / deploy window) degrades to
                // an honest note, never a locally-computed extent.
                "Corridor extent unavailable — awaiting verification"}
          </div>
        </SummaryRow>
      )}

      <button
        type="button"
        onClick={onOpenPicker}
        className="w-full border border-[color:var(--act)] bg-transparent text-[color:var(--act)] font-mono text-[11px] uppercase tracking-[0.1em] py-2.5 hover:bg-[color:var(--act)] hover:text-[color:var(--on-act)] transition-colors mt-1"
      >
        Edit Location &amp; Corridor →
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowManual((s) => !s)}
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] hover:text-[color:var(--act)]"
        >
          {showManual ? "Hide manual entry" : "Edit manually"}
        </button>
      </div>
      {showManual && (
        <ManualFallback
          scenario={scenario}
          setMeta={setMeta}
          setScenario={setScenario}
        />
      )}
    </div>
  );
}

// One applied-changes note in the LocationSummary.  Commit 2 (UX-01)
// renders the speed clamp/snap events; commit 3 (UX-02) extends the
// switch with the low-confidence skip/accept events.
function handoffNoteText(event: HandoffEvent, kind: Scenario["kind"]): string {
  // Discriminated on field first: "applied" and "clamped" are shared
  // across fields since #198 extended the union.
  switch (event.field) {
    case "speed":
      switch (event.kind) {
        case "clamped": {
          const srcLabel = event.source === "osm" ? "OSM detection" : "manual entry";
          return `Speed ${event.toMph} mph (clamped from ${event.fromMph} mph ${srcLabel} — ${scenarioNoun(kind)} plans cap at ${event.toMph} mph per ${scenarioTa(kind)}).`;
        }
        case "snapped": {
          const srcLabel = event.source === "osm" ? "OSM detection" : "manual entry";
          return `Speed ${event.toMph} mph (snapped from ${event.fromMph} mph ${srcLabel} to the 5-mph grid).`;
        }
        case "accepted_low_confidence":
          return `Speed ${event.valueMph} mph — accepted low-confidence fallback (${event.sourceLabel}).`;
        case "skipped_low_confidence":
          return `Speed fallback ${event.detectedMph} mph not applied — plan uses ${event.inEffectMph} mph (${event.sourceLabel}). Accept it in the picker to use it.`;
      }
      break;
    case "roadType": {
      if (event.kind === "applied") {
        const srcLabel = event.source === "osm" ? "OSM detection" : "manual entry";
        return `Road type set to ${ROAD_TYPE_LABELS[event.to]} (from detected ${ROAD_TYPE_LABELS[event.from]}, ${srcLabel}).`;
      }
      return `Detected ${ROAD_TYPE_LABELS[event.detected]} not valid for ${scenarioNoun(kind)} plans — kept ${ROAD_TYPE_LABELS[event.inEffect]}. Switch scenario kind to use it.`;
    }
    // #198 families 1-3: lanes / divided / laneWidth cross the seam.
    case "lanes": {
      if (event.kind === "clamped") {
        const srcLabel = event.source === "osm" ? "OSM detection" : "manual entry";
        return `Lanes ${event.to}/direction (clamped from ${event.from} ${srcLabel} — plans draw at most ${MAX_LANES_PER_DIRECTION} lanes per direction).`;
      }
      if (event.kind === "applied") {
        const srcLabel = event.source === "osm" ? "OSM detection" : "manual entry";
        return `Lanes set to ${event.to}/direction (${srcLabel} — was ${event.from}).`;
      }
      return `Lanes setting ${event.value}/direction from the picker not applied — ${scenarioNoun(kind)} plans don't take a lane count.`;
    }
    case "divided": {
      if (event.kind === "applied") {
        const srcLabel = event.source === "osm" ? "OSM detection" : "manual entry";
        return `Road set to ${event.to ? "divided" : "undivided"} (${srcLabel} — was ${event.from ? "divided" : "undivided"}).`;
      }
      return `Divided setting from the picker not applied — ${scenarioNoun(kind)} plans don't take a divided toggle.`;
    }
    case "laneWidth":
      return `Lane width set to ${event.toFt} ft (OSM detection — was ${event.fromFt} ft).`;
    // #198 family 4: the reduction cleared by a lowered posted speed.
    case "workZoneSpeed":
      return `Work-zone speed reduction removed (was ${event.wasMph} mph — the posted speed is now ${event.postedMph} mph, at or below it).`;
  }
  // Exhaustive above; TS needs the terminator for the nested switch.
  return "";
}

function HandoffNote({
  event,
  kind,
}: {
  event: HandoffEvent;
  kind: Scenario["kind"];
}) {
  return (
    <div className="flex items-baseline gap-2">
      {/* #227 reconciled vocabulary: the "changed" mark is ⚠ (the
          PDF's ! maps to ⚠); the sentence beside it is the second
          channel (rule 13). */}
      <span className="sys-glyph font-mono" aria-hidden>
        ⚠
      </span>
      <span className="text-[12px] text-[color:var(--ink-on-dark)] leading-snug">
        {handoffNoteText(event, kind)}
      </span>
    </div>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* #226: summary-row headers are mini section names — section
          role (10px replaces the old off-scale 9px). */}
      <div className="tr-section mb-1">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

// #227: one fact-strip cell — a micro label over a mono value.  The
// label rides the step-index register (mono caps dim); the value is
// instrument output.  Read-only by design: coordinates, bearing, speed
// and jurisdiction are edited in the picker / band, never here.
function FactCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact-cell">
      <span className="tr-step">{label}</span>
      <span className="font-mono text-[12px] text-white tabular-nums leading-tight">
        {value}
      </span>
    </div>
  );
}

// Same ordering convention as the modal preview: upstream → downstream
// so the rows — and the bar's segments, which must match them (PDF
// p.2) — read in the direction a motorist encounters the zones.
const CORRIDOR_ORDER: readonly CorridorZone[] = [
  "advance_warning",
  "transition",
  "buffer",
  "work_zone",
  "downstream",
];

function CorridorRows({ corridor }: { corridor: CorridorPolyline }) {
  return (
    <div className="flex flex-col gap-1">
      {CORRIDOR_ORDER.map((zone) => {
        const seg = corridor.segments.find((s) => s.zone === zone);
        const length = seg?.lengthFt ?? 0;
        return (
          <div
            key={zone}
            className="flex items-baseline justify-between gap-2"
          >
            <span className="flex items-center gap-2 min-w-0 flex-1">
              <ZoneChannelSwatch zone={zone} className="flex-shrink-0" />
              {/* #227: the hard-prefixed ✓ is dropped (GO ruling 5) —
                  these rows carry no verdict; ✓ is reserved for
                  confirmed/passing in the one glyph vocabulary. */}
              <span className="text-[11px] text-[color:var(--ink-on-dark)] truncate">
                {ZONE_LABEL[zone]}
              </span>
            </span>
            {/* Right-aligned tabular figures, unit demoted (PDF p.2). */}
            <span className="font-mono text-[11px] text-white tabular-nums whitespace-nowrap">
              {fmtFt(length)}
              <span className="text-[9px] text-[color:var(--ink-on-dark-faint)]">
                {" "}
                ft
              </span>
            </span>
          </div>
        );
      })}
      <CorridorBar corridor={corridor} />
    </div>
  );
}

// #227: the proportional bar — a sanity check under the table, never a
// second source of truth.  RULE 3 MIRROR: the only arithmetic here is
// lengthFt / totalLengthFt, a display proportion of the BACKEND zone
// lengths (sections.corridor_spec + the typed work-zone length summed
// upstream); no MUTCD math, and nothing computed here feeds any value
// anywhere.  The table is authoritative: the bar is aria-hidden and
// unlabeled (PDF p.5), with --bar-seg-min flooring each segment so a
// short taper next to a long work zone never vanishes to a sliver —
// which also means the bar deliberately over-draws small segments and
// must not be read for values.  Segment order matches the rows above.
function CorridorBar({ corridor }: { corridor: CorridorPolyline }) {
  const total = corridor.totalLengthFt;
  if (!(total > 0)) return null;
  return (
    <div className="corridor-bar" aria-hidden>
      {CORRIDOR_ORDER.map((zone) => {
        const seg = corridor.segments.find((s) => s.zone === zone);
        const length = seg?.lengthFt ?? 0;
        if (length <= 0) return null;
        return (
          <div
            key={zone}
            className="corridor-bar-seg"
            style={{
              width: `${(length / total) * 100}%`,
              background: ZONE_COLOR[zone],
            }}
          />
        );
      })}
    </div>
  );
}

function ManualFallback({
  scenario,
  setMeta,
  setScenario,
}: {
  scenario: Scenario;
  setMeta: (m: ScenarioMeta) => void;
  setScenario: (next: Scenario) => void;
}) {
  const meta = scenario.meta;
  // UX-21: same blur-gated inline validation as the per-kind forms —
  // this fallback panel is the third surface that edits workLen.
  const [wzTouched, setWzTouched] = useState(false);
  const wzValidation = validateWorkZone(scenario);
  return (
    <div className="border border-[color:var(--rule)] bg-[color:var(--canvas)] p-3">
      {/* #226: mini-card heading — section role. */}
      <div className="tr-section mb-2">
        Manual entry (fallback)
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="tr-field block mb-1">
            Latitude
          </label>
          <input
            type="number"
            step="0.000001"
            className="field-input w-full"
            value={meta.lat}
            onChange={(e) => setMeta({ ...meta, lat: +e.target.value || 0 })}
          />
        </div>
        <div>
          <label className="tr-field block mb-1">
            Longitude
          </label>
          <input
            type="number"
            step="0.000001"
            className="field-input w-full"
            value={meta.lng}
            onChange={(e) => setMeta({ ...meta, lng: +e.target.value || 0 })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="tr-field block mb-1">
            Bearing (° from N)
          </label>
          <input
            type="number"
            step="1"
            min="0"
            max="359"
            className="field-input w-full"
            value={meta.bearingDeg ?? ""}
            placeholder="0–359"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setMeta({ ...meta, bearingDeg: undefined });
              } else {
                const n = parseInt(raw, 10);
                setMeta({
                  ...meta,
                  bearingDeg: Number.isFinite(n) ? n : undefined,
                });
              }
            }}
          />
        </div>
        <div>
          <label className="tr-field block mb-1">
            Work zone (ft)
          </label>
          <input
            type="number"
            step="10"
            min="0"
            className="field-input w-full"
            value={scenario.workLen || ""}
            placeholder="e.g., 200"
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setScenario({
                ...scenario,
                workLen: Number.isFinite(n) ? n : 0,
              } as Scenario);
            }}
            onBlur={() => setWzTouched(true)}
          />
        </div>
      </div>
      {wzTouched && !wzValidation.ok && (
        <FieldErrorLine>{wzValidation.message}</FieldErrorLine>
      )}
    </div>
  );
}

function ScenarioPicker({
  value,
  onChange,
}: {
  value: ScenarioKind;
  onChange: (v: ScenarioKind) => void;
}) {
  const enabledKinds = SCENARIO_KINDS.filter((k) => isScenarioKindEnabled(k.v));

  if (enabledKinds.length <= 1) {
    const only = enabledKinds[0];
    if (!only) return null;
    return (
      <div className="border-t border-b border-[color:var(--rule)] bg-[color:var(--canvas)]">
        <div className="px-6 py-2 flex justify-between items-center font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
          <span>Scenario</span>
          <span className="text-[color:var(--act)]">STEP 1</span>
        </div>
        <div className="px-6 pb-4 pt-2">
          <div className="px-3 py-3 border border-[color:var(--act)] bg-[color:var(--canvas-tint)] flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-white">
              {only.l}
            </span>
            {/* #226: the TA/sheet citation — provenance role. */}
            <span className="tr-prov">
              {only.sub}
            </span>
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
            Additional scenarios coming soon
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-b border-[color:var(--rule)] bg-[color:var(--canvas)]">
      {/* #226: section + step-index roles (same split as FieldGroup). */}
      <div className="px-6 py-2 flex justify-between items-center">
        <span className="tr-section">Scenario</span>
        <span className="tr-step">STEP 1</span>
      </div>
      <div className="px-6 pb-4 pt-2 flex flex-col gap-2">
        {enabledKinds.map((k) => {
          const active = value === k.v;
          return (
            <button
              key={k.v}
              type="button"
              onClick={() => onChange(k.v)}
              className={[
                "flex items-baseline justify-between text-left px-3 py-3 border transition-colors",
                active
                  ? "border-[color:var(--act)] bg-[color:var(--canvas-tint)]"
                  : "border-[color:var(--rule)] hover:border-[color:var(--ink-on-dark-faint)]",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[13px] font-medium",
                  active ? "text-white" : "text-[color:var(--ink-on-dark)]",
                ].join(" ")}
              >
                {k.l}
              </span>
              {/* #226: the TA/sheet citation — provenance role. */}
              <span className="tr-prov">
                {k.sub}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DisabledScenarioBanner({ kind }: { kind: ScenarioKind }) {
  if (isScenarioKindEnabled(kind)) return null;
  const currentLabel =
    SCENARIO_KINDS.find((k) => k.v === kind)?.l ?? kind;
  const enabledLabel =
    SCENARIO_KINDS.find((k) => k.v === ENABLED_SCENARIO_KINDS[0])?.l ??
    "shoulder closure";
  return (
    <div className="px-6 py-3 border-t border-b border-[color:var(--warn)] bg-[color:var(--canvas)]">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--warn)] mb-1">
        Scenario disabled
      </div>
      <div className="text-[12px] text-[color:var(--ink-on-dark)] leading-snug">
        {`"${currentLabel}" is temporarily disabled while we verify accuracy. ${enabledLabel} is currently available.`}
      </div>
    </div>
  );
}
