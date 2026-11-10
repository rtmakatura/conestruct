"use client";

// #301 piece 1 — the aerial on the WHERE band: a read-only picture of the
// corridor, under the move ledger (ruling 189: "the Where band owns the
// aerial and the outcome").
//
// Authority: validation-artifacts/committed/issue-301-band-aerial/
// rulings.md — ruling 1 (scenario in, PNG out, drawn on the backend),
// ruling 3 (the picker's colours on all three surfaces; rule 110's palette
// is a recorded deviation), ruling 4 (before the kind: a legend line, not a
// dotted channel), ruling 5 (the legend under the image at every width).
//
// WHAT IT SHOWS, read off the backend's own geometry answer (the one
// WhereBand already asks for the side control — never a second read):
//   · side owed           the pin alone, no caption (#440 X22: the CONFIRM
//                         card's side question asks; #290's P16 caption left)
//   · side chosen, kind owed   the work segment; the legend says the
//                         approaches lay out after the kind (rule 112)
//   · both answered       the whole corridor; the five-row legend
//   · refused             the backend's reason, in words (Rule 10)
//   · waiting / failed    a sentence in the sized frame (P8), never a
//                         skeleton and never the previous picture
//   · the cross street    #440: while the CONFIRM card's cross-street
//                         question is on screen, the pin picture; armed, it
//                         takes one tap (the bar, the outline, the
//                         crosshair, "Use the big map instead"), and the
//                         tap's box and label sit at its own pixel while
//                         that same picture is shown (rulings 3-5, X3, X5)
//   · the tap's answer    #446: the bar, its outline and a ring at the tap
//                         say what the tap did: finding, found, failed, no
//                         street (ux-tap-feedback/rulings.md, rulings 1-5)
//
// Rule 3: nothing here computes a coordinate or a length.  The image is the
// backend's; the legend's swatches read ZONE_COLOR / ZONE_CHANNEL (the
// corridor's one palette source) and its words are ZONE_LABEL.  The frame's
// size is measured and sent, so the backend frames the corridor for exactly
// the box it is shown in — no crop, no horizontal scroll at 380.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Scenario } from "@/lib/scenarios";
import {
  boundWord,
  refusalReason,
  type GeometryFetch,
} from "@/lib/corridor-geometry";
import {
  ZOOM_IN_MAX,
  ZOOM_OUT_MAX,
  aerialStage,
  prefetchAerial,
  useCorridorAerial,
  type AerialStage,
} from "@/lib/corridor-aerial";
import { prefetchGeometry } from "@/lib/corridor-geometry";
import { ZONE_CHANNEL, ZONE_COLOR, type CorridorZone } from "@/lib/corridor-zones";
import { focusWasDropped, scrollAerialPartIn } from "@/lib/cross-street-reveal";
import { symClass } from "@/lib/design/symbols";
import { CROSS_FINDING, CROSS_NONE } from "./WhereQuestions";
import { MapboxAttribution, MapboxMarks } from "./MapboxMarks";

export { MAPBOX_ATTRIBUTION } from "./MapboxMarks";

// Upstream first — the motorist's order, the picker's and page 2's legend.
const LEGEND_ORDER: readonly CorridorZone[] = [
  "advance_warning",
  "transition",
  "buffer",
  "work_zone",
  "downstream",
];

/** #439 ruling 7: the key's plain labels.  `ZONE_LABEL` (the extent
 *  lines, the static preview) is unchanged. */
export const KEY_LABEL: Record<CorridorZone, string> = {
  advance_warning: "Warning signs",
  transition: "Taper",
  buffer: "Buffer",
  work_zone: "Work zone",
  downstream: "After the work",
};

export const AERIAL_WAIT = "Drawing the corridor…";
/** #491 (R145 self-ruled): Edit on map opens the picker at the pin; it
 *  draws the corridor only from its own read, and nothing but the pin
 *  before the side is confirmed, so the line promises only the pin. */
export const AERIAL_FAILED = "The map didn't load. Edit on map opens the big map at your pin.";
export const AERIAL_KIND_OWED = "Approaches lay out after you confirm the kind";
/** #440 ruling 3. */
export const AERIAL_TAP_BAR = "Tap the intersection nearest the work";
/** #446 ruling 4, verbatim. */
export const CROSS_FAILED_BAR = "The street lookup didn't answer. Tap again, or try once more.";
/** #440 X12: the armed picture says the keyboard's way in. */
export const AERIAL_ARMED_ALT =
  "Aerial at the pin. Tap the intersection nearest the work, or use the big map instead";
