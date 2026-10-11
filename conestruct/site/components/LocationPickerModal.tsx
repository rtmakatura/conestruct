"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type RefObject,
} from "react";
import type * as MapboxGL from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type {
  ConfirmedRoad,
  RoadCandidate,
  RoadClassification,
  RoadDetectResponse,
} from "@/lib/road-detection/types";
import { isPreciseGeocode } from "@/lib/geocode-precision";
import { classifyFromCandidate } from "@/lib/road-detection/classify";
import {
  deriveCrossStreet,
  type CrossStreetCandidate,
} from "@/lib/road-detection/cross-street";
import { candidateLabel, crossStreetLabel } from "@/lib/road-detection/labels";
import type { ScenarioKind } from "@/lib/scenarios";
import { scenarioNoun, scenarioTa } from "@/lib/scenarios/handoff-summary";
import {
  CORRIDOR_ZONES,
  ZONE_CHANNEL,
  ZONE_COLOR,
  ZONE_LABEL,
  type CorridorPolyline,
  type CorridorZone,
} from "@/lib/corridor-polyline";
import { ZoneChannelSwatch } from "./ZoneChannelSwatch";
import type { Scenario } from "@/lib/scenarios";
import {
  geometryToPolyline,
  refusalReason,
  useCorridorGeometry,
  type GeometryFetch,
} from "@/lib/corridor-geometry";

type MapboxNamespace = typeof MapboxGL;

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

// Initial values supplied by the parent form. Treat (0, 0) as
// "no pin placed yet" — common case when the user opens the picker
// before having any coords.
export interface LocationPickerInitial {
  address?: string;
  lat?: number;
  lng?: number;
  /**
   * #290 — the scenario as the band holds it.  The overlay is the
   * BACKEND's geometry for it (/render/corridor-geometry, ruling 7), asked
   * with this modal's live pin and road pick in place of the saved ones.
   * Absent (a caller that tracks no scenario) → no overlay is drawn.
   * Replaces the retired ``bearingDeg`` (the typed direction, #298) and
   * ``workZoneFt`` (the band's Extent is the one length control, P2).
   */
  scenario?: Scenario;
  // Pre-existing scenario kind so the corridor preview knows the
  // closure type (shoulder vs lane vs shifting) for taper math.
  scenarioKind: ScenarioKind;
  /**
   * #289 hand-check, 2026-09-23 finding 1 (Rule 10): has a PERSON
   * confirmed `scenarioKind`?  Until they have, it is the discriminant's
   * placeholder.  False → the overlay draws the work alone and the
   * panel says what it is waiting for (the corridor-spec request this
   * once gated is deleted — #301).  Defaults to true
   * for callers that do not track it.
   */
  kindConfirmed?: boolean;
  /**
   * #234 — the intersection marked at the last Save & Close, from
   * ``scenario.meta.intersection`` (near_intersection only).  The picker
   * restores its marker and names the crossing from it without firing
   * detection; moving the pin looks it up again.
   */
  intersection?: { lat: number; lng: number; name: string | null } | null;
  /**
   * The road confirmed at the last Save & Close, from
   * ``scenario.meta.confirmedRoad``.  When present AND its pin matches
   * (lat, lng) exactly, the modal restores that selection as-is and
   * fires ZERO detect calls on open — re-analysis triggers on pin
   * movement only.  A mismatched pin invalidates it (stale record).
   */
  confirmedRoad?: ConfirmedRoad | null;
}

// What the modal hands back on save.  ``classification`` is null when
// auto-detect didn't run (e.g., no Mapbox token, off-road pin, OSM
// timeout); the parent should treat that as "user wants to keep
// existing road fields".  #301 (R123 Q1): the modal edits no road
// property; WHAT is the one place speed, lanes, road type and divided
// are set, so Save carries no overrides.
export interface LocationPickerResult {
  address: string;
  lat: number;
  lng: number;
  classification: RoadClassification | null;
  /**
   * Proposed cross street from the "mark the intersection" second pin
   * (near_intersection kind only, #117).  Null when the kind doesn't
   * apply, the pin wasn't placed, or detection found nothing — the
   * approach form falls back to manual entry.  The parent applies it
   * with the same fresh-detection guard as ``classification`` so a
   * re-apply never clobbers user-edited approach fields (#112).
   */
  crossStreet: CrossStreetCandidate | null;
  /**
   * #234 — the intersection as marked at Save (near_intersection only):
   * the second pin and the cross street's name.  The parent persists it
   * on ``scenario.meta.intersection``; null when no pin is marked.
   */
  intersection: { lat: number; lng: number; name: string | null } | null;
  /**
   * The road choice as committed at Save: candidate identity,
   * classification, determination method, and the pin it was confirmed
   * at.  The parent persists this on ``scenario.meta`` so it survives
   * picker close/reopen and page reload.  Null when no road is resolved
   * (zero candidates, detection error) — an unresolved save honestly
   * clears any previous confirmation.
   */
  confirmedRoad: ConfirmedRoad | null;
}

interface Props {
  open: boolean;
  initial: LocationPickerInitial;
  onCancel: () => void;
  onSave: (result: LocationPickerResult) => void;
  /**
   * #193 — where focus goes on close when the opener no longer exists.
   * The first successful save swaps UnsetLocation ("Pick Location on
   * Map") for the pin summary, detaching the captured opener; without
   * a connected target, focus fell to <body>.  Caller supplies the
   * element that survives that swap (the location block, tabIndex -1).
   */
  restoreFallbackRef?: RefObject<HTMLElement | null>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type MapStyle = "satellite" | "streets";

const MAPBOX_STYLES: Record<MapStyle, string> = {
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  streets: "mapbox://styles/mapbox/streets-v12",
};

const DEFAULT_CENTER: [number, number] = [-105.5, 39.0]; // Colorado
const DEFAULT_ZOOM = 6;
const PIN_ZOOM = 16;
// Zoom for an area-level geocode match (whole town): close enough to
// see the street grid, far enough to show the whole area.
const COARSE_ZOOM = 12;
// #263 P11: a mapbox-gl marker is styled from JS, so this is a literal —
// it MUST equal --dim-deep (pinned by value in ink-literals.test.ts).
const PIN_COLOR = "#E8710A";
// Cross-street (second) pin — teal, matching the work-zone corridor
// segment colour so the two pins read as different jobs on the map.
// #263 P11: MUST equal ZONE_COLOR.work_zone (pinned by value).
const CROSS_PIN_COLOR = "#1EC8A5";

const CORRIDOR_SOURCE_ID = "corridor-source";
const CORRIDOR_LAYER_ID = "corridor-layer";
const CORRIDOR_LABEL_LAYER_ID = "corridor-labels";

// State machine for road detection.  ``awaiting_pick`` is the
// multi-candidate case: no road's properties are synthesized until the
// operator picks one, instead of guessing.
type ClassifyStatus =
  | { state: "idle" }
  | { state: "resolving" }
  | { state: "awaiting_pick" }
  | { state: "detected"; result: RoadClassification }
  | { state: "error"; message: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidLat(n: number): boolean {
  return Number.isFinite(n) && n >= -90 && n <= 90;
}
function isValidLng(n: number): boolean {
  return Number.isFinite(n) && n >= -180 && n <= 180;
}
// A candidate's raw OSM bearing, normalised to 0–359.  (#290: never a
// typed direction any more — the cross-street parallel filter reads it.)
function normaliseBearing(n: number): number {
  const r = ((Math.round(n) % 360) + 360) % 360;
  return r;
}

function fmt4(n: number): string {
  return (Math.round(n * 10000) / 10000).toFixed(4);
}

// #230: what people actually type or paste — the Unicode minus (U+2212,
// docs and some map apps), the en dash (U+2013, word processors) and
// stray whitespace incl. NBSP — normalised to what parseFloat reads.
// Runs on every manual-box change before any parse, and on both halves
// of a pasted "lat, lng" pair.  DMS glyphs are left alone: the DMS
// refusal below must still see them.
function normaliseCoordText(raw: string): string {
  return raw.replace(/[\u2212\u2013]/g, "-").replace(/[\s\u00a0]+/g, "");
}

function fmtFt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("en-US");
}

// Build the marker DOM: a circle "pin" with an arrow extending from its
// centre in the direction of travel.  #290: the direction is the one the
// BACKEND derived from the road and the confirmed side; null (no side yet)
// hides the arrow — a pin with no direction draws none (the pre-side
// ruling: no shape without a direction).
function buildMarkerEl(): {
  root: HTMLDivElement;
  setBearing: (deg: number | null) => void;
} {
  const root = document.createElement("div");
  root.style.position = "relative";
  root.style.width = "24px";
  root.style.height = "24px";
  root.style.cursor = "grab";

  const pin = document.createElement("div");
  pin.style.position = "absolute";
  pin.style.inset = "0";
  pin.style.borderRadius = "50%";
  pin.style.background = PIN_COLOR;
  pin.style.border = "2px solid white";
  pin.style.boxShadow = "0 2px 6px rgba(0,0,0,0.35)";
  pin.style.zIndex = "2";

  const arrowSvg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  arrowSvg.setAttribute("width", "30");
  arrowSvg.setAttribute("height", "44");
  arrowSvg.setAttribute("viewBox", "-15 -44 30 44");
  arrowSvg.style.position = "absolute";
  arrowSvg.style.left = "50%";
  arrowSvg.style.top = "50%";
  arrowSvg.style.marginLeft = "-15px";
  arrowSvg.style.marginTop = "-44px";
  arrowSvg.style.pointerEvents = "none";
  arrowSvg.style.transformOrigin = "50% 100%";
  arrowSvg.style.zIndex = "1";

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", "0");
  line.setAttribute("y1", "0");
  line.setAttribute("x2", "0");
  line.setAttribute("y2", "-32");
  line.setAttribute("stroke", PIN_COLOR);
  line.setAttribute("stroke-width", "3");
  line.setAttribute("stroke-linecap", "round");

  const head = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polygon",
  );
  head.setAttribute("points", "0,-40 -6,-28 6,-28");
  head.setAttribute("fill", PIN_COLOR);
  head.setAttribute("stroke", "white");
  head.setAttribute("stroke-width", "1");

