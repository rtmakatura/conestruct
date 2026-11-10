"use client";

// #447 (Part 2, Option A `SeeA`) — the aerial inside a NEEDS YOU question.
// Authority: validation-artifacts/committed/ux-site-map/rulings.md.
//
// Rule 3: the backend frames and draws the picture, both lines included.
// This holds the zoom step and says in the key what the backend said it drew.
//
// #483 ruling 1 (Ryan, 2026-11-09): the map loads soft, then sharpens.  The
// soft image is the same backend frame with nothing drawn on it, asked for
// first; the full one is asked for when it has answered, and fades in over
// it.  Authority: validation-artifacts/committed/missions/
// ux-token-map-load-edit/issue-483/rulings.md.

import { useEffect, useRef, useState } from "react";

import { useFrameSize } from "@/components/bands/BandAerial";
import { ZOOM_IN_MAX, ZOOM_OUT_MAX } from "@/lib/corridor-aerial";
import {
  isNeedsYouMapCached,
  streetLevelUrl,
  useNeedsYouMap,
  type NeedsYouMapFetch,
} from "@/lib/needs-you-map";
import type { Scenario } from "@/lib/scenarios";

/** Ruling 7, verbatim. */
export const MAP_FAILED = "The map didn't load. Your answer still works without it.";
/** Ruling 4 and X6. */
export const MAP_IMAGERY_NOTE = "Imagery may be a few years old";
export const MAP_KEY_WORK = "The work";
/** Ruling 5, verbatim. */
export const MAP_STREET_LEVEL = "See it at street level ↗";
/** #483 ruling 1, verbatim. */
export const MAP_LOADING = "Loading the map of this spot";

type Ready = Extract<NeedsYouMapFetch, { state: "ready" }>;

/** #448: what the picture says about the subject, for the explanation above
 *  it.  A relay of the backend's `x-map-subject` header (Rule 3): the card
 *  decides nothing about geometry. */
export type MapSubject = "loading" | "drawn" | "none" | "failed";

export interface NeedsYouMapProps {
  scenario: Scenario;
  flag: string;
  /** "Sidewalk on the map": the chip on the picture. */
  label: string;
  /** "Sidewalk the map knows about": the key's line. */
  keyLabel: string;
  /** The question's topic, for the alt text. */
  topic: string;
  /** #448: told each time the picture's subject state changes. */
  onSubject?: (subject: MapSubject) => void;
}

