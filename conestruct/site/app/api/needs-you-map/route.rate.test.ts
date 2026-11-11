// #492 — the needs-you-map route's per-IP cap is 40 a minute (Ryan,
// 2026-11-10).  Tested at the route (Rule 11): the real rateLimitOr429 runs,
// and only the Upstash SDK is a stand-in, a fixed window that counts per IP
// against the cap the route asks for.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";

const h = vi.hoisted(() => ({ counts: new Map<string, number>() }));

vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static fixedWindow(n: number) {
      return { n };
    }
    private cap: number;
    private prefix: string;
    constructor(opts: { limiter: { n: number }; prefix: string }) {
      this.cap = opts.limiter.n;
      this.prefix = opts.prefix;
    }
    async limit(ip: string) {
      const key = `${this.prefix}:${ip}`;
      const used = (h.counts.get(key) ?? 0) + 1;
      h.counts.set(key, used);
      return { success: used <= this.cap };
    }
  },
}));
vi.mock("@/lib/render-proxy", () => ({
  fetchNeedsYouMap: async () =>
    new Response("img", { status: 200, headers: { "content-type": "image/jpeg" } }),
}));

import { __resetRateLimitStateForTests } from "@/lib/rate-limit";
import { POST } from "./route";

const BODY = { scenario: DEFAULT_SHOULDER, flag: "pedestrian_facility", width: 600, height: 300 };

const post = (ip: string) =>
  POST(
    new Request("http://x/api/needs-you-map", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(BODY),
    }) as never,
  );

beforeEach(() => {
  h.counts.clear();
  __resetRateLimitStateForTests();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
  __resetRateLimitStateForTests();
});

describe("#492: the needs-you-map cap", () => {
  it("allows the 40th request in a minute from one IP and refuses the 41st", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 41; i++) statuses.push((await post("1.2.3.4")).status);
    // The first refusal is the 41st request (index 40), and none came before.
    expect(statuses.indexOf(429)).toBe(40);
    expect(statuses.slice(0, 40)).toEqual(Array(40).fill(200));
  });

  it("counts each IP on its own", async () => {
    for (let i = 0; i < 41; i++) await post("1.2.3.4");
    expect((await post("5.6.7.8")).status).toBe(200);
  });
});
