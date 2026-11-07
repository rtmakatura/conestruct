// scripts/gate.cjs — the harnesses' bypass header (coming-soon-gate R1.4,
// C-Q7).  Pinned here because a harness that silently loses the header
// measures the placeholder instead of the generator, and one that sends
// it to every host hands the token to third parties.
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const gate = require(path.resolve(__dirname, "../../../scripts/gate.cjs")) as {
  GATE_HEADER: string;
  gateHeaders: (url: string) => Record<string, string>;
  applyGate: (target: unknown, site: string) => Promise<void>;
  isSiteRequest: (requestUrl: string, site: string) => boolean;
  newGatedContext: (browser: unknown, site: string, options?: Record<string, unknown>) => Promise<unknown>;
};

const SITE = "https://www.conestruct.com/sandbox";
const TOKEN = "helper-test-token-19c2";

afterEach(() => vi.unstubAllEnvs());

describe("gateHeaders", () => {
  it("sends the token when it is set", () => {
    vi.stubEnv("GATE_BYPASS_TOKEN", TOKEN);
    expect(gate.gateHeaders(SITE)).toEqual({ "x-conestruct-gate": TOKEN });
  });
  it("fails loudly on production without the token", () => {
    vi.stubEnv("GATE_BYPASS_TOKEN", "");
    expect(() => gate.gateHeaders(SITE)).toThrow(/GATE_BYPASS_TOKEN is not set/);
    expect(() => gate.gateHeaders("https://conestruct.com/")).toThrow();
  });
  it("sends nothing, silently, to a local server without the token", () => {
    vi.stubEnv("GATE_BYPASS_TOKEN", "");
    expect(gate.gateHeaders("http://localhost:3000/sandbox")).toEqual({});
  });
  it("a look-alike host is not production", () => {
    vi.stubEnv("GATE_BYPASS_TOKEN", "");
    expect(gate.gateHeaders("https://conestruct.com.evil.example/")).toEqual({});
  });
});

