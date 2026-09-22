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

// #289 Phase 2 — #222's PENDING TREATMENT IS THE COLUMN ITSELF.
//
// #222's problem: pre-pin, the panel rendered every downstream step at
// once, and detection fills road facts from the pin, so inviting that
// work first invited an overwrite.  Its answer was a per-section dim +
// `inert` body behind a focusable "set a location first" summary.
//
// The column answers the same problem by construction.  Rule 65 opens ONE
// band — WHERE, until there is a pin — and §2.1 renders the steps below
// it as pending fact lines with rule 59's reason in the right track.
// There is no downstream body to make inert, because there is no
// downstream body: the work that could be overwritten is not on screen.
//
// So the mechanism retires and the CONTRACT transfers, which is what
// these cases assert now.  `stepsPending` and `FieldGroup`'s pending
// treatment both stay in the tree — the kind's own sections still take
// them, and the S4/S5 commit inherits them for the lock (rule 60).

describe("pre-pin gating (#222), as the column does it", () => {
  it("NI pre-pin: one band open, the rest pending lines with the reason in them", () => {
    render(
      <GeneratorShell
        mode="sandbox"
        initialScenario={DEFAULT_NEAR_INTERSECTION}
      />,
    );
    const stack = document.querySelector('[data-testid="band-stack"]')!;
    expect(stack.getAttribute("data-open-band")).toBe("where");
    // WHAT is a pending fact line: no value, no link, and the right
    // track states why (rule 59).
    const what = document.querySelector('[data-testid="fact-what"]')!;
    expect(what.getAttribute("data-fact-state")).toBe("pending");
    expect(what.querySelector("button")).toBeNull();
    expect(what.textContent).toContain("find the work first");
    // The road facts detection would overwrite are not on screen at all,
    // which is #222's whole point, reached without an inert body.
    expect(document.querySelector("#what-speed")).toBeNull();
    expect(document.querySelector("#what-road-type")).toBeNull();
    // The kind chips stay live pre-pin: the kind is UPSTREAM of the pin
    // (it decides the picker's capture flow) and detection never
    // overwrites it.  Carried from the panel's own comment.
    expect(
      document.querySelector('[data-testid="kind-chip-shoulder"]'),
    ).not.toBeNull();
  });

  it("post-pin: the pending line becomes an answer, and the band opens", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    const stack = document.querySelector('[data-testid="band-stack"]')!;
    expect(stack.getAttribute("data-open-band")).toBe("what");
    const where = document.querySelector('[data-testid="fact-where"]')!;
    expect(where.getAttribute("data-fact-state")).toBe("done");
    expect(where.querySelector("button")!.textContent).toBe("CHANGE");
    expect(document.querySelector("[inert]")).toBeNull();
  });

  it("the gate's own sentence is on screen, once, on the disabled primary", () => {
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    // #222's summary said "Pending — set a location first"; the blocker
    // chain says the same thing in the words rule 139 single-sources, and
    // #260 makes the CTA reason the one surface that carries it.
    const reason = document.querySelector('[data-testid="cta-reason"]')!;
    expect(reason.textContent).toContain("Set a location first");
  });
});

describe("the step vocabulary (#222 / #228), as the column does it", () => {
  it("the open band carries its step index; the column counts to four, not seven", () => {
    render(
      <GeneratorShell
        mode="sandbox"
        initialScenario={DEFAULT_NEAR_INTERSECTION}
      />,
    );
    // Ruling 198: four bands, not five — WHERE, WHAT, GENERATE and the
    // results.  #222's seven ascending STEP tags were the panel's
    // sections, and the sections are gone (§8.16).  Role 4 carries the
    // index now, on the open band's header, one at a time (rule 62).
    const indices = Array.from(document.querySelectorAll(".tr-step"))
      .map((e) => e.textContent ?? "")
      .filter((t) => /^STEP \d OF 4$/.test(t));
    expect(indices).toEqual(["STEP 1 OF 4"]);
  });
});
