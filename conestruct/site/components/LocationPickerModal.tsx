"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as MapboxGL from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type MapboxNamespace = typeof MapboxGL;

// Initial values supplied by the parent form. Treat (0, 0) as
// "no pin placed yet" — common case when the user opens the picker
// before having any coords.
export interface LocationPickerInitial {
  address?: string;
  lat?: number;
  lng?: number;
  bearingDeg?: number;
}

export interface LocationPickerResult {
  address: string;
  lat: number;
  lng: number;
  bearingDeg?: number;
}

interface Props {
  open: boolean;
  initial: LocationPickerInitial;
  onCancel: () => void;
  onSave: (result: LocationPickerResult) => void;
}

type MapStyle = "satellite" | "streets";

const MAPBOX_STYLES: Record<MapStyle, string> = {
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  streets: "mapbox://styles/mapbox/streets-v12",
};

const DEFAULT_CENTER: [number, number] = [-105.5, 39.0]; // Colorado
const DEFAULT_ZOOM = 6;
const PIN_ZOOM = 16;
const PIN_COLOR = "#E8710A";

interface BearingResponse {
  bearing: number | null;
  way_id: string | null;
  highway_class: string | null;
  snapped_lat: number | null;
  snapped_lng: number | null;
}

function isValidLat(n: number): boolean {
  return Number.isFinite(n) && n >= -90 && n <= 90;
}
function isValidLng(n: number): boolean {
  return Number.isFinite(n) && n >= -180 && n <= 180;
}
function isValidBearing(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 360;
}

function fmt4(n: number): string {
  return (Math.round(n * 10000) / 10000).toFixed(4);
}

// Build the marker DOM: a circle "pin" with an arrow extending from its
// center in the direction of travel. Updating ``bearingDeg`` rotates the
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

  const line = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "line",
  );
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

