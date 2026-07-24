import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Shared per-IP rate limiter for the anonymous render/geocode surface (#145).
//
// Replaces the ~13 copy-pasted in-memory `buckets` Maps that each route used
// to declare.  Those counters lived in per-serverless-instance memory: they
// reset on cold start and were not shared across horizontally-scaled Vercel
// instances, so they bounded a single hot client but never total spend.  This
// helper keeps the counter in Upstash Redis (durable, shared across all
// instances), so a per-IP cap actually holds under instance churn.
//
// FAIL-OPEN by design.  The anonymous sandbox is the top-of-funnel demo (the
// homepage itself renders it).  A limiter problem — Upstash unreachable, env
// vars unset (local dev, preview), or env vars MALFORMED — must NEVER take the
// demo down.  Every failure mode returns "allow".
//
// Two failure modes, both fail-open (this is the #145 regression fix):
//   1. Construction.  The Upstash `Redis` constructor throws SYNCHRONOUSLY on
//      a malformed URL (surrounding quotes, whitespace, non-https).  The
//      original build ran that constructor at MODULE-LOAD time, so a quoted
//      env var threw during import — outside any try/catch — and 500'd every
//      route that imported this file, bypassing fail-open entirely.  We now
//      construct lazily inside the request path, guarded, and cache the
//      result (including a "disabled" sentinel) so a bad config degrades to a
//      no-op instead of a crash.
//   2. The `.limit()` call.  Wrapped in the same guard — a store outage or
//      transient error returns "allow".
//
// SANITIZE-AND-WORK: env values are trimmed and one layer of matched
// surrounding quotes is stripped before construction, so an env var
// accidentally saved as `"https://…"` yields a FUNCTIONING limiter rather
// than a disabled one.
//
// Required env (set in Vercel — Production + Preview — before this bounds
// anything; absent, it is a documented no-op):
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN

// Strip surrounding whitespace and one layer of matched surrounding quotes
// (single or double).  Returns undefined for missing/empty values so the
// caller treats them as "unconfigured".
export function sanitizeEnv(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  let s = value.trim();
  if (
    s.length >= 2 &&
    ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'")))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s || undefined;
}

// Lazily-resolved limiter state, cached after first use.  `null` = not yet
// resolved; `{ off }` = unconfigured or config invalid (fail open); `{ on }` =
// a working Ratelimit-per-cap factory.
type State =
  | { kind: "off" }
  | { kind: "on"; redis: Redis; limiters: Map<string, Ratelimit> };

let cached: State | null = null;
let warned = false;

function warnOnce(message: string): void {
  if (!warned) {
    warned = true;
    console.warn(message);
  }
}

// Build (once) the shared Redis client from sanitized env.  Any construction
// error — including the synchronous UrlError on a malformed URL — is caught
// and degrades to the disabled sentinel, never propagating to the route.
function resolveState(): State {
  if (cached) return cached;

  const url = sanitizeEnv(process.env.UPSTASH_REDIS_REST_URL);
  const token = sanitizeEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token) {
    warnOnce(
      "rate-limit: UPSTASH_REDIS_REST_URL/TOKEN unset — limiter is a no-op (fail-open)",
    );
    cached = { kind: "off" };
    return cached;
  }

  try {
    cached = { kind: "on", redis: new Redis({ url, token }), limiters: new Map() };
  } catch (err) {
    // Malformed config (e.g. UrlError from an unparseable URL).  Fail open.
    console.error(
      "rate-limit: invalid Upstash config — limiter disabled (fail-open)",
      err,
    );
    cached = { kind: "off" };
  }
  return cached;
}

// The window is fixed 60 s to preserve the exact semantics of the old
// `reset: now + 60_000` buckets — N requests per rolling minute, per IP, per
// route.  A Ratelimit instance is built (and cached) per (route, cap).
function limiterFor(state: State, routeId: string, perMinute: number): Ratelimit {
  if (state.kind !== "on") throw new Error("limiter not configured");
  const key = `${routeId}:${perMinute}`;
  let limiter = state.limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: state.redis,
      limiter: Ratelimit.fixedWindow(perMinute, "60 s"),
      prefix: `ratelimit:${routeId}`,
      analytics: false,
      // Short-circuit an obvious flood within a single instance without a
      // Redis round-trip once the window is known-exhausted here.
      ephemeralCache: new Map(),
    });
    state.limiters.set(key, limiter);
  }
  return limiter;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Enforce a per-IP, per-route request cap backed by shared Upstash state.
 *
 * @returns a 429 `Response` when the caller is over the cap, or `null` to let
 * the handler proceed.  Call sites use: `const over = await rateLimitOr429(...);
 * if (over) return over;`.
 *
 * Fails OPEN — returns `null` (allow) on EVERY failure mode: env unset, env
 * malformed (construction throws), or the store unreachable (limit throws).
 * A limiter problem can never take down the demo.
 */
export async function rateLimitOr429(
  req: NextRequest,
  routeId: string,
  perMinute: number,
): Promise<Response | null> {
  try {
    const state = resolveState();
    if (state.kind !== "on") return null; // unconfigured / invalid → allow

    const { success } = await limiterFor(state, routeId, perMinute).limit(
      clientIp(req),
    );
    return success ? null : new Response("Too many requests", { status: 429 });
  } catch (err) {
    // Construction or store error — fail open, never block the demo.
    console.error(`rate-limit: failing open for ${routeId}`, err);
    return null;
  }
}

// Test seam: reset the memoised state so a test can re-resolve under a
// different env / mock.  Not used in production.
export function __resetRateLimitStateForTests(): void {
  cached = null;
  warned = false;
}