  arrowSvg.appendChild(line);
  arrowSvg.appendChild(head);
  root.appendChild(arrowSvg);
  root.appendChild(pin);

  return {
    root,
    setBearing: (deg: number | null) => {
      arrowSvg.style.display = deg === null ? "none" : "";
      if (deg !== null) arrowSvg.style.transform = `rotate(${deg}deg)`;
    },
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LocationPickerModal({
  open,
  initial,
  onCancel,
  onSave,
  restoreFallbackRef,
}: Props) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const tokenAvailable = token.length > 0;

  const initialHasPin = useMemo(() => {
    return (
      initial.lat !== undefined &&
      initial.lng !== undefined &&
      isValidLat(initial.lat) &&
      isValidLng(initial.lng) &&
      !(initial.lat === 0 && initial.lng === 0)
    );
  }, [initial.lat, initial.lng]);

  // Saved road confirmation to restore, or null.  Valid only when its
  // pin matches the initial pin exactly — the confirmation's contract
  // is "permanent until the pin moves", so a moved pin invalidates it.
  // Fixed at mount: the modal unmounts on close, so this can't go
  // stale within a lifetime.
  const restoredRoad = useMemo<ConfirmedRoad | null>(() => {
    const cr = initial.confirmedRoad;
    if (!cr || !initialHasPin) return null;
    if (cr.pinLat !== initial.lat || cr.pinLng !== initial.lng) return null;
    if (!cr.candidate || !cr.classification) return null;
    return cr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Pin / coord state -------------------------------------------------
  const [address, setAddress] = useState(initial.address ?? "");
  const [hasPin, setHasPin] = useState(initialHasPin);
  const [lat, setLat] = useState(initialHasPin ? initial.lat! : 0);
  const [lng, setLng] = useState(initialHasPin ? initial.lng! : 0);
  // All candidate ways returned by /api/road-bearing within snap range,
  // already deduplicated server-side by (name||ref, class, octant).
  // Length 0 → no road found; 1 → unambiguous (auto-fill behaviour);
  // 2+ → divided-highway or intersection ambiguity, operator must pick.
  const [bearingCandidates, setBearingCandidates] = useState<RoadCandidate[]>(
    restoredRoad ? [restoredRoad.candidate] : [],
  );
  // Pin-level place context returned alongside the candidates.  Drives
  // urban-vs-rural classification when the operator picks a candidate.
  const [detectionContext, setDetectionContext] = useState<{
    isUrban: boolean;
    placeName: string | null;
  }>(
    restoredRoad
      ? { isUrban: restoredRoad.isUrban, placeName: restoredRoad.placeName }
      : { isUrban: false, placeName: null },
  );
  // Which candidate is currently reflected in the bearing field.  Null
  // means "no selection yet" (multi-candidate case before the operator
  // picks).  Single-candidate case auto-selects index 0.
  const [selectedCandidateIdx, setSelectedCandidateIdx] = useState<
    number | null
  >(restoredRoad ? 0 : null);
  // Determination method of a restored confirmation.  A restored road
  // renders as a single candidate even when it was originally an
  // operator pick among several — this ref keeps the original method
  // for the re-save.  Cleared the moment fresh detection runs.
  const confirmedMethodRef = useRef<"auto_single" | "operator_pick" | null>(
    restoredRoad?.method ?? null,
  );
  const [latInput, setLatInput] = useState(
    initialHasPin ? fmt4(initial.lat!) : "",
  );
  const [lngInput, setLngInput] = useState(
    initialHasPin ? fmt4(initial.lng!) : "",
  );
  const [latError, setLatError] = useState<string | null>(null);
  const [lngError, setLngError] = useState<string | null>(null);

  // ---- Search / geocode --------------------------------------------------
  const [searchQuery, setSearchQuery] = useState(initial.address ?? "");
  const [searchStatus, setSearchStatus] = useState<
    | { state: "idle" }
    | { state: "resolving" }
    | { state: "error"; message: string }
  >({ state: "idle" });

  // ---- Bearing detection warning ----------------------------------------
  const [bearingWarning, setBearingWarning] = useState<string | null>(null);
  // Guidance line for an area-level geocode match ("Lafayette, CO"):
  // the map recentred but no pin was placed and no detection fired.
  const [coarseNotice, setCoarseNotice] = useState<string | null>(null);

  // ---- Road-property classification --------------------------------------
  const [classify, setClassify] = useState<ClassifyStatus>(
    restoredRoad
      ? { state: "detected", result: restoredRoad.classification }
      : { state: "idle" },
  );

  // ---- Cross street (near_intersection kind only, #117) ------------------
  // Second pin marking the intersection.  The map's click handler
  // routes here while ``intersectionMode`` is armed; detection then
  // runs the same /api/road-bearing call at the intersection point and
  // deriveCrossStreet turns it into one proposed approach prefill.
  const isNearIntersectionKind = initial.scenarioKind === "near_intersection";
  const [intersectionMode, setIntersectionMode] = useState(false);
  const intersectionModeRef = useRef(false);
  intersectionModeRef.current = intersectionMode;
  // #234: a saved intersection restores the pin and its name — no
  // detection fires on open (the confirmedRoad rehydration's rule);
  // moving the pin looks the crossing up again.
  const restoredCross =
    isNearIntersectionKind && initial.intersection ? initial.intersection : null;
  const [crossPin, setCrossPin] = useState<{ lat: number; lng: number } | null>(
    restoredCross ? { lat: restoredCross.lat, lng: restoredCross.lng } : null,
  );
  const [crossStatus, setCrossStatus] = useState<
    "idle" | "resolving" | "detected" | "none" | "error" | "restored"
  >(restoredCross ? "restored" : "idle");
  const [crossStreet, setCrossStreet] = useState<CrossStreetCandidate | null>(
    null,
  );
  const crossMarkerRef = useRef<MapboxGL.Marker | null>(null);
  const crossTokenRef = useRef(0);

  // ---- Map / basemap -----------------------------------------------------
  const [style, setStyle] = useState<MapStyle>("satellite");
  // Toggle to surface the lat/lng fallback inputs when the user is
  // working without an interactive map.  Auto-enabled when the Mapbox
  // token is missing.
  const [showManualCoords, setShowManualCoords] = useState(!tokenAvailable);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxGL.Map | null>(null);
  const markerRef = useRef<MapboxGL.Marker | null>(null);
  const setMarkerBearingRef = useRef<((deg: number | null) => void) | null>(null);
  // #290: the backend's derived direction of travel at the pin, or null.
  const markerTravelRef = useRef<number | null>(null);
  const mapboxRef = useRef<MapboxNamespace | null>(null);
  // Mirrors the latest computed corridor so the deferred ``installCorridor``
  // handler can push current data when the map's ``load`` fires *after*
  // the corridor was computed.  Without this, opening the modal with an
  // already-set work-zone length would race and never paint the line.
  const corridorDataRef = useRef<CorridorPolyline | null>(null);
  // Each detect call gets a token; only the latest call's result is
  // allowed to mutate state, so a fast drag doesn't get a stale snap
  // from an earlier request.  One pipeline now → one token.
  const bearingTokenRef = useRef(0);

  // ---- The corridor: the BACKEND's geometry (#290, ruling 7) -------------
  // The overlay used to fetch zone lengths (/api/render/corridor-spec) and
  // walk them out from the pin along the typed bearing itself — a frontend
  // mirror of corridor math (Rule 3) whose direction #298 found inverted.
  // Now it asks /api/render/corridor-geometry for the corridor as the plan
  // lays it: the work segment from the pin, each approach upstream of it.
  // The question is the band's scenario with THIS modal's live pin and
  // road pick in place of the saved ones.  The confirmed side is kept only
  // while the pin and the road are the ones it was confirmed on; otherwise
  // the answer is "side not confirmed" and the map draws the pin and the
  // ruled sentence, nothing directional.
  const kindConfirmed = initial.kindConfirmed ?? true;
  const pickedCandidate =
    selectedCandidateIdx !== null ? (bearingCandidates[selectedCandidateIdx] ?? null) : null;
  const baseScenario = initial.scenario ?? null;
  const previewScenario = useMemo<Scenario | null>(() => {
    if (!baseScenario || !hasPin || !isValidLat(lat) || !isValidLng(lng)) return null;
    const samePin = baseScenario.meta.lat === lat && baseScenario.meta.lng === lng;
    const sameRoad =
      (baseScenario.meta.confirmedRoad?.candidate.way_id ?? null) ===
      (pickedCandidate?.way_id ?? null);
    const { bearingDeg: _typed, work, ...meta } = baseScenario.meta;
    void _typed;
    return {
      ...baseScenario,
      meta: {
        ...meta,
        lat,
        lng,
        ...(samePin && sameRoad && work ? { work } : {}),
        // Only the relay reads this (candidate + the pin it is keyed to):
        // it materializes the road's geometry and direction facts.
        confirmedRoad: pickedCandidate
          ? ({ candidate: pickedCandidate, pinLat: lat, pinLng: lng } as ConfirmedRoad)
          : null,
      },
    } as Scenario;
  }, [baseScenario, hasPin, lat, lng, pickedCandidate]);

  // #186/#211: while detection is resolving or a multi-candidate pick is
  // pending, NOTHING binds the drawing to a road, so nothing is asked and
  // nothing is drawn — absence renders as absence.
  const pendingPick =
    classify.state === "resolving" || classify.state === "awaiting_pick";
  const geometry: GeometryFetch = useCorridorGeometry(
    open && !pendingPick ? previewScenario : null,
  );
  const laidOut = geometry.state === "ready" ? geometry.geometry : null;
  // Rule 112: before the kind is confirmed only the work segment draws.
  const corridor = useMemo<CorridorPolyline | null>(
    () => (laidOut ? geometryToPolyline(laidOut, { showApproaches: kindConfirmed }) : null),
    [laidOut, kindConfirmed],
  );
  const drawnCorridor = pendingPick ? null : corridor;
  // The pre-side ruling: the pin and one sentence, nothing else.
  const awaitingSide = laidOut?.status === "side_not_confirmed";
  // #290 hand-check: the backend could not lay this corridor out — its
  // reason is stated, never a blank map (Rule 10).
  const refusal = refusalReason(laidOut);
  const travel = laidOut?.status === "laid_out" ? laidOut.travel_bearing_deg : null;
  useEffect(() => {
    markerTravelRef.current = travel;
    setMarkerBearingRef.current?.(travel);
  }, [travel]);

    // Sync the corridor onto the live map.  ``corridorDataRef`` is the
  // canonical "what should the line show" so the deferred installer
  // (running on ``load`` after style swap or initial init) can read it.
  // When ``drawnCorridor`` is null we clear the source so a half-edited
  // state doesn't leave a stale line behind.
  useEffect(() => {
    corridorDataRef.current = drawnCorridor;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(CORRIDOR_SOURCE_ID) as
      | MapboxGL.GeoJSONSource
      | undefined;
    if (!source) return;
    const fc =
      drawnCorridor?.featureCollection ??
      ({
        type: "FeatureCollection",
        features: [],
      } as GeoJSON.FeatureCollection);
    source.setData(fc as never);
  }, [drawnCorridor]);

  // Shared fitBounds helper.  Used by the one-shot initial auto-fit
  // and by the explicit "Recenter on corridor" button — never on
  // routine pin moves or length edits.
  const recenterToCorridor = useCallback(
    (bbox: [number, number, number, number]) => {
      const map = mapRef.current;
      if (!map) return;
      const [w, s, e, n] = bbox;
      try {
        map.fitBounds(
          [
            [w, s],
            [e, n],
          ],
          {
            padding: { top: 80, right: 80, bottom: 60, left: 80 },
            maxZoom: 17,
            duration: 600,
          },
        );
      } catch {
        // fitBounds throws when both corners are identical (zero-length
        // bbox).  Ignore — there's nothing to recenter on.
      }
    },
    [],
  );

  // Auto-fit fires AT MOST ONCE per modal lifetime, and only when the
  // modal opens with a pre-existing corridor (the "Edit Location &
  // Corridor" flow with a saved plan).  After that, the camera stays
  // wherever the operator left it — drags, length edits, bearing
  // changes, road picks all just redraw the polyline.
  // Use the Recenter button to get a "show me everything" view back.
  const shouldAutoFitInitialRef = useRef(
    initialHasPin && (initial.scenario?.workLen ?? 0) > 0,
  );
  useEffect(() => {
    if (!corridor) return;
    if (!shouldAutoFitInitialRef.current) return;
    shouldAutoFitInitialRef.current = false;
    recenterToCorridor(corridor.bbox);
  }, [corridor, recenterToCorridor]);

  // ESC to cancel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  // fix-spec-02 P1·05·04 — focus containment (the dialog role, aria-modal
  // and Esc shipped in engine-removal PR D; trap/initial/restore did not):
  //   * on open, move focus INTO the dialog (the container itself,
  //     tabindex=-1, so the reader announces "Define work zone" without
  //     scroll-jumping to a field),
  //   * Tab / Shift+Tab wrap at the dialog's edges instead of escaping
  //     to the page behind the overlay,
  //   * on close, focus returns to the control that opened the modal.
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onTrapKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      // No visibility filter needed: this modal conditionally renders
      // its sections (&&), it never display:none-hides a focusable.
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (active && !root.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onTrapKey);
    return () => {
      document.removeEventListener("keydown", onTrapKey);
      // #193: restore to the opener only if it still exists — after the
      // first successful save it doesn't (UnsetLocation swaps to the
      // pin summary), and focusing a detached node silently no-ops,
      // stranding focus on <body>.
      if (opener?.isConnected) opener.focus();
      else restoreFallbackRef?.current?.focus();
    };
  }, [open, restoreFallbackRef]);

  // Lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ---- Detection: bearing + classification -------------------------------

  // Unified detection: one /api/road-bearing call returns deduped
  // candidates + pin-level place context.  Bearing and properties are
  // both derived from the picked (or auto-picked) candidate, so the
  // two can never disagree.  This collapses the previous two-pipeline
  // arrangement that produced the state-inconsistency bug and the
  // candidate-list inaccuracy together.
  const detectAt = useCallback(
    async (qLat: number, qLng: number) => {
      const myToken = ++bearingTokenRef.current;
      // Contract: confirmed choices are permanent until the pin moves —
      // and the moment it moves, nothing from the previous pin may
      // render, not even dimmed.  A stale road selection silently feeds
      // street class into jurisdiction rules downstream, so the list,
      // the selection, and any restored confirmation all clear NOW; the
      // loading skeleton (classify: resolving) takes their place.
      setBearingCandidates([]);
      setSelectedCandidateIdx(null);
      setBearingWarning(null);
      confirmedMethodRef.current = null;
      setClassify({ state: "resolving" });
      try {
        const r = await fetch("/api/road-bearing", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lat: qLat, lng: qLng }),
        });
        if (bearingTokenRef.current !== myToken) return;
        if (!r.ok) {
          setBearingWarning("Couldn't reach road-detection service.");
          setBearingCandidates([]);
          setSelectedCandidateIdx(null);
          setClassify({
            state: "error",
            message: "Detection service unavailable",
          });
          return;
        }
        const j = (await r.json()) as RoadDetectResponse;
        if (bearingTokenRef.current !== myToken) return;
        if (j.scan_status === "unavailable") {
          // #213: the scan never completed — say so and stamp NOTHING.
          // No detectionContext (the silent isUrban:false rural default
          // was the bug), and no absence claim (that copy is reserved
          // for a completed scan below).  The ↻ Re-detect roads control
          // is the retry affordance.
          setBearingWarning(
            "Road detection is unavailable right now. Use ↻ Re-detect roads to retry.",
          );
          setBearingCandidates([]);
          setSelectedCandidateIdx(null);
          setClassify({
            state: "error",
            message: "Detection service unavailable",
          });
          return;
        }
        const cands = j.candidates ?? [];
        setDetectionContext({ isUrban: j.isUrban, placeName: j.placeName });
        if (cands.length === 0) {
          setBearingWarning(
            "No road detected within 30 m. Verify the location. With no road, the band asks which way traffic heads.",
          );
          setBearingCandidates([]);
          setSelectedCandidateIdx(null);
          setClassify({
            state: "error",
            message: "No road detected at this point",
          });
          return;
        }
        setBearingWarning(null);
        setBearingCandidates(cands);
        if (cands.length === 1) {
          // Unambiguous — select it and synthesize properties from the
          // candidate's OSM tags.  (#290: no direction of travel is
          // adopted from its bearing.)
          const only = cands[0];
          setSelectedCandidateIdx(0);
          setClassify({
            state: "detected",
            result: classifyFromCandidate(only, j.isUrban, j.placeName),
          });
        } else {
          // Multi-candidate: hold the property panel in awaiting_pick until the operator commits to a
          // road.  The rail-top card renders itself off the candidate
          // data — no toggle to raise here.
          setSelectedCandidateIdx(null);
          setClassify({ state: "awaiting_pick" });
        }
      } catch {
        if (bearingTokenRef.current === myToken) {
          setBearingWarning("Couldn't reach road-detection service.");
          setBearingCandidates([]);
          setSelectedCandidateIdx(null);
          setClassify({
            state: "error",
            message: "Detection service unavailable",
          });
        }
      }
    },
    [],
  );

  // ---- Cross-street detection (near_intersection kind, #117) ------------
  // Everything the second-pin derivation needs, mirrored into a ref:
  // the map click handler that arms it is created once at map init.
  const crossDetectCtxRef = useRef<{ mainline: RoadCandidate | null }>({
    mainline: null,
  });
  crossDetectCtxRef.current = {
    mainline:
      selectedCandidateIdx !== null
        ? (bearingCandidates[selectedCandidateIdx] ?? null)
        : null,
  };

  const placeCrossPin = useCallback(async (qLat: number, qLng: number) => {
    if (!isValidLat(qLat) || !isValidLng(qLng)) return;
    setCrossPin({ lat: qLat, lng: qLng });
    setIntersectionMode(false);

    const map = mapRef.current;
    const mapbox = mapboxRef.current;
    if (map && mapbox) {
      if (!crossMarkerRef.current) {
        crossMarkerRef.current = new mapbox.Marker({ color: CROSS_PIN_COLOR })
          .setLngLat([qLng, qLat])
          .addTo(map);
      } else {
        crossMarkerRef.current.setLngLat([qLng, qLat]);
      }
    }

    const myToken = ++crossTokenRef.current;
    setCrossStatus("resolving");
    try {
      const r = await fetch("/api/road-bearing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lat: qLat, lng: qLng }),
      });
      if (crossTokenRef.current !== myToken) return;
      if (!r.ok) {
        setCrossStreet(null);
        setCrossStatus("error");
        return;
      }
      const j = (await r.json()) as RoadDetectResponse;
      if (crossTokenRef.current !== myToken) return;
      if (j.scan_status === "unavailable") {
        // #213: same guard as the mainline path — an unavailable scan
        // is the error state, never a derived "no cross street" (and
        // never deriveCrossStreet's isUrban-driven rural default).
        setCrossStreet(null);
        setCrossStatus("error");
        return;
      }
      const ctx = crossDetectCtxRef.current;
      // #290: raw facts only — the cross street's name, legs, signal,
      // speed and lanes.  Where it sits relative to the work is the
      // backend's to measure from the marked pin (ruling 7); the station
      // this used to derive from the pin and the corridor lengths is gone.
      const derived = deriveCrossStreet({
        detection: j,
        mainlineWayId: ctx.mainline?.way_id ?? null,
        mainlineName: ctx.mainline?.name ?? null,
        mainlineBearingDeg: ctx.mainline ? normaliseBearing(ctx.mainline.bearing) : null,
      });
      setCrossStreet(derived);
      setCrossStatus(derived ? "detected" : "none");
    } catch {
      if (crossTokenRef.current === myToken) {
        setCrossStreet(null);
        setCrossStatus("error");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearCrossPin = useCallback(() => {
    crossTokenRef.current++;
    setCrossPin(null);
    setCrossStreet(null);
    setCrossStatus("idle");
    setIntersectionMode(false);
    crossMarkerRef.current?.remove();
    crossMarkerRef.current = null;
  }, []);

  // ---- Marker / pin management ------------------------------------------

  const ensureMarker = useCallback(
    (mlat: number, mlng: number, mbearing: number | null) => {
      const map = mapRef.current;
      const mapbox = mapboxRef.current;
      if (!map || !mapbox) return;

      if (!markerRef.current) {
        const { root, setBearing: setBrg } = buildMarkerEl();
        setMarkerBearingRef.current = setBrg;
        const marker = new mapbox.Marker({
          element: root,
          draggable: true,
          anchor: "center",
        })
          .setLngLat([mlng, mlat])
          .addTo(map);
        marker.on("dragend", () => {
          const ll = marker.getLngLat();
          applyPinPosition(ll.lat, ll.lng, { detect: true, fly: false });
        });
        markerRef.current = marker;
      } else {
        markerRef.current.setLngLat([mlng, mlat]);
      }
      setMarkerBearingRef.current?.(mbearing);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Single source of truth for "the pin is now at these coords": updates
  // state, repositions the marker, optionally pans the map, optionally
  // fires /api/road-bearing (the unified detection endpoint).
  //
  // ``targetZoom`` only matters when ``fly`` is true.  Pass it for
  // initial-load / search-bar navigation (bumps up from a state-level
  // view to street level).  Omit it for pin drags / typed-coord moves
  // so the camera *preserves* whatever zoom the operator landed on
  // — small refinements shouldn't suddenly jump them to street level.
  const applyPinPosition = useCallback(
    (
      newLat: number,
      newLng: number,
      opts: {
        detect: boolean;
        fly: boolean;
        targetZoom?: number;
        // #230: a typed change never has its box rewritten under the
        // caret — the keystroke path owns the box text; the pin/detect
        // still follow every valid prefix exactly as before.
        keepInputs?: boolean;
      },
    ) => {
      if (!isValidLat(newLat) || !isValidLng(newLng)) return;
      setHasPin(true);
      setCoarseNotice(null);
      setLat(newLat);
      setLng(newLng);
      if (!opts.keepInputs) {
        setLatInput(fmt4(newLat));
        setLngInput(fmt4(newLng));
      }
      setLatError(null);
      setLngError(null);

      ensureMarker(newLat, newLng, markerTravelRef.current);

      const map = mapRef.current;
      if (map && opts.fly) {
        const z = map.getZoom();
        const targetZ =
          opts.targetZoom !== undefined && z < opts.targetZoom
            ? opts.targetZoom
            : z;
        map.flyTo({
          center: [newLng, newLat],
          zoom: targetZ,
          essential: true,
        });
      }

      if (opts.detect) {
        void detectAt(newLat, newLng);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ensureMarker, detectAt],
  );

  // Snap the map (if pin is off-screen) and the pin to provided coords.
  // Used after typing-in coordinates.
  const applyTypedCoords = useCallback(
    (newLat: number, newLng: number, keepInputs = false) => {
      const map = mapRef.current;
      let needFly = true;
      if (map) {
        const bounds = map.getBounds();
        if (bounds && bounds.contains([newLng, newLat])) needFly = false;
      }
      applyPinPosition(newLat, newLng, {
        detect: true,
        fly: needFly,
        keepInputs,
      });
    },
    [applyPinPosition],
  );

  // ---- Mapbox initialisation --------------------------------------------

  useEffect(() => {
    if (!open || !tokenAvailable) return;
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    let map: MapboxGL.Map | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const resizeTimers: ReturnType<typeof setTimeout>[] = [];

    (async () => {
      const mod = await import("mapbox-gl");
      if (cancelled) return;
      const mapbox = ((mod as unknown as { default?: MapboxNamespace }).default ??
        (mod as unknown as MapboxNamespace)) as MapboxNamespace;
      mapboxRef.current = mapbox;

      const initialCenter: [number, number] = initialHasPin
        ? [initial.lng!, initial.lat!]
        : DEFAULT_CENTER;
      const initialZoom = initialHasPin ? PIN_ZOOM : DEFAULT_ZOOM;

      map = new mapbox.Map({
        accessToken: token,
        container: el,
        style: MAPBOX_STYLES[style],
        center: initialCenter,
        zoom: initialZoom,
        attributionControl: true,
      });
      mapRef.current = map;

      map.addControl(new mapbox.NavigationControl(), "top-right");

      map.on("click", (e: MapboxGL.MapMouseEvent) => {
        const { lat: clat, lng: clng } = e.lngLat;
        // While "mark the intersection" is armed (near_intersection
        // kind), a click places the cross-street pin instead of moving
        // the work-zone pin.
        if (intersectionModeRef.current) {
          void placeCrossPin(clat, clng);
          return;
        }
        applyPinPosition(clat, clng, { detect: true, fly: false });
      });

      // Mapbox caches the canvas size from ``new Map()`` time.  Belt-
      // and-suspenders: observe ongoing resizes, AND kick resize()
      // multiple times during the first ~600 ms, AND on the map's own
      // load/idle events.
      resizeObserver = new ResizeObserver(() => {
        mapRef.current?.resize();
      });
      resizeObserver.observe(el);
      const kick = () => mapRef.current?.resize();
      map.on("load", kick);
      map.on("idle", kick);
      requestAnimationFrame(kick);
      for (const ms of [50, 150, 350, 700]) {
        resizeTimers.push(setTimeout(kick, ms));
      }

      // Add the corridor source + a single layer that colours by zone
      // property.  Idempotent — fires on initial ``load`` and again on
      // every ``styledata`` (because setStyle wipes sources).  After
      // (re)install, push the latest corridor data so an in-flight
      // edit doesn't go missing during a basemap toggle.
      const installCorridor = () => {
        if (!map) return;
        if (!map.getSource(CORRIDOR_SOURCE_ID)) {
          map.addSource(CORRIDOR_SOURCE_ID, {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
          });
        }
        // #131: one line layer per zone.  A mapbox-gl ``line-dasharray``
        // can't be data-driven, so colour-alone (the old single match layer)
        // is replaced by per-zone layers each carrying a distinct dash + a
        // monotonic width from the shared ZONE_CHANNEL table — legible to a
        // colour-blind reader and in grayscale.  Colour is kept as the
        // redundant cue.
        for (const zone of CORRIDOR_ZONES) {
          const layerId = `${CORRIDOR_LAYER_ID}-${zone}`;
          if (map.getLayer(layerId)) continue;
          const ch = ZONE_CHANNEL[zone];
          const dashed = ch.dash.length > 1;
          map.addLayer({
            id: layerId,
            type: "line",
            source: CORRIDOR_SOURCE_ID,
            filter: ["==", ["get", "zone"], zone],
            layout: {
              "line-join": "round",
              "line-cap": dashed ? "butt" : "round",
            },
            paint: {
              "line-width": 4 + ch.widthRank, // rank 1..5 → 5..9 px
              // #211: beyond-coverage footage (the tangent continuation
              // past the road geometry) dims to 0.35 — a luminance
              // channel that survives grayscale, leaving the zone's
              // dash + width identity untouched.  0.35 vs 0.9 CHOSEN,
              // display-only.  The extent panel carries the text form.
              "line-opacity": [
                "case",
                ["boolean", ["get", "extended"], false],
                0.35,
                0.9,
              ],
              "line-color": ZONE_COLOR[zone],
              ...(dashed ? { "line-dasharray": ch.dash } : {}),
            },
          });
        }
        // Midpoint zone labels — the strongest non-colour channel (#131).
        // One label per segment at its centre.  Zoom-gated (minzoom 13) and
        // collision-managed (mapbox drops overlapping labels by default) so
        // they never blanket the roadway at overview zoom; below the gate
        // the dash + width channel still carries zone identity.
        if (!map.getLayer(CORRIDOR_LABEL_LAYER_ID)) {
          map.addLayer({
            id: CORRIDOR_LABEL_LAYER_ID,
            type: "symbol",
            source: CORRIDOR_SOURCE_ID,
            minzoom: 13,
            // #211: zones can split into covered + extended features;
            // exactly one per zone carries ``labeled`` so the
            // line-center label never doubles.
            filter: ["boolean", ["get", "labeled"], false],
            layout: {
              "symbol-placement": "line-center",
              "text-field": [
                "match",
                ["get", "zone"],
                "advance_warning",
                ZONE_LABEL.advance_warning,
                "transition",
                ZONE_LABEL.transition,
                "buffer",
                ZONE_LABEL.buffer,
                "work_zone",
                ZONE_LABEL.work_zone,
                "downstream",
                ZONE_LABEL.downstream,
                /* default */ "",
              ],
              "text-size": 11,
              "text-letter-spacing": 0.05,
              "text-padding": 4,
            },
            // #263 P11: DECORATIVE — zone-label paint inside a Mapbox style
            // expression, where a CSS var() is impossible; declared in
            // lib/design/ink-exceptions.ts.
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "#000000",
              "text-halo-width": 1.4,
            },
          });
        }
        const current = corridorDataRef.current;
        const source = map.getSource(CORRIDOR_SOURCE_ID) as
          | MapboxGL.GeoJSONSource
          | undefined;
        if (source) {
          source.setData(
            (current?.featureCollection ?? {
              type: "FeatureCollection",
              features: [],
            }) as never,
          );
        }
      };
      map.on("load", installCorridor);
      map.on("styledata", installCorridor);

      if (initialHasPin) {
        ensureMarker(initial.lat!, initial.lng!, markerTravelRef.current);
        if (!restoredRoad) {
          // No valid saved confirmation for this pin — run detection so
          // road properties + corridor populate on first open of an
          // already-located plan.  With a restored confirmation the
          // selection is already in state and opening the dialog is NOT
          // a re-analysis trigger: zero detect calls fire (use the
          // explicit "Re-detect roads" affordance for a fresh look).
          void detectAt(initial.lat!, initial.lng!);
        }
        // #234: the saved intersection's marker, restored — the defect
        // #234 filed ("Intersection marker not restored when the picker
        // is reopened").
        if (restoredCross && !crossMarkerRef.current) {
          crossMarkerRef.current = new mapbox.Marker({ color: CROSS_PIN_COLOR })
            .setLngLat([restoredCross.lng, restoredCross.lat])
            .addTo(map);
        }
      } else {
        const initialAddress = (initial.address ?? "").trim();
        if (initialAddress.length > 0) {
          setSearchStatus({ state: "resolving" });
          try {
            const r = await fetch("/api/geocode", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ address: initialAddress }),
            });
            if (cancelled) return;
            if (r.ok) {
              const j = (await r.json()) as {
                lat: number;
                lng: number;
                placeType?: string | null;
              };
              setSearchStatus({ state: "idle" });
              if (!isPreciseGeocode(j.placeType ?? null)) {
                // Area-level match (town/region centroid) — recenter
                // only.  No pin, no detection: a road detected at a
                // centroid is a confidently wrong road.
                setCoarseNotice(
                  "Area located. Drop a pin on the road to detect roads.",
                );
                mapRef.current?.flyTo({
                  center: [j.lng, j.lat],
                  zoom: COARSE_ZOOM,
                  essential: true,
                });
              } else {
                applyPinPosition(j.lat, j.lng, {
                  detect: true,
                  fly: true,
                  targetZoom: PIN_ZOOM,
                });
              }
            } else {
              const msg =
                r.status === 503
                  ? "Geocoding not configured"
                  : r.status === 404
                    ? "No match for that address"
                    : `Geocoding failed (${r.status})`;
              setSearchStatus({ state: "error", message: msg });
            }
          } catch (err) {
            if (!cancelled) {
              setSearchStatus({
                state: "error",
                message: (err as Error).message,
              });
            }
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      for (const t of resizeTimers) clearTimeout(t);
      if (map) map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setMarkerBearingRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tokenAvailable, token]);

  // Switch basemap style on the existing map without re-initialising.
  // ``setStyle`` clears all sources, so the corridor layer reinstalls
  // itself in the ``styledata`` listener above.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(MAPBOX_STYLES[style]);
  }, [style]);

  // ---- Field handlers ---------------------------------------------------

  // #230: a pasted "lat, lng" pair in EITHER box fills both (replacing
  // whatever they held) and places the pin.  Returns false when the
  // text is not a pair so the caller continues as a single value.
  const trySplitPair = (text: string): boolean => {
    if (!text.includes(",")) return false;
    const [a, b] = text.split(",");
    const la = parseFloat(a);
    const lo = parseFloat(b);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
    setLatInput(fmt4(la));
    setLngInput(fmt4(lo));
    setLatError(isValidLat(la) ? null : "Latitude must be between -90 and 90");
    setLngError(isValidLng(lo) ? null : "Longitude must be between -180 and 180");
    if (isValidLat(la) && isValidLng(lo)) {
      applyTypedCoords(la, lo);
    }
    return true;
  };

  // #230: a pasted pair replaces both boxes whatever they held — the
  // paste event carries the clipboard text on its own, so a pair pasted
  // after a half-typed value never concatenates into one number.
  const onCoordPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = normaliseCoordText(e.clipboardData.getData("text"));
    if (trySplitPair(text)) e.preventDefault();
  };

  const onLatChange = (raw: string) => {
    if (/[°'"NSEW]/i.test(raw)) {
      setLatError("Use decimal degrees (e.g., 38.8862). DMS not supported.");
      setLatInput(raw);
      return;
    }
    const text = normaliseCoordText(raw);
    if (trySplitPair(text)) return;
    setLatInput(text);
    if (text === "") {
      setLatError(null);
      return;
    }
    const n = parseFloat(text);
    if (!Number.isFinite(n)) {
      setLatError("Invalid number");
      return;
    }
    if (!isValidLat(n)) {
      setLatError("Latitude must be between -90 and 90");
      return;
    }
    setLatError(null);
    if (isValidLng(parseFloat(lngInput))) {
      applyTypedCoords(n, parseFloat(lngInput), true);
    }
  };

  const onLngChange = (raw: string) => {
    if (/[°'"NSEW]/i.test(raw)) {
      setLngError("Use decimal degrees (e.g., -104.8354). DMS not supported.");
      setLngInput(raw);
      return;
    }
    const text = normaliseCoordText(raw);
    if (trySplitPair(text)) return;
    setLngInput(text);
    if (text === "") {
      setLngError(null);
      return;
    }
    const n = parseFloat(text);
    if (!Number.isFinite(n)) {
      setLngError("Invalid number");
      return;
    }
    if (!isValidLng(n)) {
      setLngError("Longitude must be between -180 and 180");
      return;
    }
    setLngError(null);
    if (isValidLat(parseFloat(latInput))) {
      applyTypedCoords(parseFloat(latInput), n, true);
    }
  };

  // Apply a specific candidate: select it and synthesize the road
  // properties from its OSM tags.  Used by the picker buttons.  (#290:
  // the direction of travel is derived by the backend from the road and
  // the side.)
  const applyCandidate = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= bearingCandidates.length) return;
      const c = bearingCandidates[idx];
      setSelectedCandidateIdx(idx);
      setClassify({
        state: "detected",
        result: classifyFromCandidate(
          c,
          detectionContext.isUrban,
          detectionContext.placeName,
        ),
      });
    },
    [bearingCandidates, detectionContext],
  );

  // Explicit fresh analysis at an unmoved pin — the ONLY way to re-run
  // detection without moving the pin (reopening the dialog is not a
  // trigger).  Same semantics as a pin move.
  const onRedetect = () => {
    if (!hasPin || !isValidLat(lat) || !isValidLng(lng)) return;
    void detectAt(lat, lng);
  };

  // ---- Search bar / geocode ---------------------------------------------

  const onSubmitSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const q = searchQuery.trim();
      if (!q) return;
      setSearchStatus({ state: "resolving" });
      setCoarseNotice(null);
      try {
        const r = await fetch("/api/geocode", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address: q }),
        });
        if (!r.ok) {
          const msg =
            r.status === 503
              ? "Geocoding not configured"
              : r.status === 404
                ? "No match for that address"
                : `Geocoding failed (${r.status})`;
          setSearchStatus({ state: "error", message: msg });
          return;
        }
        const j = (await r.json()) as {
          lat: number;
          lng: number;
          placeType?: string | null;
        };
        setSearchStatus({ state: "idle" });
        if (!isPreciseGeocode(j.placeType ?? null)) {
          // Coarse match (locality/place, e.g. "Lafayette, CO"):
          // recenter the map and ask for a pin.  Detection fires only
          // for address/intersection-precision results or a real pin
          // drop — never for a town centroid.
          setCoarseNotice(
            "Area located. Drop a pin on the road to detect roads.",
          );
          mapRef.current?.flyTo({
            center: [j.lng, j.lat],
            zoom: COARSE_ZOOM,
            essential: true,
          });
          return;
        }
        setAddress(q);
        applyPinPosition(j.lat, j.lng, {
          detect: true,
          fly: true,
          targetZoom: PIN_ZOOM,
        });
      } catch (err) {
        setSearchStatus({ state: "error", message: (err as Error).message });
      }
    },
    [searchQuery, applyPinPosition],
  );

  // ---- Save / cancel ----------------------------------------------------

  // #139: an ambiguous detection is a decision the operator must make,
  // not a suggestion Save may ignore.  Before this guard, Save could
  // fire in awaiting_pick and silently commit the new pin coordinates
  // with the PREVIOUS location's road properties.  Deliberate behavior
  // change riding with the fix: a hand-typed bearing is no longer an
  // escape from the pick — road properties stay unresolved either way.
  // Zero-candidate and detection-error paths remain saveable.
  const roadUnresolved =
    bearingCandidates.length > 1 && selectedCandidateIdx === null;

  // #189: an in-flight classification blocks Save — the road facts (and
  // on gated kinds, the safety relays that arm the backend refusals) are
  // genuinely unknown for the moment, and saving would commit
  // ``classification: null`` as if detection had never run.  Only
  // in-flight blocks: a settled failure (error / zero candidates) keeps
  // its existing messaging and stays saveable.
  const canSave =
    hasPin &&
    isValidLat(lat) &&
    isValidLng(lng) &&
    !latError &&
    !lngError &&
    !roadUnresolved &&
    classify.state !== "resolving";

  const onClickSave = () => {
    if (!canSave) return;
    // The committed road choice, keyed to the pin it was made at.  A
    // restored single-candidate list keeps its original determination
    // method via confirmedMethodRef; fresh detection derives it from
    // the candidate count.
    const pickedCandidate =
      classify.state === "detected" && selectedCandidateIdx !== null
        ? (bearingCandidates[selectedCandidateIdx] ?? null)
        : null;
    const confirmedRoad: ConfirmedRoad | null =
      pickedCandidate && classify.state === "detected"
        ? {
            candidate: pickedCandidate,
            classification: classify.result,
            method:
              bearingCandidates.length > 1
                ? "operator_pick"
                : (confirmedMethodRef.current ?? "auto_single"),
            isUrban: detectionContext.isUrban,
            placeName: detectionContext.placeName,
            pinLat: lat,
            pinLng: lng,
          }
        : null;
    onSave({
      address,
      lat,
      lng,
      classification: classify.state === "detected" ? classify.result : null,
      crossStreet: isNearIntersectionKind ? crossStreet : null,
      // #234: the pin and its name, as the picker shows them — a fresh
      // detection's name, or the restored one when the pin was not moved.
      intersection:
        isNearIntersectionKind && crossPin
          ? {
              lat: crossPin.lat,
              lng: crossPin.lng,
              name:
                crossStatus === "restored"
                  ? (restoredCross?.name ?? null)
                  : (crossStreet?.name ?? null),
            }
          : null,
      confirmedRoad,
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 md:p-6"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="border border-[color:var(--rule)] bg-[color:var(--canvas-tint)] flex flex-col w-full h-full md:w-[90vw] md:h-[90vh] md:max-w-[1280px] md:max-h-[880px] overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Define work zone"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[color:var(--rule)] px-6 py-3 flex-shrink-0">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--dim)] mb-1">
              Work zone · Define
            </div>
            <h2 className="text-white text-[17px] font-semibold m-0">
              Define Work Zone
            </h2>
            {/* #290 hand-check item 4: the length field left the picker (the
                band's Extent is the one length, P2), so the subtitle stops
                asking for it; the pin's meaning is what it says instead. */}
            <p
              className="text-[12px] text-[color:var(--ink-on-dark-faint)] mt-1 m-0"
              data-testid="picker-subtitle"
            >
              Drop a pin where the work starts, and pick the road.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="text-[color:var(--ink-on-dark-faint)] hover:text-white px-2 py-1"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M3 3l12 12M15 3L3 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Body: two columns at md — 980px in this repo's Tailwind config,
            the closest breakpoint to the spec's ~900px (lg here is 1280,
            NOT the stock 1024) — map column left, decision rail right,
            rail scrolls on its own, map never leaves the viewport.  Below
            md it collapses to today's stacked flow — map on top, panels
            beneath, the whole body scrolls. */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto md:flex-row md:overflow-hidden">
          {/* Map column: search, manual coords, the map itself, and the
              detection warning all live here so the rail isn't pushed
              down by them. */}
          <div className="flex flex-col md:flex-1 md:min-w-0">
            {/* Search bar */}
            <form
              onSubmit={onSubmitSearch}
              className="flex gap-2 border-b border-[color:var(--rule)] px-6 py-2 flex-shrink-0"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Address or intersection search"
                placeholder="Address or intersection (e.g., I-25 & Bijou St, Colorado Springs)"
                className="field-input flex-1"
              />
              <button
                type="submit"
                disabled={
                  searchStatus.state === "resolving" || !searchQuery.trim()
                }
                className="border border-[color:var(--act)] bg-transparent text-[color:var(--act)] font-mono text-[11px] uppercase tracking-[0.1em] px-4 hover:bg-[color:var(--act)] hover:text-[color:var(--on-act)] transition-colors disabled:opacity-40"
              >
                {searchStatus.state === "resolving" ? "Searching…" : "Search"}
              </button>
            </form>
            {searchStatus.state === "error" && (
              <div className="px-6 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fail)] flex-shrink-0">
                {searchStatus.message}
              </div>
            )}
            {coarseNotice && (
              <div className="px-6 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark)] flex-shrink-0">
                {coarseNotice}
              </div>
            )}

            {/* Manual-coords toggle + collapsible row.  Sits directly under
                the search bar so it reads as an alternative to address
                search rather than a buried fallback at the modal foot.
                Auto-expanded when the Mapbox token is missing. */}
            <div className="border-b border-[color:var(--rule)] px-6 py-1.5 flex-shrink-0 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowManualCoords((s) => !s)}
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] hover:text-[color:var(--act)]"
              >
                {showManualCoords
                  ? "− Hide coordinate entry"
                  : "+ Or enter coordinates manually"}
              </button>
              {showManualCoords && (
                <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
                  Lat / Lng decimal degrees
                </span>
              )}
            </div>
            {showManualCoords && (
              <div className="grid grid-cols-2 gap-3 border-b border-[color:var(--rule)] px-6 py-2 flex-shrink-0">
                <div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={latInput}
                    onChange={(e) => onLatChange(e.target.value)}
                    onPaste={onCoordPaste}
                    aria-label="Latitude"
                    placeholder="Latitude (e.g., 38.8862)"
                    className="field-input w-full"
                  />
                  {latError && (
                    <div className="mt-1 font-mono text-[10px] text-[color:var(--fail)]">
                      {latError}
                    </div>
                  )}
                </div>
                <div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={lngInput}
                    onChange={(e) => onLngChange(e.target.value)}
                    onPaste={onCoordPaste}
                    aria-label="Longitude"
                    placeholder="Longitude (e.g., -104.8354)"
                    className="field-input w-full"
                  />
                  {lngError && (
                    <div className="mt-1 font-mono text-[10px] text-[color:var(--fail)]">
                      {lngError}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Map. Stacked mode keeps today's 44vh band; at md the pane
                is flex-1 and fills whatever height the modal has. */}
            {tokenAvailable ? (
              <div
                ref={containerRef}
                className="relative bg-black/30 flex-shrink-0 min-h-[320px] h-[44vh] md:h-auto md:shrink md:flex-1"
              >
                <button
                  type="button"
                  onClick={() =>
                    setStyle(style === "satellite" ? "streets" : "satellite")
                  }
                  className="absolute top-3 left-3 z-10 border border-white/30 bg-black/60 text-white font-mono text-[10px] uppercase tracking-[0.08em] px-3 py-1.5 hover:bg-black/80"
                >
                  {style === "satellite" ? "Streets" : "Satellite"}
                </button>
                {!hasPin && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-black/70 text-white text-[12px] px-3 py-1.5 rounded font-mono uppercase tracking-[0.08em] pointer-events-none">
                    Click the map or search to drop a pin
                  </div>
                )}
                {/* #290, the pre-side ruling: "before the side is
                    confirmed, the picker draws the pin and the sentence
                    'Say which side is occupied to lay out the work' — no
                    segment, and no direction-free circle". */}
                {hasPin && awaitingSide && (
                  <div
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-black/70 text-white text-[12px] px-3 py-1.5 rounded font-mono uppercase tracking-[0.08em] pointer-events-none"
                    data-testid="picker-side-sentence"
                  >
                    {SIDE_SENTENCE}
                  </div>
                )}
                {/* Bottom-right stack: Recenter button (above) + legend.
                    Recenter is the explicit "show me the whole corridor"
                    control; we no longer auto-refit on pin drags. */}
                {corridor && (
                  <div className="absolute bottom-3 right-3 z-10 flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => recenterToCorridor(corridor.bbox)}
                      title="Recenter on corridor"
                      aria-label="Recenter on corridor"
                      className="bg-black/75 border border-white/20 text-white p-1.5 hover:bg-black/90 hover:border-[color:var(--act)] transition-colors flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em]"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="8"
                          cy="8"
                          r="5.5"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                        <line
                          x1="8"
                          y1="0.5"
                          x2="8"
                          y2="3"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                        <line
                          x1="8"
                          y1="13"
                          x2="8"
                          y2="15.5"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                        <line
                          x1="0.5"
                          y1="8"
                          x2="3"
                          y2="8"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                        <line
                          x1="13"
                          y1="8"
                          x2="15.5"
                          y2="8"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                        <circle cx="8" cy="8" r="1.25" fill="currentColor" />
                      </svg>
                      Recenter
                    </button>
                    <CorridorLegend zones={corridor.segments.map((z) => z.zone)} />
                  </div>
                )}
              </div>
            ) : (
              <div
                className="relative bg-black/30 flex items-center justify-center text-center px-6 flex-shrink-0 min-h-[240px] h-[30vh] md:h-auto md:shrink md:flex-1"
              >
                <div className="text-[color:var(--ink-on-dark-faint)] text-[13px] max-w-md">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--none)] mb-2">
                    Map unavailable
                  </div>
                  NEXT_PUBLIC_MAPBOX_TOKEN is not configured. The interactive
                  map can&apos;t load. Enter coordinates manually below.
                </div>
              </div>
            )}

            {/* Bearing detection warning lives just below the map so it's
                visible the moment classification surfaces a problem. */}
            {bearingWarning && (
              <div className="border-t border-[color:var(--rule)] px-6 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--warn)] flex-shrink-0">
                {bearingWarning}
              </div>
            )}
          </div>

          {/* Decision rail: everything the operator decides, stacked in
              one fixed-width column that scrolls independently at md.
              Below md it renders beneath the map, as before. */}
          <div className="flex flex-col border-t md:border-t-0 md:border-l border-[color:var(--rule)] md:w-[456px] md:flex-none">
            <div className="md:flex-1 md:min-h-0 md:overflow-y-auto">
              {/* Detection-outcome card — first block in the rail.  Once
                  a pin exists and detection has run (or is running), it
                  always shows exactly one of: in-flight skeleton,
                  single-match confirmed card, multi-candidate pick list,
                  or an explicit empty state — never nothing (#152 A).
                  Keyed on the candidate set so a fresh detection resets
                  the card's collapse state. */}
              {hasPin && classify.state !== "idle" && (
                <DetectionOutcomeCard
                  key={bearingCandidates.map((c) => c.way_id).join("|")}
                  classifyState={classify.state}
                  emptyMessage={
                    classify.state === "error" ? classify.message : null
                  }
                  candidates={bearingCandidates}
                  selectedIdx={selectedCandidateIdx}
                  onPick={applyCandidate}
                />
              )}
              {/* #301 (R123 Q1): the road-properties panel is gone; WHAT is
                  the one place speed, lanes, road type and divided are
                  set.  Its explicit fresh-analysis affordance stays:
                  reopening the dialog never re-detects (a restored
                  confirmation stays put), so this is the one control that
                  re-runs detection at an unmoved pin. */}
              {hasPin && classify.state !== "idle" && classify.state !== "resolving" && (
                <div className="px-6 py-2 border-b border-[color:var(--rule)] flex justify-end">
                  <button
                    type="button"
                    onClick={onRedetect}
                    data-testid="picker-redetect"
                    className="border border-[color:var(--rule)] bg-transparent text-[color:var(--ink-on-dark)] font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1 hover:border-[color:var(--act)] hover:text-[color:var(--act)] transition-colors"
                  >
                    ↻ Re-detect roads
                  </button>
                </div>
              )}

              <div className="border-t border-[color:var(--rule)]">
                {isNearIntersectionKind && (
                  <CrossStreetPanel
                    hasPin={hasPin}
                    intersectionMode={intersectionMode}
                    onToggleMode={() => setIntersectionMode((v) => !v)}
                    crossPin={crossPin}
                    crossStatus={crossStatus}
                    crossStreet={crossStreet}
                    restoredName={restoredCross?.name ?? null}
                    onClear={clearCrossPin}
                  />
                )}
                <CorridorPreviewPanel
                  corridor={corridor}
                  hasPin={hasPin}
                  status={
                    !baseScenario
                      ? "idle"
                      : geometry.state === "error"
                        ? "error"
                        : geometry.state === "loading" && !laidOut
                          ? "loading"
                          : awaitingSide
                            ? "side"
                            : refusal !== null
                              ? "refused"
                              : !kindConfirmed
                              ? "kind"
                              : "ready"
                  }
                  pendingPick={pendingPick}
                  refusal={refusal}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[color:var(--rule)] px-6 py-3 flex-shrink-0">
          {roadUnresolved && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--warn)]">
              <span aria-hidden="true">⚠ </span>
              Pick a road to continue
            </span>
          )}
          {classify.state === "resolving" && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
              Detecting road… Save turns on once detection settles
            </span>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 font-sans text-[13px] text-[color:var(--ink-on-dark)] hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClickSave}
            disabled={!canSave}
            className="px-6 py-2 font-sans text-[13px] bg-[color:var(--act)] text-[color:var(--on-act)] hover:bg-[color:var(--act-bright)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-panels (private to this file)
