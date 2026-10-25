// #395 (Rule 10) — the six JSON proxies relay the backend's content-type
// as-is.  An answer that names none reaches the caller with none: the
// proxy no longer labels it application/json on the backend's behalf.
// The body is relayed either way (no client reads the header; refusing a
// good answer over a missing header would turn it into an outage).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// render-proxy also exports the saved-plan proxy, which imports Clerk and
// the DB client — unresolvable under vitest's node environment (the same
// two mocks as render-proxy.validation.test.ts).
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({}) }));
vi.mock("@/db", () => ({ getDb: () => ({}), plans: {} }));

import {
  fetchAuditTrail,
  fetchCorridorGeometry,
  fetchDeviceBreakdown,
  fetchJurisdictionSuggest,
  fetchNearestIntersection,
  fetchQuoteBreakdown,
} from "./render-proxy";
import { DEFAULT_QUOTE_SETTINGS } from "./quote-settings";
import { DEFAULT_SHOULDER } from "./scenarios";

let answer: () => Response;

beforeEach(() => {
  vi.stubEnv("MODAL_RENDER_URL", "https://modal.example/");
  vi.stubEnv("MODAL_RENDER_SECRET", "s3cret");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => answer()),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const BODY = JSON.stringify({ ok: true });

const ROUTES: [string, () => Promise<Response>][] = [
  ["fetchQuoteBreakdown", () => fetchQuoteBreakdown(DEFAULT_SHOULDER, DEFAULT_QUOTE_SETTINGS)],
  ["fetchDeviceBreakdown", () => fetchDeviceBreakdown(DEFAULT_SHOULDER)],
  ["fetchCorridorGeometry", () => fetchCorridorGeometry(DEFAULT_SHOULDER)],
  ["fetchNearestIntersection", () => fetchNearestIntersection(DEFAULT_SHOULDER)],
  ["fetchAuditTrail", () => fetchAuditTrail(DEFAULT_SHOULDER)],
  ["fetchJurisdictionSuggest", () => fetchJurisdictionSuggest({ lat: 39.74, lng: -104.97 })],
];

describe.each(ROUTES)("%s", (_name, call) => {
  it("relays the backend's content-type as named", async () => {
    answer = () =>
      new Response(BODY, {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await res.text()).toBe(BODY);
  });

  it("a 200 with no content-type is relayed with none, not labelled application/json", async () => {
    // A stream body, so the Response constructor adds no text/plain of its own.
    answer = () =>
      new Response(new Blob([BODY]).stream(), { status: 200 });
    expect(answer().headers.get("content-type")).toBeNull();
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBeNull();
    expect(await res.text()).toBe(BODY);
  });
});
