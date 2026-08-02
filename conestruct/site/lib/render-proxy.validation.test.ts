// #184 — the proxy's validation passthrough (Rule 11: tested at the
// proxy/response layer, where the bug lived).  A backend 422 must reach
// the client as the 400-with-message shape the PLAN DECLINED path
// consumes — never as a 502 outage.  Fixtures are the LIVE captures from
// the Arc 3 investigation (validation-artifacts/committed/
// arc3-error-honesty/): the deployed backend's actual 422 bodies for the
// issue's 4-lanes-x-14-ft reproduction and for a wrong-enum payload.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// render-proxy also exports the saved-plan proxy, which imports Clerk and
// the DB client — irrelevant here and unresolvable under vitest's node
// environment.  Mock both module boundaries.
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({}) }));
vi.mock("@/db", () => ({ getDb: () => ({}), plans: {} }));

import {
  fetchAuditTrail,
  fetchDeviceBreakdown,
  fetchQuoteBreakdown,
  renderScenarioToResponse,
  validationPassthrough,
} from "./render-proxy";
import { DEFAULT_QUOTE_SETTINGS } from "@/lib/quote-settings";
import type { Scenario } from "@/lib/scenarios";

// Live capture 2026-08-02, Modal /render/audit, shoulder 4 lanes x 14 ft
// (repro-422 output; healthz 217a641).
const LIVE_422_DRAWABLE_WIDTH = JSON.stringify({
  detail: [
    {
      type: "value_error",
      loc: ["body", "shoulder"],
      msg:
        "Value error, 4 lanes x 14.0 ft + 8 ft shoulder = 64.0 ft exceeds " +
        "the plan sheet's drawable half-road (52 ft) — use a lane width of " +
        "11.0 ft or less, or reduce the lane count.",
      input: {},
      ctx: { error: {} },
    },
  ],
});

// Live capture, same endpoint, wrong enum literals (two detail entries).
const LIVE_422_TWO_ERRORS = JSON.stringify({
  detail: [
    {
      type: "literal_error",
      loc: ["body", "shoulder", "workType"],
      msg: "Input should be 'utility_locate', 'survey', 'signal_cabinet', 'guardrail' or 'other'",
      input: "patching_pothole",
    },
    {
      type: "literal_error",
      loc: ["body", "shoulder", "duration"],
      msg: "Input should be 'short' or 'long'",
      input: "short_duration",
    },
  ],
});

const SCENARIO = { kind: "shoulder", meta: {} } as unknown as Scenario;

function upstream(status: number, body: string): Promise<Response> {
  return Promise.resolve(
    new Response(body, {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("validationPassthrough (#184)", () => {
  it("forwards a 400 body-intact", async () => {
    const res = validationPassthrough(400, '{"detail": "gate says no"}');
    expect(res?.status).toBe(400);
    expect(await res?.text()).toBe('{"detail": "gate says no"}');
  });

  it("translates the live drawable-width 422 to a 400 with the validator's own sentence", async () => {
    const res = validationPassthrough(422, LIVE_422_DRAWABLE_WIDTH);
    expect(res?.status).toBe(400);
    const body = (await res?.json()) as { detail: string };
    // "Value error, " prefix stripped; the actionable message survives.
    expect(body.detail).toBe(
      "4 lanes x 14.0 ft + 8 ft shoulder = 64.0 ft exceeds the plan " +
        "sheet's drawable half-road (52 ft) — use a lane width of 11.0 ft " +
        "or less, or reduce the lane count.",
    );
  });

  it("joins multiple 422 detail entries into one message", async () => {
    const res = validationPassthrough(422, LIVE_422_TWO_ERRORS);
    expect(res?.status).toBe(400);
    const body = (await res?.json()) as { detail: string };
    expect(body.detail).toContain("'utility_locate'");
    expect(body.detail).toContain(" · ");
    expect(body.detail).toContain("'short' or 'long'");
  });

  it("returns null for 5xx and for an unparseable 422 — those stay honest 502s", () => {
    expect(validationPassthrough(500, "render failed: boom")).toBeNull();
    expect(validationPassthrough(502, "")).toBeNull();
    expect(validationPassthrough(422, "not json")).toBeNull();
    expect(validationPassthrough(422, '{"detail": []}')).toBeNull();
    expect(validationPassthrough(422, '{"detail": "plain"}')).toBeNull();
  });
});

describe("proxy fetchers route 422s onto the 400 path (#184)", () => {
  beforeEach(() => {
    vi.stubEnv("MODAL_RENDER_URL", "https://modal.test");
    vi.stubEnv("MODAL_RENDER_SECRET", "secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const cases: [string, (s: Scenario) => Promise<Response>][] = [
    ["fetchAuditTrail", (s) => fetchAuditTrail(s)],
    ["fetchDeviceBreakdown", (s) => fetchDeviceBreakdown(s)],
    [
      "fetchQuoteBreakdown",
      (s) => fetchQuoteBreakdown(s, DEFAULT_QUOTE_SETTINGS),
    ],
    ["renderScenarioToResponse", (s) => renderScenarioToResponse(s, "pdf")],
  ];

  for (const [name, call] of cases) {
    it(`${name}: upstream 422 → 400 with the validation message`, async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => upstream(422, LIVE_422_DRAWABLE_WIDTH)),
      );
      const res = await call(SCENARIO);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { detail: string };
      expect(body.detail).toContain("drawable half-road");
      expect(body.detail).not.toContain("Value error");
    });

    it(`${name}: upstream 500 stays a 502 outage`, async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => upstream(500, "render failed: boom")),
      );
      const res = await call(SCENARIO);
      expect(res.status).toBe(502);
    });
  }

  it("fetchQuoteBreakdown: upstream 400 now forwards its body (was a 502)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => upstream(400, '{"detail": "gate says no"}')),
    );
    const res = await fetchQuoteBreakdown(SCENARIO, DEFAULT_QUOTE_SETTINGS);
    expect(res.status).toBe(400);
    expect(await res.text()).toBe('{"detail": "gate says no"}');
  });
});
