// @vitest-environment happy-dom
//
// #183 — workbench downloads gate on dirty state (the #197 baseline-ref
// variant).  Pre-fix, opening a saved plan and editing it recomputed
// every on-screen number from the live scenario while the download
// anchors kept serving the DB row — screen and crew document silently
// diverging on every edit-after-open.  Post-fix: an edited-but-unsaved
// plan cannot silently download stale output; saving re-enables
// downloads that match the screen; unedited opens download normally.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));
// AppNav owns PlanSaveButton behind Clerk; the shell hands it scenario +
// onSaved, so the mock exposes a save affordance that reports the LIVE
// scenario back — the exact contract PlanSaveButton fulfills.
vi.mock("./AppNav", () => ({
  AppNav: (props: {
    scenario: unknown;
    onSaved: (id: string, name: string, saved: unknown) => void;
  }) => (
    <button
      onClick={() => props.onSaved("p1", "Plan A", props.scenario)}
    >
      MOCK_SAVE
    </button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { pinned } from "./test-fixtures";
import { PlanSaveButton } from "./PlanSaveButton";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";

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

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/device-breakdown")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => BREAKDOWN,
    } as unknown as Response);
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

function pdfAnchor(): HTMLAnchorElement | null {
  return document.querySelector('a[href="/api/plans/p1/pdf"]');
}

async function mountSavedPlan() {
  // #186: a saved plan carries its site; unpinned meta would gate the CTA.
  const saved = pinned({ ...DEFAULT_SCENARIO } as Scenario);
  render(
    <GeneratorShell
      mode="workbench"
      initialScenario={saved}
      initialPlanId="p1"
      initialPlanName="Plan A"
    />,
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Generate plan/ }));
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

describe("workbench downloads gate on dirty state (#183)", () => {
  it("an unedited open downloads normally — no new friction", async () => {
    await mountSavedPlan();
    expect(pdfAnchor()).not.toBeNull();
    expect(screen.queryAllByText(/Save to download/)).toHaveLength(0);
  });

  it("an edit disables the row-backed downloads and names the resolution", async () => {
    const user = await mountSavedPlan();
    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    // #182: the edit reaches the wire through the 350 ms fetch debounce.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 360));
    });

    // The screen recomputes from the live scenario…
    const bodies = fetchMock.mock.calls
      .filter(([u]) => String(u).includes("device-breakdown"))
      .map((c) => JSON.parse(String((c as unknown as [unknown, RequestInit])[1].body)));
    expect((bodies[bodies.length - 1] as { scenario: { speed: number } }).scenario.speed).toBe(35);
    // …so the DB-row anchors must not present as downloads of it.
    expect(pdfAnchor()).toBeNull();
    expect(document.querySelector('a[href="/api/plans/p1/quote"]')).toBeNull();
    expect(screen.getAllByText(/Save to download/).length).toBeGreaterThan(0);
  });

  it("saving re-enables downloads that match the screen", async () => {
    const user = await mountSavedPlan();
    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    expect(pdfAnchor()).toBeNull();

    fireEvent.click(screen.getByText("MOCK_SAVE"));
    expect(pdfAnchor()).not.toBeNull();
    expect(screen.queryAllByText(/Save to download/)).toHaveLength(0);
  });
});

describe("PlanSaveButton reports the persisted scenario (#183)", () => {
  it("update PUTs the live scenario and hands the same object to onSaved", async () => {
    const scenario = { ...DEFAULT_SCENARIO } as Scenario;
    const onSaved = vi.fn();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes("/api/plans/p1")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ id: "p1", name: "Plan A" }),
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as unknown as Response);
    });
    render(
      <PlanSaveButton
        scenario={scenario}
        planId="p1"
        planName="Plan A"
        onSaved={onSaved}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    const put = fetchMock.mock.calls.find(([u]) =>
      String(u).includes("/api/plans/p1"),
    ) as unknown as [unknown, RequestInit];
    expect(put).toBeTruthy();
    const body = JSON.parse(String(put[1].body)) as { data: unknown };
    expect(body.data).toEqual(scenario);
    // The baseline handed back is the SAME object that was persisted —
    // the identity the #197 baseline-ref comparison runs on.
    expect(onSaved).toHaveBeenCalledWith("p1", "Plan A", scenario);
  });
});
