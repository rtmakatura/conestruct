// The coming-soon gate's route table (rulings.md R1.2-R1.4, C-Q1-C-Q4).
//
// The table below IS the spec: every page and route handler in app/,
// crossed with the five identities the gate distinguishes, and the
// response each must get.  It drives the real middleware.ts default
// export — Clerk is mocked at the module boundary only, so the gate's
// own decision code runs as shipped (Rule 11: test where the bug lives).
//
// Precedent for the mock boundary: lib/render-proxy.bundle.test.ts:12.

import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GATE_HEADER = "x-conestruct-gate";
const TOKEN = "test-bypass-token-7f3a9c";
const ALLOWED = "ryan@example.com";

type Session = {
  userId: string | null;
  orgId: string | null;
  sessionClaims: Record<string, unknown> | null;
};
const session: Session = { userId: null, orgId: null, sessionClaims: null };
const getUser = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware:
    (handler: (auth: () => Promise<unknown>, req: NextRequest) => unknown) =>
    (req: NextRequest) =>
      handler(
        async () => ({
          ...session,
          redirectToSignIn: ({ returnBackUrl }: { returnBackUrl?: string } = {}) =>
            NextResponse.redirect(
              new URL(
                `/sign-in?redirect_url=${encodeURIComponent(returnBackUrl ?? "")}`,
                req.url,
              ),
            ),
        }),
        req,
      ),
  // Today's middleware.ts builds its matchers with this; the mock keeps
  // Clerk's "(.*)" suffix semantics so the red run exercises it honestly.
  createRouteMatcher:
    (patterns: string[]) => (req: NextRequest) =>
      patterns.some((p) => new RegExp(`^${p}$`).test(req.nextUrl.pathname)),
  clerkClient: async () => ({ users: { getUser } }),
}));

const { default: middleware, config } = await import("./middleware");

// ── identities ──────────────────────────────────────────────────────────
type Identity =
  | "anonymous"
  | "bypass"
  | "bypass-wrong"
  | "allowlisted"
  | "not-allowlisted";
const IDENTITIES: Identity[] = [
  "anonymous",
  "bypass",
  "bypass-wrong",
  "allowlisted",
  "not-allowlisted",
];

function become(id: Identity) {
  session.userId = null;
  session.orgId = null;
  session.sessionClaims = null;
  if (id === "allowlisted") {
    session.userId = "user_allowed";
    session.orgId = "org_1";
    session.sessionClaims = { email: ALLOWED, email_verified: true };
  }
  if (id === "not-allowlisted") {
    session.userId = "user_stranger";
    session.orgId = "org_2";
    session.sessionClaims = { email: "stranger@example.com", email_verified: true };
  }
}

function req(p: string, method: string, id: Identity): NextRequest {
  const headers = new Headers();
  if (id === "bypass") headers.set(GATE_HEADER, TOKEN);
  if (id === "bypass-wrong") headers.set(GATE_HEADER, "not-the-token");
  return new NextRequest(new URL(p, "https://www.conestruct.com"), { method, headers });
}

async function run(p: string, method: string, id: Identity) {
  become(id);
  return (await middleware(req(p, method, id), {} as never)) as Response | undefined;
}

const passed = (res: Response | undefined) =>
  res === undefined || res.headers.get("x-middleware-next") === "1";

// ── the route table ─────────────────────────────────────────────────────
// `file` ties each row to the app/ file it serves; the completeness test
// below fails if a page or route handler exists that no row names.
type Row = { path: string; method: string; file: string };

const PUBLIC: Row[] = [
  { path: "/", method: "GET", file: "app/page.tsx" },
  { path: "/terms", method: "GET", file: "app/terms/page.tsx" },
  { path: "/privacy", method: "GET", file: "app/privacy/page.tsx" },
  { path: "/sign-in", method: "GET", file: "app/sign-in/[[...sign-in]]/page.tsx" },
  { path: "/sign-in/factor-one", method: "GET", file: "app/sign-in/[[...sign-in]]/page.tsx" },
  { path: "/api/clerk/webhook", method: "POST", file: "app/api/clerk/webhook/route.ts" },
];

