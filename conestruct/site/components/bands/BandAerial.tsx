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
//   · side owed           the pin alone and "Say which side is occupied to
//                         lay out the work" (#290's pre-side ruling, P16)
//   · side chosen, kind owed   the work segment; the legend says the
//                         approaches lay out after the kind (rule 112)
//   · both answered       the whole corridor; the five-row legend
//   · refused             the backend's reason, in words (Rule 10)
//   · waiting / failed    a sentence in the sized frame (P8), never a
//                         skeleton and never the previous picture
//
// Rule 3: nothing here computes a coordinate or a length.  The image is the
// backend's; the legend's swatches read ZONE_COLOR / ZONE_CHANNEL (the
// corridor's one palette source) and its words are ZONE_LABEL.  The frame's
// size is measured and sent, so the backend frames the corridor for exactly
// the box it is shown in — no crop, no horizontal scroll at 380.

import { useLayoutEffect, useRef, useState } from "react";
import type { Scenario } from "@/lib/scenarios";
import { SIDE_BLOCKER } from "@/lib/scenarios/rail";
import {
  boundWord,
  refusalReason,
  type GeometryFetch,
} from "@/lib/corridor-geometry";
import {
  ZOOM_IN_MAX,
  ZOOM_OUT_MAX,
  aerialStage,
  useCorridorAerial,
  type AerialStage,
} from "@/lib/corridor-aerial";
import { ZONE_CHANNEL, ZONE_COLOR, ZONE_LABEL, type CorridorZone } from "@/lib/corridor-zones";

// Upstream first — the motorist's order, the picker's and page 2's legend.
const LEGEND_ORDER: readonly CorridorZone[] = [
  "advance_warning",
  "transition",
  "buffer",
  "work_zone",
  "downstream",
];

export const AERIAL_WAIT = "Drawing the corridor…";
export const AERIAL_FAILED = "The aerial didn't load — Edit on map shows the corridor.";
export const AERIAL_KIND_OWED = "Approaches lay out after you confirm the kind";

const ALT: Record<AerialStage, string> = {
  pin: "Aerial at the pin — nothing is laid out until the side is chosen",
  work: "Aerial: the work segment at the pin",
  laid_out: "Aerial: the laid-out corridor — the work and its approaches",
};

// The frame's measured box, in whole CSS px.  Before layout (and in a DOM
// without layout) the frame's rule-104 size stands in.
const FALLBACK = { width: 600, height: 300 };

function useFrameSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = Math.floor(el.clientWidth);
      const h = Math.floor(el.clientHeight);
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

export interface BandAerialProps {
  scenario: Scenario;
  geometry: GeometryFetch;
  kindConfirmed: boolean;
}

export function BandAerial({ scenario, geometry, kindConfirmed }: BandAerialProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const size = useFrameSize(frameRef);
  // Only an answer for THIS scenario: while the geometry re-reads (a pin
  // moved, a side changed) the hook still holds the previous answer, and a
  // picture of the previous answer is a stale corridor (Rule 10).
  const g = geometry.state === "ready" ? geometry.geometry : null;
  const stage = aerialStage(g, kindConfirmed);
  // Zoom (Ryan's hand-check ruling, 2026-09-26).  The step belongs to ONE
  // picture — this scenario, stage and frame — so a new picture always
  // opens on the whole corridor, with no effect to reset it.
  const base = stage && size ? JSON.stringify({ scenario, stage, size }) : null;
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
  // P16: while a zoom step is drawn, the previous picture OF THE SAME
  // corridor stays — no blank, no wait note on the image.  A different
  // corridor (base) is never held over (Rule 10).
  const held = useRef<{ base: string | null; src: string } | null>(null);
  if (aerial.state === "ready") held.current = { base, src: aerial.src };
  const holding =
    aerial.state === "loading" && held.current !== null && held.current.base === base;
  const src = aerial.state === "ready" ? aerial.src : holding ? held.current!.src : null;

  if (geometry.state === "ready" && g?.status === "no_pin") return null;

  const refusal = refusalReason(g);
  let note: string | null = null;
  if (refusal) note = `Can't lay the corridor out here — ${refusal}`;
  else if (geometry.state === "error") note = AERIAL_FAILED;
  else if (aerial.state === "refused") {
    note =
      aerial.status === "corridor_unbuildable" && aerial.message
        ? `Can't lay the corridor out here — ${aerial.message.replace(/^\w+Error:\s*/, "")}`
        : AERIAL_FAILED;
  } else if (aerial.state === "error") note = AERIAL_FAILED;
  else if (aerial.state !== "ready" && !holding) note = AERIAL_WAIT;
  else if (stage === "pin") note = SIDE_BLOCKER;

  const shown = src !== null && stage !== null;
  const zoomTo = (next: number) => {
    if (next < -ZOOM_OUT_MAX || next > ZOOM_IN_MAX) return;
    setZoomAt({ base, step: next });
  };
  const approaches = g?.approaches ?? [];
  const extended =
    stage === "laid_out"
      ? approaches.some((a) => a.zones.some((z) => z.parts.some((p) => p.extended))) ||
        (g?.work?.parts ?? []).some((p) => p.extended)
      : (g?.work?.parts ?? []).some((p) => p.extended);

  return (
    <div className="a-aerial" data-testid="band-aerial" data-read data-stage={stage ?? "none"}>
      <div ref={frameRef} className="a-aerial-frame">
        {shown && (
          // The source is an object URL of a PNG the backend drew at this
          // frame's exact size — there is nothing for next/image to
          // optimise or resize, and it cannot load a blob: URL through its
          // loader.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={ALT[stage]} data-testid="band-aerial-img" />
        )}
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
            className="a-aerial-note tr-prov"
            data-testid="band-aerial-note"
            role={note === AERIAL_WAIT ? undefined : "note"}
          >
            {note}
          </div>
        )}
      </div>
      {shown && (stage === "work" || stage === "laid_out") && (
        <div className="a-aerial-legend" data-testid="band-aerial-legend">
          {(stage === "laid_out" ? LEGEND_ORDER : (["work_zone"] as const)).map((zone) => (
            <div key={zone} className="a-aerial-row tr-prov">
              <span
                className="a-aerial-swatch"
                aria-hidden="true"
                style={{ background: ZONE_COLOR[zone], height: 1 + ZONE_CHANNEL[zone].widthRank }}
              />
              {ZONE_LABEL[zone]}
            </div>
          ))}
          {extended && (
            <div className="a-aerial-row tr-prov">
              <span
                className="a-aerial-swatch"
                aria-hidden="true"
                style={{ background: ZONE_COLOR.work_zone, opacity: 0.35, height: 3 }}
              />
              Faded: past the mapped road
            </div>
          )}
          {stage === "work" && <div className="a-aerial-line tr-prov">{AERIAL_KIND_OWED}</div>}
          {stage === "laid_out" && approaches.length === 2 && (
            <div className="a-aerial-line tr-prov">
              Two approaches: {boundWord(approaches[0].travel_bearing_deg)} (the work&apos;s side) and{" "}
              {boundWord(approaches[1].travel_bearing_deg)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
