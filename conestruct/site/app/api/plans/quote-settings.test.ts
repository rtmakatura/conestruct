// #202 — the quote settings travel with the plan: POST and PUT store them
// (bounded by coerceQuoteSettings, as every render route bounds them), and
// the row-backed quote route prices with them.  Auth and the database are
// mocked; the assertions read what would be written or sent.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  inserted: null as Record<string, unknown> | null,
  updated: null as Record<string, unknown> | null,
  row: null as Record<string, unknown> | null,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "u1", orgId: "o1" })),
}));

vi.mock("@/db", () => {
  const chain = (result: () => unknown) => {
    const c: Record<string, unknown> = {};
    for (const k of ["from", "where", "limit", "set", "values"]) {
      c[k] = (arg: unknown) => {
        if (k === "values") db.inserted = arg as Record<string, unknown>;
        if (k === "set") db.updated = arg as Record<string, unknown>;
        return c;
      };
    }
    c.returning = async () => [result()];
    c.then = (res: (v: unknown) => unknown) => Promise.resolve([result()]).then(res);
    return c;
  };
  return {
    getDb: () => ({
      insert: () => chain(() => ({ id: "p1", name: "Plan A" })),
      update: () => chain(() => ({ id: "p1", name: "Plan A" })),
      select: () =>
        chain(() => db.row ?? { acceptedTermsAt: new Date("2026-10-01T00:00:00Z") }),
    }),
    plans: { id: "id", companyId: "company_id" },
    users: { id: "id", acceptedTermsAt: "accepted_terms_at" },
  };
});

import { POST } from "./route";
import { PUT } from "./[id]/route";
import { proxyRender } from "@/lib/render-proxy";
import { DEFAULT_QUOTE_SETTINGS } from "@/lib/quote-settings";
import { DEFAULT_SCENARIO } from "@/lib/scenarios";

const ID = "0b6a1f2e-6d7c-4f1e-9a55-2b1d3c4e5f60";
const req = (body: unknown) =>
  new Request("http://x/api/plans", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  db.inserted = db.updated = db.row = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("plan routes store the quote settings (#202)", () => {
  it("POST stores them coerced (a rate past its bound is clamped)", async () => {
    const res = await POST(
      req({
        name: "Plan A",
        data: DEFAULT_SCENARIO,
        quoteSettings: { ...DEFAULT_QUOTE_SETTINGS, overhead_pct: 0.2, flagger_hourly_rate: 9999 },
      }),
    );
    expect(res.status).toBe(201);
    expect(db.inserted?.quoteSettings).toEqual({
      ...DEFAULT_QUOTE_SETTINGS,
      overhead_pct: 0.2,
      flagger_hourly_rate: 500,
    });
  });

  it("POST without them leaves the column null", async () => {
    await POST(req({ name: "Plan A", data: DEFAULT_SCENARIO }));
    expect(db.inserted?.quoteSettings).toBeNull();
  });

  it("PUT stores them, alone or beside the scenario", async () => {
    const res = await PUT(req({ quoteSettings: { ...DEFAULT_QUOTE_SETTINGS, profit_pct: 0.15 } }), {
      params: { id: ID },
    });
    expect(res.status).toBe(200);
    expect(db.updated?.quoteSettings).toEqual({ ...DEFAULT_QUOTE_SETTINGS, profit_pct: 0.15 });
  });

  it("PUT without them leaves the stored settings alone", async () => {
    await PUT(req({ name: "Plan A", data: DEFAULT_SCENARIO }), { params: { id: ID } });
    expect(db.updated && "quoteSettings" in db.updated).toBe(false);
  });
});

describe("the row-backed quote prices with the saved settings (#202)", () => {
  function upstream() {
    const sent: unknown[] = [];
    vi.stubEnv("MODAL_RENDER_URL", "https://modal.example");
    vi.stubEnv("MODAL_RENDER_SECRET", "s");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)));
        return new Response("xlsx", { status: 200 });
      }),
    );
    return sent;
  }

  it("the quote sends the row's settings", async () => {
    const sent = upstream();
    db.row = {
      id: ID,
      name: "Plan A",
      data: DEFAULT_SCENARIO,
      quoteSettings: { ...DEFAULT_QUOTE_SETTINGS, overhead_pct: 0.2 },
    };
    await proxyRender(ID, "quote");
    expect((sent[0] as { settings: unknown }).settings).toEqual({
      ...DEFAULT_QUOTE_SETTINGS,
      overhead_pct: 0.2,
    });
  });

  it("a row with no saved settings prices at the defaults", async () => {
    const sent = upstream();
    db.row = { id: ID, name: "Plan A", data: DEFAULT_SCENARIO, quoteSettings: null };
    await proxyRender(ID, "quote");
    expect((sent[0] as { settings: unknown }).settings).toEqual(DEFAULT_QUOTE_SETTINGS);
  });

  it("other kinds send the scenario alone, as before", async () => {
    const sent = upstream();
    db.row = {
      id: ID,
      name: "Plan A",
      data: DEFAULT_SCENARIO,
      quoteSettings: { ...DEFAULT_QUOTE_SETTINGS, overhead_pct: 0.2 },
    };
    await proxyRender(ID, "pdf");
    expect(sent[0]).not.toHaveProperty("settings");
  });
});