const GATED_PAGES: Row[] = [
  { path: "/sandbox", method: "GET", file: "app/sandbox/page.tsx" },
  { path: "/app", method: "GET", file: "app/app/page.tsx" },
  { path: "/app/plans/new", method: "GET", file: "app/app/plans/new/page.tsx" },
  {
    path: "/app/plans/0b6a1f2e-6d7c-4f1e-9a55-2b1d3c4e5f60",
    method: "GET",
    file: "app/app/plans/[id]/page.tsx",
  },
  { path: "/onboarding", method: "GET", file: "app/onboarding/page.tsx" },
  { path: "/sign-up", method: "GET", file: "app/sign-up/[[...sign-up]]/page.tsx" },
  { path: "/sign-up/verify-email-address", method: "GET", file: "app/sign-up/[[...sign-up]]/page.tsx" },
  { path: "/debug/sentry-test", method: "GET", file: "app/debug/sentry-test/page.tsx" },
  // The archived landing (never served: next.config.mjs redirects first).
  { path: "/landing", method: "GET", file: "app/(archived)/landing/page.tsx" },
  // Default-deny: near-misses of public paths and unknown paths.
  { path: "/sign-inx", method: "GET", file: "" },
  { path: "/terms/extra", method: "GET", file: "" },
  { path: "/no-such-page", method: "GET", file: "" },
];

const PLAN = "0b6a1f2e-6d7c-4f1e-9a55-2b1d3c4e5f60";
const GATED_API: Row[] = [
  { path: "/api/corridor-map", method: "POST", file: "app/api/corridor-map/route.ts" },
  { path: "/api/debug/sentry-test", method: "GET", file: "app/api/debug/sentry-test/route.ts" },
  { path: "/api/distance", method: "POST", file: "app/api/distance/route.ts" },
  { path: "/api/geocode", method: "POST", file: "app/api/geocode/route.ts" },
  { path: "/api/jurisdiction/suggest", method: "POST", file: "app/api/jurisdiction/suggest/route.ts" },
  { path: "/api/me", method: "GET", file: "app/api/me/route.ts" },
  { path: "/api/plans", method: "POST", file: "app/api/plans/route.ts" },
  { path: `/api/plans/${PLAN}`, method: "PUT", file: "app/api/plans/[id]/route.ts" },
  { path: `/api/plans/${PLAN}`, method: "DELETE", file: "app/api/plans/[id]/route.ts" },
  { path: `/api/plans/${PLAN}/audit-pdf`, method: "GET", file: "app/api/plans/[id]/audit-pdf/route.ts" },
  { path: `/api/plans/${PLAN}/crew-pdf`, method: "GET", file: "app/api/plans/[id]/crew-pdf/route.ts" },
  { path: `/api/plans/${PLAN}/markdown`, method: "GET", file: "app/api/plans/[id]/markdown/route.ts" },
  { path: `/api/plans/${PLAN}/pdf`, method: "GET", file: "app/api/plans/[id]/pdf/route.ts" },
  { path: `/api/plans/${PLAN}/quote`, method: "GET", file: "app/api/plans/[id]/quote/route.ts" },
  { path: `/api/plans/${PLAN}/xlsx`, method: "GET", file: "app/api/plans/[id]/xlsx/route.ts" },
  { path: "/api/render/pdf", method: "POST", file: "app/api/render/[kind]/route.ts" },
  { path: "/api/render/audit", method: "POST", file: "app/api/render/audit/route.ts" },
  { path: "/api/render/bundle", method: "POST", file: "app/api/render/bundle/route.ts" },
  { path: "/api/render/corridor-geometry", method: "POST", file: "app/api/render/corridor-geometry/route.ts" },
  { path: "/api/render/device-breakdown", method: "POST", file: "app/api/render/device-breakdown/route.ts" },
  { path: "/api/render/quote-breakdown", method: "POST", file: "app/api/render/quote-breakdown/route.ts" },
  { path: "/api/replication-snapshot", method: "POST", file: "app/api/replication-snapshot/route.ts" },
  { path: "/api/road-bearing", method: "POST", file: "app/api/road-bearing/route.ts" },
  // Default-deny near-misses of the webhook.
  { path: "/api/clerk/webhook/extra", method: "POST", file: "" },
  { path: "/api/clerk/webhookx", method: "POST", file: "" },
];

