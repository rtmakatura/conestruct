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
// homepage itself renders it).  A limiter outage — Upstash unreachable, or the
// env vars simply not set (local dev, preview deploys) — must NEVER take the
// demo down.  When the store is unconfigured or a `.limit()` call throws, we
// log once and allow the request.  The Modal-side global backstop
// (`max_containers` in modal_app.py, #145 part C) is what bounds TOTAL spend;
// this limiter throttles individual callers on top of that.
//
// Required env (set in Vercel — Production + Preview — before this bounds
// anything; absent, it is a documented no-op):
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN

function makeRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Singleton client + a Ratelimit instance per (route, cap).  The window is
// fixed 60 s to preserve the exact semantics of the old `reset: now + 60_000`
// buckets — N requests per rolling minute, per IP, per route.
const redis = makeRedis();
let warnedNoStore = false;

const limiters = new Map<string, Ratelimit>();

function limiterFor(routeId: string, perMinute: number): Ratelimit | null {
  if (!redis) return null;
  const key = `${routeId}:${perMinute}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(perMinute, "60 s"),
      prefix: `ratelimit:${routeId}`,
      analytics: false,
      // Short-circuit an obvious flood within a single instance without a
      // Redis round-trip once the window is known-exhausted here.
      ephemeralCache: new Map(),
    });
    limiters.set(key, limiter);
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
 * Fails OPEN — returns `null` (allow) when the store is unconfigured or a
 * limit check throws, so a limiter outage cannot take down the demo.
 */
export async function rateLimitOr429(
  req: NextRequest,
  routeId: string,
  perMinute: number,
): Promise<Response | null> {
  const limiter = limiterFor(routeId, perMinute);
  if (!limiter) {
    if (!warnedNoStore) {
      warnedNoStore = true;
      console.warn(
        "rate-limit: UPSTASH_REDIS_REST_URL/TOKEN unset — limiter is a no-op (fail-open)",
      );
    }
    return null;
  }

  try {
    const { success } = await limiter.limit(clientIp(req));
    if (!success) {
      return new Response("Too many requests", { status: 429 });
    }
    return null;
  } catch (err) {
    // Store unreachable / transient error — fail open, never block the demo.
    console.error(`rate-limit: store error for ${routeId}, failing open`, err);
    return null;
  }
}