// ---------------------------------------------------------------------------

// Cross-street marking for the near_intersection kind (#117).  The
// operator arms the mode, clicks the intersection on the map, and the
// detected cross street is summarised here.  Every derived value is a
// PROPOSAL — the approach form is where it lands, editable, with the
// lane count held for explicit confirmation.
function CrossStreetPanel({
  hasPin,
  intersectionMode,
  onToggleMode,
  crossPin,
  crossStatus,
  crossStreet,
  restoredName,
  onClear,
}: {
  hasPin: boolean;
  intersectionMode: boolean;
  onToggleMode: () => void;
  crossPin: { lat: number; lng: number } | null;
  crossStatus: "idle" | "resolving" | "detected" | "none" | "error" | "restored";
  crossStreet: CrossStreetCandidate | null;
  /** #234: the name saved with a restored intersection. */
  restoredName: string | null;
  onClear: () => void;
}) {
  return (
    <div className="border-t border-[color:var(--rule)] px-6 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--ink-on-dark-faint)] mb-2">
        Cross street
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMode}
          disabled={!hasPin}
          className={`px-3 py-1.5 font-sans text-[12px] border disabled:opacity-40 disabled:cursor-not-allowed ${
            intersectionMode
              ? "border-[color:var(--act)] text-[color:var(--act)]"
              : "border-[color:var(--rule)] text-[color:var(--ink-on-dark)] hover:text-white"
          }`}
        >
          {intersectionMode
            ? "Click the intersection on the map…"
            : crossPin
              ? "Move the intersection pin"
              : "Mark the intersection on the map"}
        </button>
        {crossPin && (
          <button
            type="button"
            onClick={onClear}
            className="px-2 py-1.5 font-sans text-[12px] text-[color:var(--ink-on-dark-faint)] hover:text-white"
          >
            Clear
          </button>
        )}
      </div>
      {!hasPin && (
        <p className="text-[11px] text-[color:var(--ink-on-dark-faint)] mt-2 m-0">
          Drop the work-zone pin first, then mark where the cross street
          meets this road.
        </p>
      )}
      {crossStatus === "resolving" && (
        <p className="text-[11px] text-[color:var(--ink-on-dark-faint)] mt-2 m-0">
          Looking up the cross street…
        </p>
      )}
      {crossStatus === "none" && (
        <p className="text-[11px] text-[color:var(--warn)] mt-2 m-0">
          No cross street found at that point. You can still describe the
          approaches by hand in the form.
        </p>
      )}
      {crossStatus === "error" && (
        <p className="text-[11px] text-[color:var(--fail)] mt-2 m-0">
          Couldn&apos;t reach the road-detection service. Describe the
          approaches by hand in the form.
        </p>
      )}
      {crossStatus === "restored" && (
        <p className="text-[11px] text-[color:var(--ink-on-dark)] mt-2 m-0" data-testid="cross-restored">
          {/* #234: the saved crossing, named by the one producer the WHERE
              fact line reads — no detection fires on open. */}
          {crossStreetLabel(restoredName)}: marked at your last save. Move
          the intersection pin to look it up again.
        </p>
      )}
      {crossStatus === "detected" && crossStreet && (
        <p className="text-[11px] text-[color:var(--ink-on-dark)] mt-2 m-0">
          {crossStreetLabel(crossStreet.name)}:{" "}
          {crossStreet.legCount === 1 ? "one-way" : "two-way"}
          {crossStreet.signalized ? ", signal detected" : ""}. The plan
          places it along the road from where the work starts. You&apos;ll
          confirm the details in the form.
        </p>
      )}
    </div>
  );
}