beforeEach(() => {
  vi.stubEnv("GATE_BYPASS_TOKEN", TOKEN);
  vi.stubEnv("GATE_ALLOWED_EMAILS", ` ${ALLOWED.toUpperCase()} , james@example.com,zac@example.com `);
  getUser.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

// ── the spec ────────────────────────────────────────────────────────────
describe("public paths (R1.2) answer every identity", () => {
  for (const r of PUBLIC) {
    for (const id of IDENTITIES) {
      it(`${r.method} ${r.path} · ${id} → passes`, async () => {
        expect(passed(await run(r.path, r.method, id))).toBe(true);
      });
    }
  }
});

function expectDeniedPage(res: Response | undefined) {
  expect(res?.status).toBe(307);
  const loc = new URL(res!.headers.get("location")!);
  expect(loc.pathname).toBe("/"); // C-Q1: home, never /sign-in (R1.5)
  expect(loc.search).toBe("");
  expect(res!.headers.get("x-robots-tag")).toBe("noindex");
}

async function expectDeniedApi(res: Response | undefined) {
  expect(res?.status).toBe(401); // C-Q2: JSON, no redirect
  expect(res!.headers.get("location")).toBeNull();
  expect(res!.headers.get("content-type")).toMatch(/application\/json/);
  expect(await res!.json()).toEqual({ error: "unauthorized" });
  expect(res!.headers.get("x-robots-tag")).toBe("noindex");
}

function expectGatedPass(res: Response | undefined) {
  expect(passed(res)).toBe(true);
  expect(res!.headers.get("x-robots-tag")).toBe("noindex");
}

describe("gated pages (R1.2, C-Q1, C-Q3, C-Q4)", () => {
  for (const r of GATED_PAGES) {
    it(`${r.path} · anonymous → 307 /`, async () => {
      expectDeniedPage(await run(r.path, r.method, "anonymous"));
    });
    it(`${r.path} · bypass-wrong → 307 /`, async () => {
      expectDeniedPage(await run(r.path, r.method, "bypass-wrong"));
    });
    it(`${r.path} · not-allowlisted → 307 / (C-Q3: same as signed out)`, async () => {
      expectDeniedPage(await run(r.path, r.method, "not-allowlisted"));
    });
    it(`${r.path} · allowlisted → passes`, async () => {
      expectGatedPass(await run(r.path, r.method, "allowlisted"));
    });
    // A bypass request carries no session, so the dormant workbench's own
    // sign-in rule (/app, /onboarding → /sign-in) still applies after the
    // gate lets it through; every other gated page simply passes.
    const workbench = /^\/(app|onboarding)(\/|$)/.test(r.path);
    it(`${r.path} · bypass → ${workbench ? "gate passes, workbench asks for sign-in" : "passes"}`, async () => {
      const res = await run(r.path, r.method, "bypass");
      if (workbench) {
        expect(res?.status).toBe(307);
        expect(new URL(res!.headers.get("location")!).pathname).toBe("/sign-in");
      } else {
        expectGatedPass(res);
      }
    });
  }
});

describe("gated /api/* (R1.2, C-Q2)", () => {
  for (const r of GATED_API) {
    it(`${r.method} ${r.path} · anonymous → 401`, async () => {
      await expectDeniedApi(await run(r.path, r.method, "anonymous"));
    });
    it(`${r.method} ${r.path} · bypass-wrong → 401`, async () => {
      await expectDeniedApi(await run(r.path, r.method, "bypass-wrong"));
    });
    it(`${r.method} ${r.path} · not-allowlisted → 401`, async () => {
      await expectDeniedApi(await run(r.path, r.method, "not-allowlisted"));
    });
    it(`${r.method} ${r.path} · allowlisted → passes`, async () => {
      expectGatedPass(await run(r.path, r.method, "allowlisted"));
    });
    it(`${r.method} ${r.path} · bypass → passes`, async () => {
      expectGatedPass(await run(r.path, r.method, "bypass"));
    });
  }
});

describe("the email check (R1.3) fails closed", () => {
  const P = "/sandbox";
  it("no custom claim → Clerk Backend API supplies a verified allowlisted email → passes", async () => {
    getUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: ALLOWED, verification: { status: "verified" } },
    });
    become("anonymous");
    session.userId = "user_allowed";
    session.sessionClaims = {};
    const res = (await middleware(req(P, "GET", "anonymous"), {} as never)) as Response;
    expectGatedPass(res);
    expect(getUser).toHaveBeenCalledWith("user_allowed");
  });
  it("claim present and verified → no Backend API call", async () => {
    await run(P, "GET", "allowlisted");
    expect(getUser).not.toHaveBeenCalled();
  });
  it("allowlisted address but unverified (Backend API) → denied", async () => {
    getUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: ALLOWED, verification: { status: "unverified" } },
    });
    become("anonymous");
    session.userId = "user_allowed";
    session.sessionClaims = {};
    expectDeniedPage((await middleware(req(P, "GET", "anonymous"), {} as never)) as Response);
  });
  it("allowlisted address but claim says unverified → denied", async () => {
    getUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: ALLOWED, verification: { status: "unverified" } },
    });
    become("allowlisted");
    session.sessionClaims = { email: ALLOWED, email_verified: false };
    expectDeniedPage((await middleware(req(P, "GET", "anonymous"), {} as never)) as Response);
  });
  it("Backend API throws → denied", async () => {
    getUser.mockRejectedValue(new Error("clerk down"));
    become("anonymous");
    session.userId = "user_allowed";
    session.sessionClaims = {};
    expectDeniedPage((await middleware(req(P, "GET", "anonymous"), {} as never)) as Response);
  });
  it("GATE_ALLOWED_EMAILS unset → nobody passes by session", async () => {
    vi.stubEnv("GATE_ALLOWED_EMAILS", "");
    expectDeniedPage(await run(P, "GET", "allowlisted"));
  });
  it("allowlisted user with no organisation still meets the workbench's onboarding rule on /app", async () => {
    become("allowlisted");
    session.orgId = null;
    const res = (await middleware(req("/app", "GET", "anonymous"), {} as never)) as Response;
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/onboarding");
  });
});

