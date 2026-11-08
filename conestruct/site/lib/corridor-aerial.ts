// #301 piece 1 — the WHERE band's aerial: which picture to ask for, and
// the request for it.
//
// Rule 3: the band never computes a coordinate.  It asks the backend for a
// PICTURE of the scenario (POST /api/corridor-map → /render/corridor-map on
// Modal), which lays the corridor out with #302's one layout call and draws
// page 2's own overlay.  What this module decides is only WHICH picture the
// column's state calls for — read off the backend's own geometry answer:
//
//   side_not_confirmed → "pin"       the pin alone (#290's pre-side ruling)
//   laid_out, kind owed → "work"     the work segment only (rule 112)
//   laid_out, kind confirmed → "laid_out"   the whole corridor
//   anything else → no picture (a refusal is stated in words, Rule 10)

import { useEffect, useRef, useState } from "react";
import type { Scenario } from "./scenarios";
import type { CorridorGeometry } from "./corridor-geometry";

export type AerialStage = "pin" | "work" | "laid_out";

export function aerialStage(
  g: CorridorGeometry | null,
  kindConfirmed: boolean,
): AerialStage | null {
  if (!g) return null;
  // #317 (R129 Q2): no crossing marked yet — the pin, as before a side.
  if (g.status === "side_not_confirmed" || g.status === "intersection_not_marked") return "pin";
  if (g.status === "laid_out") return kindConfirmed ? "laid_out" : "work";
  return null;
}

export interface AerialRequest {
  scenario: Scenario;
  stage: AerialStage;
  width: number;
  height: number;
  /** The zoom step (hand-check ruling, 2026-09-26): absent = the whole
   *  corridor; −1 one step out; +1..+3 in.  Sent only when not 0. */
  zoom?: number;
}

/** The band's zoom bounds — the backend's (static_aerial.ZOOM_OUT_MAX /
 *  ZOOM_IN_MAX, CHOSEN there).  A mirror for rendering the buttons'
 *  bounds only; the backend refuses a step outside them. */
export const ZOOM_OUT_MAX = 1;
export const ZOOM_IN_MAX = 3;

export type AerialFetch =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; src: string }
  // The backend's own reason there is no picture (409: no_pin,
  // side_not_confirmed, corridor_unbuildable; 502/503: unavailable).
  | { state: "refused"; status: string; message: string | null }
  | { state: "error" };

// The pictures already drawn this session, by request: re-opening WHERE, or
// toggling back to an answer already seen, shows it at once instead of
// asking again.  A read cache of object URLs; the oldest is released past
// the cap.  CHOSEN: 24 (a session asks for about 3–6 — #301 checkpoint (b)).
const CACHE_MAX = 24;
const cache = new Map<string, string>();
// #456 ruling 3: a request already on its way (the hook's own, or one
// loaded ahead) is shared, never sent twice.
const inflight = new Map<string, Promise<AerialFetch>>();

function remember(key: string, src: string) {
  cache.set(key, src);
  while (cache.size > CACHE_MAX) {
    const [oldest, url] = cache.entries().next().value as [string, string];
    cache.delete(oldest);
    if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
  }
}

/** Test seam: forget every picture. */
export function forgetAerials() {
  cache.clear();
  inflight.clear();
}

/** #456 M11: what a picture is remembered by.  The pin picture is the pin,
 *  the frame and the zoom step and nothing else of the scenario (#440 X5;
 *  the backend draws `stage: "pin"` from lat, lng, size and zoom alone), so
 *  a kind answered before the side reuses the picture on screen.  Every
 *  other stage is the whole request.  The request SENT is always the whole
 *  request (`JSON.stringify(req)`). */
export function aerialCacheKey(req: AerialRequest): string {
  if (req.stage !== "pin") return JSON.stringify(req);
  return JSON.stringify({
    lat: req.scenario.meta.lat,
    lng: req.scenario.meta.lng,
    stage: "pin",
    width: req.width,
    height: req.height,
    zoom: req.zoom ?? 0,
  });
}

/** One request for one picture; a picture is remembered, and decoded before
 *  it is reported ready so it swaps in one step (#456 M10). */
function ask(body: string, key: string): Promise<AerialFetch> {
  const running = inflight.get(key);
  if (running) return running;
  const p = (async (): Promise<AerialFetch> => {
    try {
      const r = await fetch("/api/corridor-map", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      if (!r.ok) {
        const answer = (await r.json().catch(() => null)) as {
          status?: unknown;
          message?: unknown;
        } | null;
        return answer && typeof answer.status === "string"
          ? {
              state: "refused",
              status: answer.status,
              message: typeof answer.message === "string" ? answer.message : null,
            }
          : { state: "error" };
      }
      const blob = await r.blob();
      const src = URL.createObjectURL(blob);
      if (typeof Image !== "undefined") {
        const img = new Image();
        img.src = src;
        await img.decode().catch(() => undefined);
      }
      remember(key, src);
      return { state: "ready", src };
    } catch {
      return { state: "error" };
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** #456 ruling 3, load ahead: ask for a picture an answer would show, unless
 *  it is remembered or already on its way (at most one per choice). */
export function prefetchAerial(req: AerialRequest): void {
  const key = aerialCacheKey(req);
  if (cache.has(key) || inflight.has(key)) return;
  void ask(JSON.stringify(req), key);
}

/**
 * Ask for the picture ``req`` describes (null: nothing to ask), debounced
 * 300 ms like the geometry read.  A remembered picture comes back at once,
 * and a request already on its way (loaded ahead) is awaited, not re-sent.
 * An answer is kept only while it is the current request's (Rule 10); the
 * band holds the previous picture on screen meanwhile (#456 M9).
 */
export function useCorridorAerial(req: AerialRequest | null): AerialFetch {
  const body = req ? JSON.stringify(req) : null;
  const key = req ? aerialCacheKey(req) : null;
  // Every answer is tagged with the request it answers.  On the render in
  // which the request changes, the effect below has not run yet, so the
  // held answer is the OLD request's — and an old picture returned as this
  // request's would show another corridor as this one (Rule 10; the #301
  // zoom hand-check's hold made the window visible).  An answer is
  // returned only for its own request.
  const [answer, setAnswer] = useState<{ key: string | null; fetch: AerialFetch }>(() => ({
    key,
    fetch: key && cache.has(key) ? { state: "ready", src: cache.get(key)! } : { state: "idle" },
  }));
  const tokenRef = useRef(0);
  useEffect(() => {
    const token = ++tokenRef.current;
    const setResult = (fetch: AerialFetch) => {
      if (tokenRef.current === token) setAnswer({ key, fetch });
    };
    if (key === null || body === null) {
      setResult({ state: "idle" });
      return;
    }
    const cached = cache.get(key);
    if (cached) {
      setResult({ state: "ready", src: cached });
      return;
    }
    setResult({ state: "loading" });
    const running = inflight.get(key);
    if (running) {
      void running.then(setResult);
      return;
    }
    // A request that has started is not called off: its picture is
    // remembered, so going back to that answer shows it at once.
    const timer = setTimeout(() => {
      void ask(body, key).then(setResult);
    }, 300);
    return () => clearTimeout(timer);
    // `body` changes exactly when `key` or the scenario does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);
  if (key === null) return { state: "idle" };
  if (answer.key === key) return answer.fetch;
  const cached = cache.get(key);
  return cached ? { state: "ready", src: cached } : { state: "loading" };
}