// Static legend bar.  Positioning is owned by the parent — this is
// rendered inside the bottom-right stack alongside the Recenter
// button, so it shouldn't carry its own absolute coords.
// Rule 109: a row per channel DRAWN — the work alone before the kind is
// confirmed, all five once the approaches lay out.
function CorridorLegend({ zones }: { zones: CorridorZone[] }) {
  const order: CorridorZone[] = [
    "advance_warning",
    "transition",
    "buffer",
    "work_zone",
    "downstream",
  ];
  const rows = order.filter((z) => zones.includes(z)).map((zone) => ({ zone }));
  return (
    <div className="bg-black/75 border border-white/15 px-3 py-2 flex flex-col gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-white max-w-[200px]">
      {rows.map((r) => (
        <div key={r.zone} className="flex items-center gap-2 whitespace-nowrap">
          <ZoneChannelSwatch zone={r.zone} className="flex-shrink-0" />
          <span>{ZONE_LABEL[r.zone]}</span>
        </div>
      ))}
    </div>
  );
}

function DetectionOutcomeCard({
  classifyState,
  emptyMessage,
  candidates,
  selectedIdx,
  onPick,
}: {
  classifyState: ClassifyStatus["state"];
  emptyMessage: string | null;
  candidates: RoadCandidate[];
  selectedIdx: number | null;
  onPick: (idx: number) => void;
}) {
  if (classifyState === "resolving") {
    return (
      <div className="border-b border-[color:var(--rule)] px-6 py-3">
        <div className="border border-[color:var(--rule)] px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--ink-on-dark-faint)] flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block w-3 h-3 rounded-full border-[1.5px] border-[color:var(--act)]/40 border-t-[color:var(--act)] animate-spin"
            />
            Detecting roads at pin…
          </div>
          <div
            className="w-3/4 mt-2 h-[10px] bg-[color:var(--rule)] animate-pulse"
            aria-hidden
          />
        </div>
      </div>
    );
  }
  if (candidates.length === 0) {
    // Empty and error states are both explicit outcomes (rule 10): the
    // chromeless ◌ marks "nothing found", not a failure color.
    return (
      <div className="border-b border-[color:var(--rule)] px-6 py-3">
        <div className="border border-[color:var(--rule)] px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--none)]">
            <span aria-hidden>◌ </span>
            {emptyMessage ?? "No roads detected"}
          </div>
          <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)]">
            {/* #290: there is no direction to set here any more — with
                no road, the band asks which way traffic heads. */}
            Set road properties in Step 2, or drag the pin closer to the
            roadway. With no road, the band asks which way traffic heads.
          </div>
        </div>
      </div>
    );
  }
  if (candidates.length === 1) {
    return (
      <div className="border-b border-[color:var(--rule)] px-6 py-3">
        <div className="border border-[color:var(--rule)] px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--ink-on-dark-faint)]">
            <span aria-hidden className="text-[color:var(--pass)]">
              ✓{" "}
            </span>
            Road detected · 1 match
          </div>
          <div className="mt-2">
            {/* Same row affordance as the multi-list, pre-selected —
                clicking re-applies the sole candidate's bearing and
                properties (idempotent). */}
            <CandidatePicker
              candidates={candidates}
              selectedIdx={selectedIdx ?? 0}
              onPick={onPick}
            />
          </div>
        </div>
      </div>
    );
  }
  return (
    <WhichRoadCard
      candidates={candidates}
      selectedIdx={selectedIdx}
      onPick={onPick}
    />
  );
}