export function LocationPickerModal({
  open,
  initial,
  onCancel,
  onSave,
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

  const [address, setAddress] = useState(initial.address ?? "");
  const [hasPin, setHasPin] = useState(initialHasPin);
  const [lat, setLat] = useState(initialHasPin ? initial.lat! : 0);
  const [lng, setLng] = useState(initialHasPin ? initial.lng! : 0);
  const [bearing, setBearing] = useState(initial.bearingDeg ?? 0);

  const [latInput, setLatInput] = useState(initialHasPin ? fmt4(initial.lat!) : "");
  const [lngInput, setLngInput] = useState(initialHasPin ? fmt4(initial.lng!) : "");
  const [bearingInput, setBearingInput] = useState(
    initial.bearingDeg !== undefined ? String(Math.round(initial.bearingDeg)) : "",
  );
  const [latError, setLatError] = useState<string | null>(null);
  const [lngError, setLngError] = useState<string | null>(null);
  const [bearingError, setBearingError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState(initial.address ?? "");
  const [searchStatus, setSearchStatus] = useState<
    | { state: "idle" }
    | { state: "resolving" }
    | { state: "error"; message: string }
  >({ state: "idle" });

  const [bearingWarning, setBearingWarning] = useState<string | null>(null);
  const [style, setStyle] = useState<MapStyle>("satellite");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxGL.Map | null>(null);
  const markerRef = useRef<MapboxGL.Marker | null>(null);
  const setMarkerBearingRef = useRef<((deg: number) => void) | null>(null);
  const mapboxRef = useRef<MapboxNamespace | null>(null);
  // Guards to avoid feedback loops between marker drag and coord state.
  const suppressFlyToRef = useRef(false);
  const suppressDragHandlerRef = useRef(false);
  // Each bearing-detect call gets a token; only the latest call's
  // result is allowed to mutate state, so a fast drag doesn't get a
  // stale snap from an earlier request.
  const detectTokenRef = useRef(0);

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

  // Initialize Mapbox GL once the modal opens. Dynamic-import keeps it
  // out of any SSR bundle since mapbox-gl touches ``window`` at module
  // scope.
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
      // mapbox-gl is shipped as a CommonJS module: ESM consumers receive
      // the namespace under ``.default`` (with a fallback for bundlers
      // that interop differently).
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

      // Click on map to drop/move the pin (when no pin yet, or to relocate).
      map.on("click", (e: MapboxGL.MapMouseEvent) => {
        const { lat: clat, lng: clng } = e.lngLat;
        applyPinPosition(clat, clng, { detect: true, fly: false });
      });

      // Mapbox caches the canvas size from ``new Map()`` time. When the
      // modal mounts inside a flex column, the container often hasn't
      // reached its final height by then — and a single ResizeObserver
      // can miss the layout settle if it happens between async ticks.
      // Belt-and-suspenders: observe ongoing resizes, AND kick resize()
      // multiple times during the first ~600ms, AND on the map's own
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

      if (initialHasPin) {
        ensureMarker(initial.lat!, initial.lng!, initial.bearingDeg ?? 0);
      } else {
        // No prefilled pin, but the parent may have an address from the
        // sidebar input. Auto-geocode so the map opens at that location
        // instead of the generic Colorado view — the user shouldn't have
        // to click "Search" again for an address they already entered.
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
              applyPinPosition(j.lat, j.lng, { detect: true, fly: true });
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
              setSearchStatus({ state: "error", message: (err as Error).message });
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
    // We intentionally only re-init on open / token availability; style
    // changes are handled below via setStyle on the existing map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tokenAvailable, token]);

  // Switch basemap style on the existing map without re-initializing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(MAPBOX_STYLES[style]);
  }, [style]);

  // ---- Marker management --------------------------------------------------

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
    // ensureMarker and applyPinPosition reference each other; including
    // applyPinPosition here would force a fresh marker on every render
    // and tear down the user's drag interaction. Both read live values
    // from refs, so empty deps are intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Single source of truth for "the pin is now at these coords": updates
  // state, repositions the marker, optionally pans the map, optionally
  // re-detects road bearing and snaps.
  const applyPinPosition = useCallback(
    (
      newLat: number,
      newLng: number,
      opts: { detect: boolean; fly: boolean },
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
        map.flyTo({
          center: [newLng, newLat],
          zoom: z < PIN_ZOOM ? PIN_ZOOM : z,
          essential: true,
        });
      }

      if (opts.detect) {
        void detectBearing(newLat, newLng);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bearing, ensureMarker],
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

  // ---- Bearing detection --------------------------------------------------

  const detectBearing = useCallback(
    async (qLat: number, qLng: number) => {
      const myToken = ++detectTokenRef.current;
      try {
        const r = await fetch("/api/road-bearing", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lat: qLat, lng: qLng }),
        });
        if (!r.ok) {
          if (detectTokenRef.current === myToken) {
            setBearingWarning(
              "Couldn't reach road-detection service. Enter bearing manually.",
            );
          }
          return;
        }
        const j = (await r.json()) as BearingResponse;
        if (detectTokenRef.current !== myToken) return;
        if (j.bearing === null) {
          setBearingWarning(
            "No road detected within 100 m. Verify the location or enter bearing manually.",
          );
          return;
        }
        setBearingWarning(null);
        const newBearing = Math.round(j.bearing);
        setBearing(newBearing);
        setBearingInput(String(newBearing));
        setBearingError(null);
        setMarkerBearingRef.current?.(newBearing);
        // Snap pin to the projected nearest point on the road centerline.
        if (j.snapped_lat !== null && j.snapped_lng !== null) {
          suppressDragHandlerRef.current = true;
          markerRef.current?.setLngLat([j.snapped_lng, j.snapped_lat]);
          setLat(j.snapped_lat);
          setLng(j.snapped_lng);
          setLatInput(fmt4(j.snapped_lat));
          setLngInput(fmt4(j.snapped_lng));
          // Release the guard on next tick.
          setTimeout(() => {
            suppressDragHandlerRef.current = false;
          }, 0);
        }
      } catch {
        if (detectTokenRef.current === myToken) {
          setBearingWarning(
            "Couldn't reach road-detection service. Enter bearing manually.",
          );
        }
      }
    },
    [],
  );

  // ---- Search bar / geocode -----------------------------------------------

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
        applyPinPosition(j.lat, j.lng, { detect: true, fly: true });
      } catch (err) {
        setSearchStatus({ state: "error", message: (err as Error).message });
      }
    },
    [searchQuery, applyPinPosition],
  );

  // ---- Field handlers -----------------------------------------------------

  const onLatChange = (raw: string) => {
    // If a comma-separated paste lands here, split into both fields.
    if (raw.includes(",")) {
      const [a, b] = raw.split(",").map((s) => s.trim());
      const la = parseFloat(a);
      const lo = parseFloat(b);
      if (Number.isFinite(la) && Number.isFinite(lo)) {
        setLatInput(fmt4(la));
        setLngInput(fmt4(lo));
        setLatError(isValidLat(la) ? null : "Latitude must be between -90 and 90");
        setLngError(isValidLng(lo) ? null : "Longitude must be between -180 and 180");
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
      return;
    }
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) {
      setBearingError("Invalid number");
      return;
    }
    if (!isValidBearing(n)) {
      setBearingError("Bearing must be between 0 and 360");
      return;
    }
    setBearingError(null);
    const rounded = Math.round(n);
    setBearing(rounded);
    setMarkerBearingRef.current?.(rounded);
  };

  const onFlipDirection = () => {
    const flipped = (bearing + 180) % 360;
    setBearing(flipped);
    setBearingInput(String(flipped));
    setBearingError(null);
    setMarkerBearingRef.current?.(flipped);
  };

  // ---- Save / cancel ------------------------------------------------------

  const canSave =
    hasPin &&
    isValidLat(lat) &&
    isValidLng(lng) &&
    !latError &&
    !lngError &&
    !bearingError;

  const onClickSave = () => {
    if (!canSave) return;
    onSave({
      address,
      lat,
      lng,
      bearingDeg: bearingInput.trim() === "" ? undefined : bearing,
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 md:p-6"
      onClick={onCancel}
    >
      <div
        className="border border-[color:var(--rule)] bg-[color:var(--canvas-tint)] flex flex-col w-full h-full md:w-[80vw] md:h-[80vh] md:max-w-[1200px] md:max-h-[800px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Pick work zone location"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[color:var(--rule)] px-5 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--orange)] mb-1">
              Location · Pick on Map
            </div>
            <h2 className="text-white text-[18px] font-semibold m-0">
              Pick Work Zone Location
            </h2>
            <p className="text-[13px] text-[color:var(--ink-on-dark-faint)] mt-1 m-0">
              Drop a pin at the work zone anchor and indicate direction of
              travel.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="text-[color:var(--ink-on-dark-faint)] hover:text-white text-[20px] leading-none px-2 py-1"
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
          className="flex gap-2 border-b border-[color:var(--rule)] px-5 py-3"
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
          <div className="px-5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#EB5757]">
            {searchStatus.message}
          </div>
        )}

        {/* Map area — mapbox attaches directly to the flex-1 div so the
            canvas tracks the parent's resolved height without a layered
            absolute child that can read 0 during the initial paint. */}
        {tokenAvailable ? (
          <div
            ref={containerRef}
            className="relative flex-1 bg-black/30"
            style={{ minHeight: 320 }}
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
          </div>
        ) : (
          <div
            className="relative flex-1 bg-black/30 flex items-center justify-center text-center px-6"
            style={{ minHeight: 320 }}
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

        {/* Controls */}
        <div className="flex items-center justify-between border-t border-[color:var(--rule)] px-5 py-3">
          <button
            type="button"
            onClick={onFlipDirection}
            disabled={!hasPin}
            className="border border-[color:var(--ink-on-dark-faint)] bg-transparent text-[color:var(--ink-on-dark)] font-mono text-[11px] uppercase tracking-[0.1em] px-4 py-2 hover:border-white hover:text-white transition-colors disabled:opacity-40"
          >
            ⟲ Flip Direction
          </button>
          {bearingWarning && (
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#E8710A] text-right ml-3">
              {bearingWarning}
            </div>
          )}
        </div>

        {/* Coordinate panel */}
        <div className="grid grid-cols-3 gap-3 border-t border-[color:var(--rule)] px-5 py-3">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] block mb-1">
              Latitude
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={latInput}
              onChange={(e) => onLatChange(e.target.value)}
              placeholder="38.8862"
              className="field-input w-full"
            />
            {latError && (
              <div className="mt-1 font-mono text-[10px] text-[#EB5757]">
                {latError}
              </div>
            )}
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] block mb-1">
              Longitude
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={lngInput}
              onChange={(e) => onLngChange(e.target.value)}
              placeholder="-104.8354"
              className="field-input w-full"
            />
            {lngError && (
              <div className="mt-1 font-mono text-[10px] text-[#EB5757]">
                {lngError}
              </div>
            )}
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] block mb-1">
              Bearing (° from N)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={bearingInput}
              onChange={(e) => onBearingChange(e.target.value)}
              placeholder="19"
              className="field-input w-full"
            />
            {bearingError && (
              <div className="mt-1 font-mono text-[10px] text-[#EB5757]">
                {bearingError}
              </div>
            )}
          </div>
        </div>
        <div className="px-5 pb-3 font-mono text-[10px] text-[color:var(--ink-on-dark-faint)]">
          Coordinates update as you move the pin. You can also type them
          directly.
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-[color:var(--rule)] px-5 py-3">
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
