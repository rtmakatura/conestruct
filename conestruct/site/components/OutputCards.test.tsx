// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { OutputCards } from "./OutputCards";
import { BUNDLE_PART_KINDS } from "@/lib/render-types";
import type { AuditSummary } from "@/lib/render-types";
import type { Scenario } from "@/lib/scenarios";
import type { DeviceBreakdownState } from "./DeviceBreakdown";

// Zone 2 download cards (restage of the former sheet-index table).
// OutputCards previously had zero tests and was mocked to null in every
// GeneratorShell suite — the exact blind spot class that let the picker
// re-apply bug (#112) ship green through 198 tests.  These are
// mounted-flow tests of the rendered cards: real backend values in the
// right cards, the loading/error fallbacks, all three mode variants,
// and the bundle-count header rule.

const SUMMARY: AuditSummary = {
  ta: "TA-3",
  cdot_sheet: "S-630-1",
  case_id: "Case 11",
  taper_length_ft: 183,
  taper_label: "L/3 (shoulder taper)",
  buffer_space_ft: 495,
  device_spacing_taper_ft: 55,
  device_spacing_tangent_ft: 110,
  step_count: 8,
};

const READY_BREAKDOWN: DeviceBreakdownState = {
  state: "ready",
  data: { devices: [], total_devices: 42, unique_types: 6 },
};

// Minimal scenario stand-in: OutputCards treats it as an opaque payload
// (POSTed verbatim to /api/render/*); only meta.project is read, for
// the download filename.
const SCENARIO = { meta: { project: "Test Job" } } as unknown as Scenario;

function renderPublic(
  overrides: Partial<Parameters<typeof OutputCards>[0]> = {},
) {
  return render(
    <OutputCards
      summary={SUMMARY}
      generated={true}
      mode={{ kind: "public", scenario: SCENARIO }}
      breakdown={READY_BREAKDOWN}
      {...overrides}
    />,
  );
}