// Multi-candidate disambiguation card (Concept A inc-3).  Rendered by
// DetectionOutcomeCard when detection returned more than one candidate
// road.  Unpicked, it holds the full picker, framed as the blocking
// decision it is: amber warning treatment with a glyph and words, never
// hue alone (rule 13) — and amber, not orange, because in the workbench
// orange means generated output and this card is entirely controls.
// Once picked it collapses to a one-line confirmed summary (reusing
// CandidateCaption) with an explicit Change affordance.
function WhichRoadCard({
  candidates,
  selectedIdx,
  onPick,
}: {
  candidates: RoadCandidate[];
  selectedIdx: number | null;
  onPick: (idx: number) => void;
}) {
  // Collapse/re-expand after a pick is card-local UI state; the parent
  // keys this component on the candidate set, so a fresh detection
  // mounts a fresh card and the state can never go stale.
  const [reExpanded, setReExpanded] = useState(false);
  const expanded = selectedIdx === null || reExpanded;
  const picked =
    selectedIdx !== null ? (candidates[selectedIdx] ?? null) : null;
  return (
    <div className="border-b border-[color:var(--rule)] px-6 py-3">
      <div className="border border-[color:var(--warn)] bg-[color:var(--warn-soft)] px-3 py-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--warn)]">
          <span aria-hidden="true">⚠ </span>
          Which road? · {candidates.length} detected
        </div>
        {expanded ? (
          <div className="mt-2">
            <CandidatePicker
              candidates={candidates}
              selectedIdx={selectedIdx}
              onPick={(idx) => {
                setReExpanded(false);
                onPick(idx);
              }}
            />
          </div>
        ) : (
          picked && (
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark)]">
                <CandidateCaption candidate={picked} />
              </span>
              {/* act-bright, not act: on the amber-tinted card bg the
                  base cyan measures 4.09:1 — under the 4.5 AA text
                  floor.  act-bright measures 5.06:1 (hover fill 7.73). */}
              <button
                type="button"
                onClick={() => setReExpanded(true)}
                className="flex-shrink-0 border border-[color:var(--act-bright)] bg-transparent text-[color:var(--act-bright)] font-mono text-[10px] uppercase tracking-[0.08em] px-2 py-1 hover:bg-[color:var(--act-bright)] hover:text-[color:var(--on-act)] transition-colors"
              >
                Change
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// One-line caption summarising the selected candidate.  Used both in
// the unambiguous case (single road found) and after the operator picks
// one in the multi-candidate case.
function CandidateCaption({ candidate }: { candidate: RoadCandidate }) {
  const lbl = candidateLabel(candidate);
  const brg = normaliseBearing(candidate.bearing);
  return (
    <>
      Detected from OSM: {brg}° ({lbl.primary} {lbl.direction.toLowerCase()},{" "}
      {lbl.sub.toLowerCase()}) · way {candidate.way_id}
    </>
  );
}

// Picker rows shown inside the Which-road card when /api/road-bearing
// returns multiple candidates within snap range (the divided-highway
// case).  Each candidate is a button: clicking sets the bearing field,
// the arrow, AND the road-property panel (via classifyFromCandidate in
// the parent applyCandidate handler).  Snap distance + way id ride
// visibly on each row so the operator can tell the carriageways apart
// (previously tooltip-only).
function CandidatePicker({
  candidates,
  selectedIdx,
  onPick,
}: {
  candidates: RoadCandidate[];
  selectedIdx: number | null;
  onPick: (idx: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {candidates.map((c, idx) => {
        const lbl = candidateLabel(c);
        const brg = normaliseBearing(c.bearing);
        const selected = idx === selectedIdx;
        return (
          <button
            key={`${c.way_id}-${idx}`}
            type="button"
            onClick={() => onPick(idx)}
            className={`text-left px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] border transition-colors ${
              selected
                ? "border-[color:var(--act-bright)] bg-[color:var(--act)]/15 text-white"
                : // faint border, not --rule: on the amber-tinted card bg
                  // --rule measures 1.02:1 (invisible); faint is 4.04:1.
                  // act-bright on hover/selected: 5.06:1 vs act's 4.09.
                  "border-[color:var(--ink-on-dark-faint)] text-[color:var(--ink-on-dark)] hover:border-[color:var(--act-bright)] hover:text-white"
            }`}
          >
            <span className="text-white">
              {lbl.primary} {lbl.direction.toLowerCase()}
            </span>
            <span className="opacity-70">
              {" "}
              ({lbl.sub.toLowerCase()}, {brg}°)
            </span>
            <span className="block text-[10px] tracking-[0.04em] opacity-70">
              {c.snap_distance_m.toFixed(0)} m from pin · way {c.way_id}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---- CorridorPreviewPanel -------------------------------------------------

/** #290 — the geometry answer's state as this panel speaks it.  "side":
 *  the side is not confirmed (nothing directional exists).  "kind" (#289
 *  finding 1): the work is drawn, the approaches wait on the kind. */
type PreviewStatus = "idle" | "loading" | "ready" | "error" | "side" | "kind" | "refused";

/** The pre-side ruling's sentence, verbatim — one string for the map and
 *  the panel.  (The same words as the rail's SIDE_BLOCKER.) */
const SIDE_SENTENCE = "Say which side is occupied to lay out the work";

function CorridorPreviewPanel({
  corridor,
  hasPin,
  status,
  pendingPick,
  refusal,
}: {
  corridor: CorridorPolyline | null;
  hasPin: boolean;
  // #290: the backend geometry's state.  Every length and direction is
  // the backend's; this panel names the wait / the missing answer
  // instead of ever drawing a locally-derived extent.
  status: PreviewStatus;
  // Detection resolving / multi-candidate pick pending: the map draws
  // no corridor (#186) and the Centerline row stays absent — no
  // geometry claim exists yet to disclose (#211).
  pendingPick: boolean;
  /** The backend's reason it could not lay the corridor out ("refused"). */
  refusal: string | null;
}) {
  const coverageStart = corridor?.coverageStartFt ?? 0;
  return (
    <div className="border-t border-[color:var(--rule)]">
      <div className="px-6 py-2 border-b border-[color:var(--rule)] bg-[color:var(--canvas)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
        Corridor extent
      </div>

      <div className="px-6 py-3">
        {!hasPin && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-1">
            Drop a pin to compute the corridor.
          </div>
        )}
        {hasPin && status === "loading" && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-1">
            Computing corridor extent…
          </div>
        )}
        {hasPin && status === "error" && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--none)] py-1">
            Corridor preview unavailable. Couldn&apos;t reach the layout
            service. You can still save; the plan is validated when
            generated.
          </div>
        )}
        {hasPin && status === "refused" && (
          <div
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--none)] py-1"
            data-testid="picker-corridor-refused"
          >
            Can&apos;t lay the corridor out here: {refusal}
          </div>
        )}
        {hasPin && (status === "side" || status === "kind" || status === "idle") && (
          <div
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-1"
            data-testid="picker-corridor-note"
          >
            {/* #289 finding 1: the lengths depend on the kind, and the
                kind is not chosen yet — say so rather than draw a
                corridor for the placeholder.  Rule 5, stated: on a first
                pass the picker opens before the chips exist, so this is
                what it shows then; the lengths appear in the WHERE band
                once the kind is confirmed.  One element, two sentences —
                the #263 type census counts elements, and this is the
                same note in the same register. */}
            {status === "side"
              ? `${SIDE_SENTENCE}.`
              : status === "kind"
                ? "Corridor lengths wait on the kind of work. Choose it after you save."
                : "Save the pin; the corridor lays out on the band."}
          </div>
        )}
        {corridor && status === "ready" && (
          <>
            {/* #301 piece 2 (ruling 7): "the audit is the one speaker; the
                modal's per-zone length rows go."  The corridor's lengths
                are stated once, by the WHERE band's rows (the audit's
                corridor_spec — what the plan builds); this panel keeps
                what only the picker knows, the road's coverage. */}
            {/* #211: the Centerline provenance row — the same vocabulary
                as the PDF's CORRIDOR DETAILS row, so the two surfaces
                can never describe the same fact differently.  Absent
                while a pick is pending (no geometry claim exists yet). */}
            {!pendingPick && (
              <div className="flex items-baseline justify-between gap-3 pt-2 font-mono text-[10px] uppercase tracking-[0.08em]">
                <span className="text-[color:var(--ink-on-dark-faint)]">
                  Centerline
                </span>
                {/* Partial/manual states use the panel's existing
                    disclosure register (--none, chromaless) — the words
                    are the channel, not a hue (Rule 13). */}
                <span
                  className={
                    corridor.coverageFt !== null &&
                    coverageStart <= 0 &&
                    corridor.coverageFt >= corridor.totalLengthFt
                      ? "text-[color:var(--ink-on-dark)]"
                      : "text-[color:var(--none)]"
                  }
                >
                  {/* #290 hand-check: the road-backed range can start past
                      the anchor (the work runs beyond the way's downstream
                      end) — the row names both ends, never "0" for a
                      station the road does not reach. */}
                  {corridor.coverageFt === null
                    ? "none: straight projection along the heading"
                    : coverageStart <= 0 && corridor.coverageFt >= corridor.totalLengthFt
                      ? "OSM, full corridor"
                      : `covers ${fmtFt(Math.max(0, coverageStart))}–${fmtFt(Math.min(corridor.coverageFt, corridor.totalLengthFt))} ft, bearing beyond`}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