/** #440 ruling 4. */
export const AERIAL_BIG_MAP = "Use the big map instead";
/** #456 ruling 2, verbatim. */
export const AERIAL_HIDE = "Hide map";
export const AERIAL_SHOW = "Show map";
/** #460: the stand-in's alt; it is the picker's map, not the aerial. */
export const AERIAL_STAND_IN_ALT = "The map as you saved it. The aerial is being drawn";

const ALT: Record<AerialStage, string> = {
  pin: "Aerial at the pin. Nothing is laid out until the side is chosen",
  work: "Aerial: the work segment at the pin",
  laid_out: "Aerial: the laid-out corridor, with the work and its approaches",
};

// The frame's measured box, in whole CSS px.  Before layout (and in a DOM
// without layout) the frame's rule-104 size stands in.
const FALLBACK = { width: 600, height: 300 };

export function useFrameSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = Math.floor(el.clientWidth);
      const h = Math.floor(el.clientHeight);
      // #456: a hidden map (Hide map) is not laid out; it keeps the size it
      // was drawn at, so showing it again asks for nothing new.
      if (w <= 0 && h <= 0 && el.getClientRects().length === 0) {
        setSize((prev) => prev ?? FALLBACK);
        return;
      }
      const next = w > 0 && h > 0 ? { width: Math.min(w, 1280), height: Math.min(h, 1280) } : FALLBACK;
      setSize((prev) => (prev && prev.width === next.width && prev.height === next.height ? prev : next));
    };
    measure();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** #490: the scale that makes the picture (the canvas, drawn at its own
 *  layout size) cover the frame when the frame is taller or wider than it:
 *  set on the frame as `--aerial-cover`, which only the two-column CSS reads.
 *  A transform, so the canvas's layout size, and with it the picture asked
 *  for, never changes; taps, the ring and the mark scale with it (the tap
 *  reads the picture's on-screen box). */
export function coverScale(frame: { width: number; height: number }, canvas: { width: number; height: number }): number {
  if (canvas.width <= 0 || canvas.height <= 0) return 1;
  return Math.max(1, frame.width / canvas.width, frame.height / canvas.height);
}

function useCoverScale(
  frameBox: React.RefObject<HTMLDivElement | null>,
  canvas: React.RefObject<HTMLDivElement | null>,
) {
  useLayoutEffect(() => {
    const f = frameBox.current;
    const c = canvas.current;
    if (!f || !c) return;
    const set = () => {
      const s = coverScale({ width: f.clientWidth, height: f.clientHeight }, { width: c.clientWidth, height: c.clientHeight });
      const v = String(+s.toFixed(4));
      if (f.style.getPropertyValue("--aerial-cover") !== v) f.style.setProperty("--aerial-cover", v);
    };
    set();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(set);
    ro.observe(f);
    ro.observe(c);
    return () => ro.disconnect();
  }, [frameBox, canvas]);
}

/** #456 M9: the picture on screen and what its key and line say. */
interface Shown {
  base: string | null;
  /** #460: the pin the picture was drawn at. */
  pin: { lat: number; lng: number };
  src: string;
  stage: AerialStage;
  approachWords: string | null;
  extended: boolean;
}

/** #440 X5: the tap's pixel in the picture it was made on. */
export interface AerialMark {
  x: number;
  y: number;
  name: string;
  frameKey: string;
}

export interface AerialTap {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  frameKey: string;
}

/** #446: what the bar says while the cross-street question is on screen. */
export type AerialBar =
  | { kind: "armed" }
  | { kind: "finding" }
  | { kind: "found"; name: string }
  | { kind: "failed"; onRetry: () => void }
  | { kind: "none" };

/** #446 T7: the tap's ring, on the picture tapped (X5). */
export interface AerialRing {
  x: number;
  y: number;
  frameKey: string;
  look: "solid" | "dashed";
}

export interface BandAerialProps {
  scenario: Scenario;
  geometry: GeometryFetch;
  kindConfirmed: boolean;
  /** #439 ruling 1: "Edit on map" on the aerial's top-right corner. */
  onEditMap?: () => void;
  locked?: boolean;
  /** #440 X3: the cross-street question is on screen — the pin picture,
   *  the one frame whose centre and zoom the backend fixes. */
  pinFrame?: boolean;
  /** #440 ruling 3: the picture takes one tap. */
  armed?: boolean;
  onTap?: (tap: AerialTap) => void;
  /** #440 ruling 4: the picker, armed for the cross street. */
  onBigMap?: () => void;
  /** #440 X5: the box and label, shown only on the picture tapped. */
  mark?: AerialMark | null;
  /** #446: the bar's state; without one the armed picture's bar. */
  bar?: AerialBar | null;
  ring?: AerialRing | null;
  /** #446 T25: counts the answers a hidden bar comes back for. */
  missCount?: number;
  /** #456 ruling 3, load ahead: the scenarios the open question's answers
   *  would write.  Each one's geometry is read and its one picture asked
   *  for, unless remembered.  Empty for a tap question. */
  ahead?: readonly Scenario[];
  /** #456 ruling 2: the strip's Hide map / Show map (the band owns the
   *  choice; the layout shows them only in the narrow strip). */
  hidden?: boolean;
  onHide?: () => void;
  onShow?: () => void;
  /** #460 (Ryan, 2026-11-08): the picker's last picture at this pin.
   *  Before any aerial is on screen it stands in for the empty box, with
   *  the wait line in its corner (it is not the aerial, so it never takes
   *  a tap, a zoom or the key).  Null = the wait sentence, as before. */
  pickerPicture?: string | null;
}

/** #440 ruling 3: the bar's crosshair (the design canvas's own path).
 *  #446 ruling 1 / T1: the finding arc, `TapA1`'s path, still (R10). */
function BarIcon({ finding = false }: { finding?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      focusable="false"
    >
      {finding ? (
        <path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5" />
      ) : (
        <>
          <path d="M8 1v4M8 11v4M1 8h4M11 8h4" />
          <circle cx="8" cy="8" r="2" />
        </>
      )}
    </svg>
  );
}

export function BandAerial({
  scenario,
  geometry,
  kindConfirmed,
  onEditMap,
  locked = false,
  pinFrame = false,
  armed = false,
  onTap,
  onBigMap,
  mark = null,
  bar = null,
  ring = null,
  missCount = 0,
  ahead = [],
  hidden = false,
  onHide,
  onShow,
  pickerPicture = null,
}: BandAerialProps) {
  // #456 M4: measured on the picture's own box (the canvas), which keeps
  // the full height while the narrow strip clips the frame to 150 px.
  const frameRef = useRef<HTMLDivElement | null>(null);
  const size = useFrameSize(frameRef);
  const frameBoxRef = useRef<HTMLDivElement | null>(null);
  useCoverScale(frameBoxRef, frameRef);
  // #456: focus follows the toggle to its other button.
  const hideRef = useRef<HTMLButtonElement | null>(null);
  const showRef = useRef<HTMLButtonElement | null>(null);
  const toggled = useRef(false);
  useEffect(() => {
    if (!toggled.current) return;
    toggled.current = false;
    (hidden ? showRef : hideRef).current?.focus({ preventScroll: true });
  }, [hidden]);
  // #456 ruling 3, load ahead (M13): each answer's geometry, then its one
  // picture at this frame's size, unless remembered or on its way.  The
  // request is built exactly as the hook below builds it.
  const aheadKey = size && ahead.length > 0 ? JSON.stringify(ahead) : null;
  useEffect(() => {
    if (!size || aheadKey === null) return;
    let live = true;
    for (const s of JSON.parse(aheadKey) as Scenario[]) {
      void prefetchGeometry(s).then((r) => {
        if (!live || r.state !== "ready") return;
        const st = aerialStage(r.geometry, kindConfirmed);
        if (st) prefetchAerial({ scenario: s, stage: st, width: size.width, height: size.height });
      });
    }
    return () => {
      live = false;
    };
  }, [aheadKey, size, kindConfirmed]);
  // #446 T11: a retry unmounts its own button; if it fails again, focus
  // comes back to the new one.  T22: if it answers "no street" there's no
  // new one, so focus goes to the bar's big-map button, the keyboard's way in.
  const retryRef = useRef<HTMLButtonElement | null>(null);
  const bigMapRef = useRef<HTMLButtonElement | null>(null);
  const retryHadFocus = useRef(false);
  const barKind = (bar?.kind ?? (armed ? "armed" : null)) as AerialBar["kind"] | null;
  useEffect(() => {
    if (retryHadFocus.current) {
      // T26: only if focus is still lost; a place the person moved it stays.
      if (focusWasDropped()) {
        if (barKind === "failed") retryRef.current?.focus({ preventScroll: true });
        if (barKind === "none") bigMapRef.current?.focus({ preventScroll: true });
      }
    }
    if (barKind !== "finding") retryHadFocus.current = false;
  }, [barKind]);
  // #446 T25 (Ryan, 2026-11-06, amending ruling 4): a failed or "no street"
  // answer whose bar is hidden under the nav scrolls just enough to show the
  // bar, once per answer; a bar already all there moves nothing.
  const barRef = useRef<HTMLDivElement | null>(null);
  // Seen whatever the bar says, so an answer that landed with this question
  // off screen doesn't scroll when the person comes back to it.
  const missSeen = useRef(missCount);
  useEffect(() => {
    if (missCount === missSeen.current) return;
    missSeen.current = missCount;
    if ((barKind === "failed" || barKind === "none") && barRef.current) scrollAerialPartIn(barRef.current);
  }, [missCount, barKind]);
  // Only an answer for THIS scenario: while the geometry re-reads (a pin
  // moved, a side changed) the hook still holds the previous answer, and a
  // picture of the previous answer is a stale corridor (Rule 10).
  const g = geometry.state === "ready" ? geometry.geometry : null;
  const natural = aerialStage(g, kindConfirmed);
  // #440 X3: the cross-street question asks for the pin picture.  It is
  // the pin, the frame and the step only, so it does not wait on the
  // geometry read (the mark's own write re-reads it; P1: the picture and
  // the box stay put meanwhile).
  const stage: AerialStage | null = pinFrame ? "pin" : natural;
  // Zoom (Ryan's hand-check ruling, 2026-09-26).  The step belongs to ONE
  // picture — this scenario, stage and frame — so a new picture always
  // opens on the whole corridor, with no effect to reset it.  #440 X5
  // (Rule 5, stated): the pin picture is the pin, the frame and the step
  // and nothing else of the scenario, so on that stage the key is those;
  // the mark's own write keeps the picture (and the box on it).
  const base =
    stage && size
      ? stage === "pin"
        ? JSON.stringify({ lat: scenario.meta.lat, lng: scenario.meta.lng, stage, size })
        : JSON.stringify({ scenario, stage, size })
      : null;
  const [zoomAt, setZoomAt] = useState<{ base: string | null; step: number }>({
    base: null,
    step: 0,
  });
  const step = zoomAt.base === base ? zoomAt.step : 0;
  const aerial = useCorridorAerial(
    stage && size
      ? {
          scenario,
          stage,
          width: size.width,
          height: size.height,
          ...(step !== 0 ? { zoom: step } : {}),
        }
      : null,
  );
  const approaches = g?.approaches ?? [];
  // #456 ruling 3 (M9): the picture on screen stays until the next one is
  // ready, then swaps in one step: never a blank box.  P16's zoom hold (the
  // same corridor) shows no line; any other held picture says it is being
  // redrawn (Rule 10: it is not presented as the current one).  The key and
  // the line under it are the held picture's own, so they always match it.
  // A failure or a refusal is never held over: its sentence replaces it.
  const held = useRef<Shown | null>(null);
  if (aerial.state === "ready" && stage !== null) {
    held.current = {
      base,
      pin: { lat: scenario.meta.lat, lng: scenario.meta.lng },
      src: aerial.src,
      stage,
      approachWords:
        stage === "laid_out" && approaches.length === 2
          ? `Two approaches: ${boundWord(approaches[0].travel_bearing_deg)} (the work's side) and ${boundWord(approaches[1].travel_bearing_deg)}`
          : null,
      extended:
        stage === "laid_out"
          ? approaches.some((a) => a.zones.some((z) => z.parts.some((p) => p.extended))) ||
            (g?.work?.parts ?? []).some((p) => p.extended)
          : (g?.work?.parts ?? []).some((p) => p.extended),
    };
  }

  if (geometry.state === "ready" && g?.status === "no_pin") return null;

  const refusal = refusalReason(g);
  let note: string | null = null;
  if (refusal) note = `Can't lay the corridor out here: ${refusal}`;
  else if (geometry.state === "error") note = AERIAL_FAILED;
  else if (aerial.state === "refused") {
    note =
      aerial.status === "corridor_unbuildable" && aerial.message
        ? `Can't lay the corridor out here: ${aerial.message.replace(/^\w+Error:\s*/, "")}`
        : AERIAL_FAILED;
  } else if (aerial.state === "error") note = AERIAL_FAILED;
  const current = aerial.state === "ready" && stage !== null;
  const kept: Shown | null = current || note === null ? held.current : null;
  // #460: the picker's picture stands in, with the wait line in the corner,
  // before any picture and (Ryan, 2026-11-08, amendment) in place of a held
  // picture drawn at another pin: that one is a different place.  A held
  // picture at this same pin stays (#456 M9).
  const keptElsewhere =
    kept !== null && !current && (kept.pin.lat !== scenario.meta.lat || kept.pin.lng !== scenario.meta.lng);
  const standIn = !current && note === null && (kept === null || keptElsewhere) ? pickerPicture : null;
  const display: Shown | null = standIn !== null ? null : kept;
  const holding = !current && display !== null;
  // The wait sentence: centred in the box only before any picture; over a
  // held picture of another corridor, or the stand-in, a small line in its
  // corner.
  const heldLine = (holding && display !== null && display.base !== base) || standIn !== null;
  if (!current && note === null && display === null && standIn === null) note = AERIAL_WAIT;
  // #440 ruling 7: the not-marked line left the aerial (#317's note); the
  // CONFIRM card's cross-street question asks for the crossing.  #440 R145
  // X22 (Ryan, 2026-11-04): the side caption left it the same way; the
  // CONFIRM card's side question asks for the side.

  // `shown`: a picture is on screen, this state's or a held one (#456 repair
  // 2: the zoom buttons and #446's bar and live region stay through a held
  // load, as #301's zoom hold kept them, so focus is never dropped).
  // `current`: this state's own picture; taps, the ring and the box wait for
  // it, so a tap is never read off a held picture.
  const shown = display !== null;
  const src = display?.src ?? null;
  const frameKey = base !== null ? JSON.stringify({ base, step }) : null;
  const tapping = armed && current && onTap !== undefined && size !== null && frameKey !== null;
  const markShown = mark !== null && current && frameKey !== null && mark.frameKey === frameKey;
  const ringShown = ring !== null && current && frameKey !== null && ring.frameKey === frameKey;
  // #446: one bar element through every state, so its live region is there
  // before its words change (ruling 1).  #465: while a held picture loads
  // the frame takes no tap, so the armed line gives way to the wait (P8,
  // P3); it comes back when this state's own picture lands.
  const barSet: AerialBar | null = shown
    ? (bar ?? (armed && onTap !== undefined ? { kind: "armed" } : null))
    : null;
  const barNow: AerialBar | { kind: "waiting" } | null =
    barSet?.kind === "armed" && !tapping ? { kind: "waiting" } : barSet;
  const tap = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!tapping || !size || frameKey === null || !onTap) return;
    const r = e.currentTarget.getBoundingClientRect();
    // The pointer relative to the picture, in the frame's CSS px (the
    // size the backend drew it at).
    const sx = r.width > 0 ? size.width / r.width : 1;
    const sy = r.height > 0 ? size.height / r.height : 1;
    const x = Math.min(size.width, Math.max(0, (e.clientX - r.left) * sx));
    const y = Math.min(size.height, Math.max(0, (e.clientY - r.top) * sy));
    onTap({ x, y, width: size.width, height: size.height, zoom: step, frameKey });
  };
  const zoomTo = (next: number) => {
    if (next < -ZOOM_OUT_MAX || next > ZOOM_IN_MAX) return;
    setZoomAt({ base, step: next });
  };
  const keyStage = display?.stage ?? null;
  const extended = display?.extended ?? false;

  return (
    <div className="a-aerial" data-testid="band-aerial" data-read data-stage={stage ?? "none"}>
      {onShow && (
        // #456 ruling 2: the strip, hidden, is this one row (the layout
        // shows it only in the narrow strip).
        <div className="a-aerial-showrow" hidden={!hidden}>
          <button
            ref={showRef}
            type="button"
            className="a-aerial-toggle"
            data-read=""
            onClick={() => {
              toggled.current = true;
              onShow();
            }}
            data-testid="band-aerial-show"
          >
            {AERIAL_SHOW}
          </button>
        </div>
      )}
      <div
        ref={frameBoxRef}
        className={`a-aerial-frame${tapping ? " is-armed" : ""}${barNow ? " has-bar" : ""}`}
        data-bar={barNow?.kind}
        data-held={holding || standIn !== null || undefined}
        aria-busy={holding || standIn !== null || undefined}
        data-testid="band-aerial-frame"
      >
        {barNow && (
          <div ref={barRef} className="a-aerial-bar" data-testid="band-aerial-bar" role="status">
            {barNow.kind === "armed" && (
              <>
                <BarIcon />
                {AERIAL_TAP_BAR}
              </>
            )}
            {barNow.kind === "waiting" && (
              <>
                <BarIcon finding />
                {AERIAL_WAIT}
              </>
            )}
            {barNow.kind === "finding" && (
              <>
                <BarIcon finding />
                {CROSS_FINDING}
              </>
            )}
            {barNow.kind === "found" && (
              <>
                <span className={`a-aerial-bar-glyph ${symClass("✓")}`}>✓</span>{" "}
                <span className="a-aerial-bar-text">Near {barNow.name}</span>
              </>
            )}
            {(barNow.kind === "failed" || barNow.kind === "none") && (
              <>
                <span className={`a-aerial-bar-glyph ${symClass("⚠")}`}>⚠</span>{" "}
                <span className="a-aerial-bar-text">
                  {barNow.kind === "failed" ? CROSS_FAILED_BAR : CROSS_NONE}
                </span>
              </>
            )}
            {barNow.kind === "failed" && (
              <button
                ref={retryRef}
                type="button"
                className="a-aerial-bar-btn"
                data-write=""
                aria-disabled={locked || undefined}
                onClick={() => {
                  if (locked) return;
                  retryHadFocus.current = true;
                  barNow.onRetry();
                }}
                data-testid="band-aerial-retry"
              >
                Try again
              </button>
            )}
          </div>
        )}
        {onEditMap && (
          <button
            type="button"
            className="a-pri a-aerial-edit"
            data-write=""
            aria-disabled={locked || undefined}
            onClick={onEditMap}
            data-testid="where-open-picker"
          >
            Edit on map
          </button>
        )}
        <div ref={frameRef} className="a-aerial-canvas">
        {standIn !== null && (
          // #460: a data URL the picker read off its own canvas.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={standIn}
            alt={AERIAL_STAND_IN_ALT}
            className="a-aerial-standin"
            data-testid="band-aerial-standin"
          />
        )}
        {src !== null && display !== null && (
          // The source is an object URL of an image the backend drew at this
          // frame's exact size — there is nothing for next/image to
          // optimise or resize, and it cannot load a blob: URL through its
          // loader.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={tapping ? AERIAL_ARMED_ALT : ALT[display.stage]}
            data-testid="band-aerial-img"
            onClick={tapping ? tap : undefined}
          />
        )}
        {ringShown && ring && (
          // #446 ruling 1 / ruling 4: at the tap's own pixel.
          <span
            className="a-aerial-ring"
            data-testid="band-aerial-ring"
            data-look={ring.look}
            aria-hidden="true"
            style={{ left: ring.x - 16, top: ring.y - 16 }}
          />
        )}
        {markShown && size && mark && (
          // X5: at the tap's own pixel; the label on the side with room.
          <>
            <span
              className="a-aerial-mark"
              data-testid="band-aerial-mark"
              aria-hidden="true"
              style={{ left: mark.x - 14, top: mark.y - 14 }}
            />
            <span
              className="a-aerial-mark-label tr-note"
              data-testid="band-aerial-mark-label"
              style={
                mark.x > size.width / 2
                  ? { right: size.width - mark.x + 20, top: mark.y - 14 }
                  : { left: mark.x + 20, top: mark.y - 14 }
              }
            >
              {mark.name}
            </span>
          </>
        )}
        </div>
        {/* #490 repair 1: the frame's foot, one bottom-anchored column: the
            foot's controls and lines over Mapbox's marks (C11), stacked by
            the layout at any text size, so none of them covers another. */}
        <div className="a-aerial-foot">
          {((barNow && onBigMap) || onHide || (heldLine && barNow?.kind !== "waiting")) && (
            <div className="a-aerial-foot-row">
              {heldLine && barNow?.kind !== "waiting" && (
                <div className="a-aerial-held tr-prov" data-testid="band-aerial-held" role="status">
                  {AERIAL_WAIT}
                </div>
              )}
              {barNow && onBigMap && (
                <button
                  ref={bigMapRef}
                  type="button"
                  className="a-aerial-bigmap"
                  data-write=""
                  aria-disabled={locked || undefined}
                  onClick={() => {
                    if (!locked) onBigMap();
                  }}
                  data-testid="band-aerial-big-map"
                >
                  {AERIAL_BIG_MAP}
                </button>
              )}
              {onHide && (
                <button
                  ref={hideRef}
                  type="button"
                  className="a-aerial-toggle a-aerial-hide"
                  data-read=""
                  onClick={() => {
                    toggled.current = true;
                    onHide();
                  }}
                  data-testid="band-aerial-hide"
                >
                  {AERIAL_HIDE}
                </button>
              )}
            </div>
          )}
          {(src !== null || standIn !== null) && (
            // #490 C11: the picture is asked for without Mapbox's logo and
            // attribution and may be scaled to cover the frame, so both are
            // drawn here, on the frame, outside the scaled canvas: always
            // whole.
            <MapboxMarks testid="band-aerial" linked />
          )}
        </div>
        {shown && (
          // The zoom controls: reads (data-read), never locked by the
          // write lock.  At a bound a button is aria-disabled — still
          // focusable, and it does nothing.
          <div className="a-aerial-zoom" data-testid="band-aerial-zoom" data-step={step}>
            <button
              type="button"
              className="a-aerial-zbtn"
              data-read
              aria-label="Zoom in"
              aria-disabled={step >= ZOOM_IN_MAX || undefined}
              onClick={() => zoomTo(step + 1)}
            >
              +
            </button>
            <button
              type="button"
              className="a-aerial-zbtn"
              data-read
              aria-label="Zoom out"
              aria-disabled={step <= -ZOOM_OUT_MAX || undefined}
              onClick={() => zoomTo(step - 1)}
            >
              −
            </button>
            {step !== 0 && (
              <button
                type="button"
                className="a-aerial-zbtn a-aerial-reset tr-prov"
                data-read
                aria-label="Reset to the whole corridor"
                onClick={() => zoomTo(0)}
              >
                Reset
              </button>
            )}
          </div>
        )}
        {note && (
          <div
            className="a-aerial-note tr-note"
            data-testid="band-aerial-note"
            role={note === AERIAL_WAIT ? undefined : "note"}
          >
            {note}
          </div>
        )}
      </div>
      {(src !== null || standIn !== null) && (
        // #490 repair 1 (Amendment 4): at 519 px and under the frame is too
        // small for the attribution line beside its controls at large text
        // sizes, so the line is drawn directly under it instead (Mapbox's
        // static-map rule: "a textual description near the image"); the
        // logo stays on the frame.  Shown there only (globals.css).
        <MapboxAttribution testid="band-aerial-attribution-under" linked className="mbx-under" />
      )}
      {src !== null && (keyStage === "work" || keyStage === "laid_out") && (
        // #439 ruling 7: the key on the aerial's top-left corner (under it
        // below 520 px, a 2-column grid); one row per channel, the same
        // swatches and hexes (ZONE_COLOR, the ruled overlay pair).
        <div className="a-aerial-legend" data-testid="band-aerial-legend">
          {(keyStage === "laid_out" ? LEGEND_ORDER : (["work_zone"] as const)).map((zone) => (
            <div key={zone} className="a-aerial-row tr-note">
              <span
                className="a-aerial-swatch"
                aria-hidden="true"
                style={{ background: ZONE_COLOR[zone], height: 1 + ZONE_CHANNEL[zone].widthRank }}
              />
              {KEY_LABEL[zone]}
            </div>
          ))}
          {extended && (
            <div className="a-aerial-row a-aerial-row-wide tr-note">
              <span
                className="a-aerial-swatch"
                aria-hidden="true"
                style={{ background: ZONE_COLOR.work_zone, opacity: 0.35, height: 3 }}
              />
              Faded: past the mapped road
            </div>
          )}
        </div>
      )}
      {/* W10: the two sentences are not channels; one line under the
          aerial. */}
      {src !== null && keyStage === "work" && (
        <p className="a-aerial-line tr-prov">{AERIAL_KIND_OWED}</p>
      )}
      {src !== null && display?.approachWords && (
        <p className="a-aerial-line tr-prov">{display.approachWords}</p>
      )}
    </div>
  );
}
