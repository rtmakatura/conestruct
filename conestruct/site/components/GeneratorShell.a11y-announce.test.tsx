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
// #258: the audit refuses the scan (the prod-captured 400 shape) while
// the breakdown may still answer — the declined pair must never
// announce "Plan generated".
let auditRefuses = false;
const REFUSAL = {
  detail: {
    error: "site_scan_unavailable",
    message:
      "Site scan unavailable — the plan can't verify school zones, sidewalks, or signals right now. Retry, or generate anyway — the plan says whether the scan ran.",
    site_scan: {
      status: "unavailable",
      error: "scan budget exceeded (20 s)",
      mode: "corridor",
      measured_at: "2026-09-03T15:29:51+00:00",
      budget_s: 20.0,
      proceeded_anyway: false,
    },
    recovery: { retry: true, proceed_field: "site_scan.proceed_if_unavailable" },
  },
};

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit") && auditRefuses) {
    return Promise.resolve({
      ok: false,
      status: 400,
      json: async () => REFUSAL,
    } as unknown as Response);
  }
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
  // #252: the working band's row is a second role=status while a
  // request is open — a different speaker for a different event (the
  // flight, never the package).  The package region is the sr-only one,
  // and there is exactly one of it.
  const regions = document.querySelectorAll('[role="status"]:not(.wb-row)');
  expect(regions.length).toBe(1);
  return regions[0] as HTMLElement;
}

beforeEach(() => {
  breakdownCalls = [];
  bundleFails = false;
  auditRefuses = false;
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
    // #258: nothing at the click — the announcement waits for the PAIR
    // (the generated wire's breakdown AND its audit verdict), never
    // for the breakdown alone.
    expect(statusRegion().textContent).toBe("");
    await flushDebounce();
    await release(breakdownCalls.length - 1, okBreakdown());
    await flushDebounce();
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
    await flushDebounce();
    await release(1, okBreakdown());

    // Reopen (settled — #252 locks edits mid-flight); Generate with the
    // pre-generate refire pending — the region must be visibly cleared
    // during the window, then repopulate.
    await user.click(screen.getByText(/Edit full setup/));
    await flushDebounce(); // the pre-generate refire dispatches and stays pending
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    expect(statusRegion().textContent).toBe("");

    await flushDebounce();
    await release(breakdownCalls.length - 1, okBreakdown());
    expect(statusRegion().textContent).toBe(
      "Plan generated — 42 devices, 6 types.",
    );
  });

  it("a background settle never writes the status region", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(1, okBreakdown());
    const announced = statusRegion().textContent;

    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    await flushDebounce();
    await release(2, okBreakdown());
    // Unchanged — same text, no re-announcement for an edit settle.
    expect(statusRegion().textContent).toBe(announced);
  });

  it("a failed generation announces via the alert ribbon, not the status region", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(1, okBreakdown());

    await user.click(screen.getByText(/Edit full setup/));
    await flushDebounce(); // the pre-generate refire dispatches and stays pending
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    expect(statusRegion().textContent).toBe("");
    await flushDebounce();
    await release(breakdownCalls.length - 1, errBreakdown());

    const alerts = screen.getAllByRole("alert");
    expect(
      alerts.some((a) =>
        a.textContent?.includes("Device breakdown failed"),
      ),
    ).toBe(true);
    expect(statusRegion().textContent).toBe("");
  });

  it("#258: a refused pair never writes the status region — even when the breakdown answered; the role=alert container speaks", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    // The generated wire's audit refuses; the breakdown succeeds (the
    // two race the scan budget independently — audit F-S5-1 #1).
    auditRefuses = true;
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(breakdownCalls.length - 1, okBreakdown());
    await flushDebounce();

    expect(document.querySelector(".scan-refusal")?.getAttribute("role")).toBe("alert");
    expect(statusRegion().textContent).toBe("");
    expect(document.querySelector(".hero")).toBeNull();
  });

  it("#258: a Retry that settles clean announces the recovered plan, once", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    auditRefuses = true;
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(breakdownCalls.length - 1, okBreakdown());
    await flushDebounce();
    expect(statusRegion().textContent).toBe("");

    auditRefuses = false;
    await user.click(screen.getByRole("button", { name: /Retry scan/ }));
    await flushDebounce();
    await release(breakdownCalls.length - 1, okBreakdown());
    await flushDebounce();
    expect(statusRegion().textContent).toBe(
      "Plan generated — 42 devices, 6 types.",
    );
    expect(document.querySelector(".hero")).not.toBeNull();
  });

  it("a bundle failure announces via role=alert", async () => {
    bundleFails = true;
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    // #252: the zip button is a write control — settle the pair first.
    await flushDebounce();
    await release(1, okBreakdown());

    await user.click(screen.getByRole("button", { name: /All \(\.zip\)/ }));
    const alerts = screen.getAllByRole("alert");
    expect(
      alerts.some((a) => a.textContent?.includes("Bundle failed (500)")),
    ).toBe(true);
  });

  it("the stale ribbon stays visual-only (the band's region announces the flight, #252)", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(1, okBreakdown());

    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    await flushDebounce();
    const ribbon = screen.getByText(/Previous answer/);
    expect(ribbon.getAttribute("role")).toBeNull();
    // Exactly one live region carries the flight: the band's row.
    const bandRow = document.querySelector(".working-band [role=status]");
    expect(bandRow).not.toBeNull();
    expect(bandRow!.getAttribute("aria-live")).toBe("polite");
    expect(document.querySelector(".status-bar")).toBeNull();
    await release(1, okBreakdown());
  });
});
