// #447 — a NEEDS YOU question's map: the request for it.
//
// Rule 3: the backend frames and draws it (POST /api/needs-you-map →
// /render/needs-you-map).  The card computes nothing: it gets a picture, whether
// the subject's line was drawn, and the question's point.

import { useEffect, useState } from "react";
import type { Scenario } from "./scenarios";

export interface NeedsYouMapRequest {
  scenario: Scenario;
  flag: string;
  width: number;
  height: number;
  /** Sent only when not 0 (the backend's bounds, as the band's zoom). */
  zoom?: number;
  /** #483 ruling 1: the same frame's quick image, nothing drawn on it. */
  soft?: true;
}

export type NeedsYouMapFetch =
  | { state: "loading" }
  | {
      state: "ready";
      src: string;
      drawn: boolean;
      point: string | null;
      /** #483: the backend's `x-map-frame`, relayed for the checks (Rule 3). */
      frame: string | null;
    }
  | { state: "error" };

type Ready = Extract<NeedsYouMapFetch, { state: "ready" }>;

// The pictures already drawn this session, by request.  CHOSEN: 24, as the
// band's (a plan asks for 2 to 50, checkpoint § 3); the oldest is released.
const CACHE_MAX = 24;
const cache = new Map<string, Ready>();

function remember(key: string, ready: Ready) {
  cache.set(key, ready);
  while (cache.size > CACHE_MAX) {
    const [oldest, old] = cache.entries().next().value as [string, Ready];
    cache.delete(oldest);
    if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(old.src);
  }
}

/** #483: whether `req`'s picture is already drawn this session (then no
 *  soft image is asked for it). */
export function isNeedsYouMapCached(req: NeedsYouMapRequest): boolean {
  return cache.has(JSON.stringify(req));
}

/** Test seam: forget every picture. */
export function forgetNeedsYouMaps() {
  cache.clear();
}

/** The documented Maps URL (ruling 5).  `point` is the backend's "lat,lng". */
export function streetLevelUrl(point: string): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${point}`;
}

async function draw(key: string, signal: AbortSignal): Promise<Ready> {
  const r = await fetch("/api/needs-you-map", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: key,
    signal,
  });
  if (!r.ok) throw new Error(String(r.status));
  const blob = await r.blob();
  return {
    state: "ready",
    src: URL.createObjectURL(blob),
    drawn: r.headers.get("x-map-subject") === "drawn",
    point: r.headers.get("x-map-point"),
    frame: r.headers.get("x-map-frame"),
  };
}

export interface NeedsYouMapPair {
  /** The full picture `req` asked for. */
  map: NeedsYouMapFetch;
  /** #483: the same frame's soft picture, while one was asked for and drawn. */
  soft: Ready | null;
}

/**
 * Ask for the picture `req` describes (null: not measured yet), debounced
 * 300 ms like the band's and superseded by any newer request.  An answer is
 * returned only for its own request, so a new request never shows the old
 * picture as this one (Rule 10).
 *
 * #483 ruling 1: with `softFirst`, the same frame's soft picture is asked for
 * first and the full one right after it answers (either way), in one chain,
 * so one Overpass read serves both on a warm container (rulings.md R145-3).
 */
export function useNeedsYouMap(req: NeedsYouMapRequest | null, softFirst = false): NeedsYouMapPair {
  const key = req ? JSON.stringify(req) : null;
  const softKey = req && softFirst ? JSON.stringify({ ...req, soft: true }) : null;
  const [answer, setAnswer] = useState<{ key: string; fetch: NeedsYouMapFetch } | null>(null);
  const [softAnswer, setSoftAnswer] = useState<{ key: string; ready: Ready } | null>(null);
  useEffect(() => {
    if (key === null || cache.has(key)) return;
    let live = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (softKey !== null && !cache.has(softKey)) {
        try {
          const ready = await draw(softKey, controller.signal);
          if (!live) return;
          remember(softKey, ready);
          setSoftAnswer({ key: softKey, ready });
        } catch {
          // A soft picture that fails costs only itself: the full one is
          // still asked for.
          if (!live) return;
        }
      }
      try {
        const ready = await draw(key, controller.signal);
        if (!live) return;
        remember(key, ready);
        setAnswer({ key, fetch: ready });
      } catch {
        if (live) setAnswer({ key, fetch: { state: "error" } });
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, softKey]);
  const softCached = softKey !== null ? cache.get(softKey) : undefined;
  const soft = softCached ?? (softAnswer && softAnswer.key === softKey ? softAnswer.ready : null);
  if (key === null) return { map: { state: "loading" }, soft };
  const cached = cache.get(key);
  if (cached) return { map: cached, soft };
  return { map: answer?.key === key ? answer.fetch : { state: "loading" }, soft };
}
