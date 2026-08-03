// @vitest-environment happy-dom
//
// Arc 7 (#193) capture instrument — records focus + live-region facts
// through the post-Generate transitions.  Log-only: it asserts nothing
// about right or wrong, so the SAME file runs pre-fix and post-fix and
// the diff of its output is the evidence (arc6 pattern).
//
// To run: copy to conestruct/site/components/A11yCapture193.scratch.test.tsx
//   npx vitest run components/A11yCapture193.scratch.test.tsx
// then delete the copy.  Output lands in the run log.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./AuditTrail", () => ({ AuditTrail: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";

const CLEAN_AUDIT = {
  summary: {
    ta: "TA-3",
    cdot_sheet: "S-630-1",
    case_id: "Case 11",
    taper_length_ft: 183,
    taper_label: "L/3 (shoulder taper)",
    buffer_space_ft: 495,
    device_spacing_taper_ft: 55,
    device_spacing_tangent_ft: 110,
    step_count: 8,
  },
  sections: {
    taper: {},
    buffer: {},
    spacing: {},
    advance: {},
    colorado: {},
    case: {},
    flagger: {},
    corridor_validation: { checked: false, warnings: [] },
    geometry_validation: { violations: [], all_pass: true },
  },
  pending_verification: { count: 0, note: "", tracking_issue: null },
  plan_flags: {
    validation_warnings: 0,
    compliance_fails: 0,
    v1_limitations: 0,
    is_clean: true,
  },
};

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
  if (url.includes("/api/render/audit")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => CLEAN_AUDIT,
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

function describeActive(): string {
  const el = document.activeElement;
  if (!el || el === document.body) return "<body>";
  const tag = el.tagName.toLowerCase();
  const label =
    el.getAttribute("aria-label") ??
    el.getAttribute("id") ??
    el.className.split(" ")[0] ??
    "";
  return `<${tag}${label ? ` ${label}` : ""}>`;
}

function liveRegions(): string {
  return JSON.stringify(
    Array.from(
      document.querySelectorAll("[aria-live], [role='status'], [role='alert']"),
    ).map((el) => ({
      role: el.getAttribute("role"),
      live: el.getAttribute("aria-live"),
      text: (el as HTMLElement).textContent?.trim().slice(0, 90),
    })),
  );
}

beforeEach(() => {
  breakdownCalls = [];
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

describe("#193 capture — focus + announcements", () => {
  it("A: keyboard Generate (success, breakdown settled)", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    const btn = screen.getByRole("button", { name: /Generate plan/ });
    btn.focus();
    console.log("A regions before:", liveRegions());
    await user.keyboard("{Enter}");
    console.log("A focus after Generate:", describeActive());
    console.log("A regions after:", liveRegions());
    console.log(
      "A results mounted:",
      !!document.querySelector(".hero"),
    );
    expect(true).toBe(true);
  });

  it("B: failed generation", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    await flushDebounce();
    await user.click(screen.getByText(/Edit full setup/));
    const btn = screen.getByRole("button", { name: /Generate plan/ });
    btn.focus();
    await user.keyboard("{Enter}");
    await release(1, errBreakdown());
    console.log("B focus after failed generate:", describeActive());
    console.log("B regions:", liveRegions());
    expect(true).toBe(true);
  });

  it("C: strip inline editor close", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    console.log("C focus with editor open:", describeActive());
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    console.log("C focus after done():", describeActive());
    await flushDebounce();
    await release(1, okBreakdown());
    expect(true).toBe(true);
  });

  it("D: reopen full setup", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    const editAll = screen.getByText(/Edit full setup/);
    editAll.focus();
    await user.click(editAll);
    console.log("D focus after reopen:", describeActive());
    expect(true).toBe(true);
  });

  it("E: background settle never moves focus (control)", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await user.click(screen.getByRole("button", { name: /Edit Work zone/i }));
    const input = screen.getByLabelText("Work zone (ft)");
    input.focus();
    await user.clear(input);
    await user.type(input, "600");
    await flushDebounce();
    const before = describeActive();
    await release(1, okBreakdown());
    console.log("E focus before settle:", before, "| after settle:", describeActive());
    expect(true).toBe(true);
  });
});

describe("#193 capture — picker restore", () => {
  it("F: close with detached opener", async () => {
    const { LocationPickerModal: RealPicker } = await vi.importActual<
      typeof import("./LocationPickerModal")
    >("./LocationPickerModal");
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const opener = document.createElement("button");
    opener.textContent = "Pick Location on Map";
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(
      <RealPicker
        open
        initial={{ scenarioKind: "shoulder", speedMph: 65 }}
        onCancel={() => {}}
        onSave={() => {}}
      />,
    );
    console.log("F focus on open:", describeActive());
    opener.remove();
    unmount();
    console.log("F focus after close with detached opener:", describeActive());
    opener.isConnected || opener.remove();
    expect(true).toBe(true);
  });
});
