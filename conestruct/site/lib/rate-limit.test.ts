// #145 guards.  The anonymous render/geocode surface is bounded by a shared
// Upstash limiter, but the sandbox is the top-of-funnel demo — so a limiter
// outage (store unreachable, or env vars simply unset) must FAIL OPEN and let
// the request through, never 429 the demo.  These pin both halves of that
// contract: over-limit → 429, and every failure mode → allow.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Controllable stand-in for `Ratelimit.limit()`.  `vi.hoisted` so the mock
// factory (hoisted above imports) can close over it.
const h = vi.hoisted(() => ({
  limit: async (_key: string): Promise<{ success: boolean }> => ({
    success: true,
  }),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(_opts: unknown) {}
  },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static fixedWindow() {
      return {};
    }
    constructor(_opts: unknown) {}
    limit(key: string) {
      return h.limit(key);
    }
  },
}));

// Minimal NextRequest stand-in — the helper only reads two headers off it.
function fakeReq(ip = "1.2.3.4"): import("next/server").NextRequest {
  return {
    headers: {
      get: (k: string) => (k === "x-forwarded-for" ? ip : null),
    },
  } as unknown as import("next/server").NextRequest;
}

// The module holds a load-time singleton Redis client, so each test must
// re-import it fresh after stubbing env / resetting the mock.
async function freshHelper() {
  vi.resetModules();
  return import("./rate-limit");
}

const CONFIGURED = {
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "test-token",
};

beforeEach(() => {
  h.limit = async () => ({ success: true });
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("rateLimitOr429 — fail-open contract (#145)", () => {
  it("allows (returns null) when the store is UNCONFIGURED, no matter how many calls", async () => {
    // No UPSTASH_* env → makeRedis() returns null → limiter is a no-op.
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { rateLimitOr429 } = await freshHelper();

    for (let i = 0; i < 50; i++) {
      const res = await rateLimitOr429(fakeReq(), "geocode", 1);
      expect(res).toBeNull();
    }
  });

  it("allows (returns null) when the store THROWS — never blocks the demo", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", CONFIGURED.UPSTASH_REDIS_REST_URL);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", CONFIGURED.UPSTASH_REDIS_REST_TOKEN);
    h.limit = async () => {
      throw new Error("upstash unreachable");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { rateLimitOr429 } = await freshHelper();

    const res = await rateLimitOr429(fakeReq(), "render-bundle", 10);
    expect(res).toBeNull();
  });

  it("returns a 429 when configured AND the limiter reports over-cap", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", CONFIGURED.UPSTASH_REDIS_REST_URL);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", CONFIGURED.UPSTASH_REDIS_REST_TOKEN);
    h.limit = async () => ({ success: false });
    const { rateLimitOr429 } = await freshHelper();

    const res = await rateLimitOr429(fakeReq(), "render-bundle", 10);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(429);
  });

  it("allows (returns null) when configured and under cap", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", CONFIGURED.UPSTASH_REDIS_REST_URL);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", CONFIGURED.UPSTASH_REDIS_REST_TOKEN);
    h.limit = async () => ({ success: true });
    const { rateLimitOr429 } = await freshHelper();

    const res = await rateLimitOr429(fakeReq(), "render-bundle", 10);
    expect(res).toBeNull();
  });
});
