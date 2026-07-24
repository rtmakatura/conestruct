// #145 guards.  The anonymous render/geocode surface is bounded by a shared
// Upstash limiter, but the sandbox is the top-of-funnel demo — so a limiter
// problem must FAIL OPEN and let the request through, never take a route down.
//
// The centerpiece here is the CONSTRUCTOR-THROW test: the original build ran
// `new Redis()` at module-load time, so a malformed env var (e.g. a URL saved
// WITH surrounding quotes) threw during import and 500'd every route — the
// per-request fail-open never engaged.  That exact case shipped broken and is
// pinned below.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Controllable stand-ins for the Upstash SDK, resolved through vi.hoisted so
// the (hoisted) mock factories can close over them.
const h = vi.hoisted(() => ({
  redisCtor: (_opts: { url: string; token: string }): void => {},
  limit: async (_key: string): Promise<{ success: boolean }> => ({
    success: true,
  }),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(opts: { url: string; token: string }) {
      h.redisCtor(opts);
    }
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

import {
  rateLimitOr429,
  sanitizeEnv,
  __resetRateLimitStateForTests,
} from "./rate-limit";

function fakeReq(ip = "1.2.3.4"): import("next/server").NextRequest {
  return {
    headers: {
      get: (k: string) => (k === "x-forwarded-for" ? ip : null),
    },
  } as unknown as import("next/server").NextRequest;
}

const VALID = {
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "test-token",
};

function stubValidEnv() {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", VALID.UPSTASH_REDIS_REST_URL);
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", VALID.UPSTASH_REDIS_REST_TOKEN);
}

beforeEach(() => {
  h.redisCtor = () => {};
  h.limit = async () => ({ success: true });
  __resetRateLimitStateForTests();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  __resetRateLimitStateForTests();
});

describe("rateLimitOr429 — fail-open contract (#145)", () => {
  it("fails open (returns null) when the Upstash CONSTRUCTOR THROWS — the #145 regression, never 500s the route", async () => {
    // Models the synchronous UrlError the real Redis constructor raises on a
    // malformed URL (e.g. one saved with surrounding quotes).
    stubValidEnv();
    h.redisCtor = () => {
      throw new Error(
        "Upstash Redis client was passed an invalid URL. You should pass a URL starting with https.",
      );
    };
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(rateLimitOr429(fakeReq(), "road-bearing", 30)).resolves.toBeNull();
  });

  it("allows (returns null) when the store is UNCONFIGURED, no matter how many calls", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    for (let i = 0; i < 50; i++) {
      expect(await rateLimitOr429(fakeReq(), "geocode", 1)).toBeNull();
    }
  });

  it("allows (returns null) when the .limit() call THROWS — store unreachable", async () => {
    stubValidEnv();
    h.limit = async () => {
      throw new Error("upstash unreachable");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await rateLimitOr429(fakeReq(), "render-bundle", 10)).toBeNull();
  });

  it("returns a 429 when configured AND the limiter reports over-cap", async () => {
    stubValidEnv();
    h.limit = async () => ({ success: false });
    const res = await rateLimitOr429(fakeReq(), "render-bundle", 10);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(429);
  });

  it("allows (returns null) when configured and under cap", async () => {
    stubValidEnv();
    h.limit = async () => ({ success: true });
    expect(await rateLimitOr429(fakeReq(), "render-bundle", 10)).toBeNull();
  });
});

describe("sanitize-and-work — a quoted env yields a FUNCTIONING limiter (#145)", () => {
  it("strips surrounding quotes before constructing, so the limiter still enforces", async () => {
    // Env saved WITH quotes — the exact confound that broke the ship.
    vi.stubEnv("UPSTASH_REDIS_REST_URL", `"${VALID.UPSTASH_REDIS_REST_URL}"`);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", `"${VALID.UPSTASH_REDIS_REST_TOKEN}"`);
    const seen: Array<{ url: string; token: string }> = [];
    h.redisCtor = (opts) => {
      seen.push(opts);
    };
    h.limit = async () => ({ success: false }); // prove enforcement is live

    const res = await rateLimitOr429(fakeReq(), "geocode", 40);

    // Construction happened with the UNQUOTED values...
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe(VALID.UPSTASH_REDIS_REST_URL);
    expect(seen[0].token).toBe(VALID.UPSTASH_REDIS_REST_TOKEN);
    // ...and the limiter actually enforces (not silently disabled).
    expect(res?.status).toBe(429);
  });
});

describe("sanitizeEnv", () => {
  it("strips matched double quotes", () => {
    expect(sanitizeEnv('"https://x.io"')).toBe("https://x.io");
  });
  it("strips matched single quotes", () => {
    expect(sanitizeEnv("'https://x.io'")).toBe("https://x.io");
  });
  it("trims surrounding whitespace", () => {
    expect(sanitizeEnv("  https://x.io  ")).toBe("https://x.io");
  });
  it("trims inside stripped quotes too", () => {
    expect(sanitizeEnv('" https://x.io "')).toBe("https://x.io");
  });
  it("leaves a clean value untouched", () => {
    expect(sanitizeEnv("https://x.io")).toBe("https://x.io");
  });
  it("returns undefined for empty / missing", () => {
    expect(sanitizeEnv("")).toBeUndefined();
    expect(sanitizeEnv("   ")).toBeUndefined();
    expect(sanitizeEnv(undefined)).toBeUndefined();
  });
  it("does not strip an unmatched leading quote", () => {
    expect(sanitizeEnv('"https://x.io')).toBe('"https://x.io');
  });
});
