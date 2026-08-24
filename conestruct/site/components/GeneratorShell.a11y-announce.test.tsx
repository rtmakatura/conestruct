// @vitest-environment happy-dom
//
// #193 — announcement policy for the Generate lifecycle (WCAG 4.1.3
// status messages).  The strip's polite live region covers
// VERIFICATION states; nothing announced the package itself.  Policy
// under test:
//   * a persistent role="status" region announces "Plan generated —
//     N devices, M types" at the ARMED settle, with the counts the
//     hero renders (same source, rule 10);
//   * cleared at the click so a repeat Generate re-announces;
//   * background settles never write it;
//   * generation failure and bundle failure announce via role="alert"
//     (the breakdown pipeline never reaches the strip's region).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";

const BREAKDOWN = {
  devices: [],
  total_devices: 42,
  unique_types: 6,
  zone_geometry: {
    taper_l_ft: 183,
    buffer_b_ft: 495,
    device_spacing_ft: 55,
    work_len_ft: 500,
  },
};

type Deferred = { resolve: (r: Response) => void };
let breakdownCalls: Deferred[] = [];
let bundleFails = false;

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/device-breakdown")) {
    return new Promise<Response>((resolve) => {
      breakdownCalls.push({ resolve });
    });
  }
  if (url.includes("/api/render/bundle")) {
    return Promise.resolve({
      ok: !bundleFails,
      status: bundleFails ? 500 : 200,
      blob: async () => new Blob(["x"]),
      json: async () => ({}),
    } as unknown as Response);
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

function okBreakdown(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => BREAKDOWN,
  } as unknown as Response;
}

function errBreakdown(): Response {
  return {
    ok: false,
    status: 500,
    json: async () => ({}),
    text: async () => "boom",
  } as unknown as Response;
}

async function release(index: number, response: Response) {
  await act(async () => {
    breakdownCalls[index].resolve(response);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function flushDebounce() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 360));
  });
}

function statusRegion(): HTMLElement {
  const regions = document.querySelectorAll('[role="status"]');
  expect(regions.length).toBe(1);
  return regions[0] as HTMLElement;
}

beforeEach(() => {
  breakdownCalls = [];
  bundleFails = false;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = vi.fn() as never;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("generation announcements (#193)", () => {
  it("announces the generated package with the counts the hero renders", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    expect(statusRegion().textContent).toBe("");

    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    expect(statusRegion().textContent).toBe(
      "Plan generated — 42 devices, 6 types.",
    );
    // Same source as the visuals: the hero shows the same counts.
    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
    expect(screen.getAllByText("6").length).toBeGreaterThan(0);
  });

  it("clears at the click so a repeat Generate with identical counts re-announces", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));

    // Reopen; edit leaves a fetch pending; Generate mid-flight — the
    // region must be visibly cleared during the window, then repopulate.
    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    await flushDebounce();
    await user.click(screen.getByText(/Edit full setup/));
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    expect(statusRegion().textContent).toBe("");

    await release(1, okBreakdown());
    expect(statusRegion().textContent).toBe(
      "Plan generated — 42 devices, 6 types.",
    );
  });

  it("a background settle never writes the status region", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    const announced = statusRegion().textContent;

    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    await flushDebounce();
    await release(1, okBreakdown());
    // Unchanged — same text, no re-announcement for an edit settle.
    expect(statusRegion().textContent).toBe(announced);
  });

  it("a failed generation announces via the alert ribbon, not the status region", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));

    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    await flushDebounce();
    await user.click(screen.getByText(/Edit full setup/));
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    expect(statusRegion().textContent).toBe("");
    await release(1, errBreakdown());

    const alerts = screen.getAllByRole("alert");
    expect(
      alerts.some((a) =>
        a.textContent?.includes("Device breakdown failed"),
      ),
    ).toBe(true);
    expect(statusRegion().textContent).toBe("");
  });

  it("a bundle failure announces via role=alert", async () => {
    bundleFails = true;
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));

    await user.click(screen.getByRole("button", { name: /All \(\.zip\)/ }));
    const alerts = screen.getAllByRole("alert");
    expect(
      alerts.some((a) => a.textContent?.includes("Bundle failed (500)")),
    ).toBe(true);
  });

  it("the recomputing ribbon stays visual-only (strip announces COMPUTING)", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));

    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    await flushDebounce();
    const ribbon = screen.getByText(/Recomputing/);
    expect(ribbon.getAttribute("role")).toBeNull();
    await release(1, okBreakdown());
  });
});
