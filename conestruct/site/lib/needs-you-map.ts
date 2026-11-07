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
}

export type NeedsYouMapFetch =
  | { state: "loading" }
  | { state: "ready"; src: string; drawn: boolean; point: string | null }
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

/** Test seam: forget every picture. */
export function forgetNeedsYouMaps() {
  cache.clear();
}

/** The documented Maps URL (ruling 5).  `point` is the backend's "lat,lng". */
export function streetLevelUrl(point: string): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${point}`;
}

/**
 * Ask for the picture `req` describes (null: not measured yet), debounced
 * 300 ms like the band's and superseded by any newer request.  An answer is
 * returned only for its own request, so a new request never shows the old
 * picture as this one (Rule 10).
 */
export function useNeedsYouMap(req: NeedsYouMapRequest | null): NeedsYouMapFetch {
  const key = req ? JSON.stringify(req) : null;
  const [answer, setAnswer] = useState<{ key: string; fetch: NeedsYouMapFetch } | null>(null);
  useEffect(() => {
    if (key === null || cache.has(key)) return;
    let live = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch("/api/needs-you-map", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: key,
          signal: controller.signal,
        });
        if (!r.ok) throw new Error(String(r.status));
        const blob = await r.blob();
        if (!live) return;
        const ready: Ready = {
          state: "ready",
          src: URL.createObjectURL(blob),
          drawn: r.headers.get("x-map-subject") === "drawn",
          point: r.headers.get("x-map-point"),
        };
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
  }, [key]);
  if (key === null) return { state: "loading" };
  const cached = cache.get(key);
  if (cached) return cached;
  return answer?.key === key ? answer.fetch : { state: "loading" };
}
