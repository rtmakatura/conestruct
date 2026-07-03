"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as MapboxGL from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type {
  Confidence,
  DetectedField,
  RoadCandidate,
  RoadClassification,
  RoadDetectResponse,
} from "@/lib/road-detection/types";
import { classifyFromCandidate } from "@/lib/road-detection/classify";
import {
  bearingToDirectionLabel as bearingToDirectionLabelImpl,
  candidateLabel,
} from "@/lib/road-detection/labels";
import type { RoadType, ScenarioKind } from "@/lib/scenarios";
import { snapSpeedToDomain } from "@/lib/scenarios";
import { scenarioNoun, scenarioTa } from "@/lib/scenarios/handoff-summary";
import {
  buildCorridorSpec,
  roadCategoryForRoadType,
} from "@/lib/corridor-spacing";
import {
  buildCorridorPolyline,
  ZONE_COLOR,
  ZONE_LABEL,
  type CorridorPolyline,
  type CorridorZone,
} from "@/lib/corridor-polyline";

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
const PIN_COLOR = "#E8710A";

const CORRIDOR_SOURCE_ID = "corridor-source";
const CORRIDOR_LAYER_ID = "corridor-layer";

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

function confDotClass(c: Confidence): string {
  switch (c) {
    case "high":
      return "bg-[color:var(--cyan)]";
    case "medium":
      return "bg-[color:var(--orange)]";
    case "low":
      return "bg-[#d94f4f]";
  }
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

export function LocationPickerModal({ open, initial, onCancel, onSave }: Props) {
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
    [],
  );
  // Pin-level place context returned alongside the candidates.  Drives
  // urban-vs-rural classification when the operator picks a candidate.
  const [detectionContext, setDetectionContext] = useState<{
    isUrban: boolean;
    placeName: string | null;
  }>({ isUrban: false, placeName: null });
  // Which candidate is currently reflected in the bearing field.  Null
  // means "no selection yet" (multi-candidate case before the operator
  // picks).  Single-candidate case auto-selects index 0.
  const [selectedCandidateIdx, setSelectedCandidateIdx] = useState<
    number | null
  >(null);
  // When true, the inline picker is rendered under the bearing row.
  // Auto-opens on a fresh multi-candidate detection and on "Use
  // Detected" when multiple candidates exist; closes after the
  // operator picks one.
  const [showCandidatePicker, setShowCandidatePicker] = useState(false);

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

  // ---- Road-property classification --------------------------------------
  const [classify, setClassify] = useState<ClassifyStatus>({ state: "idle" });
  // User overrides on top of the classification.  Keyed by field; an
  // undefined entry means "no override, use detected".  The values
  // here are committed to the parent on Save.
  const [overrides, setOverrides] = useState<RoadFieldOverrides>({});

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

  // ---- Corridor projection ----------------------------------------------
  const corridor = useMemo<CorridorPolyline | null>(() => {
    if (!hasPin || !isValidLat(lat) || !isValidLng(lng)) return null;
    if (workZoneFt <= 0) return null;
    // UX-01: the form clamps speed to the scenario kind's schema domain
    // on Save (snapSpeedToDomain, inside applyClassification /
    // applyOverridesToScenario).  Compute the in-modal preview with that
    // same clamped value so the corridor numbers the operator reviews are
    // the ones Save will actually apply — otherwise they implicitly
    // approve a buffer/total the form then silently changes (the
    // "approved 2,745, received 2,595" contradiction at the handoff).
    const rawSpeed = effectiveSpeed ?? initial.speedMph ?? 35;
    const speed = snapSpeedToDomain(initial.scenarioKind, rawSpeed);
    const spec = buildCorridorSpec({
      anchorLat: lat,
      anchorLng: lng,
      bearingDeg: bearing,
      speedMph: speed,
      workZoneFt,
      scenarioKind: initial.scenarioKind,
      // Backend-faithful category mapping (schemas.py _map_road_type),
      // including the speed-dependent urban_arterial split the previous
      // inline ternary got wrong (it always picked urban_high).
      roadCategory: roadCategoryForRoadType(effectiveRoadType, speed),
    });
    return buildCorridorPolyline(spec);
  }, [
    hasPin,
    lat,
    lng,
    bearing,
    workZoneFt,
    effectiveSpeed,
    effectiveRoadType,
    initial.scenarioKind,
    initial.speedMph,
  ]);

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
          setShowCandidatePicker(false);
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
          setShowCandidatePicker(false);
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
          setShowCandidatePicker(false);
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
          // Multi-candidate: surface the picker, leave bearing alone,
          // and hold the property panel in awaiting_pick until the
          // operator commits to a road.
          setSelectedCandidateIdx(null);
          setShowCandidatePicker(true);
          setClassify({ state: "awaiting_pick" });
        }
      } catch {
        if (bearingTokenRef.current === myToken) {
          setBearingWarning(
            "Couldn't reach road-detection service. Enter bearing manually.",
          );
          setBearingCandidates([]);
          setSelectedCandidateIdx(null);
          setShowCandidatePicker(false);
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
          map.addLayer({
            id: CORRIDOR_LAYER_ID,
            type: "line",
            source: CORRIDOR_SOURCE_ID,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-width": 6,
              "line-opacity": 0.9,
              "line-color": [
                "match",
                ["get", "zone"],
                "advance_warning",
                ZONE_COLOR.advance_warning,
                "transition",
                ZONE_COLOR.transition,
                "buffer",
                ZONE_COLOR.buffer,
                "work_zone",
                ZONE_COLOR.work_zone,
                "downstream",
                ZONE_COLOR.downstream,
                /* default */ "#ffffff",
              ],
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
        // Run detection so road properties + corridor populate on first
        // open of an already-located plan.
        void detectAt(initial.lat!, initial.lng!);
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
              const j = (await r.json()) as { lat: number; lng: number };
              setSearchStatus({ state: "idle" });
              applyPinPosition(j.lat, j.lng, {
                detect: true,
                fly: true,
                targetZoom: PIN_ZOOM,
              });
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
      setShowCandidatePicker(false);
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
    if (bearingCandidates.length === 0) return;
    if (bearingCandidates.length === 1) {
      applyCandidate(0);
      return;
    }
    // Multiple candidates — re-expand the picker so the operator can
    // pick.  Don't pre-apply: that's the bug we're fixing.
    setShowCandidatePicker(true);
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
        const j = (await r.json()) as { lat: number; lng: number };
        setSearchStatus({ state: "idle" });
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

  const canSave =
    hasPin &&
    isValidLat(lat) &&
    isValidLng(lng) &&
    !latError &&
    !lngError &&
    !bearingError &&
    !workZoneError;

  const onClickSave = () => {
    if (!canSave) return;
    onSave({
      address,
      lat,
      lng,
      bearingDeg:
        bearingInput.trim() === "" ? undefined : normaliseBearing(bearing),
      workZoneFt,
      classification: classify.state === "detected" ? classify.result : null,
      overrides,
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 md:p-6"
      onClick={onCancel}
    >
      <div
        className="border border-[color:var(--rule)] bg-[color:var(--canvas-tint)] flex flex-col w-full h-full md:w-[90vw] md:h-[90vh] md:max-w-[1280px] md:max-h-[880px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Define work zone"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[color:var(--rule)] px-5 py-3 flex-shrink-0">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--orange)] mb-1">
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

        {/* Search bar */}
        <form
          onSubmit={onSubmitSearch}
          className="flex gap-2 border-b border-[color:var(--rule)] px-5 py-2.5 flex-shrink-0"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Address or intersection (e.g., I-25 & Bijou St, Colorado Springs)"
            className="field-input flex-1"
          />
          <button
            type="submit"
            disabled={searchStatus.state === "resolving" || !searchQuery.trim()}
            className="border border-[color:var(--cyan)] bg-transparent text-[color:var(--cyan)] font-mono text-[11px] uppercase tracking-[0.1em] px-4 hover:bg-[color:var(--cyan)] hover:text-white transition-colors disabled:opacity-40"
          >
            {searchStatus.state === "resolving" ? "Searching…" : "Search"}
          </button>
        </form>
        {searchStatus.state === "error" && (
          <div className="px-5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#EB5757] flex-shrink-0">
            {searchStatus.message}
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
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] hover:text-[color:var(--cyan)]"
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
                placeholder="Latitude (e.g., 38.8862)"
                className="field-input w-full"
              />
              {latError && (
                <div className="mt-1 font-mono text-[10px] text-[#EB5757]">
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
                placeholder="Longitude (e.g., -104.8354)"
                className="field-input w-full"
              />
              {lngError && (
                <div className="mt-1 font-mono text-[10px] text-[#EB5757]">
                  {lngError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Body: map (top) + panels (bottom). The body scrolls when the
            viewport is small; the map keeps a minimum height so the
            corridor preview is always readable. */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          {/* Map */}
          {tokenAvailable ? (
            <div
              ref={containerRef}
              className="relative bg-black/30 flex-shrink-0"
              style={{ minHeight: 320, height: "44vh" }}
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
                    className="bg-black/75 border border-white/20 text-white p-1.5 hover:bg-black/90 hover:border-[color:var(--cyan)] transition-colors flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em]"
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
              className="relative bg-black/30 flex items-center justify-center text-center px-6 flex-shrink-0"
              style={{ minHeight: 240, height: "30vh" }}
            >
              <div className="text-[color:var(--ink-on-dark-faint)] text-[13px] max-w-md">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--orange)] mb-2">
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
            <div className="border-t border-[color:var(--rule)] px-5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--orange)] flex-shrink-0">
              {bearingWarning}
            </div>
          )}

          {/* Panels: road properties (left, ~60%) + work zone & corridor
              (right, ~40%) on wider screens; stacked below ~lg. */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-0 border-t border-[color:var(--rule)] flex-shrink-0">
            <RoadPropertiesPanel
              classify={classify}
              overrides={overrides}
              setOverrides={setOverrides}
              scenarioKind={initial.scenarioKind}
            />

            <div className="border-l-0 lg:border-l border-t lg:border-t-0 border-[color:var(--rule)]">
              <WorkZonePanel
                workZoneInput={workZoneInput}
                workZoneError={workZoneError}
                onWorkZoneChange={onWorkZoneChange}
                bearingInput={bearingInput}
                bearingError={bearingError}
                onBearingChange={onBearingChange}
                bearingCandidates={bearingCandidates}
                selectedCandidateIdx={selectedCandidateIdx}
                showCandidatePicker={showCandidatePicker}
                onApplyCandidate={applyCandidate}
                onUseDetectedBearing={onUseDetectedBearing}
                onFlipDirection={onFlipDirection}
                hasPin={hasPin}
              />
              <CorridorPreviewPanel corridor={corridor} hasPin={hasPin} />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-[color:var(--rule)] px-5 py-3 flex-shrink-0">
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
            className="px-5 py-2 font-sans text-[13px] bg-[color:var(--orange)] text-[color:var(--canvas)] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
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
          <span
            className="inline-block w-3 h-1.5"
            style={{ background: ZONE_COLOR[r.zone] }}
          />
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
}: {
  classify: ClassifyStatus;
  overrides: RoadFieldOverrides;
  setOverrides: (next: RoadFieldOverrides) => void;
  scenarioKind: ScenarioKind;
}) {
  return (
    <div>
      <div className="px-5 py-2 border-b border-[color:var(--rule)] bg-[color:var(--canvas)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
        Road properties
      </div>

      <div className="px-5 py-1">
        {classify.state === "idle" && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-3">
            Drop a pin on the map to auto-detect road properties.
          </div>
        )}
        {classify.state === "resolving" && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-3 flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full border-[1.5px] border-[color:var(--cyan)]/40 border-t-[color:var(--cyan)] animate-spin" />
            Classifying road…
          </div>
        )}
        {classify.state === "awaiting_pick" && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--orange)] py-3">
            Multiple roads detected — pick a direction above to load road
            properties.
          </div>
        )}
        {classify.state === "error" && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--orange)] py-3">
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
          <span className="font-mono text-[10px] tracking-[0.04em] leading-snug text-[color:var(--orange)]">
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
            className="flex-shrink-0 border border-[color:var(--orange)] bg-transparent text-[color:var(--orange)] font-mono text-[10px] uppercase tracking-[0.08em] px-2.5 py-1 hover:bg-[color:var(--orange)] hover:text-[color:var(--canvas)] transition-colors"
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
  const confTone =
    field.confidence === "low"
      ? "text-[color:var(--orange)]"
      : "text-[color:var(--ink-on-dark-faint)]";
  return (
    <div className="grid grid-cols-[1fr_150px] gap-3 items-center py-2 border-b border-[color:var(--rule)]/40 last:border-b-0 min-h-[52px]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-white font-medium leading-none">
            {label}
          </span>
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${confDotClass(field.confidence)}`}
            title={`${field.confidence} confidence`}
          />
          {modified && (
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[color:var(--orange)] leading-none">
              modified
            </span>
          )}
        </div>
        <div
          className={`mt-1 font-mono text-[10px] uppercase tracking-[0.06em] truncate leading-tight ${confTone}`}
          title={field.rawData ?? undefined}
        >
          {field.source} · {field.confidence} confidence
        </div>
        {note && (
          <div className="mt-1 font-mono text-[10px] tracking-[0.04em] leading-snug text-[color:var(--orange)]">
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
              ? "bg-[color:var(--cyan)] text-[color:var(--canvas)]"
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
              ? "bg-[color:var(--cyan)] text-[color:var(--canvas)]"
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
  showCandidatePicker,
  onApplyCandidate,
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
  showCandidatePicker: boolean;
  onApplyCandidate: (idx: number) => void;
  onUseDetectedBearing: () => void;
  onFlipDirection: () => void;
  hasPin: boolean;
}) {
  const ambiguous = bearingCandidates.length > 1;
  const selectedCandidate =
    selectedCandidateIdx !== null
      ? (bearingCandidates[selectedCandidateIdx] ?? null)
      : null;
  // Disable "Use Detected" only when we have nothing to apply.  Multi-
  // candidate case keeps it enabled — clicking re-opens the picker.
  const useDetectedDisabled = bearingCandidates.length === 0;
  const useDetectedTitle =
    bearingCandidates.length === 0
      ? "No bearing detected at this pin"
      : ambiguous
        ? "Multiple roads detected — pick a direction"
        : `Use ${normaliseBearing(bearingCandidates[0].bearing)}° detected from OSM`;
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
                <span className="text-[#EB5757]">{workZoneError}</span>
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
                <span className="text-[#EB5757]">{bearingError}</span>
              ) : ambiguous && selectedCandidate === null ? (
                <span className="text-[color:var(--orange)]">
                  Multiple roads detected — pick a direction below
                </span>
              ) : selectedCandidate ? (
                <CandidateCaption
                  candidate={selectedCandidate}
                  multi={ambiguous}
                />
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
            className="flex-1 border border-[color:var(--cyan)] bg-transparent text-[color:var(--cyan)] font-mono text-[10px] uppercase tracking-[0.08em] py-1.5 hover:bg-[color:var(--cyan)] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {ambiguous ? "Pick Road" : "Use Detected"}
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

        {ambiguous && showCandidatePicker && (
          <CandidatePicker
            candidates={bearingCandidates}
            selectedIdx={selectedCandidateIdx}
            onPick={onApplyCandidate}
          />
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
      {multi && (
        <span className="opacity-70"> · tap Pick Road to change</span>
      )}
    </>
  );
}

// Inline picker shown when /api/road-bearing returns multiple
// candidates within snap range (the divided-highway case).  Each
// candidate is a button: clicking sets the bearing field, the arrow,
// AND the road-property panel (via classifyFromCandidate in the parent
// applyCandidate handler).
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
    <div className="border-t border-[color:var(--rule)]/40 pt-2 pb-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] mb-1.5">
        Select road:
      </div>
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
                  ? "border-[color:var(--cyan)] bg-[color:var(--cyan)]/15 text-white"
                  : "border-[color:var(--rule)] text-[color:var(--ink-on-dark)] hover:border-[color:var(--cyan)] hover:text-white"
              }`}
              title={`${c.snap_distance_m.toFixed(0)} m from pin · way ${c.way_id}`}
            >
              <span className="text-white">
                {lbl.primary} {lbl.direction.toLowerCase()}
              </span>
              <span className="opacity-70">
                {" "}
                ({lbl.sub.toLowerCase()}, {brg}°)
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- CorridorPreviewPanel -------------------------------------------------

function CorridorPreviewPanel({
  corridor,
  hasPin,
}: {
  corridor: CorridorPolyline | null;
  hasPin: boolean;
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
        {hasPin && !corridor && (
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-1">
            Enter a work-zone length to compute the corridor.
          </div>
        )}
        {corridor && <ExtentRows corridor={corridor} />}
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
            <span
              className="inline-block w-3 h-1.5 flex-shrink-0"
              style={{ background: ZONE_COLOR[d.zone] }}
            />
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