describe("applyGate rides only on the site's own requests", () => {
  it("site origin yes; map tiles, Sentry and the apex no", () => {
    expect(gate.isSiteRequest("https://www.conestruct.com/api/render/audit", SITE)).toBe(true);
    expect(gate.isSiteRequest("https://api.mapbox.com/styles/v1/x", SITE)).toBe(false);
    expect(gate.isSiteRequest("https://o1.ingest.sentry.io/api/1/envelope/", SITE)).toBe(false);
    expect(gate.isSiteRequest("https://conestruct.com/sandbox", SITE)).toBe(false);
  });

  it("installs one route whose handler adds the header, keeps the request's own, and follows no redirect", async () => {
    vi.stubEnv("GATE_BYPASS_TOKEN", TOKEN);
    const routes: Array<[(u: URL) => boolean, (r: unknown) => unknown]> = [];
    await gate.applyGate({ route: async (m: never, h: never) => void routes.push([m, h]) }, SITE);
    expect(routes).toHaveLength(1);
    const [match, handle] = routes[0];
    expect(match(new URL("https://www.conestruct.com/_next/static/x.js"))).toBe(true);
    expect(match(new URL("https://api.mapbox.com/v4/tile.png"))).toBe(false);
    const answer = { status: () => 200, headers: () => ({}) };
    const fetch = vi.fn(async () => answer);
    const fulfill = vi.fn();
    const request = () => ({ url: () => SITE, method: () => "GET", headers: () => ({ accept: "text/html" }) });
    await handle({ request, fetch, fulfill });
    expect(fetch).toHaveBeenCalledWith({
      url: SITE,
      method: "GET",
      headers: { accept: "text/html", "x-conestruct-gate": TOKEN },
      maxRedirects: 0,
    });
    expect(fulfill).toHaveBeenCalledWith({ response: answer });
  });

  it("#450: a redirect through Clerk carries the header on the site's hops only", async () => {
    vi.stubEnv("GATE_BYPASS_TOKEN", TOKEN);
    const routes: Array<[unknown, (r: unknown) => unknown]> = [];
    await gate.applyGate({ route: async (m: never, h: never) => void routes.push([m, h]) }, SITE);
    const CLERK = "https://clerk.example-dev.test/v1/client/handshake?redirect_url=x";
    const BACK = "https://www.conestruct.com/sandbox?__clerk_handshake=1";
    const hops: Record<string, { status: number; location?: string }> = {
      [SITE]: { status: 307, location: CLERK },
      [CLERK]: { status: 307, location: BACK },
      [BACK]: { status: 307, location: "/sandbox" },
    };
    const seen: Array<[string, boolean]> = [];
    const final = { status: () => 200, headers: () => ({}) };
    let back = 0;
    const fetch = vi.fn(async (o: { url: string; headers: Record<string, string> }) => {
      seen.push([new URL(o.url).host, "x-conestruct-gate" in o.headers]);
      // The second visit to /sandbox (after the handshake) answers 200.
      if (o.url === SITE && back++ > 0) return final;
      const h = hops[o.url];
      return { status: () => h.status, headers: () => ({ location: h.location! }) };
    });
    const fulfill = vi.fn();
    const request = () => ({ url: () => SITE, method: () => "GET", headers: () => ({}) });
    await routes[0][1]({ request, fetch, fulfill });
    expect(seen).toEqual([
      ["www.conestruct.com", true],
      ["clerk.example-dev.test", false],
      ["www.conestruct.com", true],
      ["www.conestruct.com", true],
    ]);
    expect(fulfill).toHaveBeenCalledWith({ response: final });
  });

  it("with no token on a local server it installs nothing", async () => {
    vi.stubEnv("GATE_BYPASS_TOKEN", "");
    const route = vi.fn();
    await gate.applyGate({ route }, "http://localhost:3000/sandbox");
    expect(route).not.toHaveBeenCalled();
  });

  it("#450: the match is the request's host, so Clerk, a look-alike and another port are out", () => {
    expect(gate.isSiteRequest("https://clerk.conestruct.com/npm/@clerk/clerk-js", SITE)).toBe(false);
    expect(gate.isSiteRequest("https://www.conestruct.com.evil.example/", SITE)).toBe(false);
    expect(gate.isSiteRequest("http://www.conestruct.com/sandbox", SITE)).toBe(false);
    expect(gate.isSiteRequest("http://localhost:3000/api/geocode", "http://localhost:3000/sandbox")).toBe(true);
    expect(gate.isSiteRequest("http://localhost:8000/render/audit", "http://localhost:3000/sandbox")).toBe(false);
  });

  it("#450: a 303 after a POST turns into a GET with an empty body; a 307 keeps the original", async () => {
    vi.stubEnv("GATE_BYPASS_TOKEN", TOKEN);
    const routes: Array<[unknown, (r: unknown) => unknown]> = [];
    await gate.applyGate({ route: async (m: never, h: never) => void routes.push([m, h]) }, SITE);
    const calls: Array<{ method: string; postData?: Buffer }> = [];
    const answers = [
      { status: () => 307, headers: () => ({ location: "/sandbox?a" }) },
      { status: () => 303, headers: () => ({ location: "/sandbox?b" }) },
      { status: () => 200, headers: () => ({}) },
    ];
    const fetch = vi.fn(async (o: { method: string; postData?: Buffer }) => {
      calls.push(o);
      return answers[calls.length - 1];
    });
    const request = () => ({ url: () => SITE, method: () => "POST", headers: () => ({}) });
    await routes[0][1]({ request, fetch, fulfill: vi.fn() });
    expect(calls.map((c) => c.method)).toEqual(["POST", "POST", "GET"]);
    expect("postData" in calls[0]).toBe(false);
    expect("postData" in calls[1]).toBe(false);
    expect(calls[2].postData?.length).toBe(0);
  });

  it("#450: newGatedContext builds the context and installs the site-only route", async () => {
    vi.stubEnv("GATE_BYPASS_TOKEN", TOKEN);
    const routes: Array<[(u: URL) => boolean, unknown]> = [];
    const ctx = { route: async (m: never, h: never) => void routes.push([m, h]) };
    const newContext = vi.fn(async () => ctx);
    const got = await gate.newGatedContext({ newContext }, SITE, { viewport: { width: 390, height: 844 } });
    expect(got).toBe(ctx);
    expect(newContext).toHaveBeenCalledWith({ viewport: { width: 390, height: 844 } });
    expect(routes).toHaveLength(1);
    expect(routes[0][0](new URL("https://www.conestruct.com/sandbox"))).toBe(true);
    expect(routes[0][0](new URL("https://clerk.conestruct.com/v1/client"))).toBe(false);
  });

  it("#450: newGatedContext refuses the gate header in extraHTTPHeaders, any case", async () => {
    vi.stubEnv("GATE_BYPASS_TOKEN", TOKEN);
    const newContext = vi.fn();
    for (const key of ["x-conestruct-gate", "X-Conestruct-Gate"]) {
      await expect(
        gate.newGatedContext({ newContext }, SITE, { extraHTTPHeaders: { [key]: TOKEN } }),
      ).rejects.toThrow(/would go to every origin/);
    }
    expect(newContext).not.toHaveBeenCalled();
  });

  it("the error never carries a token and nothing is logged", () => {
    const spies = (["log", "info", "warn", "error"] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation(() => {}),
    );
    vi.stubEnv("GATE_BYPASS_TOKEN", TOKEN);
    gate.gateHeaders(SITE);
    expect(spies.every((s) => s.mock.calls.length === 0)).toBe(true);
    spies.forEach((s) => s.mockRestore());
  });
});
