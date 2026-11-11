// #447 — the needs-you map's proxy (Rule 11: at the layer that could lose the
// two headers the card reads).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({}) }));
vi.mock("@/db", () => ({ getDb: () => ({}), plans: {} }));

import { fetchNeedsYouMap } from "./render-proxy";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";

const PICTURE = { flag: "pedestrian_facility", width: 800, height: 400 };

beforeEach(() => {
  vi.stubEnv("MODAL_RENDER_URL", "https://modal.example");
  vi.stubEnv("MODAL_RENDER_SECRET", "s");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fetchNeedsYouMap", () => {
  it("#493: sends the tap's cross-street line on meta.intersection as it was written", async () => {
    const f = vi.fn(async () => new Response("img", { status: 200, headers: { "content-type": "image/jpeg" } }));
    vi.stubGlobal("fetch", f);
    const geometry: Array<[number, number]> = [
      [39.7395, -104.96836],
      [39.7404, -104.96835],
    ];
    const intersection = { lat: 39.74, lng: -104.968, name: "Franklin Street", geometry };
    await fetchNeedsYouMap(
      { ...DEFAULT_SHOULDER, meta: { ...DEFAULT_SHOULDER.meta, intersection } },
      { ...PICTURE, flag: "adjacent_intersection" },
    );
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).scenario.meta.intersection).toEqual(intersection);
  });


  it("posts the scenario and the picture, and relays the bytes and both headers", async () => {
    const f = vi.fn(
      async () =>
        new Response("img", {
          status: 200,
          headers: {
            "content-type": "image/jpeg",
            "x-map-subject": "drawn",
            "x-map-point": "39.74,-104.97",
            "x-map-frame": "39.740000,-104.970000,18.00",
            "x-map-cross-street": "Franklin%20Street",
            "x-map-cross-tag": "312,16",
            "x-map-cross-source": "tap",
          },
        }),
    );
    vi.stubGlobal("fetch", f);
    const r = await fetchNeedsYouMap(DEFAULT_SHOULDER, PICTURE);
    // #483: the frame both images were framed on, relayed as it came.
    expect(r.headers.get("x-map-frame")).toBe("39.740000,-104.970000,18.00");
    // #484: the cross street's name and its tag's place, relayed as they came.
    expect(r.headers.get("x-map-cross-street")).toBe("Franklin%20Street");
    expect(r.headers.get("x-map-cross-tag")).toBe("312,16");
    // #493: which path drew it, relayed for the checks.
    expect(r.headers.get("x-map-cross-source")).toBe("tap");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://modal.example/render/needs-you-map");
    expect(JSON.parse(init.body as string)).toMatchObject(PICTURE);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/jpeg");
    expect(r.headers.get("x-map-subject")).toBe("drawn");
    expect(r.headers.get("x-map-point")).toBe("39.74,-104.97");
    expect(await r.text()).toBe("img");
  });

  it("relays a JSON refusal as it came, and never invents a header", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response('{"status":"no_pin"}', {
            status: 409,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    const r = await fetchNeedsYouMap(DEFAULT_SHOULDER, PICTURE);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ status: "no_pin" });
    expect(r.headers.get("x-map-subject")).toBeNull();
  });

  it("a 200 that names no format is refused, not guessed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1]), { status: 200 })));
    const r = await fetchNeedsYouMap(DEFAULT_SHOULDER, PICTURE);
    expect(r.status).toBe(502);
  });
});
