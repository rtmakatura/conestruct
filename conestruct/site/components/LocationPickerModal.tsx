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
  Confidence,
  ConfirmedRoad,
  DetectedField,
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
import {
  bearingToDirectionLabel as bearingToDirectionLabelImpl,
  candidateLabel,
} from "@/lib/road-detection/labels";
import type { RoadType, ScenarioKind } from "@/lib/scenarios";
import { snapSpeedToDomain } from "@/lib/scenarios";
import { scenarioNoun, scenarioTa } from "@/lib/scenarios/handoff-summary";
import type { CorridorSpecLengths } from "@/lib/render-types";
import {
  buildCorridorPolyline,
  CORRIDOR_ZONES,
  ZONE_CHANNEL,
  ZONE_COLOR,
  ZONE_LABEL,
  type CorridorPolyline,
  type CorridorZone,
} from "@/lib/corridor-polyline";
import { ZoneChannelSwatch } from "./ZoneChannelSwatch";

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
  bearingDeg?: number;
  workZoneFt?: number;
  // Pre-existing scenario kind so the corridor preview knows the
  // closure type (shoulder vs lane vs shifting) for taper math.
  scenarioKind: ScenarioKind;
  // Speed limit fallback for advance-warning / buffer / taper math
  // before the in-modal classify resolves.  Mirrors whatever the
  // scenario currently carries.
  speedMph: number;
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
// existing road fields".  ``overrides`` carry any inline edits the
// user made on top of the detected values — keyed by field so the
// parent can apply them in scenario-narrowing-safe order.
export interface LocationPickerResult {
  address: string;
  lat: number;
  lng: number;
  bearingDeg?: number;
  workZoneFt: number;
  classification: RoadClassification | null;
  overrides: RoadFieldOverrides;
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
   * The road choice as committed at Save: candidate identity,
   * classification, determination method, and the pin it was confirmed
   * at.  The parent persists this on ``scenario.meta`` so it survives
   * picker close/reopen and page reload.  Null when no road is resolved
   * (zero candidates, detection error) — an unresolved save honestly
   * clears any previous confirmation.
   */
  confirmedRoad: ConfirmedRoad | null;
}

// Defined in lib/scenarios/overrides.ts (PR 4 extraction); imported
// for local use and re-exported so existing importers keep their path.
import type { RoadFieldOverrides } from "@/lib/scenarios/overrides";

export type { RoadFieldOverrides };

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
const PIN_COLOR = "#E8710A";
// Cross-street (second) pin — teal, matching the work-zone corridor
// segment colour so the two pins read as different jobs on the map.
const CROSS_PIN_COLOR = "#1EC8A5";

const CORRIDOR_SOURCE_ID = "corridor-source";
const CORRIDOR_LAYER_ID = "corridor-layer";
const CORRIDOR_LABEL_LAYER_ID = "corridor-labels";

const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  rural_undivided: "Rural — undivided",
  rural_divided: "Rural — divided",
  urban_arterial: "Urban arterial",
  freeway: "Freeway / interstate",
};

const ROAD_TYPE_OPTIONS: Array<{ v: RoadType; l: string }> = [
  { v: "rural_undivided", l: "Rural — undivided" },
  { v: "rural_divided", l: "Rural — divided" },
  { v: "urban_arterial", l: "Urban arterial" },
  { v: "freeway", l: "Freeway / interstate" },
];

// State machine for the Road Properties panel.  ``awaiting_pick`` is
// the multi-candidate case: properties aren't synthesized until the
// operator picks one road, so the panel sits in this state in the
// meantime instead of guessing.
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
// Bearing is presented as a 0–359 integer (360 normalises to 0 before
// the value ever reaches the input).  Out-of-range or fractional
// values trip the inline error and disable Save.
function isValidBearing(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 359;
}
function normaliseBearing(n: number): number {
  const r = ((Math.round(n) % 360) + 360) % 360;
  return r;
}

function fmt4(n: number): string {
  return (Math.round(n * 10000) / 10000).toFixed(4);
}

function fmtFt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("en-US");
}

// Re-export the shared label helper under the original local name so
// the modal's render code keeps reading naturally.  The single source
// of truth lives in lib/road-detection/labels.ts.
const bearingToDirectionLabel = bearingToDirectionLabelImpl;

