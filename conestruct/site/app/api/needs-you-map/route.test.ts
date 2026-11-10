// #483 ruling 1 — the needs-you map's route passes `soft: true` on, exactly,
// and nothing else that isn't asked for (the frame itself is the backend's).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";

const forwarded: unknown[] = [];

vi.mock("@/lib/rate-limit", () => ({ rateLimitOr429: async () => null }));
vi.mock("@/lib/render-proxy", () => ({
  fetchNeedsYouMap: async (scenario: unknown, picture: unknown) => {
    forwarded.push({ scenario, picture });
    return new Response("img", { status: 200, headers: { "content-type": "image/jpeg" } });
  },
}));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(
    new Request("http://x/api/needs-you-map", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
  );

const BASE = { scenario: DEFAULT_SHOULDER, flag: "pedestrian_facility", width: 600, height: 300 };

beforeEach(() => {
  forwarded.length = 0;
});

describe("the needs-you-map route", () => {
  it("forwards the full picture as before, with no soft key", async () => {
    expect((await post(BASE)).status).toBe(200);
    expect(forwarded).toEqual([
      { scenario: DEFAULT_SHOULDER, picture: { flag: "pedestrian_facility", width: 600, height: 300 } },
    ]);
  });

  it("#483: forwards soft: true when asked", async () => {
    expect((await post({ ...BASE, soft: true })).status).toBe(200);
    expect(forwarded).toEqual([
      {
        scenario: DEFAULT_SHOULDER,
        picture: { flag: "pedestrian_facility", width: 600, height: 300, soft: true },
      },
    ]);
  });

  it("#483: soft: false is the full picture; anything else is refused", async () => {
    expect((await post({ ...BASE, soft: false })).status).toBe(200);
    expect(forwarded[0]).toEqual({
      scenario: DEFAULT_SHOULDER,
      picture: { flag: "pedestrian_facility", width: 600, height: 300 },
    });
    for (const soft of ["yes", 1, null]) {
      expect((await post({ ...BASE, soft })).status).toBe(400);
    }
    expect(forwarded).toHaveLength(1);
  });
});
