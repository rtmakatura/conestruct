"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { geocodeFailureMessage, isPreciseGeocode } from "@/lib/geocode-precision";
import { readSearchCoords, type SearchCoords } from "@/lib/search-coords";
import { classifyFromCandidate } from "@/lib/road-detection/classify";
import type { CrossStreetCandidate } from "@/lib/road-detection/cross-street";
import {
  intersectionRecord,
  lookupCrossStreet,
} from "@/lib/road-detection/cross-street-lookup";
import { candidateLabel, crossStreetLabel } from "@/lib/road-detection/labels";
import type { ScenarioKind } from "@/lib/scenarios";
import { scenarioNoun, scenarioTa } from "@/lib/scenarios/handoff-summary";
import {
  CORRIDOR_ZONES,
  ZONE_CHANNEL,
  ZONE_COLOR,
  type CorridorPolyline,
} from "@/lib/corridor-polyline";
import type { Scenario } from "@/lib/scenarios";
import type { IntersectionRecord, RoadAxis } from "@/lib/scenarios/types";
import { ROAD_AXES } from "@/lib/road-axis";
import { reconcileJurisdiction } from "@/lib/scenarios/guesses";
import {
  geometryToPolyline,
  refusalReason,
  asSentence,
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
  intersection?: IntersectionRecord | null;
  /**
   * #301 (R123 Q4): open with "mark the intersection" already armed (the
   * near-intersection form's "Mark on map").  near_intersection only;
   * absent or false, the picker opens as before.
   */
  armIntersection?: boolean;
  /**
   * The road confirmed at the last Save & Close, from
   * ``scenario.meta.confirmedRoad``.  When present AND its pin matches
   * (lat, lng) exactly, the modal restores that selection as-is and
   * fires ZERO detect calls on open — re-analysis triggers on pin
   * movement only.  A mismatched pin invalidates it (stale record).
   */
  confirmedRoad?: ConfirmedRoad | null;
  /**
   * #347 — the form's selected jurisdiction.  Sent with every search so
   * a cross-street pair typed with no city is looked up inside that
   * jurisdiction's area (lib/geocode.ts).
   */
  jurisdictionKey?: string | null;
  /** #507: the way the road runs, as saved with no confirmed road. */
  roadAxis?: RoadAxis | null;
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
  intersection: IntersectionRecord | null;
  /**
   * The road choice as committed at Save: candidate identity,
   * classification, determination method, and the pin it was confirmed
   * at.  The parent persists this on ``scenario.meta`` so it survives
   * picker close/reopen and page reload.  Null when no road is resolved
   * (zero candidates, detection error) — an unresolved save honestly
   * clears any previous confirmation.
   */
  confirmedRoad: ConfirmedRoad | null;
  /** #507 ruling 4: the way the road runs, said in the fallback; null
   *  whenever a road is confirmed. */
  roadAxis: RoadAxis | null;
  /**
   * #460 (Ryan, 2026-11-08): the map as it stood at Save, a JPEG data URL,
   * for the WHERE aerial to show until its own picture is drawn.  Absent
   * when there is no map to read (no token, no WebGL, a test DOM).  A
   * picture only: never written to the scenario or sent anywhere.
   */
  snapshot?: string;
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
  // #507 ruling 4: "failed" (the lookup didn't answer) or "none" (it
  // answered with no road in reach).  The words are the panel's, below.
  | { state: "error"; reason: "failed" | "none" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidLat(n: number): boolean {
  return Number.isFinite(n) && n >= -90 && n <= 90;
}
function isValidLng(n: number): boolean {
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

function fmt4(n: number): string {
  return (Math.round(n * 10000) / 10000).toFixed(4);
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

// ---------------------------------------------------------------------------
// #507 (UX group 8): the map window's words.  Each is Ryan's ruling text
// (2026-11-10) or the W1/F1 board's, except where marked R145; the list
// with sources is validation-artifacts/committed/missions/
// ux-group8-map-window/checkpoint.md § Strings.
// ---------------------------------------------------------------------------

/** Ruling 1. */
export const MAP_WINDOW_HEADING = "Where is the work?";
/** Ruling 1. */
export const MAP_WINDOW_LINE =
  "Search an address or tap the map where the work starts, then pick the road.";
/** Ruling 1. */
export const ROAD_QUESTION = "Which road is the work on?";
/** W1 board. */
export const SIDE_NEXT_LINE = "You'll pick the side of the road next, on the page.";
/** Ruling 1. */
export const WORK_START_HEADING = "Where the work starts";
/** R145-7: W1's line names the pin; the cross-street distance it shows
 *  is not read in the window, so the line stops at the pin. */
export const WORK_START_AT_PIN = "At your pin.";
/** R145: the old map overlay "Click the map or search to drop a pin",
 *  moved off the map (ruling 1) and reworded to the heading's verbs. */
export const WORK_START_NO_PIN = "Search an address or tap the map to place your pin.";
/** Ruling 1, as a plain line (R145-7). */
export const WORK_START_MOVE = "Tap the map to move it.";
/** Ruling 4. */
export const LOOKUP_FAILED_TITLE = "We couldn't look up the roads here.";
/** Ruling 4. */
export const LOOKUP_FAILED_LINE =
  "The road data service didn't answer. Try again, or tell us which way the road runs and carry on.";
/** R145-5: the lookup answered with no road in reach (replaces "No road
 *  detected at this point" and its 30 m line). */
export const LOOKUP_NONE_TITLE = "We didn't find a road at your pin.";
/** R145-5: the 30 m is the route's SNAP_MAX_DISTANCE_M. */
export const LOOKUP_NONE_LINE =
  "No mapped road runs within 30 m. Move the pin onto the road, or tell us which way the road runs and carry on.";
/** R145: replaces "Detecting roads at pin…". */
export const LOOKUP_RUNNING = "Looking up the roads at your pin…";
/** Ruling 4. */
export const AXIS_QUESTION = "Which way does the road run?";
/** Ruling 4. */
export const AXIS_HINT = "Look at the map: which way do the lanes run past your pin?";
/** Ruling 6. */
export const SAVE_BLOCKED_LINE = "Pick a road, or a direction if the lookup failed.";
/** R145: replaces "Detecting road… Save turns on once detection settles". */
export const SAVE_WAITS_LINE = "Looking up the roads. Save turns on when that's done.";
// #541 (Ryan, 2026-11-22, docs/prompts/cc-prompt-ux-coords-in-search.md):
// coordinates are typed in the search box; the bar under the map only
// reads.  Strings and sources: validation-artifacts/committed/missions/
// ux-coords-in-search/issue-541/strings.md.
/** #541 ruling 1. */
export const SEARCH_PLACEHOLDER = "Address, intersection or coordinates";
/** #541 R145: the box's accessible name follows its placeholder. */
export const SEARCH_LABEL = "Address, intersection or coordinates search";
/** #541 ruling 2: the read-only line before a pin. */
export const COORDS_NO_PIN = "No pin yet";
/** #537 S2 ruling 2, kept by #541 ruling 2 ("Pin at 39.7401, -104.9811"). */
export const COORDS_PIN_AT = "Pin at";
/** #541 ruling 1: the choice offered for a pair typed the wrong way round,
 *  "Did you mean 39.7401, -104.9811?".  #544 ruling 3: the two numbers are
 *  their own piece, rendered with the question mark in a span that can't
 *  wrap. */
export const COORDS_DID_YOU_MEAN = "Did you mean";
export const coordsPair = (lat: number, lng: number) => `${fmt4(lat)}, ${fmt4(lng)}`;
/** #537: the old boxes' range errors, kept word for word.  #548 (Ryan,
 *  2026-11-23): these two and the "Did you mean" choice are the only
 *  coordinate lines; #541's "Use decimal degrees" line is gone, and text
 *  that is not a full pair goes to the geocoder. */
export const COORDS_LAT_RANGE = "Latitude must be between -90 and 90";
/** #537: the old boxes' range errors, kept word for word. */
export const COORDS_LNG_RANGE = "Longitude must be between -180 and 180";
/** #541 R145: with no map, the search box is where coordinates go. */
export const MAP_OFF_LINE = "Type the coordinates in the search box instead.";

/** The search's line for a coordinate pair with a number out of range
 *  (#541 ruling 1): never a pin, never a geocoder request. */
type CoordsRefusal = {
  state: "coords";
  line: string;
  swap: { lat: number; lng: number } | null;
};
function coordsRefusal(read: Exclude<SearchCoords, { kind: "address" | "point" }>): CoordsRefusal {
  return {
    state: "coords",
    line: read.axis === "lat" ? COORDS_LAT_RANGE : COORDS_LNG_RANGE,
    swap: read.swap,
  };
}

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

  // ---- Search / geocode --------------------------------------------------
  const [searchQuery, setSearchQuery] = useState(initial.address ?? "");
  // "coords" (#541): the box held coordinates that are not a point.
  const [searchStatus, setSearchStatus] = useState<
    | { state: "idle" }
    | { state: "resolving" }
    | { state: "error"; message: string }
    | CoordsRefusal
  >({ state: "idle" });

  // #507 ruling 4: the way the road runs, said in the fallback.  Restored
  // from the saved plan only when no road was confirmed there.
  const [roadAxis, setRoadAxis] = useState<RoadAxis | null>(
    restoredRoad ? null : (initial.roadAxis ?? null),
  );
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
  // #301 (R123 Q4): opened from the near-intersection form's "Mark on
  // map", the picker starts ready for the click that marks the crossing.
  const [intersectionMode, setIntersectionMode] = useState(
    Boolean(initial.armIntersection) && initial.scenarioKind === "near_intersection",
  );
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
  // #507 ruling 1 (R145-6): the layer toggle left the map; satellite only.
  const style: MapStyle = "satellite";

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
    // #430: the shell drops a jurisdiction guess in the write that moves
    // its pin (guesses.ts, R110 Q1); the preview moves the pin with no
    // write, so it applies the same rule, or the backend refuses the
    // stale guess (400 guess_stale).
    return reconcileJurisdiction({
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
    } as Scenario);
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
      // #460: without preventScroll the browser scrolls the focused node
      // into view, and the fallback sits after the band stack, so the page
      // jumped to its end.  The band landing (ruling 184) is the one place
      // that moves the page after a Save.
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      else restoreFallbackRef?.current?.focus({ preventScroll: true });
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
          setBearingCandidates([]);
          setSelectedCandidateIdx(null);
          setClassify({ state: "error", reason: "failed" });
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
          // #507 ruling 4: the panel's plain message and Try again say it.
          setBearingCandidates([]);
          setSelectedCandidateIdx(null);
          setClassify({ state: "error", reason: "failed" });
          return;
        }
        const cands = j.candidates ?? [];
        setDetectionContext({ isUrban: j.isUrban, placeName: j.placeName });
        if (cands.length === 0) {
          setBearingCandidates([]);
          setSelectedCandidateIdx(null);
          setClassify({ state: "error", reason: "none" });
          return;
        }
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
          setBearingCandidates([]);
          setSelectedCandidateIdx(null);
          setClassify({ state: "error", reason: "failed" });
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
    // #440 X4: the lookup is the one producer the band's tap also calls
    // (lib/road-detection/cross-street-lookup.ts) — the same request, the
    // same #213 guard, the same derivation.
    const found = await lookupCrossStreet(
      { lat: qLat, lng: qLng },
      crossDetectCtxRef.current.mainline,
    );
    if (crossTokenRef.current !== myToken) return;
    if (found.kind === "detected") {
      setCrossStreet(found.candidate);
      setCrossStatus("detected");
    } else {
      setCrossStreet(null);
      setCrossStatus(found.kind);
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
  // search results and typed coordinates (bumps up from a state-level
  // view to street level; a closer view is kept).  Pin drags and map taps
  // don't fly, so the camera *preserves* whatever zoom the operator
  // landed on.
  const flyToPin = useCallback((pinLat: number, pinLng: number, targetZoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    const z = map.getZoom();
    map.flyTo({
      center: [pinLng, pinLat],
      zoom: targetZoom !== undefined && z < targetZoom ? targetZoom : z,
      essential: true,
    });
  }, []);
  const applyPinPosition = useCallback(
    (
      newLat: number,
      newLng: number,
      opts: {
        detect: boolean;
        fly: boolean;
        targetZoom?: number;
      },
    ) => {
      if (!isValidLat(newLat) || !isValidLng(newLng)) return;
      setHasPin(true);
      setCoarseNotice(null);
      setLat(newLat);
      setLng(newLng);
      // #541: a refused-coordinates line answers the pin that was not
      // placed; any pin clears it (as #537's bar error was cleared).
      setSearchStatus((s) => (s.state === "coords" ? { state: "idle" } : s));

      ensureMarker(newLat, newLng, markerTravelRef.current);

      if (opts.fly) flyToPin(newLat, newLng, opts.targetZoom);

      if (opts.detect) {
        // #507: a direction said for the old pin answers nothing at a new
        // one (a reopen or Try again at the same pin keeps it).
        setRoadAxis(null);
        void detectAt(newLat, newLng);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ensureMarker, detectAt, flyToPin],
  );

  // The pin goes to typed coordinates and the map flies to it at a search
  // result's zoom.  #538 (ruling 3): this used to fly only when the point
  // was off screen, at the zoom already set, so a pin typed on the state
  // view (whose bounds hold all of Colorado) left the map zoomed out.
  const applyTypedCoords = useCallback(
    (newLat: number, newLng: number) => {
      applyPinPosition(newLat, newLng, {
        detect: true,
        fly: true,
        targetZoom: PIN_ZOOM,
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
        // #460: keeps the last frame readable, so Save can hand the WHERE
        // aerial the picture on screen.
        preserveDrawingBuffer: true,
      });
      mapRef.current = map;

      // #507 ruling 1: zoom is the map's only control (no compass).
      map.addControl(new mapbox.NavigationControl({ showCompass: false }), "top-right");

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
        // #507 ruling 1 (R145-6): the zone text labels left the map (a
        // text overlay); the dash + width channel still carries each zone.
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
        // #541 ruling 1: geocode sender 1 of 2.  A saved address that is
        // coordinates is read here and never sent.
        const savedCoords = readSearchCoords(initialAddress);
        if (savedCoords.kind === "point") {
          applyTypedCoords(savedCoords.lat, savedCoords.lng);
        } else if (savedCoords.kind !== "address") {
          setSearchStatus(coordsRefusal(savedCoords));
        } else if (initialAddress.length > 0) {
          setSearchStatus({ state: "resolving" });
          try {
            const r = await fetch("/api/geocode", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                address: initialAddress,
                jurisdiction_key: initial.jurisdictionKey ?? null,
              }),
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
                setCoarseNotice(COARSE_NOTICE);
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
              const message = await geocodeFailureMessage(r);
              if (cancelled) return;
              setSearchStatus({ state: "error", message });
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

  // #507 ruling 6: with no map, the open-time lookup above never runs, and
  // Save (which now needs an answer) would stay shut on a located plan
  // with no confirmed road.  Run the same one lookup on open here.
  useEffect(() => {
    if (!open || tokenAvailable || !initialHasPin || restoredRoad) return;
    void detectAt(initial.lat!, initial.lng!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ---- Field handlers ---------------------------------------------------

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

  // #541 ruling 1: coordinates from the search box.  The pin goes there by
  // #538's path (fly at the search zoom, road lookup).
  const placeSearchCoords = useCallback(
    (newLat: number, newLng: number) => {
      setSearchStatus({ state: "idle" });
      if (hasPin && fmt4(newLat) === fmt4(lat) && fmt4(newLng) === fmt4(lng)) {
        // #538 fold-in (a): the pin's own numbers (at the shown precision)
        // move nothing: no lookup, so the road pick and the direction stay.
        // The map still centres on the pin.
        flyToPin(lat, lng, PIN_ZOOM);
        return;
      }
      applyTypedCoords(newLat, newLng);
    },
    [hasPin, lat, lng, flyToPin, applyTypedCoords],
  );

  const onSubmitSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const q = searchQuery.trim();
      if (!q) return;
      setCoarseNotice(null);
      // #541 ruling 1: geocode sender 2 of 2.  Coordinates are read here,
      // before any request; only an address goes on to the geocoder.
      const read = readSearchCoords(q);
      if (read.kind === "point") {
        placeSearchCoords(read.lat, read.lng);
        return;
      }
      if (read.kind !== "address") {
        setSearchStatus(coordsRefusal(read));
        return;
      }
      setSearchStatus({ state: "resolving" });
      try {
        const r = await fetch("/api/geocode", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            address: q,
            jurisdiction_key: initial.jurisdictionKey ?? null,
          }),
        });
        if (!r.ok) {
          setSearchStatus({ state: "error", message: await geocodeFailureMessage(r) });
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
          setCoarseNotice(COARSE_NOTICE);
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
    [searchQuery, applyPinPosition, placeSearchCoords, initial.jurisdictionKey],
  );

  // The "Did you mean" choice: the pair the other way round, shown in the
  // box as it is placed.
  const onTakeSwap = (swap: { lat: number; lng: number }) => {
    setSearchQuery(`${swap.lat}, ${swap.lng}`);
    placeSearchCoords(swap.lat, swap.lng);
  };

  // Editing the box withdraws a refused-coordinates line (it answered the
  // old text); a geocoder error stays until the next search, as before.
  const onSearchChange = (text: string) => {
    setSearchQuery(text);
    setSearchStatus((s) => (s.state === "coords" ? { state: "idle" } : s));
  };

  // ---- Save / cancel ----------------------------------------------------

  // #139: an ambiguous detection is a decision the operator must make,
  // not a suggestion Save may ignore.  Before this guard, Save could
  // fire in awaiting_pick and silently commit the new pin coordinates
  // with the PREVIOUS location's road properties.  Deliberate behavior
  // change riding with the fix: a hand-typed bearing is no longer an
  // escape from the pick — road properties stay unresolved either way.
  // #507 ruling 6 (#506) narrows Save further below: a failed or empty
  // lookup saves only with a direction.
  const roadUnresolved =
    bearingCandidates.length > 1 && selectedCandidateIdx === null;

  // #189: an in-flight classification blocks Save — the road facts (and
  // on gated kinds, the safety relays that arm the backend refusals) are
  // genuinely unknown for the moment, and saving would commit
  // ``classification: null`` as if detection had never run.  Only
  // in-flight blocks here; a settled failure (error / zero candidates)
  // keeps its messaging, and ruling 6 below decides its Save.
  // #507 ruling 6 (#506): Save needs an answer, a road picked or, when the
  // lookup failed or found none, the way the road runs.  Before this, a
  // failed lookup saved with no road and the plan fell back to defaults.
  const roadPicked = classify.state === "detected" && selectedCandidateIdx !== null;
  const axisAnswers = classify.state === "error" && roadAxis !== null;
  const canSave =
    hasPin &&
    isValidLat(lat) &&
    isValidLng(lng) &&
    !roadUnresolved &&
    // (an in-flight lookup, #189, is neither, so it blocks Save too)
    (roadPicked || axisAnswers);

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
    // #460: the picture on screen, if the canvas can be read.
    let snapshot: string | undefined;
    try {
      const url = mapRef.current?.getCanvas().toDataURL("image/jpeg", 0.85);
      if (url && url.startsWith("data:image/")) snapshot = url;
    } catch {
      snapshot = undefined;
    }
    onSave({
      ...(snapshot ? { snapshot } : {}),
      address,
      lat,
      lng,
      classification: classify.state === "detected" ? classify.result : null,
      crossStreet: isNearIntersectionKind ? crossStreet : null,
      // #234: the pin and its name, as the picker shows them — a fresh
      // detection's name, or the restored one when the pin was not moved.
      // #316: a fresh crossing also carries its cross street's class and
      // posted speed, so the approach speed's source survives a reload
      // (measured, guessed or not set); a restored one goes back exactly
      // as it was saved.
      intersection:
        isNearIntersectionKind && crossPin
          ? crossStatus === "restored" && restoredCross
            ? { ...restoredCross, lat: crossPin.lat, lng: crossPin.lng }
            : intersectionRecord(crossPin, crossStreet)
          : null,
      confirmedRoad,
      roadAxis: confirmedRoad ? null : roadAxis,
    });
  };

  if (!open) return null;

  // #507 ruling 6: the one line under a disabled Save (not while the
  // lookup runs; that has its own line).
  const saveBlocked = !canSave && classify.state !== "resolving";

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/70 backdrop-blur-sm p-0 md:p-6"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="map-window border border-[color:var(--rule)] bg-[color:var(--canvas)] flex flex-col w-full h-full md:w-[90vw] md:h-[90vh] md:max-w-[1280px] md:max-h-[880px] overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-window-h"
      >
        {/* #507 ruling 1 (W1): the heading and its line, Inter. */}
        <div className="mw-head">
          <div className="mw-head-text">
            <h2 id="map-window-h" className="mw-title">
              {MAP_WINDOW_HEADING}
            </h2>
            <p className="mw-line" data-testid="picker-subtitle">
              {MAP_WINDOW_LINE}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="tap-44 mw-close"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M3 3l12 12M15 3L3 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Body: two columns at md (980 px here), map left and the rail
            right; below md the map sits on top and the body scrolls. */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto md:flex-row md:overflow-hidden">
          <div className="mw-map-col flex flex-col md:flex-1 md:min-w-0">
            <form onSubmit={onSubmitSearch} className="mw-search">
              <div className="mw-search-box">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  aria-label={SEARCH_LABEL}
                  placeholder={SEARCH_PLACEHOLDER}
                  className="tap-44 field-input mw-search-input"
                />
                {/* #541 ruling 1: the search's lines float under the box,
                    over the top of the map, so none of them resizes the
                    map or moves the rail (P1).  Always mounted, so a line
                    that arrives is announced.
                    #543 (ruling 2): the coarse-match notice is a line here
                    too, not in the column's flow. */}
                <div className="mw-search-list" role="status" data-testid="search-list">
                  {coarseNotice && <p className="mw-note mw-search-line">{coarseNotice}</p>}
                  {searchStatus.state === "error" && (
                    <p className="mw-note mw-note-fail mw-search-line">{searchStatus.message}</p>
                  )}
                  {searchStatus.state === "coords" &&
                    (searchStatus.swap ? (
                      <button
                        type="button"
                        onClick={() => onTakeSwap(searchStatus.swap!)}
                        className="mw-link mw-search-pick"
                      >
                        {COORDS_DID_YOU_MEAN}{" "}
                        <span className="mw-search-pair">
                          {coordsPair(searchStatus.swap.lat, searchStatus.swap.lng)}?
                        </span>
                      </button>
                    ) : (
                      <p className="mw-note mw-note-fail mw-search-line">{searchStatus.line}</p>
                    ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={searchStatus.state === "resolving" || !searchQuery.trim()}
                className="tap-44 mw-btn mw-btn-line"
              >
                {searchStatus.state === "resolving" ? "Searching…" : "Search"}
              </button>
            </form>

            {/* #507 ruling 1: the map carries zoom only (R145-6). */}
            {tokenAvailable ? (
              <div
                ref={containerRef}
                className="picker-map relative bg-black/30 flex-shrink-0 min-h-[320px] h-[44vh] md:h-auto md:shrink md:flex-1"
              />
            ) : (
              <div className="mw-map-off flex-shrink-0 min-h-[240px] h-[30vh] md:h-auto md:shrink md:flex-1">
                <p className="mw-sub">The map can&apos;t load here.</p>
                <p className="mw-line">{MAP_OFF_LINE}</p>
              </div>
            )}

            {/* #541 (ruling 2): the pin's coordinates, read-only, always here
                at 44 px, so the map and the rail never move (P1).  The
                numbers can be selected and copied; nothing here is a control.
                #545 (ruling 1): the mark is a hollow ring with no pin and
                the filled dot with one; globals.css draws both from
                data-pin, in the same 10 x 10 box. */}
            <div className="mw-cbar" data-testid="coords-bar">
              <span className="mw-cbar-dot" data-pin={hasPin ? "true" : "false"} aria-hidden="true" />
              {hasPin ? (
                <span className="mw-cbar-line">
                  <span className="mw-cbar-lead">{COORDS_PIN_AT}</span>{" "}
                  <span className="mw-cbar-coords">{`${fmt4(lat)}, ${fmt4(lng)}`}</span>
                </span>
              ) : (
                <span className="mw-cbar-lead">{COORDS_NO_PIN}</span>
              )}
            </div>
          </div>

          <div className="mw-rail flex flex-col border-t md:border-t-0 md:border-l border-[color:var(--rule)] md:w-[456px] md:flex-none">
            <div className="mw-rail-body md:flex-1 md:min-h-0 md:overflow-y-auto">
              {hasPin && classify.state !== "idle" && (
                <RoadQuestion
                  key={bearingCandidates.map((c) => c.way_id).join("|")}
                  classify={classify}
                  candidates={bearingCandidates}
                  selectedIdx={selectedCandidateIdx}
                  onPick={applyCandidate}
                  roadAxis={roadAxis}
                  onAxis={setRoadAxis}
                  onTryAgain={onRedetect}
                />
              )}
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
              <section className="mw-section" aria-labelledby="mw-start-h">
                <h3 id="mw-start-h" className="mw-sub">
                  {WORK_START_HEADING}
                </h3>
                <p className="mw-line">{hasPin ? WORK_START_AT_PIN : WORK_START_NO_PIN}</p>
                <p className="mw-hint">{WORK_START_MOVE}</p>
                <CorridorPreviewPanel
                  corridor={corridor}
                  hasPin={hasPin}
                  status={
                    !baseScenario
                      ? "idle"
                      : geometry.state === "error"
                        ? geometry.httpStatus === 400
                          ? "declined"
                          : "error"
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
                  declined={geometry.state === "error" ? (geometry.message ?? null) : null}
                />
              </section>
            </div>
          </div>
        </div>

        {/* Footer (ruling 1): Cancel and "Save and close".  Below md the
            line takes its own row so the buttons never wrap (#396 W14). */}
        <div className="mw-foot">
          {saveBlocked && (
            <span className="mw-foot-line" data-testid="picker-save-blocked">
              {SAVE_BLOCKED_LINE}
            </span>
          )}
          {classify.state === "resolving" && (
            <span className="mw-foot-line">{SAVE_WAITS_LINE}</span>
          )}
          <button type="button" onClick={onCancel} className="tap-44 mw-btn mw-btn-quiet">
            Cancel
          </button>
          <button
            type="button"
            onClick={onClickSave}
            disabled={!canSave}
            className="tap-44 mw-btn mw-btn-pri"
          >
            Save and close
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
    <section className="mw-section">
      <h3 className="mw-sub">Cross street</h3>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMode}
          disabled={!hasPin}
          className={`tap-44 mw-btn border disabled:opacity-40 disabled:cursor-not-allowed ${
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
            className="tap-44 mw-btn mw-btn-quiet"
          >
            Clear
          </button>
        )}
      </div>
      {!hasPin && (
        <p className="mw-line">
          Drop the work-zone pin first, then mark where the cross street
          meets this road.
        </p>
      )}
      {crossStatus === "resolving" && (
        <p className="mw-line">
          Looking up the cross street…
        </p>
      )}
      {crossStatus === "none" && (
        <p className="mw-line">
          No cross street found at that point. You can still describe the
          approaches by hand in the form.
        </p>
      )}
      {crossStatus === "error" && (
        <p className="mw-line">
          {/* #507 ruling 4: plain words for the old service jargon. */}
          The street lookup didn&apos;t answer. Describe the approaches by
          hand in the form.
        </p>
      )}
      {crossStatus === "restored" && (
        <p className="mw-line" data-testid="cross-restored">
          {/* #234: the saved crossing, named by the one producer the WHERE
              fact line reads — no detection fires on open. */}
          {crossStreetLabel(restoredName)}: marked at your last save. Move
          the intersection pin to look it up again.
        </p>
      )}
    </section>
  );
}

// #507 (W1, F1): the rail's road question.  One of: the lookup running,
// the roads found as one radio list (ruling 2: a grouped street is one
// row), or the lookup failed / found nothing, with Try again and the
// four-direction question (ruling 4).  Every word is in the constants
// above; the rows read the route's candidates and compute nothing.
function RoadQuestion({
  classify,
  candidates,
  selectedIdx,
  onPick,
  roadAxis,
  onAxis,
  onTryAgain,
}: {
  classify: ClassifyStatus;
  candidates: RoadCandidate[];
  selectedIdx: number | null;
  onPick: (idx: number) => void;
  roadAxis: RoadAxis | null;
  onAxis: (a: RoadAxis) => void;
  onTryAgain: () => void;
}) {
  if (classify.state === "resolving") {
    return (
      <section className="mw-section" aria-busy="true">
        <h3 className="mw-sub">{ROAD_QUESTION}</h3>
        <p className="mw-line" role="status">
          {LOOKUP_RUNNING}
        </p>
      </section>
    );
  }
  if (classify.state === "error" || candidates.length === 0) {
    const failed = classify.state === "error" && classify.reason === "failed";
    return (
      <section className="mw-section">
        <div className="mw-status" role="status" data-testid="road-lookup-status">
          <p className="mw-sub">{failed ? LOOKUP_FAILED_TITLE : LOOKUP_NONE_TITLE}</p>
          <p className="mw-line">{failed ? LOOKUP_FAILED_LINE : LOOKUP_NONE_LINE}</p>
          {failed && (
            <button
              type="button"
              onClick={onTryAgain}
              data-testid="picker-redetect"
              className="tap-44 mw-btn mw-btn-line mw-self-start"
            >
              Try again
            </button>
          )}
        </div>
        <fieldset className="mw-fieldset">
          <legend className="mw-sub">{AXIS_QUESTION}</legend>
          <div role="radiogroup" aria-label={AXIS_QUESTION} className="mw-axis-grid">
            {ROAD_AXES.map((a) => {
              const picked = roadAxis === a.value;
              return (
                <button
                  key={a.value}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  aria-label={a.label}
                  onClick={() => onAxis(a.value)}
                  className={`road-pick-row mw-axis${picked ? " is-picked" : ""}`}
                  data-testid="road-axis"
                >
                  {/* #511 (Rule 13): the same mark the road rows carry, so
                      the pick reads by shape as well as colour. */}
                  <span className="road-pick-mark" aria-hidden="true" />
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d={a.path} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span className="road-pick-name">{a.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mw-hint">{AXIS_HINT}</p>
        </fieldset>
      </section>
    );
  }
  return (
    <section className="mw-section">
      <div className="road-pick-panel mw-roads" data-testid="road-pick-panel">
        <h3 id="mw-road-h" className="mw-sub">
          {ROAD_QUESTION}
        </h3>
        <div role="radiogroup" aria-labelledby="mw-road-h" className="mw-road-rows">
          {candidates.map((c, idx) => {
            const picked = idx === selectedIdx;
            return (
              <button
                key={`${c.way_id}-${idx}`}
                type="button"
                role="radio"
                aria-checked={picked}
                onClick={() => onPick(idx)}
                className={`road-pick-row${picked ? " is-picked" : ""}`}
              >
                <span className="road-pick-mark" aria-hidden="true" />
                <span className="road-pick-label">
                  {/* #536 (Ryan, 2026-11-12, N2): the corner is in the
                      title, "<street> at <cross street>", the cross street
                      in 400 --ink-mute on the same line.  The row's
                      accessible name is its text, so it carries the corner. */}
                  <span className="road-pick-name">
                    {candidateLabel(c).primary}
                    {c.cross_street ? <span className="road-pick-at">{` at ${c.cross_street}`}</span> : null}
                  </span>
                  <span className="road-pick-sub">{roadRowLine(c)}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mw-hint">{SIDE_NEXT_LINE}</p>
      </div>
    </section>
  );
}

/** #507 ruling 2: "Traffic both ways · 9 m from your pin".  #512 (Ryan,
 *  2026-11-11): the words are the backend's (`c.travel`, from
 *  `/render/road-travel`: the one-way reading the side choices use, and
 *  #308's carriageway verdict), never a rule here (Rule 3).  A one-way
 *  entry is named by the verdict (R145-11, Rule 12): "One-way" for a
 *  one-way street, "Divided road" for one carriageway of a divided road,
 *  else "Traffic one way here".  A reversible or alternating way reads
 *  "Direction changes by time".  No answer, or a road the backend can't
 *  name a direction for (an untagged motorway), shows only the distance
 *  (Rule 10).  The distance is the lead carriageway's, the nearer one.
 *  #536 (Ryan, 2026-11-12, N2): the cross street (#525's
 *  `c.cross_street`) is named in the row's title, not on this line. */
export function roadRowLine(c: RoadCandidate): string {
  return travelAndDistance(c);
}

function travelAndDistance(c: RoadCandidate): string {
  const dist = `${c.snap_distance_m.toFixed(0)} m from your pin`;
  const t = c.travel;
  if (!t || t.travel === "unknown") return dist;
  if (t.travel === "both_ways") return `Traffic both ways · ${dist}`;
  if (t.travel === "changes_by_time") return `Direction changes by time · ${dist}`;
  const v = t.carriageway;
  const words = v === "one_way_street" ? "One-way" : v === "divided" ? "Divided road" : "Traffic one way here";
  return `${words} · ${dist}`;
}

// ---- CorridorPreviewPanel -------------------------------------------------

/** #290 — the geometry answer's state as this panel speaks it.  "side":
 *  the side is not confirmed (nothing directional exists).  "kind" (#289
 *  finding 1): the work is drawn, the approaches wait on the kind. */
type PreviewStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "declined"
  | "side"
  | "kind"
  | "refused";

/** #513 (ruling 1/4, R145-9): the search found a town or area, not a
 *  street, so no pin is set and no roads are looked up. */
const COARSE_NOTICE = "That search found a town or area. Tap the map on the road where the work starts.";

/** #507 ruling 4 (R145-9): the preview's failures in plain words. */
const PREVIEW_FAILED =
  "We couldn't draw the work on the map. You can still save; the plan is checked when it's made.";
const PREVIEW_DECLINED = "The work can't be drawn here:";
const PREVIEW_DECLINED_BARE = "The work can't be drawn here.";
const PREVIEW_STILL_SAVE = "You can still save; the plan is checked when it's made.";
const PREVIEW_REFUSED = "The work can't be laid out here:";

function CorridorPreviewPanel({
  corridor,
  hasPin,
  status,
  pendingPick,
  refusal,
  declined,
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
  /** #430: the backend's message when it refused the preview (a 400,
   *  "declined"); null when the refusal carried none. */
  declined: string | null;
}) {
  const coverageStart = corridor?.coverageStartFt ?? 0;
  return (
    // #507 ruling 1: no header of its own; it speaks under "Where the work
    // starts", in Inter.
    <div className="mw-preview">
      <div>
        {/* #507 ruling 1: the pin and wait lines left the panel; "Where
            the work starts" says where the pin is. */}
        {hasPin && status === "error" && (
          <div className="mw-note">
            {/* #507 ruling 4: plain words for "Corridor preview
                unavailable. Couldn't reach the layout service." */}
            {PREVIEW_FAILED}
          </div>
        )}
        {hasPin && status === "declined" && (
          <div
            className="mw-note"
            data-testid="picker-corridor-declined"
          >
            {/* #430 (Rule 10): a 400 is a refusal, not an outage.  Only the
                backend's own message is quoted; with none, no answerer is
                named (the route's own 400s come before the backend). */}
            {declined
              ? `${PREVIEW_DECLINED} ${asSentence(declined)}`
              : PREVIEW_DECLINED_BARE}{" "}
            {PREVIEW_STILL_SAVE}
          </div>
        )}
        {hasPin && status === "refused" && (
          <div
            className="mw-note"
            data-testid="picker-corridor-refused"
          >
            {PREVIEW_REFUSED} {refusal}
          </div>
        )}
        {/* #507 ruling 1: the side / kind / idle notes left; W1's "You'll
            pick the side of the road next, on the page." follows #402's
            side sentence. */}
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
              <div className="mw-note flex items-baseline justify-between gap-3">
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