export function NeedsYouMap({
  scenario,
  flag,
  label,
  keyLabel,
  topic,
  onSubject,
}: NeedsYouMapProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const size = useFrameSize(frameRef);
  const [step, setStep] = useState(0);
  const [sharpLoaded, setSharpLoaded] = useState(false);
  // Rule 10: a full image that arrives but can't be decoded is a failed map,
  // the same path as a failed fetch (never an invisible image under a key).
  const [undecodable, setUndecodable] = useState(false);
  // P16: while a zoom step is drawn the previous picture of this question
  // stays.  This component is keyed by the flag, so nothing else is held over.
  const held = useRef<Ready | null>(null);
  const base = size ? { scenario, flag, width: size.width, height: size.height } : null;
  const fullReq = base ? { ...base, ...(step !== 0 ? { zoom: step } : {}) } : null;
  // #483: the soft image only before this question has shown a full picture
  // (never for a zoom step or a resize, R145-9) and not when the full one is
  // already drawn this session.
  const wantSoft =
    fullReq !== null && step === 0 && held.current === null && !isNeedsYouMapCached(fullReq);
  // R145-3: the full image is asked for once the soft one has answered
  // (either way), in the same chain.
  const { map, soft } = useNeedsYouMap(fullReq, wantSoft);
  // The soft picture stays under the full one while it fades in.
  const softHeld = useRef<Ready | null>(null);
  if (soft) softHeld.current = soft;
  if (map.state === "ready") held.current = map;
  const shown = map.state === "ready" ? map : map.state === "loading" ? held.current : null;
  const failed = map.state === "error" || undecodable;
  const softShown = failed ? null : softHeld.current;
  const drawn = shown?.drawn === true;
  const phase = failed ? "failed" : shown ? "sharp" : softShown ? "soft" : "waiting";
  // #448: the same state the key and label show, said to the explanation.
  const subject: MapSubject = failed ? "failed" : shown === null ? "loading" : drawn ? "drawn" : "none";
  useEffect(() => {
    onSubject?.(subject);
  }, [subject, onSubject]);
  const zoomTo = (next: number) => {
    if (next >= -ZOOM_OUT_MAX && next <= ZOOM_IN_MAX) setStep(next);
  };

  return (
    <figure className="nyq-map" data-testid="needs-you-map">
      <div className="nyq-map-stage">
        {/* P1: the frame holds its height, loaded or not. */}
        <div
          ref={frameRef}
          className="nyq-map-frame"
          aria-busy={shown === null && !failed}
          data-map={phase}
        >
          {failed ? (
            <p className="nyq-map-failed tr-help" role="status" data-testid="needs-you-map-failed">
              {MAP_FAILED}
            </p>
          ) : null}
          {/* #483: until anything lands, the frame's own ground (R145-4): no
              picture of another frame.  Then the soft image of this frame,
              blurred, under a scrim; decorative, since the frame is busy and
              the label says so. */}
          {softShown ? (
            <span className="nyq-map-soft" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={softShown.src}
                alt=""
                data-testid="needs-you-map-soft"
                data-frame={softShown.frame ?? undefined}
              />
            </span>
          ) : null}
          {!failed && shown ? (
            <>
              {/* An object URL of an image the backend drew at this frame's
                  size, as BandAerial's; next/image can't load a blob: URL.
                  #483: it fades in once decoded (R145-10). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="nyq-map-sharp"
                src={shown.src}
                alt={
                  drawn
                    ? `Aerial of the work, with ${topic.toLowerCase()} marked as the map knows it`
                    : "Aerial of the work"
                }
                data-testid="needs-you-map-img"
                data-frame={shown.frame ?? undefined}
                data-loaded={sharpLoaded || undefined}
                onLoad={() => setSharpLoaded(true)}
                onError={() => setUndecodable(true)}
              />
              <div className="nyq-map-zoom" data-testid="needs-you-map-zoom" data-step={step}>
                <button
                  type="button"
                  className="nyq-map-zbtn"
                  data-read=""
                  aria-label="Zoom in"
                  aria-disabled={step >= ZOOM_IN_MAX || undefined}
                  onClick={() => zoomTo(step + 1)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="nyq-map-zbtn"
                  data-read=""
                  aria-label="Zoom out"
                  aria-disabled={step <= -ZOOM_OUT_MAX || undefined}
                  onClick={() => zoomTo(step - 1)}
                >
                  −
                </button>
              </div>
            </>
          ) : null}
        </div>
        {/* Over the map from 480 px up, under it below that (phone fix round).
            Always in the layout, so the space under the map is held (P1). */}
        <div className="nyq-map-under">
          {/* #483 ruling 1: in the map's corner from 480 px up; in the
              label's held slot under it below that (R145-7). */}
          {!failed && !shown ? (
            <span className="nyq-map-loading tr-note" data-testid="needs-you-map-loading">
              {MAP_LOADING}
            </span>
          ) : null}
          {!failed && drawn ? (
            <span className="nyq-map-label tr-note" data-testid="needs-you-map-label">
              <span className="nyq-map-swatch is-subject" aria-hidden="true" />
              {label}
            </span>
          ) : null}
          {!failed && shown?.point ? (
            <a
              className="nyq-map-street tr-help"
              href={streetLevelUrl(shown.point)}
              target="_blank"
              rel="noopener noreferrer"
              data-read=""
              data-testid="needs-you-map-street"
            >
              {MAP_STREET_LEVEL}
            </a>
          ) : null}
        </div>
      </div>
      {/* Ruling 7 (P1): always in the layout, hidden with the picture, so a
          loaded or failed image moves nothing under it.  #483: it appears
          with the full image, in this reserved space. */}
      <figcaption
        className="nyq-map-key tr-note"
        data-testid="needs-you-map-key"
        data-hidden={failed || !shown || undefined}
      >
        <span className="nyq-map-key-item">
          <span className="nyq-map-swatch is-work" aria-hidden="true" />
          {MAP_KEY_WORK}
        </span>
        {drawn ? (
          <span className="nyq-map-key-item">
            <span className="nyq-map-swatch is-subject" aria-hidden="true" />
            {keyLabel}
          </span>
        ) : null}
        <span className="nyq-map-key-note">{MAP_IMAGERY_NOTE}</span>
      </figcaption>
    </figure>
  );
}
