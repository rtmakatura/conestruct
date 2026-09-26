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
  if (g.status === "side_not_confirmed") return "pin";
  if (g.status === "laid_out") return kindConfirmed ? "laid_out" : "work";
  return null;
}

export interface AerialRequest {
  scenario: Scenario;
  stage: AerialStage;
  width: number;
  height: number;
}

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
}

/**
 * Ask for the picture ``req`` describes (null: nothing to ask), debounced
 * 300 ms like the geometry read and superseded by any newer request.  An
 * answer is kept only while it is the current request's: a new request
 * clears the old picture at once — a stale corridor is never shown as this
 * one (Rule 10).
 */
export function useCorridorAerial(req: AerialRequest | null): AerialFetch {
  const key = req ? JSON.stringify(req) : null;
  const [result, setResult] = useState<AerialFetch>(() =>
    key && cache.has(key) ? { state: "ready", src: cache.get(key)! } : { state: "idle" },
  );
  const tokenRef = useRef(0);
  useEffect(() => {
    const token = ++tokenRef.current;
    if (key === null) {
      setResult({ state: "idle" });
      return;
    }
    const cached = cache.get(key);
    if (cached) {
      setResult({ state: "ready", src: cached });
      return;
    }
    setResult({ state: "loading" });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch("/api/corridor-map", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: key,
          signal: controller.signal,
        });
        if (tokenRef.current !== token) return;
        if (!r.ok) {
          const body = (await r.json().catch(() => null)) as {
            status?: unknown;
            message?: unknown;
          } | null;
          if (tokenRef.current !== token) return;
          setResult(
            body && typeof body.status === "string"
              ? {
                  state: "refused",
                  status: body.status,
                  message: typeof body.message === "string" ? body.message : null,
                }
              : { state: "error" },
          );
          return;
        }
        const blob = await r.blob();
        if (tokenRef.current !== token) return;
        const src = URL.createObjectURL(blob);
        remember(key, src);
        setResult({ state: "ready", src });
      } catch {
        if (tokenRef.current === token) setResult({ state: "error" });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);
  return result;
}
