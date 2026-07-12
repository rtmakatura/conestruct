// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { OutputCards } from "./OutputCards";
import { BUNDLE_PART_KINDS } from "@/lib/render-types";
import type { AuditSummary } from "@/lib/render-types";
import type { Scenario } from "@/lib/scenarios";
import type { DeviceBreakdownState } from "./DeviceBreakdown";

// Sheet-index refactor: OutputCards previously had zero tests and was
// mocked to null in every GeneratorShell suite — the exact blind spot
// class that let the picker re-apply bug (#112) ship green through 198
// tests.  These are mounted-flow tests of the rendered table: real
// backend values in the right cells, the loading/error fallbacks, table
// semantics, all three mode variants, and the color-system rule that
// sheet letters are labels (neutral ink), never output-orange.

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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("OutputCards sheet index", () => {
  it("renders one row per deliverable with backend values in the Qty cells", () => {
    const { container } = renderPublic();

    const bodyRows = container.querySelectorAll("tbody tr");
    expect(bodyRows).toHaveLength(3);

    // Backend-sourced quantities land in the right rows.
    const [plan, devices, crew] = Array.from(bodyRows);
    expect(plan.textContent).toContain("Plan sheet");
    expect(plan.textContent).toContain("42"); // total_devices
    expect(plan.textContent).toContain("TA-3"); // summary.ta in the spec line
    expect(plan.textContent).toContain("S-630-1"); // summary.cdot_sheet
    expect(devices.textContent).toContain("Device list");
    expect(devices.textContent).toContain("6"); // unique_types
    expect(crew.textContent).toContain("Crew instructions");
    expect(crew.textContent).toContain("8"); // step_count
  });

  it("uses real table semantics: five column headers with scope=col", () => {
    const { container } = renderPublic();
    const headers = container.querySelectorAll('th[scope="col"]');
    expect(Array.from(headers).map((h) => h.textContent)).toEqual([
      "Sheet",
      "Deliverable",
      "Format",
      "Qty",
      "File",
    ]);
  });

  it("derives the header file count from the actual bundle contents, not the row count", () => {
    renderPublic();
    // The zip carries quote.xlsx in addition to the three index rows —
    // the label must describe the package (4 files), never the table.
    expect(BUNDLE_PART_KINDS.length).toBe(4);
    expect(
      screen.getByText(`MHT PACKAGE · ${BUNDLE_PART_KINDS.length} FILES`),
    ).toBeTruthy();
    expect(screen.queryByText(/3 (FILES|SHEETS)/)).toBeNull();
  });

  it("renders sheet letters in neutral ink, never output-orange", () => {
    const { container } = renderPublic();
    const letterCells = Array.from(
      container.querySelectorAll("tbody tr td:first-child"),
    );
    expect(letterCells.map((c) => c.textContent)).toEqual(["A", "B", "C"]);
    for (const cell of letterCells) {
      expect(cell.className).toContain("--ink-mute");
      expect(cell.className).not.toContain("--dim");
      expect(cell.className).not.toContain("--orange");
    }
  });

  it("shows the loading ellipsis and error dash fallbacks for breakdown stats", () => {
    const { container: loading } = renderPublic({
      breakdown: { state: "loading" },
    });
    const loadingRows = loading.querySelectorAll("tbody tr");
    expect(loadingRows[0].textContent).toContain("…");

    cleanup();

    const { container: errored } = renderPublic({
      breakdown: { state: "error", message: "boom" },
      summary: null,
    });
    const errorRows = errored.querySelectorAll("tbody tr");
    expect(errorRows[0].textContent).toContain("—"); // devices
    expect(errorRows[2].textContent).toContain("—"); // steps (null summary)
  });

  it("public mode: the crew row offers PDF plus a secondary .md download, and clicking posts the scenario", async () => {
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

  it("every row download button shares one fixed size, and every row one fixed height", () => {
    const { container } = renderPublic();

    // All four download buttons (plan, devices, crew PDF, crew .md)
    // carry the same fixed width and height class.
    const buttons = Array.from(container.querySelectorAll("tbody button"));
    expect(buttons).toHaveLength(4);
    for (const b of buttons) {
      expect(b.className).toContain("h-[34px]");
      expect(b.className).toContain("w-[152px]");
    }

    // The crew row's pair sits side by side (flex row, not flex-col),
    // and every cell pins the shared fixed row height, middle-aligned.
    const crewButtonWrap = buttons[2].parentElement!;
    expect(crewButtonWrap.className).not.toContain("flex-col");
    expect(crewButtonWrap.contains(buttons[3])).toBe(true);
    for (const cell of Array.from(container.querySelectorAll("tbody td"))) {
      expect(cell.className).toContain("h-[72px]");
      expect(cell.className).toContain("align-middle");
    }
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
      (screen.getByRole("button", { name: /All \(\.zip\)/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("saved mode with a plan id: rows link to the plan's download routes and no zip button renders", () => {
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
    const hrefs = Array.from(container.querySelectorAll("tbody a")).map((a) =>
      a.getAttribute("href"),
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

  it("saved mode without a plan id: each row funnels to signup", () => {
    const { container } = render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "saved", planId: null }}
        breakdown={READY_BREAKDOWN}
      />,
    );
    const links = Array.from(container.querySelectorAll('tbody a[href="/app"]'));
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
    expect(document.querySelector("table")).toBeNull();
  });
});
