// @vitest-environment happy-dom
//
// #193 — focus policy for the Generate lifecycle, mounted (rule 11:
// the bug lives in unmount timing, so every assertion reads
// document.activeElement through a real interaction sequence).
// Policy under test (WCAG 2.4.3 focus order / 2.1.1 keyboard):
//   * an ARMED Generate click owns the next focus move — when the
//     staged lifecycle settles (post or error) focus lands on the
//     results zone;
//   * background settles (debounced refetches) never move focus;
//   * Reopen moves focus to the Setup zone (the strip control that was
//     clicked unmounts with the strip).

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

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/device-breakdown")) {
    return new Promise<Response>((resolve) => {
      breakdownCalls.push({ resolve });
    });
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

// The results zone is the section holding the results content; the
// setup zone is the section holding the Generate button.  Both carry
// tabIndex={-1}, so activeElement can BE them.
function activeIsResultsZone(): boolean {
  const el = document.activeElement;
  return (
    el instanceof HTMLElement &&
    el.tagName === "SECTION" &&
    el.querySelector(".zone-title") !== null &&
    el.textContent!.includes("MHT package")
  );
}

function activeIsSetupZone(): boolean {
  const el = document.activeElement;
  return (
    el instanceof HTMLElement &&
    el.tagName === "SECTION" &&
    el.querySelector(".setup-panel") !== null
  );
}

let scrollSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  breakdownCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  scrollSpy = vi.fn();
  Element.prototype.scrollIntoView = scrollSpy as never;
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

describe("focus policy after Generate (#193)", () => {
  it("keyboard Generate (Enter) lands focus on the results zone; scroll still fires", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());

    const btn = screen.getByRole("button", { name: /Generate plan/ });
    btn.focus();
    await user.keyboard("{Enter}");

    expect(activeIsResultsZone()).toBe(true);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it("with the fetch still in flight, focus moves only when it settles to post", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));

    // Strip edit leaves a fetch pending; reopen → Generate mid-flight.
    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    await flushDebounce();
    await user.click(screen.getByText(/Edit full setup/));
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    expect(activeIsResultsZone()).toBe(false);

    await release(1, okBreakdown());
    expect(activeIsResultsZone()).toBe(true);
  });

  it("a failed generation focuses the results zone (it holds the alert) without scrolling", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    scrollSpy.mockClear();

    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    await flushDebounce();
    await user.click(screen.getByText(/Edit full setup/));
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await release(1, errBreakdown());

    expect(activeIsResultsZone()).toBe(true);
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("a background settle never moves focus (debounced strip edit)", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));

    await user.click(screen.getByRole("button", { name: /Edit Work zone/i }));
    const input = screen.getByLabelText("Work zone (ft)");
    await user.clear(input);
    await user.type(input, "600");
    await flushDebounce();
    expect(document.activeElement).toBe(input);
    await release(1, okBreakdown());
    expect(document.activeElement).toBe(input);
    expect(activeIsResultsZone()).toBe(false);
  });

  it("Reopen lands focus on the Setup zone", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));

    await user.click(screen.getByText(/Edit full setup/));
    expect(activeIsSetupZone()).toBe(true);
    // The panel is really back: Tab reaches its controls from here.
    expect(
      screen.getByRole("button", { name: /Generate plan/ }),
    ).toBeTruthy();
  });
});