describe("the bypass header (R1.4)", () => {
  it("GATE_BYPASS_TOKEN unset → the header is never accepted, even empty-to-empty", async () => {
    vi.stubEnv("GATE_BYPASS_TOKEN", "");
    become("anonymous");
    const r = new NextRequest(new URL("/sandbox", "https://www.conestruct.com"), {
      headers: { [GATE_HEADER]: "" },
    });
    expectDeniedPage((await middleware(r, {} as never)) as Response);
  });
  it("a token that is a prefix of the real one is refused", async () => {
    become("anonymous");
    const r = new NextRequest(new URL("/sandbox", "https://www.conestruct.com"), {
      headers: { [GATE_HEADER]: TOKEN.slice(0, -1) },
    });
    expectDeniedPage((await middleware(r, {} as never)) as Response);
  });
  it("the header is stripped before the request reaches the route", async () => {
    const res = await run("/api/render/audit", "POST", "bypass");
    expectGatedPass(res);
    const forwarded = res!.headers.get("x-middleware-override-headers") ?? "";
    expect(forwarded.split(",")).not.toContain(GATE_HEADER);
    expect(res!.headers.get(`x-middleware-request-${GATE_HEADER}`)).toBeNull();
  });
  it("neither token value is ever logged", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation(() => {}),
    );
    await run("/sandbox", "GET", "bypass");
    await run("/sandbox", "GET", "bypass-wrong");
    const said = spies.flatMap((s) => s.mock.calls.flat().map(String)).join("\n");
    expect(said).not.toContain(TOKEN);
    expect(said).not.toContain("not-the-token");
    spies.forEach((s) => s.mockRestore());
  });
});

// ── the matcher: middleware must actually run on every row ─────────────
// Next's own compiler for `config.matcher` (Next 14.2 has no
// unstable_doesMiddlewareMatch; that helper is 15.1+).
const { getMiddlewareMatchers } = await import(
  "next/dist/build/analysis/get-page-static-info"
);
describe("config.matcher reaches every row, and skips Next's static files", () => {
  const matchers = (
    getMiddlewareMatchers as (m: unknown, c: unknown) => Array<{ regexp: string }>
  )(config.matcher, { basePath: "", i18n: undefined });
  const runs = (p: string) => matchers.some((m) => new RegExp(m.regexp).test(p));
  for (const r of [...PUBLIC, ...GATED_PAGES, ...GATED_API]) {
    it(`middleware runs on ${r.path}`, () => expect(runs(r.path)).toBe(true));
  }
  for (const p of ["/_next/static/chunks/main.js", "/_next/static/media/font.woff2", "/favicon.ico"]) {
    it(`middleware skips ${p}`, () => expect(runs(p)).toBe(false));
  }
});

// ── completeness: no page or route handler escapes the table ───────────
describe("the table names every page and route handler in app/", () => {
  const root = path.resolve(__dirname);
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "page.tsx" || name === "route.ts")
        found.push(path.relative(root, full).split(path.sep).join("/"));
    }
  };
  walk(path.join(root, "app"));
  const named = new Set([...PUBLIC, ...GATED_PAGES, ...GATED_API].map((r) => r.file));
  for (const f of found) {
    it(`${f} has a row`, () => expect(named.has(f)).toBe(true));
  }
});
