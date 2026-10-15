"use client";

import { useEffect, useState } from "react";

// #242: the frontend build this tab is running (inlined at build time;
// the same value the ship's served-frontend check reads from the chunks).
export const BUILT_SHA: string | null = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null;

/** CHOSEN (#242, R145): how often an open tab asks which build is live.
 *  A deploy is rarely more urgent than five minutes, and the answer is a
 *  few bytes.  The tab also asks whenever it becomes visible again. */
export const VERSION_POLL_MS = 5 * 60 * 1000;

/** True once a newer frontend deployment than ``built`` is live.  Never
 *  reloads anything; the caller offers the reload.  With no built sha
 *  (local dev, tests) it never asks. */
export function useNewVersion(built: string | null = BUILT_SHA): boolean {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (!built) return;
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { sha?: unknown };
        if (alive && typeof body.sha === "string" && body.sha !== "" && body.sha !== built) {
          setStale(true);
        }
      } catch {
        // Offline or the route failed: no signal, so no notice (Rule 10).
      }
    };
    const id = setInterval(check, VERSION_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [built]);
  return stale;
}
