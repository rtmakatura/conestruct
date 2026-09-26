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

  it("installs one route whose handler adds the header and keeps the request's own", async () => {
    vi.stubEnv("GATE_BYPASS_TOKEN", TOKEN);
    const routes: Array<[(u: URL) => boolean, (r: unknown) => unknown]> = [];
    await gate.applyGate({ route: async (m: never, h: never) => void routes.push([m, h]) }, SITE);
    expect(routes).toHaveLength(1);
    const [match, handle] = routes[0];
    expect(match(new URL("https://www.conestruct.com/_next/static/x.js"))).toBe(true);
    expect(match(new URL("https://api.mapbox.com/v4/tile.png"))).toBe(false);
    const cont = vi.fn();
    await handle({ request: () => ({ headers: () => ({ accept: "text/html" }) }), continue: cont });
    expect(cont).toHaveBeenCalledWith({
      headers: { accept: "text/html", "x-conestruct-gate": TOKEN },
    });
  });

  it("with no token on a local server it installs nothing", async () => {
    vi.stubEnv("GATE_BYPASS_TOKEN", "");
    const route = vi.fn();
    await gate.applyGate({ route }, "http://localhost:3000/sandbox");
    expect(route).not.toHaveBeenCalled();
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
