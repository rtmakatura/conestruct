// @vitest-environment happy-dom
//
// Zone staging (restage inc-1): the page lifecycle derives from the
// Generate click + the real device-breakdown request state — pre →
// generating → post → error, and reopen back to pre.  Mounted-flow
// tests with releasable breakdown fetches: the transitions under test
// are exactly the ones a fake-timer prototype can't exercise.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./AuditTrail", () => ({ AuditTrail: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";

const BREAKDOWN = {
  devices: [
    {
      device: "ROAD WORK AHEAD",
      code: "W20-1",
      function: "Advance warning",
      qty: 2,
    },
  ],
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

const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
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

beforeEach(() => {
  breakdownCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function zones(): HTMLElement[] {
  return Array.from(document.querySelectorAll("section.zone"));
}

describe("zone staging lifecycle", () => {
  it("pre: dominant setup panel, empty results, no strip", async () => {
    render(<GeneratorShell mode="sandbox" />);
    await release(0, okBreakdown());

    const [setup, results] = zones();
    expect(setup.className).toContain("dominant");
    expect(setup.textContent).toContain("Describe the work zone");
    expect(setup.querySelector(".setup-panel")).not.toBeNull();
    expect(setup.querySelector(".setup-strip")).toBeNull();
    expect(results.className).not.toContain("dominant");
    expect(results.textContent).toContain("No package yet");
    expect(document.querySelector(".hero")).toBeNull();
  });

  it("generating: Generate with the answer in flight shows the strip + placeholder", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" />);
    await release(0, okBreakdown());

    // Edit-free generate while a NEW breakdown fetch is pending: force
    // one by clicking Generate before any refetch resolves.  The mount
    // fetch already resolved, so genState=post would be instant — so
    // instead assert the generating presentation by regenerating after
    // a scenario-change fetch is left pending.
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    // Post (breakdown already ready).
    expect(document.querySelector(".setup-strip")).not.toBeNull();

    // A strip edit (speed) refires the breakdown fetch → generating.
    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    expect(screen.getByText("Generating…")).toBeTruthy();
    expect(document.querySelector(".hero")).toBeNull();

    // Resolve → back to post with the hero mounted.
    await release(1, okBreakdown());
    expect(screen.queryByText("Generating…")).toBeNull();
    expect(document.querySelector(".hero")).not.toBeNull();
  });

  it("post: results zone is dominant with hero numerals and geometry rendered verbatim", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));

    const [setup, results] = zones();
    expect(results.className).toContain("dominant");
    expect(setup.className).not.toContain("dominant");

    const hero = document.querySelector(".hero")!;
    const nums = Array.from(hero.querySelectorAll(".num")).map(
      (n) => n.textContent,
    );
    expect(nums).toEqual(["42", "6"]);
    expect(hero.textContent).toContain("183 ft"); // taper_l_ft, as returned
    expect(hero.textContent).toContain("495 ft"); // buffer_b_ft
    expect(hero.textContent).toContain("55 ft o.c."); // device_spacing_ft
  });

  it("error: breakdown failure after generate shows the stale ribbon, not a silent blank", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));

    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    await release(1, errBreakdown());

    expect(document.querySelector(".stale-ribbon")).not.toBeNull();
    expect(document.querySelector(".results-stale")).not.toBeNull();
  });

  it("reopen: Edit full setup returns to the dominant panel and empties results", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    expect(document.querySelector(".hero")).not.toBeNull();

    await user.click(screen.getByText(/Edit full setup/));
    const [setup, results] = zones();
    expect(setup.className).toContain("dominant");
    expect(setup.querySelector(".setup-panel")).not.toBeNull();
    expect(results.textContent).toContain("No package yet");
    expect(document.querySelector(".hero")).toBeNull();
  });

  it("panel schedule entry reaches the POSTed scenario (payload-level, inc-8)", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" />);
    await release(0, okBreakdown());

    // The Setup panel's Schedule step: choose a work date, then flip to
    // the deliberate "Not set" mode — both edits must ride the same
    // scenario.schedule the strip and hours chip read.
    const dateInput = document.getElementById("sched-date") as HTMLInputElement;
    expect(dateInput).not.toBeNull();
    await user.type(dateInput, "2026-08-04");
    await release(1, okBreakdown());

    let bodies = fetchMock.mock.calls
      .filter(([u]) => String(u).includes("device-breakdown"))
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    let last = bodies[bodies.length - 1] as {
      scenario: { schedule?: { date_mode: string; work_date?: string } };
    };
    expect(last.scenario.schedule?.work_date).toBe("2026-08-04");
    expect(last.scenario.schedule?.date_mode).toBe("single");

    await user.click(screen.getByRole("button", { name: "Not set" }));
    bodies = fetchMock.mock.calls
      .filter(([u]) => String(u).includes("device-breakdown"))
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    last = bodies[bodies.length - 1] as {
      scenario: { schedule?: { date_mode: string } };
    };
    expect(last.scenario.schedule?.date_mode).toBe("tbd");
  });

  it("strip inline edit writes the scenario and refires the request (payload-level)", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));

    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");

    // The refetch carries the edited speed in the POSTed scenario.
    const bodies = fetchMock.mock.calls
      .filter(([u]) => String(u).includes("device-breakdown"))
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    const last = bodies[bodies.length - 1] as {
      scenario: { speed: number };
    };
    expect(last.scenario.speed).toBe(35);
  });
});
