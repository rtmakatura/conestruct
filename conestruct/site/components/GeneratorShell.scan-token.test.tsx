// @vitest-environment happy-dom
//
// #307 (R151) — the Generate's audit asks the backend to sign the scan it
// answered from (``include_scan_token``); the shell keeps the token with
// the scenario it answered for, and the downloads (the cards, the quote,
// the zip) carry it so the backend builds them from that same scan.  The
// audit's own request never carries a token.  Mounted on the
// bundle-settings harness (Rule 11).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";

const seen = vi.hoisted(() => ({ mode: null as null | { kind: string; scenario?: Scenario } }));

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./OutputCards", () => ({
  OutputCards: ({
    onDownloadAll,
    mode,
  }: {
    onDownloadAll?: () => void;
    mode: { kind: string; scenario?: Scenario };
  }) => {
    seen.mode = mode;
    return (
      <button type="button" onClick={onDownloadAll}>
        ALL_ZIP
      </button>
    );
  },
}));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));
vi.mock("./GeneratorSidebar", () => ({
  GeneratorSidebar: ({ onGenerate }: { onGenerate: () => void }) => (
    <button type="button" onClick={onGenerate}>
      Generate package
    </button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { MIN_AUDIT } from "./test-fixtures";

let token: string | undefined = "tok-307";
const auditBodies: Array<{ scenario: Record<string, unknown> }> = [];
let bundleBody: { scenario: Scenario } | null = null;

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/api/render/bundle")) {
    bundleBody = JSON.parse(String(init?.body));
    return Promise.resolve({ ok: true, status: 200, blob: async () => new Blob(["zip"]) } as unknown as Response);
  }
  if (url.includes("/api/render/audit")) {
    const body = JSON.parse(String(init?.body));
    auditBodies.push(body);
    // The backend signs only when the scan ran (the request carried site_scan).
    const signed = body.scenario.site_scan && token ? { site_scan_token: token } : {};
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ ...MIN_AUDIT, ...signed }) } as unknown as Response);
  }
  return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as unknown as Response);
});

beforeEach(() => {
  token = "tok-307";
  auditBodies.length = 0;
  bundleBody = null;
  seen.mode = null;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:mock", configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function generate() {
  const user = userEvent.setup();
  render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await user.click(screen.getByText("Generate package"));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
  });
  return user;
}

describe("the Generate's signed scan rides the downloads (#307)", () => {
  it("every audit asks for the token, and none carries one", async () => {
    await generate();
    expect(auditBodies.length).toBeGreaterThan(0);
    for (const b of auditBodies) {
      expect(b.scenario.include_scan_token).toBe(true);
      expect((b.scenario.site_scan as { token?: string } | undefined)?.token).toBeUndefined();
    }
  });

  it("the download cards and the zip carry the token the audit returned", async () => {
    const user = await generate();
    await waitFor(() =>
      expect(seen.mode?.scenario?.site_scan).toEqual({ proceed_if_unavailable: false, token: "tok-307" }),
    );
    await user.click(screen.getByText("ALL_ZIP"));
    await waitFor(() => expect(bundleBody).not.toBeNull());
    expect(bundleBody?.scenario.site_scan?.token).toBe("tok-307");
  });

  it("no token from the audit: the downloads send the scenario without one", async () => {
    token = undefined;
    await generate();
    await waitFor(() => expect(seen.mode?.scenario?.site_scan).toBeTruthy());
    expect(seen.mode?.scenario?.site_scan).toEqual({ proceed_if_unavailable: false });
  });
});
