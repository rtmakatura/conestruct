// #301 piece 1 — fetchCorridorMap relays the band's aerial.  The backend
// draws it and holds the Mapbox token; the site sends the scenario (with
// the confirmed road relayed, as every upstream POST does) and the picture
// asked for, and relays the bytes — or the backend's own worded refusal.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// render-proxy also exports the saved-plan proxy, which imports Clerk and
// the DB client — unresolvable under vitest's node environment (the same
// two mocks as render-proxy.validation.test.ts).
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({}) }));
vi.mock("@/db", () => ({ getDb: () => ({}), plans: {} }));

import { fetchCorridorMap } from "./render-proxy";
import { DEFAULT_SHOULDER } from "./scenarios";

const calls: { url: string; init: RequestInit }[] = [];
let answer: () => Response;

beforeEach(() => {
  calls.length = 0;
  vi.stubEnv("MODAL_RENDER_URL", "https://modal.example/");
  vi.stubEnv("MODAL_RENDER_SECRET", "s3cret");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return answer();
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const picture = { stage: "laid_out" as const, width: 600, height: 300 };

describe("fetchCorridorMap", () => {
  it("posts the scenario and the picture to /render/corridor-map and relays the PNG", async () => {
    answer = () =>
      new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { "content-type": "image/png", "cache-control": "private, max-age=600" },
      });
    const res = await fetchCorridorMap(DEFAULT_SHOULDER, picture);
    expect(calls[0].url).toBe("https://modal.example/render/corridor-map");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toEqual({ scenario: DEFAULT_SHOULDER, ...picture });
    expect(JSON.stringify(body)).not.toMatch(/token/i);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("private, max-age=600");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
  });

  it("relays the backend's worded refusal (409 / 502 / 503) as-is", async () => {
    for (const [status, body] of [
      [409, { status: "corridor_unbuildable", message: "ValueError: no road" }],
      [502, { status: "unavailable", message: "the aerial image could not be fetched" }],
      [503, { status: "unavailable", message: "no map token configured" }],
    ] as const) {
      answer = () =>
        new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
      const res = await fetchCorridorMap(DEFAULT_SHOULDER, picture);
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual(body);
    }
  });

  it("anything else is a plain failure", async () => {
    answer = () => new Response("boom", { status: 500 });
    expect((await fetchCorridorMap(DEFAULT_SHOULDER, picture)).status).toBe(502);
  });

  it("without the render service configured, says so", async () => {
    vi.stubEnv("MODAL_RENDER_URL", "");
    expect((await fetchCorridorMap(DEFAULT_SHOULDER, picture)).status).toBe(503);
    expect(calls).toHaveLength(0);
  });
});
