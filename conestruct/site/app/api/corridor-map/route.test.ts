// #301 piece 1 — the band aerial's proxy.  Ruling 1: "scenario in, PNG out,
// drawn on the backend, thin Next proxy."  The route checks the body's
// shape and forwards exactly the scenario and the picture asked for — it
// adds nothing (no token, no coordinate) and forwards nothing malformed.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";

const forwarded: unknown[] = [];

vi.mock("@/lib/rate-limit", () => ({ rateLimitOr429: async () => null }));
vi.mock("@/lib/render-proxy", () => ({
  fetchCorridorMap: async (scenario: unknown, picture: unknown) => {
    forwarded.push({ scenario, picture });
    return new Response("png", { status: 200, headers: { "content-type": "image/png" } });
  },
}));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(
    new Request("http://x/api/corridor-map", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
  );

beforeEach(() => {
  forwarded.length = 0;
});

describe("the corridor-map proxy", () => {
  it("forwards the scenario and the picture asked for, and relays the image", async () => {
    const res = await post({ scenario: DEFAULT_SHOULDER, stage: "laid_out", width: 600, height: 300 });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(forwarded).toEqual([
      { scenario: DEFAULT_SHOULDER, picture: { stage: "laid_out", width: 600, height: 300 } },
    ]);
  });

  it("each of the three stages is a picture it forwards", async () => {
    for (const stage of ["pin", "work", "laid_out"]) {
      expect((await post({ scenario: DEFAULT_SHOULDER, stage, width: 348, height: 250 })).status).toBe(200);
    }
    expect(forwarded).toHaveLength(3);
  });

  it("refuses a malformed request without forwarding it", async () => {
    const bad = [
      { scenario: { kind: "nope" }, stage: "pin", width: 600, height: 300 },
      { scenario: DEFAULT_SHOULDER, stage: "everything", width: 600, height: 300 },
      { scenario: DEFAULT_SHOULDER, stage: "pin", width: 2000, height: 300 },
      { scenario: DEFAULT_SHOULDER, stage: "pin", width: 600.5, height: 300 },
      { scenario: DEFAULT_SHOULDER, stage: "pin", width: 600 },
    ];
    for (const body of bad) expect((await post(body)).status).toBe(400);
    expect(forwarded).toEqual([]);
  });
});
