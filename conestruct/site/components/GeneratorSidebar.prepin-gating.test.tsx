// @vitest-environment happy-dom
//
// #222 — pre-pin step gating + the step relabel, MOUNTED through the
// real shell (rule 11: the gating decision lives in GeneratorSidebar's
// stepsPending wiring, so the assertions read the rendered panel).
//
//   * Pre-pin: every step after Location renders its header plus a
//     FOCUSABLE pending summary; the field body carries ``inert`` +
//     aria-hidden (the browser enforces unfocusability — no trap, and
//     the summary is the keyboard/AT path).  Scenario stays live: the
//     kind is upstream of the pin and detection never overwrites it.
//   * Post-pin: no summaries, no inert, fields byte-identical to
//     before — unchanged behavior.
//   * The relabel: Scenario reads STEP 1, Location STEP 2, and the
//     panel's header labels appear in ascending step order in the DOM
//     (the walked S1 inversion — Scenario/STEP 2 above Location/STEP 1
//     — is gone by renumbering, not reordering).
//   * A summary click jumps focus to the Location header (#193: a
//     user-initiated armed action owns the focus move).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";
import { DEFAULT_NEAR_INTERSECTION, DEFAULT_SCENARIO } from "@/lib/scenarios";

const fetchMock = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response),
);

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function pendingSummaries(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll(".setup-panel .step-pending-summary"),
  ) as HTMLButtonElement[];
}

function inertBodies(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll(".setup-panel .step-pending-body"),
  ) as HTMLElement[];
}

describe("pre-pin gating (#222)", () => {
  it("NI pre-pin: five downstream steps pending — summary focusable, body inert + aria-hidden", () => {
    render(
      <GeneratorShell
        mode="sandbox"
        initialScenario={DEFAULT_NEAR_INTERSECTION}
      />,
    );
    // Road, Work, Cross street, Schedule, Site conditions — and the
    // #227 jurisdiction band, a downstream section like the rest (its
    // suggestions are pin-derived; GO standing, 2026-08-27).  It has no
    // STEP tag (not a rail step — #228 owns rail vocabulary), so the
    // relabel test below is untouched.
    const summaries = pendingSummaries();
    expect(summaries.length).toBe(6);
    for (const s of summaries) {
      expect(s.textContent).toContain("Pending — set a location first");
      // A real <button>: in the Tab order, announced, actionable.
      expect(s.tagName).toBe("BUTTON");
      expect(s.disabled).toBe(false);
    }
    const bodies = inertBodies();
    expect(bodies.length).toBe(6);
    for (const b of bodies) {
      // ``inert`` unfocuses the whole body in the browser (no trap);
      // aria-hidden is the explicit accessibility-tree twin.
      expect(b.hasAttribute("inert")).toBe(true);
      expect(b.getAttribute("aria-hidden")).toBe("true");
    }
    // The Scenario picker stays live pre-pin (upstream of the pin).
    expect(
      screen.getByRole("button", { name: /Shoulder work/i },
      ) instanceof HTMLButtonElement,
    ).toBe(true);
    // Location itself is never gated.
    expect(document.getElementById("rail-step-location")).not.toBeNull();
    expect(
      document
        .getElementById("rail-step-location")!
        .closest("div")!
        .parentElement!.querySelector(".step-pending-summary"),
    ).toBeNull();
  });

  it("post-pin: no pending chrome anywhere — unchanged behavior", () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    expect(pendingSummaries().length).toBe(0);
    expect(inertBodies().length).toBe(0);
    expect(document.querySelector("[inert]")).toBeNull();
  });

  it("a pending summary click moves focus to the Location header (armed action)", async () => {
    Element.prototype.scrollIntoView = function () {};
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    await userEvent.click(pendingSummaries()[0]);
    expect(document.activeElement?.id).toBe("rail-step-location");
  });
});

describe("the step relabel (#222)", () => {
  it("Scenario reads STEP 1, Location STEP 2, and header tags ascend in DOM order", () => {
    render(
      <GeneratorShell
        mode="sandbox"
        initialScenario={DEFAULT_NEAR_INTERSECTION}
      />,
    );
    const tags = Array.from(
      document.querySelectorAll(".setup-panel span"),
    )
      .map((e) => e.textContent ?? "")
      .filter((t) => /^STEP \d+$/.test(t))
      .map((t) => Number(t.replace("STEP ", "")));
    // NI: Scenario 1, Location 2, Road 3, Work 4, Cross street 5,
    // Schedule 6, Site conditions 7 — ascending as rendered.
    expect(tags).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // And the labels pair with the right numbers.
    const headers = Array.from(
      document.querySelectorAll(".setup-panel div"),
    ).filter(
      (e) =>
        e.children.length === 2 &&
        /^STEP \d+$/.test(e.children[1].textContent ?? ""),
    );
    const pairs = headers.map((e) => [
      e.children[0].textContent,
      e.children[1].textContent,
    ]);
    expect(pairs).toContainEqual(["Scenario", "STEP 1"]);
    expect(pairs).toContainEqual(["Location", "STEP 2"]);
  });
});
