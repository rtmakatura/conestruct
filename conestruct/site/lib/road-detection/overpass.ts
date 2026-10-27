// The road lookup's Overpass round trip (#405): every mirror asked at once,
// the first valid answer wins.
//
// This is the backend's #292 race (src/rules/site_detection.py `_race`,
// rulings R69/R70/R73/R74) ported to the Next route, which used to run its
// own sequential chain: overpass-api.de, then overpass.kumi.systems, then
// overpass.openstreetmap.fr, 6 s each, in order.  Measured 2026-10-27
// (validation-artifacts/committed/missions/walkthrough-followups/405/):
// overpass-api.de answered 0 of 10 (a 502 or nothing in 25 s), kumi 0 of 10,
// .fr 10 of 10 (median 1.9 s), so every round trip waited 6.5-12 s (de's
// 502 in about 0.5 s or its 6 s cap, then kumi's 6 s cap) before .fr was
// asked, and the live route took 15-28 s.  The chain also
// stopped at the first 4xx, so one 429 from the first mirror read as
// "Detection service unavailable" without .fr ever being asked.
//
// The rules, as the backend's:
// - The live mirrors get the query at the same moment.  The first answer that
//   is valid -- HTTP 200, JSON, no `remark` (#251) -- wins, and every other
//   request is aborted.
// - A 4xx, 429, 5xx, network error, invalid JSON or remark from one mirror is
//   that mirror's failure; the other's answer stays in play (R74).
// - A 429 rests that mirror for its Retry-After, else
//   RATE_LIMIT_COOLDOWN_MS (R73).  Nothing is retried.
// - One hard deadline per round trip (R71's shape).  Past it every request is
//   aborted and the caller gets null: an honest "unavailable" (#213).
// - Each round trip logs one line with every mirror's time and outcome
//   (#405 Acceptance; the scan's counterpart is the audit's `mirror` meta).

// The backend's list (site_detection.py OVERPASS_MIRRORS); overpass.test.ts
// fails if the two drift.  overpass.kumi.systems is dropped (R70; 0 of 10 in
// #405's probe).
export const OVERPASS_MIRRORS: readonly string[] = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

// CHOSEN (Rule 12, #405): 10 s per round trip.  The query itself carries
// `[timeout:10]`, so Overpass gives up on it at 10 s server-side; an answer
// later than that would be a timeout remark, not data.  The issue's 8 s
// target was not taken as the cap: .fr answered once in 7.97 s in the
// before-probe.  A two-trip lookup's worst case is 20 s (was 36 s).
export const OVERPASS_DEADLINE_MS = 10_000;

// CHOSEN (Rule 12): 60 s, the backend's RATE_LIMIT_COOLDOWN_S (R73).
// Neither mirror documents a value; a minute is the shortest pause that is
// plainly not a retry loop.  Held per warm server instance.
export const RATE_LIMIT_COOLDOWN_MS = 60_000;

// Overpass returns 406 to clients without an identifying User-Agent.
export const OVERPASS_USER_AGENT =
  "conestruct-traffic-control-tool/0.2 (+https://conestruct.com; hello@conestruct.com)";

const restedUntil = new Map<string, number>();

/** Tests only: forget every 429 rest. */
export function resetMirrorRest(): void {
  restedUntil.clear();
}

export interface MirrorTiming {
  mirror: string;
  /** Time to this mirror's outcome; null when it was never asked or was cut off. */
  ms: number | null;
  outcome: string;
}

type Asked = { payload: unknown; outcome: string };

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function retryAfterMs(r: Response): number {
  const raw = r.headers?.get?.("retry-after");
  const s = raw == null ? NaN : Number(raw);
  return Number.isFinite(s) && s >= 0 ? s * 1000 : RATE_LIMIT_COOLDOWN_MS;
}

function remarkOf(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const remark = (payload as { remark?: unknown }).remark;
  if (typeof remark !== "string" || remark.trim() === "") return null;
  return remark.trim().split("\n")[0];
}

