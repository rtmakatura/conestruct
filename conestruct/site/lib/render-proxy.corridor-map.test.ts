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
  // #390: production answers JPEG for the satellite style (#369), so the
  // stub does too; the header reaches the caller as the backend named it.
  it("posts the scenario and the picture to /render/corridor-map and relays the image", async () => {
    answer = () =>
      new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
        status: 200,
        headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=600" },
      });
    const res = await fetchCorridorMap(DEFAULT_SHOULDER, picture);
    expect(calls[0].url).toBe("https://modal.example/render/corridor-map");
    const body = JSON.parse(String(calls[0].init.body));
    // #409: the untouched starting length rides the wire as a default.
    expect(body).toEqual({
      scenario: { ...DEFAULT_SHOULDER, guesses: { work_length: { startFt: 1000 } } },
      ...picture,
    });
    expect(JSON.stringify(body)).not.toMatch(/token/i);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("private, max-age=600");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));
  });

  it("relays a PNG as image/png", async () => {
    answer = () =>
      new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    const res = await fetchCorridorMap(DEFAULT_SHOULDER, picture);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  // #390 (Rule 10): a 200 that doesn't name its bytes is not guessed as a PNG.
  it("a 200 with no content-type is a plain failure, not relabelled image/png", async () => {
    answer = () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), { status: 200 });
    expect(answer().headers.get("content-type")).toBeNull();
    const res = await fetchCorridorMap(DEFAULT_SHOULDER, picture);
    expect(res.status).toBe(502);
    expect(res.headers.get("content-type")).not.toBe("image/png");
    expect(await res.text()).toBe("Corridor map failed");
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
