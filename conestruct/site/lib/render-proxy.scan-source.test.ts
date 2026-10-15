// #307: the file proxy passes the backend's x-site-scan-source through,
// so a probe through the site can see whether a download re-scanned.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/db", () => ({ getDb: vi.fn(), plans: {} }));

import { renderScenarioToResponse } from "./render-proxy";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function upstream(headers: Record<string, string>) {
  vi.stubEnv("MODAL_RENDER_URL", "https://modal.example");
  vi.stubEnv("MODAL_RENDER_SECRET", "s");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("pdf", { status: 200, headers: { "content-type": "application/pdf", ...headers } })),
  );
}

describe("renderScenarioToResponse passes the scan source (#307)", () => {
  it("relays x-site-scan-source", async () => {
    upstream({ "x-site-scan-source": "token" });
    const res = await renderScenarioToResponse(DEFAULT_SCENARIO as Scenario, "pdf");
    expect(res.headers.get("x-site-scan-source")).toBe("token");
  });

  it("adds none when the backend sent none", async () => {
    upstream({});
    const res = await renderScenarioToResponse(DEFAULT_SCENARIO as Scenario, "pdf");
    expect(res.headers.get("x-site-scan-source")).toBeNull();
  });
});
