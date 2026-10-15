// @vitest-environment happy-dom
//
// #202 — the quote settings join the #183 dirty baseline.  A saved plan
// opens on its saved settings; a rate edit makes the plan dirty (the
// row-backed quote no longer matches the screen, so the downloads ask for
// a save); a save that persists those settings makes it clean again.
// Mounted (Rule 11), on #183's harness.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));
// The nav's Save, reduced to what PlanSaveButton does on success: hand
// back the scenario and the settings the body was built from.
vi.mock("./AppNav", () => ({
  AppNav: (props: {
    scenario: unknown;
    quoteSettings?: unknown;
    onSaved: (id: string, name: string, saved: unknown, settings?: unknown) => void;
  }) => (
    <button onClick={() => props.onSaved("p1", "Plan A", props.scenario, props.quoteSettings)}>
      MOCK_SAVE
    </button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { pinned, MIN_AUDIT } from "./test-fixtures";
import { DEFAULT_QUOTE_SETTINGS } from "@/lib/quote-settings";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) {
    return Promise.resolve({ ok: true, status: 200, json: async () => MIN_AUDIT } as unknown as Response);
  }
  return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as unknown as Response);
});

const quoteDownload = () => document.querySelector('[data-download="/api/plans/p1/quote"]');

async function mountSavedPlan() {
  const saved = pinned({ ...DEFAULT_SCENARIO } as Scenario);
  render(
    <GeneratorShell
      mode="workbench"
      initialScenario={saved}
      initialPlanId="p1"
      initialPlanName="Plan A"
      initialQuoteSettings={{ ...DEFAULT_QUOTE_SETTINGS, overhead_pct: 0.2 }}
    />,
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Generate plan/ }));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
  });
  fireEvent.click(screen.getByRole("button", { name: /Pricing quote/ }));
  return user;
}

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("saved quote settings join the dirty baseline (#202)", () => {
  it("opens on the saved settings, clean", async () => {
    await mountSavedPlan();
    expect((screen.getByLabelText("Overhead (%)") as HTMLInputElement).value).toBe("20");
    expect(quoteDownload()).not.toBeNull();
  });

  it("a rate edit makes the plan dirty; saving it makes it clean", async () => {
    await mountSavedPlan();
    fireEvent.change(screen.getByLabelText("Overhead (%)"), { target: { value: "25" } });
    expect(quoteDownload()).toBeNull();
    expect(screen.getAllByText(/Save to download/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("MOCK_SAVE"));
    expect(quoteDownload()).not.toBeNull();
    expect(screen.queryAllByText(/Save to download/)).toHaveLength(0);
  });
});