// fix-spec-02 P1·04 — confidence speaks its own achromatic language:
// filled pips (3/2/1 of 3) plus the word in the caption beneath the row
// ("<source> · <level> confidence").  The old single dot borrowed the
// interactive cyan, the output orange, and a hardcoded red — three role
// collisions, and a hue-alone signal.
function confPipCount(c: Confidence): number {
  switch (c) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

function ConfPips({ c }: { c: Confidence }) {
  const filled = confPipCount(c);
  return (
    <span
      className="inline-flex items-center gap-[3px]"
      title={`${c} confidence`}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            i < filled
              ? "bg-[color:var(--conf-fill)]"
              : "bg-[color:var(--conf-empty)]"
          }`}
        />
      ))}
    </span>
  );
}

// Build the marker DOM: a circle "pin" with an arrow extending from its
// centre in the direction of travel. Updating ``bearingDeg`` rotates the
// arrow around the pin without re-creating the marker.
function buildMarkerEl(): {
  root: HTMLDivElement;
  setBearing: (deg: number) => void;
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
    setBearing: (deg: number) => {
      arrowSvg.style.transform = `rotate(${deg}deg)`;
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
  const [bearing, setBearing] = useState(
    initial.bearingDeg !== undefined ? normaliseBearing(initial.bearingDeg) : 0,
  );
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
  const [bearingInput, setBearingInput] = useState(
    initial.bearingDeg !== undefined
      ? String(normaliseBearing(initial.bearingDeg))
      : "",
  );
  const [latError, setLatError] = useState<string | null>(null);
  const [lngError, setLngError] = useState<string | null>(null);
  const [bearingError, setBearingError] = useState<string | null>(null);

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
  // User overrides on top of the classification.  Keyed by field; an
  // undefined entry means "no override, use detected".  The values
  // here are committed to the parent on Save.
  const [overrides, setOverrides] = useState<RoadFieldOverrides>(
    restoredRoad?.overrides ?? {},
  );

  // ---- Work zone length --------------------------------------------------
  const [workZoneFt, setWorkZoneFt] = useState(
    Math.max(0, initial.workZoneFt ?? 0),
  );
  const [workZoneInput, setWorkZoneInput] = useState(
    initial.workZoneFt && initial.workZoneFt > 0
      ? String(Math.round(initial.workZoneFt))
      : "",
  );
  const [workZoneError, setWorkZoneError] = useState<string | null>(null);

  // ---- Cross street (near_intersection kind only, #117) ------------------
  // Second pin marking the intersection.  The map's click handler
  // routes here while ``intersectionMode`` is armed; detection then
  // runs the same /api/road-bearing call at the intersection point and
  // deriveCrossStreet turns it into one proposed approach prefill.
  const isNearIntersectionKind = initial.scenarioKind === "near_intersection";
  const [intersectionMode, setIntersectionMode] = useState(false);
  const intersectionModeRef = useRef(false);
  intersectionModeRef.current = intersectionMode;
  const [crossPin, setCrossPin] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [crossStatus, setCrossStatus] = useState<
    "idle" | "resolving" | "detected" | "none" | "error"
  >("idle");
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
  const setMarkerBearingRef = useRef<((deg: number) => void) | null>(null);
  const mapboxRef = useRef<MapboxNamespace | null>(null);
  const corridorReadyRef = useRef(false);
  // Mirrors the latest computed corridor so the deferred ``installCorridor``
  // handler can push current data when the map's ``load`` fires *after*
  // the corridor was computed.  Without this, opening the modal with an
  // already-set work-zone length would race and never paint the line.
  const corridorDataRef = useRef<CorridorPolyline | null>(null);
  // Guards to avoid feedback loops between marker drag and coord state.
  const suppressFlyToRef = useRef(false);
  const suppressDragHandlerRef = useRef(false);
  // Each detect call gets a token; only the latest call's result is
  // allowed to mutate state, so a fast drag doesn't get a stale snap
  // from an earlier request.  One pipeline now → one token.
  const bearingTokenRef = useRef(0);

  // ---- Effective values (override > detected > current) -----------------
  const effectiveRoadType: RoadType | null =
    overrides.roadType ??
    (classify.state === "detected" ? classify.result.roadType : null);
  const effectiveDivided: boolean | null =
    overrides.divided ??
    (classify.state === "detected" ? classify.result.divided : null);
  // UX-02: only an override (an explicit accept/edit) or a high-confidence
  // OSM speed feeds the corridor preview.  A low-confidence highway-class
  // fallback is shown in the field but does NOT auto-apply on Save, so it
  // must not drive the preview either — otherwise the corridor computes a
  // value Save won't keep (the same divergence UX-01 fixes for the clamp).
  // Until the operator accepts it (which makes it an override), the preview
  // falls back to initial.speedMph — the scenario's current speed, which is
  // exactly what Save will keep.
  const effectiveSpeed: number | null =
    overrides.speedMph ??
    (classify.state === "detected"
      ? (classify.result.speedLimitMph ?? null)
      : null);
  const effectiveLanes: number | null =
    overrides.lanesPerDirection ??
    (classify.state === "detected"
      ? (classify.result.lanesPerDirection ??
        classify.result.fields.lanes.value ??
        null)
      : null);

  // ---- Corridor spec lengths (backend-fed, engine-removal PR D) ----------
  // The MUTCD zone lengths (taper/buffer/advance/downstream) come from
  // POST /api/render/corridor-spec — the same backend tables the plan
  // itself uses; the frontend mirror they replace is deleted.  The
  // lengths depend only on (kind, speed, roadType), so pin drags,
  // bearing edits, and work-zone typing redraw the polyline instantly
  // from the cached lengths — only a speed or road-type change refetches
  // (debounced 300 ms).  On failure the last lengths stay in use with an
  // explicit "unavailable" note; nothing is ever computed locally.
  //
  // UX-01: the fetch uses the same domain-clamped speed Save will apply
  // (snapSpeedToDomain), so the corridor the operator reviews is the one
  // the form keeps — same invariant the retired local math enforced.
  const previewSpeed = snapSpeedToDomain(
    initial.scenarioKind,
    effectiveSpeed ?? initial.speedMph ?? 35,
  );
  const [specLengths, setSpecLengths] = useState<CorridorSpecLengths | null>(
    null,
  );
  const [specStatus, setSpecStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const specLengthsRef = useRef<CorridorSpecLengths | null>(null);
  specLengthsRef.current = specLengths;
  const specTokenRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const myToken = ++specTokenRef.current;
    setSpecStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const r = await fetch("/api/render/corridor-spec", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: initial.scenarioKind,
            speed: previewSpeed,
            roadType: effectiveRoadType,
          }),
        });
        if (specTokenRef.current !== myToken) return;
        if (!r.ok) {
          setSpecStatus("error");
          return;
        }
        const j = (await r.json()) as CorridorSpecLengths;
        if (specTokenRef.current !== myToken) return;
        setSpecLengths(j);
        setSpecStatus("ready");
      } catch {
        if (specTokenRef.current === myToken) setSpecStatus("error");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [open, initial.scenarioKind, previewSpeed, effectiveRoadType]);

  // ---- Corridor projection ----------------------------------------------
  // Geometry only — anchor, bearing, typed work-zone length; the zone
  // lengths are the backend's (above).  Null until the first lengths
  // arrive: the preview shows an explicit updating/unavailable note
  // rather than a locally-derived extent.
  const corridor = useMemo<CorridorPolyline | null>(() => {
    if (!hasPin || !isValidLat(lat) || !isValidLng(lng)) return null;
    if (workZoneFt <= 0) return null;
    if (!specLengths) return null;
    return buildCorridorPolyline({
      anchorLat: lat,
      anchorLng: lng,
      bearingDeg: bearing,
      advanceWarningFt: specLengths.advance_warning_ft,
      taperFt: specLengths.taper_ft,
      bufferFt: specLengths.buffer_ft,
      workZoneFt,
      downstreamTaperFt: specLengths.downstream_taper_ft,
    });
  }, [hasPin, lat, lng, bearing, workZoneFt, specLengths]);

  // Sync the corridor onto the live map.  ``corridorDataRef`` is the
  // canonical "what should the line show" so the deferred installer
  // (running on ``load`` after style swap or initial init) can read it.
  // When ``corridor`` is null we clear the source so a half-edited
  // state doesn't leave a stale line behind.
  useEffect(() => {
    corridorDataRef.current = corridor;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(CORRIDOR_SOURCE_ID) as
      | MapboxGL.GeoJSONSource
      | undefined;
    if (!source) return;
    const fc =
      corridor?.featureCollection ??
      ({
        type: "FeatureCollection",
        features: [],
      } as GeoJSON.FeatureCollection);
    source.setData(fc as never);
  }, [corridor]);

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
  // changes, road-property overrides all just redraw the polyline.
  // Use the Recenter button to get a "show me everything" view back.
  const shouldAutoFitInitialRef = useRef(
    initialHasPin && (initial.workZoneFt ?? 0) > 0,
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
      // #149 contract: a moved (or re-analyzed) pin invalidates
      // everything from the previous pin — including the direction of
      // travel, which was derived from the now-stale road.  Clear it so
      // an unresolved detection never shows a bearing left over from the
      // old location; a single-candidate result re-applies its own
      // bearing below (the empty field passes the auto-adopt guard), and
      // an operator re-picks or re-types otherwise.  The ref is cleared
      // in step so the single-candidate guard reads the cleared value.
      setBearing(0);
      setBearingInput("");
      bearingInputRef.current = "";
      setBearingError(null);
      setMarkerBearingRef.current?.(0);
      setClassify({ state: "resolving" });
      try {
        const r = await fetch("/api/road-bearing", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lat: qLat, lng: qLng }),
        });
        if (bearingTokenRef.current !== myToken) return;
        if (!r.ok) {
          setBearingWarning(
            "Couldn't reach road-detection service. Enter bearing manually.",
          );
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
        const cands = j.candidates ?? [];
        setDetectionContext({ isUrban: j.isUrban, placeName: j.placeName });
        if (cands.length === 0) {
          setBearingWarning(
            "No road detected within 30 m. Verify the location or enter bearing manually.",
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
          // Unambiguous — adopt the detected bearing if the operator
          // hasn't typed one (otherwise leave their override alone),
          // and synthesize properties from the candidate's OSM tags.
          const only = cands[0];
          const newBearing = normaliseBearing(only.bearing);
          setSelectedCandidateIdx(0);
          if (bearingInputRef.current.trim() === "") {
            setBearing(newBearing);
            setBearingInput(String(newBearing));
            setBearingError(null);
            setMarkerBearingRef.current?.(newBearing);
          }
          setClassify({
            state: "detected",
            result: classifyFromCandidate(only, j.isUrban, j.placeName),
          });
        } else {
          // Multi-candidate: leave bearing alone and hold the property
          // panel in awaiting_pick until the operator commits to a
          // road.  The rail-top card renders itself off the candidate
          // data — no toggle to raise here.
          setSelectedCandidateIdx(null);
          setClassify({ state: "awaiting_pick" });
        }
      } catch {
        if (bearingTokenRef.current === myToken) {
          setBearingWarning(
            "Couldn't reach road-detection service. Enter bearing manually.",
          );
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

  // The bearing-input string is captured in a ref so the async detection
  // callback can read its *current* value without re-creating the
  // closure (which would tear the request token-guard).
  const bearingInputRef = useRef(bearingInput);
  bearingInputRef.current = bearingInput;

  // ---- Cross-street detection (near_intersection kind, #117) ------------
  // Everything the second-pin derivation needs, mirrored into a ref:
  // the map click handler that arms it is created once at map init.
  const crossDetectCtxRef = useRef<{
    lat: number;
    lng: number;
    bearing: number;
    mainline: RoadCandidate | null;
  }>({
    lat: 0,
    lng: 0,
    bearing: 0,
    mainline: null,
  });
  crossDetectCtxRef.current = {
    lat,
    lng,
    bearing,
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
      const ctx = crossDetectCtxRef.current;
      // The anchor pin sits one downstream-taper length below station
      // 0, so the derivation needs the same backend-fed length the
      // corridor preview draws (engine-removal PR D — the local spec
      // mirror is deleted).  If the lengths haven't arrived yet, the
      // proposal degrades to the manual-entry path rather than deriving
      // a station from a locally-guessed taper.
      const lengths = specLengthsRef.current;
      if (!lengths) {
        setCrossStreet(null);
        setCrossStatus("error");
        return;
      }
      const derived = deriveCrossStreet({
        detection: j,
        mainlineWayId: ctx.mainline?.way_id ?? null,
        mainlineName: ctx.mainline?.name ?? null,
        mainlineBearingDeg: ctx.bearing,
        anchorLat: ctx.lat,
        anchorLng: ctx.lng,
        crossLat: qLat,
        crossLng: qLng,
        downstreamTaperFt: lengths.downstream_taper_ft,
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
    (mlat: number, mlng: number, mbearing: number) => {
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
          if (suppressDragHandlerRef.current) return;
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
      opts: { detect: boolean; fly: boolean; targetZoom?: number },
    ) => {
      if (!isValidLat(newLat) || !isValidLng(newLng)) return;
      setHasPin(true);
      setCoarseNotice(null);
      setLat(newLat);
      setLng(newLng);
      setLatInput(fmt4(newLat));
      setLngInput(fmt4(newLng));
      setLatError(null);
      setLngError(null);

      ensureMarker(newLat, newLng, bearing);

      const map = mapRef.current;
      if (map && opts.fly && !suppressFlyToRef.current) {
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
        // Reset overrides on pin move so the fresh detection is the
        // baseline.  Resetting here (not in candidate-pick) preserves
        // operator edits when they pick a different carriageway from
        // the same pin's candidate list.
        setOverrides({});
        void detectAt(newLat, newLng);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bearing, ensureMarker, detectAt],
  );

  // Snap the map (if pin is off-screen) and the pin to provided coords.
  // Used after typing-in coordinates.
  const applyTypedCoords = useCallback(
    (newLat: number, newLng: number) => {
      const map = mapRef.current;
      let needFly = true;
      if (map) {
        const bounds = map.getBounds();
        if (bounds && bounds.contains([newLng, newLat])) needFly = false;
      }
      applyPinPosition(newLat, newLng, { detect: true, fly: needFly });
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
              "line-opacity": 0.9,
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
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "#000000",
              "text-halo-width": 1.4,
            },
          });
        }
        corridorReadyRef.current = true;
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
        ensureMarker(initial.lat!, initial.lng!, bearing);
        if (!restoredRoad) {
          // No valid saved confirmation for this pin — run detection so
          // road properties + corridor populate on first open of an
          // already-located plan.  With a restored confirmation the
          // selection is already in state and opening the dialog is NOT
          // a re-analysis trigger: zero detect calls fire (use the
          // explicit "Re-detect roads" affordance for a fresh look).
          void detectAt(initial.lat!, initial.lng!);
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
                  "Area located — drop a pin on the road to detect roads.",
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
      corridorReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tokenAvailable, token]);

  // Switch basemap style on the existing map without re-initialising.
  // ``setStyle`` clears all sources, so the corridor layer reinstalls
  // itself in the ``styledata`` listener above.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    corridorReadyRef.current = false;
    map.setStyle(MAPBOX_STYLES[style]);
  }, [style]);

  // ---- Field handlers ---------------------------------------------------

  const onLatChange = (raw: string) => {
    if (raw.includes(",")) {
      const [a, b] = raw.split(",").map((s) => s.trim());
      const la = parseFloat(a);
      const lo = parseFloat(b);
      if (Number.isFinite(la) && Number.isFinite(lo)) {
        setLatInput(fmt4(la));
        setLngInput(fmt4(lo));
        setLatError(isValidLat(la) ? null : "Latitude must be between -90 and 90");
        setLngError(
          isValidLng(lo) ? null : "Longitude must be between -180 and 180",
        );
        if (isValidLat(la) && isValidLng(lo)) {
          applyTypedCoords(la, lo);
        }
        return;
      }
    }
    if (/[°'"NSEW]/i.test(raw)) {
      setLatError("Use decimal degrees (e.g., 38.8862). DMS not supported.");
      setLatInput(raw);
      return;
    }
    setLatInput(raw);
    if (raw.trim() === "") {
      setLatError(null);
      return;
    }
    const n = parseFloat(raw);
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
      applyTypedCoords(n, parseFloat(lngInput));
    }
  };

  const onLngChange = (raw: string) => {
    if (/[°'"NSEW]/i.test(raw)) {
      setLngError("Use decimal degrees (e.g., -104.8354). DMS not supported.");
      setLngInput(raw);
      return;
    }
    setLngInput(raw);
    if (raw.trim() === "") {
      setLngError(null);
      return;
    }
    const n = parseFloat(raw);
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
      applyTypedCoords(parseFloat(latInput), n);
    }
  };

  const onBearingChange = (raw: string) => {
    setBearingInput(raw);
    if (raw.trim() === "") {
      setBearingError(null);
      // Empty input — fall back to the operator's currently-selected
      // candidate if any, else 0.  The arrow rotates so the operator
      // sees the change immediately.
      const fallback =
        selectedCandidateIdx !== null
          ? normaliseBearing(bearingCandidates[selectedCandidateIdx].bearing)
          : 0;
      setBearing(fallback);
      setMarkerBearingRef.current?.(fallback);
      return;
    }
    // Reject anything that isn't a positive integer up-front.  ``parseFloat``
    // would silently accept "37.5" or "37foo" — both are valid for the
    // input box but not for a compass bearing.
    if (!/^\d+$/.test(raw.trim())) {
      setBearingError("Enter a whole number");
      return;
    }
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) {
      setBearingError("Invalid number");
      return;
    }
    if (!isValidBearing(n)) {
      setBearingError("Bearing must be between 0 and 359");
      return;
    }
    setBearingError(null);
    const rounded = normaliseBearing(n);
    setBearing(rounded);
    setMarkerBearingRef.current?.(rounded);
  };

  // Apply a specific candidate to the bearing field AND synthesize
  // the road properties from that candidate's OSM tags.  Used by the
  // picker buttons and indirectly by ``onUseDetectedBearing`` when
  // only one candidate exists.  Property panel and bearing are now
  // derived from the same picked candidate — they cannot disagree.
  const applyCandidate = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= bearingCandidates.length) return;
      const c = bearingCandidates[idx];
      const b = normaliseBearing(c.bearing);
      setSelectedCandidateIdx(idx);
      setBearing(b);
      setBearingInput(String(b));
      setBearingError(null);
      setMarkerBearingRef.current?.(b);
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

  const onUseDetectedBearing = () => {
    // Re-apply the picked candidate (covers the single-candidate case
    // too — detection auto-selects index 0 there).  Ambiguous-unpicked
    // and zero-candidate cases render the button disabled: the pick
    // lives in the rail-top card, and pre-applying is the bug the
    // picker exists to prevent.
    if (selectedCandidateIdx !== null) {
      applyCandidate(selectedCandidateIdx);
      return;
    }
    if (bearingCandidates.length === 1) applyCandidate(0);
  };

  // Explicit fresh analysis at an unmoved pin — the ONLY way to re-run
  // detection without moving the pin (reopening the dialog is not a
  // trigger).  Same reset semantics as a pin move: overrides clear so
  // the fresh detection is the baseline.
  const onRedetect = () => {
    if (!hasPin || !isValidLat(lat) || !isValidLng(lng)) return;
    setOverrides({});
    void detectAt(lat, lng);
  };

  const onFlipDirection = () => {
    const flipped = normaliseBearing(bearing + 180);
    setBearing(flipped);
    setBearingInput(String(flipped));
    setBearingError(null);
    setMarkerBearingRef.current?.(flipped);
  };

  const onWorkZoneChange = (raw: string) => {
    setWorkZoneInput(raw);
    if (raw.trim() === "") {
      setWorkZoneError(null);
      setWorkZoneFt(0);
      return;
    }
    if (!/^\d+$/.test(raw.trim())) {
      setWorkZoneError("Whole number of feet");
      return;
    }
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) {
      setWorkZoneError("Invalid length");
      return;
    }
    if (n > 50000) {
      setWorkZoneError("Implausibly long — under 50,000 ft");
      return;
    }
    setWorkZoneError(null);
    setWorkZoneFt(n);
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
            "Area located — drop a pin on the road to detect roads.",
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
    !bearingError &&
    !workZoneError &&
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
            overrides,
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
      bearingDeg:
        bearingInput.trim() === "" ? undefined : normaliseBearing(bearing),
      workZoneFt,
      classification: classify.state === "detected" ? classify.result : null,
      overrides,
      crossStreet: isNearIntersectionKind ? crossStreet : null,
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
        <div className="flex items-start justify-between border-b border-[color:var(--rule)] px-5 py-3 flex-shrink-0">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--dim)] mb-1">
              Work zone · Define
            </div>
            <h2 className="text-white text-[17px] font-semibold m-0">
              Define Work Zone
            </h2>
            <p className="text-[12px] text-[color:var(--ink-on-dark-faint)] mt-0.5 m-0">
              Drop a pin, review the detected road properties, and set the
              work-zone length.
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
              className="flex gap-2 border-b border-[color:var(--rule)] px-5 py-2.5 flex-shrink-0"
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
              <div className="px-5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fail)] flex-shrink-0">
                {searchStatus.message}
              </div>
            )}
            {coarseNotice && (
              <div className="px-5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark)] flex-shrink-0">
                {coarseNotice}
              </div>
            )}

            {/* Manual-coords toggle + collapsible row.  Sits directly under
                the search bar so it reads as an alternative to address
                search rather than a buried fallback at the modal foot.
                Auto-expanded when the Mapbox token is missing. */}
            <div className="border-b border-[color:var(--rule)] px-5 py-1.5 flex-shrink-0 flex items-center justify-between">
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
              <div className="grid grid-cols-2 gap-3 border-b border-[color:var(--rule)] px-5 py-2 flex-shrink-0">
                <div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={latInput}
                    onChange={(e) => onLatChange(e.target.value)}
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
                    <CorridorLegend />
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
                  map can&apos;t load — please enter coordinates manually below.
                </div>
              </div>
            )}

            {/* Bearing detection warning lives just below the map so it's
                visible the moment classification surfaces a problem. */}
            {bearingWarning && (
              <div className="border-t border-[color:var(--rule)] px-5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--warn)] flex-shrink-0">
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
              <RoadPropertiesPanel
                classify={classify}
                overrides={overrides}
                setOverrides={setOverrides}
                scenarioKind={initial.scenarioKind}
                canRedetect={hasPin}
                onRedetect={onRedetect}
              />

              <div className="border-t border-[color:var(--rule)]">
                <WorkZonePanel
                  workZoneInput={workZoneInput}
                  workZoneError={workZoneError}
                  onWorkZoneChange={onWorkZoneChange}
                  bearingInput={bearingInput}
                  bearingError={bearingError}
                  onBearingChange={onBearingChange}
                  bearingCandidates={bearingCandidates}
                  selectedCandidateIdx={selectedCandidateIdx}
                  onUseDetectedBearing={onUseDetectedBearing}
                  onFlipDirection={onFlipDirection}
                  hasPin={hasPin}
                />
                {isNearIntersectionKind && (
                  <CrossStreetPanel
                    hasPin={hasPin}
                    intersectionMode={intersectionMode}
                    onToggleMode={() => setIntersectionMode((v) => !v)}
                    crossPin={crossPin}
                    crossStatus={crossStatus}
                    crossStreet={crossStreet}
                    onClear={clearCrossPin}
                  />
                )}
                <CorridorPreviewPanel
                  corridor={corridor}
                  hasPin={hasPin}
                  specStatus={specStatus}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[color:var(--rule)] px-5 py-3 flex-shrink-0">
          {roadUnresolved && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--warn)]">
              <span aria-hidden="true">⚠ </span>
              Pick a road to continue
            </span>
          )}
          {classify.state === "resolving" && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
              Detecting road… — Save enables when detection settles
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
            className="px-5 py-2 font-sans text-[13px] bg-[color:var(--act)] text-[color:var(--on-act)] hover:bg-[color:var(--act-bright)] disabled:opacity-40 disabled:cursor-not-allowed"
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
  onClear,
}: {
  hasPin: boolean;
  intersectionMode: boolean;
  onToggleMode: () => void;
  crossPin: { lat: number; lng: number } | null;
  crossStatus: "idle" | "resolving" | "detected" | "none" | "error";
  crossStreet: CrossStreetCandidate | null;
  onClear: () => void;
}) {
  return (
    <div className="border-t border-[color:var(--rule)] px-5 py-3">
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
      {crossStatus === "detected" && crossStreet && (
        <p className="text-[11px] text-[color:var(--ink-on-dark)] mt-2 m-0">
          {crossStreet.name ?? "Unnamed road"} —{" "}
          {crossStreet.legCount === 1 ? "one-way" : "two-way"}
          {crossStreet.signalized ? ", signal detected" : ""}. Crossing
          about {Math.abs(crossStreet.alongStationFt).toLocaleString("en-US")}{" "}
          ft {crossStreet.alongStationFt < 0 ? "past" : "before"} the work
          zone. You&apos;ll confirm the details in the form.
        </p>
      )}
    </div>
  );
}

// Static legend bar.  Positioning is owned by the parent — this is
// rendered inside the bottom-right stack alongside the Recenter
// button, so it shouldn't carry its own absolute coords.
function CorridorLegend() {
  const rows: Array<{ zone: CorridorZone }> = [
    { zone: "advance_warning" },
    { zone: "transition" },
    { zone: "buffer" },
    { zone: "work_zone" },
    { zone: "downstream" },
  ];
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

// ---- RoadPropertiesPanel --------------------------------------------------

function RoadPropertiesPanel({
  classify,
  overrides,
  setOverrides,
  scenarioKind,
  canRedetect,
  onRedetect,
}: {
  classify: ClassifyStatus;
  overrides: RoadFieldOverrides;
  setOverrides: (next: RoadFieldOverrides) => void;
  scenarioKind: ScenarioKind;
  canRedetect: boolean;
  onRedetect: () => void;
}) {
  return (
    <div>
      <div className="px-5 py-2 border-b border-[color:var(--rule)] bg-[color:var(--canvas)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] flex items-center justify-between">
        <span>Road properties</span>
        {/* Explicit fresh-analysis affordance: reopening the dialog
            never re-detects (a restored confirmation stays put), so
            this is the one control that re-runs detection at an
            unmoved pin. */}
        {canRedetect && classify.state !== "resolving" && (
          <button
            type="button"
            onClick={onRedetect}
            className="border border-[color:var(--rule)] bg-transparent text-[color:var(--ink-on-dark)] font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-0.5 hover:border-[color:var(--act)] hover:text-[color:var(--act)] transition-colors"
          >
            ↻ Re-detect roads
          </button>
        )}
      </div>

      <div className="px-5 py-1">
        {classify.state === "idle" && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-3">
            Drop a pin on the map to auto-detect road properties.
          </div>
        )}
        {classify.state === "resolving" && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-3 flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full border-[1.5px] border-[color:var(--act)]/40 border-t-[color:var(--act)] animate-spin" />
            Classifying road…
          </div>
        )}
        {classify.state === "awaiting_pick" && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--warn)] py-3">
            Multiple roads detected — pick a road above to load road
            properties.
          </div>
        )}
        {classify.state === "error" && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fail)] py-3">
            {classify.message}. Fields default to the scenario&apos;s existing
            values — verify manually below.
          </div>
        )}
        {classify.state === "detected" && (
          <DetectedRows
            result={classify.result}
            overrides={overrides}
            setOverrides={setOverrides}
            scenarioKind={scenarioKind}
          />
        )}
      </div>
    </div>
  );
}

function DetectedRows({
  result,
  overrides,
  setOverrides,
  scenarioKind,
}: {
  result: RoadClassification;
  overrides: RoadFieldOverrides;
  setOverrides: (next: RoadFieldOverrides) => void;
  scenarioKind: ScenarioKind;
}) {
  const speedDetected =
    result.speedLimitMph ?? result.fields.speed.value ?? null;
  const lanesDetected =
    result.lanesPerDirection ?? result.fields.lanes.value ?? null;

  const speedValue = overrides.speedMph ?? speedDetected;
  const lanesValue = overrides.lanesPerDirection ?? lanesDetected;
  const roadTypeValue = overrides.roadType ?? result.roadType;
  const dividedValue = overrides.divided ?? result.divided;

  // UX-01: surface the domain clamp right at the speed field so the
  // operator sees the cap before Save.  The corridor preview already
  // computes with the clamped value (commit 1); this names *why* the
  // value shown in the field won't carry verbatim.  Only the bound clamp
  // gets the "cap" framing; a pure 5-mph grid snap gets the lighter note.
  const speedClampedTo =
    speedValue != null ? snapSpeedToDomain(scenarioKind, speedValue) : null;
  const speedSourceWord =
    overrides.speedMph !== undefined ? "entered" : "detected (OSM)";
  let speedNote: string | null = null;
  if (
    speedValue != null &&
    speedClampedTo != null &&
    speedClampedTo !== speedValue
  ) {
    const boundClamp = Math.round(speedValue / 5) * 5 !== speedClampedTo;
    speedNote = boundClamp
      ? `${speedValue} mph ${speedSourceWord} — ${scenarioNoun(scenarioKind)} plans cap at ${speedClampedTo} mph (${scenarioTa(scenarioKind)} speed domain). Plan will use ${speedClampedTo}.`
      : `${speedValue} mph ${speedSourceWord} snaps to the ${speedClampedTo} mph grid. Plan will use ${speedClampedTo}.`;
  }

  // UX-02: a low-confidence speed (highway-class fallback, no OSM tag)
  // does not auto-apply.  Offer an explicit click-to-accept so the
  // reviewed value can be kept in one click (Pattern B) instead of
  // silently evaporating.  Once accepted it becomes an override (applies
  // + drives the preview); the affordance hides and the row reads as
  // modified.  No auto-apply behavior changes — the operator opts in.
  const speedLowConf =
    result.fields.speed.confidence === "low" && speedDetected != null;
  const showAcceptSpeed = speedLowConf && overrides.speedMph === undefined;

  return (
    <div className="flex flex-col">
      <RoadFieldRow
        label="Speed limit (mph)"
        field={result.fields.speed}
        modified={
          overrides.speedMph !== undefined &&
          (overrides.speedMph !== speedDetected || speedLowConf)
        }
        note={speedNote}
      >
        <NumericFieldEditor
          value={speedValue}
          step={5}
          min={5}
          max={85}
          onChange={(v) =>
            setOverrides({
              ...overrides,
              speedMph: v ?? undefined,
            })
          }
          onClear={() => {
            const next = { ...overrides };
            delete next.speedMph;
            setOverrides(next);
          }}
          hasOverride={overrides.speedMph !== undefined}
        />
      </RoadFieldRow>

      {showAcceptSpeed && (
        <div className="flex items-center justify-between gap-3 py-2 -mt-1 border-b border-[color:var(--rule)]/40">
          <span className="font-mono text-[10px] tracking-[0.04em] leading-snug text-[color:var(--warn)]">
            Low-confidence fallback — won&apos;t apply unless you accept it.
          </span>
          <button
            type="button"
            onClick={() =>
              setOverrides({
                ...overrides,
                speedMph: speedDetected ?? undefined,
              })
            }
            className="flex-shrink-0 border border-[color:var(--act)] bg-transparent text-[color:var(--act)] font-mono text-[10px] uppercase tracking-[0.08em] px-2.5 py-1 hover:bg-[color:var(--act)] hover:text-[color:var(--on-act)] transition-colors"
          >
            Use {speedDetected} mph
          </button>
        </div>
      )}

      <RoadFieldRow
        label="Lanes per direction"
        field={result.fields.lanes}
        modified={
          overrides.lanesPerDirection !== undefined &&
          overrides.lanesPerDirection !== lanesDetected
        }
      >
        <NumericFieldEditor
          value={lanesValue}
          step={1}
          min={1}
          max={6}
          onChange={(v) =>
            setOverrides({
              ...overrides,
              lanesPerDirection: v ?? undefined,
            })
          }
          onClear={() => {
            const next = { ...overrides };
            delete next.lanesPerDirection;
            setOverrides(next);
          }}
          hasOverride={overrides.lanesPerDirection !== undefined}
        />
      </RoadFieldRow>

      <RoadFieldRow
        label="Road type"
        field={result.fields.roadType}
        modified={
          overrides.roadType !== undefined &&
          overrides.roadType !== result.roadType
        }
      >
        <RoadTypeEditor
          value={roadTypeValue}
          onChange={(v) =>
            setOverrides({
              ...overrides,
              roadType: v === result.roadType ? undefined : v,
            })
          }
          onClear={() => {
            const next = { ...overrides };
            delete next.roadType;
            setOverrides(next);
          }}
          hasOverride={overrides.roadType !== undefined}
        />
      </RoadFieldRow>

      <RoadFieldRow
        label="Divided"
        field={result.fields.divided}
        modified={
          overrides.divided !== undefined &&
          overrides.divided !== result.divided
        }
      >
        <DividedEditor
          value={dividedValue}
          onChange={(v) =>
            setOverrides({
              ...overrides,
              divided: v === result.divided ? undefined : v,
            })
          }
          onClear={() => {
            const next = { ...overrides };
            delete next.divided;
            setOverrides(next);
          }}
          hasOverride={overrides.divided !== undefined}
        />
      </RoadFieldRow>
    </div>
  );
}

// One detected road property.  Layout is a strict 2-column grid: label
// + single-line source caption on the left, control on the right.  The
// right column width is locked at 150 px so every editor — number,
// dropdown, pill — anchors to the same column edge regardless of its
// natural width.  Row height ~52 px keeps the section dense.
function RoadFieldRow<T>({
  label,
  field,
  modified,
  children,
  note,
}: {
  label: string;
  field: DetectedField<T>;
  modified: boolean;
  children: React.ReactNode;
  // Optional below-caption annotation (UX-01: the domain clamp/snap note
  // on the speed row).  Rendered in the orange low-confidence tone so it
  // reads as a "heads up, this value will change" signal.
  note?: string | null;
}) {
  // The visible provenance is a short, non-truncating token — source +
  // method only ("OSM · MEASURED" / "OSM · INFERRED").  The full
  // sentence (the old visible line) plus the confidence word and raw
  // evidence move to the tooltip, same pattern as the spec-chain
  // breadcrumb (title attribute: hover + tap, no extra tab stop).
  //
  // Provenance tracks WHO owns the value now.  Once the operator edits
  // or accepts a field (``modified``), the value is theirs, not the
  // detector's — it reads "OPERATOR-SET" in the neutral tone and is
  // never inferred, because a value the operator confirmed is no longer
  // a guess (Ryan ruling).  Otherwise the warning tone follows the
  // detection METHOD, not the pip count: only an inferred detected
  // value borrows amber, so a measured value — even at medium
  // confidence — reads neutral and never misuses the warning role.
  const inferred = !modified && field.method === "inferred";
  const confTone = inferred
    ? "text-[color:var(--warn)]"
    : "text-[color:var(--ink-on-dark-faint)]";
  const provenanceText = modified ? "operator-set" : `OSM · ${field.method}`;
  const provenanceTitle = modified
    ? `Operator-set — overrides the detected ${field.source}`
    : [field.source, `${field.confidence} confidence`, field.rawData]
        .filter(Boolean)
        .join(" · ");
  return (
    <div className="grid grid-cols-[1fr_150px] gap-3 items-center py-2 border-b border-[color:var(--rule)]/40 last:border-b-0 min-h-[52px]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-white font-medium leading-none">
            {label}
          </span>
          <ConfPips c={field.confidence} />
          {modified && (
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[color:var(--ink-mute)] border border-dashed border-[color:var(--ink-faint)] px-1 leading-none py-px">
              modified
            </span>
          )}
        </div>
        <div
          className={`mt-1 font-mono text-[10px] uppercase tracking-[0.06em] leading-tight cursor-help ${confTone}`}
          title={provenanceTitle}
        >
          {provenanceText}
        </div>
        {note && (
          <div className="mt-1 font-mono text-[10px] tracking-[0.04em] leading-snug text-[color:var(--warn)]">
            {note}
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-1.5 min-w-0">
        {children}
      </div>
    </div>
  );
}

// Width of the revert button + its gap; the input fills the rest of
// the 150 px right column so all three editors visually anchor to the
// same column edge.
function RevertButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      title="Revert to detected value"
      className="font-mono text-[12px] text-[color:var(--ink-on-dark-faint)] hover:text-white px-1 leading-none flex-shrink-0"
    >
      ↺
    </button>
  );
}

function NumericFieldEditor({
  value,
  step,
  min,
  max,
  onChange,
  onClear,
  hasOverride,
}: {
  value: number | null;
  step: number;
  min: number;
  max: number;
  onChange: (v: number | null) => void;
  onClear: () => void;
  hasOverride: boolean;
}) {
  return (
    <>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          const n = parseInt(raw, 10);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="field-input flex-1 min-w-0 text-right"
      />
      {hasOverride && <RevertButton onClear={onClear} />}
    </>
  );
}

function RoadTypeEditor({
  value,
  onChange,
  onClear,
  hasOverride,
}: {
  value: RoadType;
  onChange: (v: RoadType) => void;
  onClear: () => void;
  hasOverride: boolean;
}) {
  return (
    <>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RoadType)}
        aria-label="Road type"
        className="field-input field-select flex-1 min-w-0 text-[12px]"
      >
        {ROAD_TYPE_OPTIONS.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
      {hasOverride && <RevertButton onClear={onClear} />}
    </>
  );
}

function DividedEditor({
  value,
  onChange,
  onClear,
  hasOverride,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  onClear: () => void;
  hasOverride: boolean;
}) {
  return (
    <>
      <div className="flex flex-1 min-w-0 border border-[color:var(--rule)]">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 font-mono text-[10px] uppercase tracking-[0.06em] py-1.5 ${
            value
              ? "bg-[color:var(--act)] text-[color:var(--on-act)]"
              : "text-[color:var(--ink-on-dark)] hover:text-white"
          }`}
        >
          Divided
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 font-mono text-[10px] uppercase tracking-[0.06em] py-1.5 border-l border-[color:var(--rule)] ${
            !value
              ? "bg-[color:var(--act)] text-[color:var(--on-act)]"
              : "text-[color:var(--ink-on-dark)] hover:text-white"
          }`}
        >
          Undivided
        </button>
      </div>
      {hasOverride && <RevertButton onClear={onClear} />}
    </>
  );
}

// ---- WorkZonePanel --------------------------------------------------------

function WorkZonePanel({
  workZoneInput,
  workZoneError,
  onWorkZoneChange,
  bearingInput,
  bearingError,
  onBearingChange,
  bearingCandidates,
  selectedCandidateIdx,
  onUseDetectedBearing,
  onFlipDirection,
  hasPin,
}: {
  workZoneInput: string;
  workZoneError: string | null;
  onWorkZoneChange: (v: string) => void;
  bearingInput: string;
  bearingError: string | null;
  onBearingChange: (v: string) => void;
  bearingCandidates: RoadCandidate[];
  selectedCandidateIdx: number | null;
  onUseDetectedBearing: () => void;
  onFlipDirection: () => void;
  hasPin: boolean;
}) {
  const ambiguous = bearingCandidates.length > 1;
  const selectedCandidate =
    selectedCandidateIdx !== null
      ? (bearingCandidates[selectedCandidateIdx] ?? null)
      : null;
  // Disabled when there is nothing to apply: no candidates at all, or
  // an ambiguous set with no pick yet — that decision lives in the
  // rail-top Which-road card, not this row.  After a pick, the button
  // re-applies the picked candidate's bearing.
  const useDetectedDisabled =
    bearingCandidates.length === 0 ||
    (ambiguous && selectedCandidate === null);
  // #152 A: the detected bearing is the labeled DEFAULT, not a hidden
  // action — when the field holds exactly the selected candidate's
  // bearing, the row says so; a manual value names what it displaced.
  const detectedBearing = selectedCandidate
    ? normaliseBearing(selectedCandidate.bearing)
    : null;
  const usingDetected =
    detectedBearing !== null &&
    bearingInput.trim() !== "" &&
    /^\d+$/.test(bearingInput.trim()) &&
    normaliseBearing(parseInt(bearingInput, 10)) === detectedBearing;
  const useDetectedTitle =
    bearingCandidates.length === 0
      ? "No bearing detected at this pin"
      : ambiguous && selectedCandidate === null
        ? "Pick a road above first"
        : usingDetected
          ? `Detected bearing ${detectedBearing}° is in use`
          : `Use ${normaliseBearing(
              (selectedCandidate ?? bearingCandidates[0]).bearing,
            )}° detected from OSM`;
  return (
    <div>
      <div className="px-5 py-2 border-b border-[color:var(--rule)] bg-[color:var(--canvas)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
        Work zone
      </div>

      <div className="px-5 py-1">
        {/* Work zone length — matches RoadFieldRow's 2-col rhythm */}
        <div className="grid grid-cols-[1fr_150px] gap-3 items-center py-2 border-b border-[color:var(--rule)]/40 min-h-[52px]">
          <div className="min-w-0">
            <div className="text-[13px] text-white font-medium leading-none">
              Work zone length (ft)
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] leading-tight">
              {workZoneError ? (
                <span className="text-[color:var(--fail)]">{workZoneError}</span>
              ) : (
                <>Whole feet, &lt; 50,000</>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end min-w-0">
            <input
              type="number"
              inputMode="numeric"
              value={workZoneInput}
              onChange={(e) => onWorkZoneChange(e.target.value)}
              aria-label="Work zone length in feet"
              placeholder="200"
              className="field-input flex-1 min-w-0 text-right"
            />
          </div>
        </div>

        {/* Direction of travel — label + caption on the left mirrors a
            normal row, but the right side has 3 controls so we break it
            into its own block below to keep buttons readable. */}
        <div className="grid grid-cols-[1fr_150px] gap-3 items-center py-2 min-h-[52px]">
          <div className="min-w-0">
            <div className="text-[13px] text-white font-medium leading-none">
              Direction of travel (°)
            </div>
            <div
              className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] leading-tight truncate"
              title="Compass bearing in degrees clockwise from north."
            >
              {bearingError ? (
                <span className="text-[color:var(--fail)]">{bearingError}</span>
              ) : selectedCandidate && usingDetected ? (
                <CandidateCaption
                  candidate={selectedCandidate}
                  multi={ambiguous}
                />
              ) : selectedCandidate ? (
                <>
                  Manual bearing — detected {detectedBearing}° available
                  below
                </>
              ) : (
                <>0–359 clockwise from north</>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end min-w-0">
            <input
              type="number"
              inputMode="numeric"
              value={bearingInput}
              onChange={(e) => onBearingChange(e.target.value)}
              aria-label="Direction of travel in degrees"
              placeholder="0–359"
              className="field-input flex-1 min-w-0 text-right"
            />
          </div>
        </div>

        {/* Bearing action row — sits flush under the bearing input,
            full-width so the two buttons read as one cluster. */}
        <div className="flex gap-2 pb-2 -mt-1">
          <button
            type="button"
            onClick={onUseDetectedBearing}
            disabled={useDetectedDisabled}
            title={useDetectedTitle}
            aria-pressed={usingDetected}
            className={`flex-1 border border-[color:var(--act)] font-mono text-[10px] uppercase tracking-[0.08em] py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              usingDetected
                ? "bg-[color:var(--act)] text-[color:var(--on-act)]"
                : "bg-transparent text-[color:var(--act)] hover:bg-[color:var(--act)] hover:text-[color:var(--on-act)]"
            }`}
          >
            {usingDetected ? "✓ Detected (in use)" : "Use Detected"}
          </button>
          <button
            type="button"
            onClick={onFlipDirection}
            disabled={!hasPin}
            title="Reverse direction by 180°"
            className="flex-1 border border-[color:var(--ink-on-dark-faint)] bg-transparent text-[color:var(--ink-on-dark)] font-mono text-[10px] uppercase tracking-[0.08em] py-1.5 hover:border-white hover:text-white transition-colors disabled:opacity-40"
          >
            ⟲ Flip
          </button>
        </div>
      </div>
    </div>
  );
}

// Rail-top detection-outcome card (#152 Surface A).  Once detection has
// run at a pin, the operator always sees exactly one outcome here —
// silence is indistinguishable from a hang, so every branch renders:
//   resolving   → in-flight skeleton line
//   0 candidates → explicit empty state ("set manually"), never nothing
//   1 candidate  → the detected road as a pre-selected row — the same
//                  confirm affordance the multi-list uses, already
//                  applied (detection auto-picks the sole match)
//   2+          → the WhichRoadCard pick flow, unchanged
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
      <div className="border-b border-[color:var(--rule)] px-5 py-3">
        <div className="border border-[color:var(--rule)] px-3.5 py-2.5">
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
      <div className="border-b border-[color:var(--rule)] px-5 py-3">
        <div className="border border-[color:var(--rule)] px-3.5 py-2.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--none)]">
            <span aria-hidden>◌ </span>
            {emptyMessage ?? "No roads detected"}
          </div>
          <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)]">
            Set direction of travel and road properties manually below, or
            drag the pin closer to the roadway.
          </div>
        </div>
      </div>
    );
  }
  if (candidates.length === 1) {
    return (
      <div className="border-b border-[color:var(--rule)] px-5 py-3">
        <div className="border border-[color:var(--rule)] px-3.5 py-2.5">
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
    <div className="border-b border-[color:var(--rule)] px-5 py-3">
      <div className="border border-[color:var(--warn)] bg-[color:var(--warn-soft)] px-3.5 py-2.5">
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
                <CandidateCaption candidate={picked} multi={false} />
              </span>
              {/* act-bright, not act: on the amber-tinted card bg the
                  base cyan measures 4.09:1 — under the 4.5 AA text
                  floor.  act-bright measures 5.06:1 (hover fill 7.73). */}
              <button
                type="button"
                onClick={() => setReExpanded(true)}
                className="flex-shrink-0 border border-[color:var(--act-bright)] bg-transparent text-[color:var(--act-bright)] font-mono text-[10px] uppercase tracking-[0.08em] px-2.5 py-1 hover:bg-[color:var(--act-bright)] hover:text-[color:var(--on-act)] transition-colors"
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
function CandidateCaption({
  candidate,
  multi,
}: {
  candidate: RoadCandidate;
  multi: boolean;
}) {
  const lbl = candidateLabel(candidate);
  const brg = normaliseBearing(candidate.bearing);
  return (
    <>
      Detected from OSM: {brg}° ({lbl.primary} {lbl.direction.toLowerCase()},{" "}
      {lbl.sub.toLowerCase()}) · way {candidate.way_id}
      {/* inc-5: the hint used to read "tap Pick Road to change" — that
          button is gone; the change affordance is the rail-top card. */}
      {multi && <span className="opacity-70"> · change it above</span>}
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
            className={`text-left px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] border transition-colors ${
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

function CorridorPreviewPanel({
  corridor,
  hasPin,
  specStatus,
}: {
  corridor: CorridorPolyline | null;
  hasPin: boolean;
  // Backend corridor-spec fetch state (engine-removal PR D).  The zone
  // lengths are server-computed; this panel names the wait/failure
  // instead of ever drawing a locally-derived extent.
  specStatus: "idle" | "loading" | "ready" | "error";
}) {
  return (
    <div className="border-t border-[color:var(--rule)]">
      <div className="px-5 py-2 border-b border-[color:var(--rule)] bg-[color:var(--canvas)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
        Corridor extent
      </div>

      <div className="px-5 py-3">
        {!hasPin && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-1">
            Drop a pin to compute the corridor.
          </div>
        )}
        {hasPin && !corridor && specStatus === "loading" && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-1">
            Computing corridor extent…
          </div>
        )}
        {hasPin && !corridor && specStatus === "error" && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--none)] py-1">
            Corridor preview unavailable — couldn&apos;t reach the spacing
            service. You can still save; the plan is validated when
            generated.
          </div>
        )}
        {hasPin && !corridor && specStatus !== "loading" && specStatus !== "error" && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-1">
            Enter a work-zone length to compute the corridor.
          </div>
        )}
        {corridor && (
          <>
            <ExtentRows corridor={corridor} />
            {specStatus === "loading" && (
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] pt-2">
                Preview updating…
              </div>
            )}
            {specStatus === "error" && (
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--none)] pt-2">
                Preview may be stale — spacing service unreachable.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ExtentRows({ corridor }: { corridor: CorridorPolyline }) {
  // Always render all 5 zones in upstream → downstream order (the order
  // a motorist encounters them), even if a segment is 0 ft.  Keeps the
  // layout stable as the operator types and prevents the list from
  // jumping around.
  const display: Array<{ zone: CorridorZone; lengthFt: number }> = [
    {
      zone: "advance_warning",
      lengthFt:
        corridor.segments.find((s) => s.zone === "advance_warning")?.lengthFt ??
        0,
    },
    {
      zone: "transition",
      lengthFt:
        corridor.segments.find((s) => s.zone === "transition")?.lengthFt ?? 0,
    },
    {
      zone: "buffer",
      lengthFt:
        corridor.segments.find((s) => s.zone === "buffer")?.lengthFt ?? 0,
    },
    {
      zone: "work_zone",
      lengthFt:
        corridor.segments.find((s) => s.zone === "work_zone")?.lengthFt ?? 0,
    },
    {
      zone: "downstream",
      lengthFt:
        corridor.segments.find((s) => s.zone === "downstream")?.lengthFt ?? 0,
    },
  ];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between py-1 border-b border-[color:var(--rule)]">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)]">
          Total
        </span>
        <span className="text-white font-semibold text-[15px] tabular-nums">
          {fmtFt(corridor.totalLengthFt)} ft
        </span>
      </div>
      {display.map((d) => (
        <div
          key={d.zone}
          className="flex items-baseline justify-between gap-3 py-0.5"
        >
          <span className="flex items-center gap-2 min-w-0 flex-1">
            <ZoneChannelSwatch zone={d.zone} className="flex-shrink-0" />
            <span className="text-[12px] text-[color:var(--ink-on-dark)] truncate">
              {ZONE_LABEL[d.zone]}
            </span>
          </span>
          <span className="font-mono text-[12px] text-white tabular-nums whitespace-nowrap">
            {fmtFt(d.lengthFt)} ft
          </span>
        </div>
      ))}
    </div>
  );
}
