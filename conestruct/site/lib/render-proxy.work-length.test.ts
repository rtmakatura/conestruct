// #409 — the defaulted work-zone length rides the outgoing wire (Rule 11:
// tested at the proxy, where the payload is built).  While the length is
// the session's starting 1,000 ft and the operator never entered one
// (`workLenIsDefault`), every upstream POST carries
// `guesses.work_length = { startFt: 1000 }`, and the backend lists the
// length in the audit as defaulted, not confirmed.  An entered length
// carries nothing, and a stale entry in state never reaches the wire.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({}) }));
vi.mock("@/db", () => ({ getDb: () => ({}), plans: {} }));

import {
  fetchAllRenderParts,
  fetchAuditTrail,
  fetchCorridorGeometry,
  renderScenarioToResponse,
} from "./render-proxy";
import { DEFAULT_QUOTE_SETTINGS } from "@/lib/quote-settings";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios";

type Body = { guesses?: Record<string, unknown> } & Record<string, unknown>;

function sentBodies(fetchMock: ReturnType<typeof vi.fn>): Body[] {
  return fetchMock.mock.calls.map(([, init]) => {
    const parsed = JSON.parse((init as RequestInit).body as string) as Body & {
      scenario?: Body;
    };
    return parsed.scenario ?? parsed;
  });
}

function okFetch() {
  return vi.fn(() =>
    Promise.resolve(
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    ),
  );
}

const ENTERED = {
  ...DEFAULT_SHOULDER,
  meta: { ...DEFAULT_SHOULDER.meta, operatorSet: ["workLen"] },
} as Scenario;

describe("the defaulted length on the wire (#409)", () => {
  beforeEach(() => {
    vi.stubEnv("MODAL_RENDER_URL", "https://modal.test");
    vi.stubEnv("MODAL_RENDER_SECRET", "secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("the audit request carries it while the length is the untouched start", async () => {
    const f = okFetch();
    vi.stubGlobal("fetch", f);
    await fetchAuditTrail(DEFAULT_SHOULDER);
    expect(sentBodies(f)[0].guesses).toEqual({ work_length: { startFt: 1000 } });
  });

  it("the PDF and the corridor read carry it too", async () => {
    const f = okFetch();
    vi.stubGlobal("fetch", f);
    await renderScenarioToResponse(DEFAULT_SHOULDER, "audit-pdf");
    await fetchCorridorGeometry(DEFAULT_SHOULDER);
    for (const body of sentBodies(f)) {
      expect(body.guesses).toEqual({ work_length: { startFt: 1000 } });
    }
  });

  it("the zipped bundle parts carry it", async () => {
    const f = vi.fn(() => Promise.resolve(new Response(new Uint8Array([1]), { status: 200 })));
    vi.stubGlobal("fetch", f);
    await fetchAllRenderParts(DEFAULT_SHOULDER, DEFAULT_QUOTE_SETTINGS).catch(() => undefined);
    expect(f.mock.calls.length).toBeGreaterThan(0);
    for (const body of sentBodies(f)) {
      expect(body.guesses).toEqual({ work_length: { startFt: 1000 } });
    }
  });

  it("an entered length carries nothing, even at 1,000 ft", async () => {
    const f = okFetch();
    vi.stubGlobal("fetch", f);
    await fetchAuditTrail(ENTERED);
    expect(sentBodies(f)[0]).not.toHaveProperty("guesses");
  });

  it("a length away from the start carries nothing", async () => {
    const f = okFetch();
    vi.stubGlobal("fetch", f);
    await fetchAuditTrail({ ...DEFAULT_SHOULDER, workLen: 600 } as Scenario);
    expect(sentBodies(f)[0]).not.toHaveProperty("guesses");
  });

  it("keeps the other guesses, and drops a stale entry from state", async () => {
    const f = okFetch();
    vi.stubGlobal("fetch", f);
    const guessed = {
      ...ENTERED,
      guesses: { speed: { highwayClass: "trunk" }, work_length: { startFt: 1000 } },
    } as Scenario;
    await fetchAuditTrail(guessed);
    await fetchAuditTrail({ ...guessed, meta: DEFAULT_SHOULDER.meta } as Scenario);
    const [entered, untouched] = sentBodies(f);
    expect(entered.guesses).toEqual({ speed: { highwayClass: "trunk" } });
    expect(untouched.guesses).toEqual({
      speed: { highwayClass: "trunk" },
      work_length: { startFt: 1000 },
    });
  });
});
