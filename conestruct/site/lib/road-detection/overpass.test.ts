// #405 — the road lookup's Overpass race (lib/road-detection/overpass.ts).
// The route-level outcomes (a 4xx/429/remark on one mirror, a stalled
// mirror) are pinned in app/api/road-bearing/route.test.ts, where the bug
// lived; this file pins the race's own rules: the deadline, the 429 rest,
// the client abort, the per-mirror log line, and the mirror list matching
// the backend's.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OVERPASS_DEADLINE_MS,
  OVERPASS_MIRRORS,
  RATE_LIMIT_COOLDOWN_MS,
  overpassRace,
  resetMirrorRest,
} from "./overpass";

const [DE, FR] = OVERPASS_MIRRORS;

type Script = (init: { signal: AbortSignal }) => Promise<unknown>;
let scripts: Map<string, Script>;
let fetchMock: ReturnType<typeof vi.fn>;
let logs: string[];

function hang(init: { signal: AbortSignal }): Promise<unknown> {
  return new Promise((_resolve, reject) =>
    init.signal.addEventListener("abort", () =>
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" })),
    ),
  );
}

function answer(body: unknown, status = 200, headers: Record<string, string> = {}): Script {
  return async () => new Response(JSON.stringify(body), { status, headers });
}

beforeEach(() => {
  resetMirrorRest();
  scripts = new Map();
  logs = [];
  vi.spyOn(console, "info").mockImplementation((line: string) => {
    logs.push(line);
  });
  fetchMock = vi.fn(async (url: string, init: { signal: AbortSignal }) => {
    const s = scripts.get(url);
    if (!s) throw new TypeError("fetch failed");
    return s(init);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("overpassRace (#405)", () => {
  it("asks every mirror at once, before any answers", async () => {
    scripts.set(DE, hang);
    scripts.set(FR, hang);
    vi.useFakeTimers();
    const p = overpassRace("q", undefined, "roads");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([DE, FR]);
    await vi.advanceTimersByTimeAsync(OVERPASS_DEADLINE_MS);
    await expect(p).resolves.toBeNull();
  });

  it("past the deadline it gives up with null and aborts every request", async () => {
    scripts.set(DE, hang);
    scripts.set(FR, hang);
    vi.useFakeTimers();
    const p = overpassRace("q", undefined, "roads");
    await vi.advanceTimersByTimeAsync(OVERPASS_DEADLINE_MS - 1);
    let settled = false;
    void p.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBeNull();
    for (const c of fetchMock.mock.calls) {
      expect((c[1] as { signal: AbortSignal }).signal.aborted).toBe(true);
    }
    const line = JSON.parse(logs.at(-1)!);
    expect(line.winner).toBeNull();
    expect(line.mirrors.map((m: { outcome: string }) => m.outcome)).toEqual([
      `no answer in ${OVERPASS_DEADLINE_MS} ms`,
      `no answer in ${OVERPASS_DEADLINE_MS} ms`,
    ]);
  });

  it("the deadline is CHOSEN at the query's own [timeout:10]", () => {
    expect(OVERPASS_DEADLINE_MS).toBe(10_000);
  });

  it("logs one line per round trip with every mirror's time and outcome", async () => {
    scripts.set(DE, answer({}, 502));
    scripts.set(FR, answer({ elements: [] }));
    const payload = await overpassRace("q", undefined, "geometry");
    expect(payload).toEqual({ elements: [] });
    expect(logs).toHaveLength(1);
    const line = JSON.parse(logs[0]);
    expect(line).toMatchObject({
      event: "overpass",
      route: "road-bearing",
      trip: "geometry",
      winner: "overpass.openstreetmap.fr",
    });
    expect(line.mirrors).toEqual([
      { mirror: "overpass-api.de", ms: expect.any(Number), outcome: "HTTP 502" },
      { mirror: "overpass.openstreetmap.fr", ms: expect.any(Number), outcome: "answered" },
    ]);
  });

  it("a 429 rests that mirror for its Retry-After; the next trip doesn't ask it", async () => {
    scripts.set(DE, answer({}, 429, { "retry-after": "30" }));
    scripts.set(FR, answer({ elements: [] }));
    await overpassRace("q", undefined, "roads");
    expect(JSON.parse(logs[0]).mirrors[0].outcome).toBe("429 rate-limited (rested 30 s)");

    fetchMock.mockClear();
    await overpassRace("q", undefined, "geometry");
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([FR]);
    expect(JSON.parse(logs[1]).mirrors[0]).toEqual({
      mirror: "overpass-api.de",
      ms: null,
      outcome: "rested after a 429, 30 s more",
    });
  });

  it("without a Retry-After the rest is RATE_LIMIT_COOLDOWN_MS, then the mirror is asked again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    scripts.set(DE, answer({}, 429));
    scripts.set(FR, answer({ elements: [] }));
    await overpassRace("q", undefined, "roads");
    fetchMock.mockClear();
    vi.setSystemTime(Date.now() + RATE_LIMIT_COOLDOWN_MS - 1);
    await overpassRace("q", undefined, "roads");
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([FR]);
    fetchMock.mockClear();
    vi.setSystemTime(Date.now() + 1);
    await overpassRace("q", undefined, "roads");
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([DE, FR]);
  });

  it("a client abort throws AbortError and aborts every request", async () => {
    scripts.set(DE, hang);
    scripts.set(FR, hang);
    const client = new AbortController();
    const p = overpassRace("q", client.signal, "roads");
    client.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    for (const c of fetchMock.mock.calls) {
      expect((c[1] as { signal: AbortSignal }).signal.aborted).toBe(true);
    }
  });

  it("invalid JSON is that mirror's failure", async () => {
    scripts.set(DE, async () => new Response("<html>busy</html>", { status: 200 }));
    scripts.set(FR, answer({ elements: [] }));
    await expect(overpassRace("q", undefined, "roads")).resolves.toEqual({ elements: [] });
    expect(JSON.parse(logs[0]).mirrors[0].outcome).toBe("invalid JSON");
  });

  it("sends the query form-encoded with the identifying User-Agent", async () => {
    scripts.set(DE, answer({ elements: [] }));
    await overpassRace('[out:json];way["name"="A & B"];', undefined, "roads");
    const init = fetchMock.mock.calls[0][1] as { body: string; headers: Record<string, string> };
    expect(init.body).toBe(`data=${encodeURIComponent('[out:json];way["name"="A & B"];')}`);
    expect(init.headers["user-agent"]).toMatch(/^conestruct-traffic-control-tool\//);
  });
});

describe("one mirror list with the backend (#405)", () => {
  // The scan's list (src/rules/site_detection.py OVERPASS_MIRRORS, #292
  // R70) and the road lookup's are the same public mirrors in the same
  // order.  The route had drifted to its own three-mirror chain; this
  // fails if the two lists part again.
  it("matches site_detection.py's OVERPASS_MIRRORS", () => {
    const py = readFileSync(
      resolve(__dirname, "../../../../src/rules/site_detection.py"),
      "utf-8",
    );
    const block = py.match(/^OVERPASS_MIRRORS[^=]*=\s*\(([\s\S]*?)^\)/m);
    expect(block).not.toBeNull();
    const backend = [...block![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(OVERPASS_MIRRORS).toEqual(backend);
  });
});
