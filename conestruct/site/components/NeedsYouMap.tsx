"use client";

// #447 (Part 2, Option A `SeeA`) — the aerial inside a NEEDS YOU question.
// Authority: validation-artifacts/committed/ux-site-map/rulings.md.
//
// Rule 3: the backend frames and draws the picture, both lines included.
// This holds the zoom step and says in the key what the backend said it drew.

import { useRef, useState } from "react";

import { useFrameSize } from "@/components/bands/BandAerial";
import { ZOOM_IN_MAX, ZOOM_OUT_MAX } from "@/lib/corridor-aerial";
import { streetLevelUrl, useNeedsYouMap } from "@/lib/needs-you-map";
import type { Scenario } from "@/lib/scenarios";

/** Ruling 7, verbatim. */
export const MAP_FAILED = "The map didn't load. Your answer still works without it.";
/** Ruling 4 and X6. */
export const MAP_IMAGERY_NOTE = "Imagery may be a few years old";
export const MAP_KEY_WORK = "The work";
/** Ruling 5, verbatim. */
export const MAP_STREET_LEVEL = "See it at street level ↗";

export interface NeedsYouMapProps {
  scenario: Scenario;
  flag: string;
  /** "Sidewalk on the map": the chip on the picture. */
  label: string;
  /** "Sidewalk the map knows about": the key's line. */
  keyLabel: string;
  /** The question's topic, for the alt text. */
  topic: string;
}

export function NeedsYouMap({ scenario, flag, label, keyLabel, topic }: NeedsYouMapProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const size = useFrameSize(frameRef);
  const [step, setStep] = useState(0);
  const map = useNeedsYouMap(
    size
      ? {
          scenario,
          flag,
          width: size.width,
          height: size.height,
          ...(step !== 0 ? { zoom: step } : {}),
        }
      : null,
  );
  // P16: while a zoom step is drawn the previous picture of this question
  // stays.  This component is keyed by the flag, so nothing else is held over.
  const held = useRef<Extract<typeof map, { state: "ready" }> | null>(null);
  if (map.state === "ready") held.current = map;
  const shown = map.state === "ready" ? map : map.state === "loading" ? held.current : null;
  const failed = map.state === "error";
  const drawn = shown?.drawn === true;
  const zoomTo = (next: number) => {
    if (next >= -ZOOM_OUT_MAX && next <= ZOOM_IN_MAX) setStep(next);
  };

  return (
    <figure className="nyq-map" data-testid="needs-you-map">
      <div className="nyq-map-stage">
        {/* P1: the frame holds its height, loaded or not. */}
        <div ref={frameRef} className="nyq-map-frame" aria-busy={shown === null && !failed}>
          {failed ? (
            <p className="nyq-map-failed tr-help" role="status" data-testid="needs-you-map-failed">
              {MAP_FAILED}
            </p>
          ) : null}
          {!failed && shown ? (
            <>
              {/* An object URL of an image the backend drew at this frame's
                  size, as BandAerial's; next/image can't load a blob: URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shown.src}
                alt={
                  drawn
                    ? `Aerial of the work, with ${topic.toLowerCase()} marked as the map knows it`
                    : "Aerial of the work"
                }
                data-testid="needs-you-map-img"
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
          loaded or failed image moves nothing under it. */}
      <figcaption
        className="nyq-map-key tr-note"
        data-testid="needs-you-map-key"
        data-hidden={failed || undefined}
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