function cards(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll(".dl-card"));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("OutputCards download cards", () => {
  it("renders one card per deliverable with backend values", () => {
    const { container } = renderPublic();

    const [plan, devices, crew] = cards(container);
    expect(cards(container)).toHaveLength(3);

    // Backend-sourced quantities land in the right cards.
    expect(plan.textContent).toContain("Plan sheet");
    expect(plan.textContent).toContain("42"); // total_devices
    expect(plan.textContent).toContain("TA-3"); // summary.ta in the spec line
    expect(plan.textContent).toContain("S-630-1"); // summary.cdot_sheet
    expect(devices.textContent).toContain("Device list");
    expect(devices.textContent).toContain("6"); // unique_types
    expect(crew.textContent).toContain("Crew instructions");
    expect(crew.textContent).toContain("8"); // step_count
  });

  it("derives the header file count from the actual bundle contents, not the card count", () => {
    renderPublic();
    // The zip carries quote.xlsx in addition to the three cards — the
    // label must describe the package (4 files), never the grid.
    expect(BUNDLE_PART_KINDS.length).toBe(4);
    expect(
      screen.getByText(`MHT PACKAGE · ${BUNDLE_PART_KINDS.length} FILES`),
    ).toBeTruthy();
    expect(screen.queryByText(/3 (FILES|SHEETS)/)).toBeNull();
  });

  it("shows the loading ellipsis and error dash fallbacks for breakdown stats", () => {
    const { container: loading } = renderPublic({
      breakdown: { state: "loading" },
    });
    expect(cards(loading)[0].textContent).toContain("…");

    cleanup();

    const { container: errored } = renderPublic({
      breakdown: { state: "error", message: "boom" },
      summary: null,
    });
    expect(cards(errored)[0].textContent).toContain("—"); // devices
    expect(cards(errored)[2].textContent).toContain("—"); // steps (null summary)
  });

  it("public mode: the crew card offers PDF plus a secondary .md download, and clicking posts the scenario", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderPublic();
    expect(screen.getAllByText("Download PDF")).toHaveLength(2); // plan + crew
    expect(screen.getByText("Download XLSX")).toBeTruthy();

    fireEvent.click(screen.getByText("Download .md"));
    await screen.findByText("Try again");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/render/markdown",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ scenario: SCENARIO }),
      }),
    );
  });

  it("public mode: renders the All (.zip) button wired to the bundle handler, disabled while bundling", () => {
    const onDownloadAll = vi.fn();
    renderPublic({ onDownloadAll });

    const zip = screen.getByRole("button", { name: /All \(\.zip\)/ });
    fireEvent.click(zip);
    expect(onDownloadAll).toHaveBeenCalledTimes(1);

    cleanup();
    renderPublic({ onDownloadAll, bundling: true });
    expect(
      (screen.getByRole("button", { name: /Bundling/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("saved mode with a plan id: cards link to the plan's download routes and no zip button renders", () => {
    const onDownloadAll = vi.fn();
    const { container } = render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "saved", planId: "plan-1" }}
        breakdown={READY_BREAKDOWN}
        onDownloadAll={onDownloadAll}
      />,
    );
    const hrefs = Array.from(container.querySelectorAll(".dl-card a")).map(
      (a) => a.getAttribute("href"),
    );
    expect(hrefs).toEqual([
      "/api/plans/plan-1/pdf",
      "/api/plans/plan-1/xlsx",
      "/api/plans/plan-1/crew-pdf",
      "/api/plans/plan-1/markdown",
    ]);
    // Ruling: a zip button that has no bundle route must not render.
    expect(screen.queryByText(/All \(\.zip\)/)).toBeNull();
  });

  it("saved mode without a plan id: each card funnels to signup", () => {
    const { container } = render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "saved", planId: null }}
        breakdown={READY_BREAKDOWN}
      />,
    );
    const links = Array.from(
      container.querySelectorAll('.dl-card a[href="/app"]'),
    );
    expect(links).toHaveLength(3);
    expect(links[0].textContent).toContain("Sign up to download PDF");
  });

  it("renders the empty state before generation", () => {
    render(
      <OutputCards
        summary={null}
        generated={false}
        mode={{ kind: "public", scenario: SCENARIO }}
        breakdown={{ state: "loading" }}
      />,
    );
    expect(screen.getByText("No package yet")).toBeTruthy();
    expect(document.querySelector(".dl-card")).toBeNull();
  });
});

// #197 (umbrella instance, no standalone issue): a download error is an
// ANSWER — it was computed for the scenario that was POSTed.  When the
// scenario changes, presenting the old error (and its "Try again" label)
// as current is the stale-as-current class.  The error carries the #197
// input-identity stamp and renders only while its scenario is on screen.
describe("download errors carry their input identity (#197)", () => {
  const FLOOR_400 =
    "Work zone length (50 ft) is shorter than the required shoulder taper.";

  function fail400() {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ detail: { message: FLOOR_400 } }),
        } as unknown as Response),
      ),
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the error for the scenario it answered, then drops it when the scenario changes", async () => {
    fail400();
    const s1 = { meta: { project: "A" } } as unknown as Scenario;
    const s2 = { meta: { project: "A" } } as unknown as Scenario;
    const view = render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "public", scenario: s1 }}
        breakdown={READY_BREAKDOWN}
      />,
    );
    fireEvent.click(document.querySelector(".dl-btn") as HTMLButtonElement);
    expect(await screen.findByText(FLOOR_400)).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();

    // The input changes (every edit replaces the scenario object): the
    // stale error and its Try-again label must not survive.
    view.rerender(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "public", scenario: s2 }}
        breakdown={READY_BREAKDOWN}
      />,
    );
    expect(screen.queryByText(FLOOR_400)).toBeNull();
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("the error stays while its own scenario stays (unchanged input keeps the honest failure)", async () => {
    fail400();
    const s1 = { meta: { project: "A" } } as unknown as Scenario;
    render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "public", scenario: s1 }}
        breakdown={READY_BREAKDOWN}
      />,
    );
    fireEvent.click(document.querySelector(".dl-btn") as HTMLButtonElement);
    expect(await screen.findByText(FLOOR_400)).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });
});