async function askMirror(url: string, data: string, signal: AbortSignal): Promise<Asked> {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": OVERPASS_USER_AGENT,
    },
    body: `data=${encodeURIComponent(data)}`,
    signal,
  });
  if (r.status === 429) {
    const pause = retryAfterMs(r);
    restedUntil.set(url, Date.now() + pause);
    return { payload: null, outcome: `429 rate-limited (rested ${Math.round(pause / 1000)} s)` };
  }
  if (!r.ok) return { payload: null, outcome: `HTTP ${r.status}` };
  let payload: unknown;
  try {
    payload = await r.json();
  } catch {
    return { payload: null, outcome: "invalid JSON" };
  }
  const remark = remarkOf(payload);
  if (remark !== null) return { payload: null, outcome: `remark: ${remark}` };
  return { payload, outcome: "answered" };
}

function abortError(): Error {
  const err = new Error("Aborted");
  err.name = "AbortError";
  return err;
}

/**
 * Ask every live mirror at once; resolve with the first valid answer, or
 * null when every mirror failed or the deadline passed.  Throws an
 * AbortError when `signal` (the client's request) aborts.
 */
export async function overpassRace<T>(
  data: string,
  signal: AbortSignal | undefined,
  trip: string,
): Promise<T | null> {
  if (signal?.aborted) throw abortError();
  const t0 = Date.now();
  const timings = new Map<string, MirrorTiming>();
  const live = OVERPASS_MIRRORS.filter((u) => (restedUntil.get(u) ?? 0) <= t0);
  for (const u of OVERPASS_MIRRORS) {
    if (!live.includes(u)) {
      const left = Math.ceil(((restedUntil.get(u) ?? t0) - t0) / 1000);
      timings.set(u, { mirror: host(u), ms: null, outcome: `rested after a 429, ${left} s more` });
    }
  }

  const controllers = live.map(() => new AbortController());
  const abortAll = () => controllers.forEach((c) => c.abort());
  signal?.addEventListener("abort", abortAll, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let winner: string | null = null;
  let deadlinePassed = false;
  try {
    const result = await new Promise<T | null>((resolve) => {
      let open = live.length;
      let settled = false;
      const settle = (v: T | null) => {
        if (settled) return;
        settled = true;
        resolve(v);
      };
      if (open === 0) settle(null);
      timer = setTimeout(() => {
        deadlinePassed = true;
        settle(null);
      }, OVERPASS_DEADLINE_MS);
      live.forEach((url, i) => {
        askMirror(url, data, controllers[i].signal).then(
          ({ payload, outcome }) => {
            if (settled) return;
            timings.set(url, { mirror: host(url), ms: Date.now() - t0, outcome });
            if (payload !== null) {
              winner = url;
              settle(payload as T);
            } else if (--open === 0) settle(null);
          },
          (err: Error) => {
            if (settled) return;
            const outcome = err?.name === "AbortError" ? "aborted" : `${err?.name ?? "Error"}: ${err?.message ?? ""}`;
            timings.set(url, { mirror: host(url), ms: Date.now() - t0, outcome });
            if (--open === 0) settle(null);
          },
        );
      });
    });
    if (signal?.aborted) throw abortError();
    return result;
  } finally {
    clearTimeout(timer);
    abortAll();
    signal?.removeEventListener("abort", abortAll);
    for (const u of live) {
      if (!timings.has(u)) {
        timings.set(u, {
          mirror: host(u),
          ms: null,
          outcome: deadlinePassed
            ? `no answer in ${OVERPASS_DEADLINE_MS} ms`
            : signal?.aborted
              ? "aborted (client left)"
              : "cancelled (another mirror answered)",
        });
      }
    }
    console.info(
      JSON.stringify({
        event: "overpass",
        route: "road-bearing",
        trip,
        winner: winner === null ? null : host(winner),
        ms: Date.now() - t0,
        mirrors: OVERPASS_MIRRORS.map((u) => timings.get(u)),
      }),
    );
  }
}
