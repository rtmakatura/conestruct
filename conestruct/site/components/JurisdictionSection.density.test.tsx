// @vitest-environment happy-dom
//
// THE DENSITY CONTRACT (design deliverable 4, Zone 3):
//   * every reference family is one collapsed summary chip;
//   * one click reveals full detail, one fact per row;
//   * ONLY plan-invalidating chips auto-expand — the hours chip when
//     the backend hours_eval says the schedule is OUTSIDE the window;
//   * empty families render nothing (no placeholder chip).
// Mounted-flow tests over the real regenerated fixture data.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { JurisdictionSection } from "./JurisdictionSection";
import type { HoursEval, JurisdictionBlock } from "@/lib/jurisdiction";
import demo from "./__fixtures__/jurisdiction-demo.json";

const jur = (key: string): JurisdictionBlock =>
  (demo as { jurisdictions: Record<string, unknown> }).jurisdictions[
    key
  ] as JurisdictionBlock;

const noop = () => {};

function mount(j: JurisdictionBlock) {
  return render(
    <JurisdictionSection
      jurisdiction={j}
      loading={false}
      streetClass="arterial"
      schedule={{
        date_mode: "single",
        work_date: "2026-07-22",
        start_time: 8.0,
        end_time: 15.0,
      }}
    />,
  );
}

function chipHead(name: RegExp): HTMLElement {
  return screen.getByRole("button", { name });
}

afterEach(cleanup);

describe("Zone 3 density contract", () => {
  it("chips are collapsed by default and expand/collapse on click", async () => {
    mount(jur("greeley"));
    const head = chipHead(/greeley deltas/i);
    expect(head.getAttribute("aria-expanded")).toBe("false");
    // Body detail absent while collapsed.
    expect(
      screen.queryByText(/Type C arrow boards must be used/i),
    ).toBeNull();

    await userEvent.click(head);
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByText(/Type C arrow boards must be used/i),
    ).toBeTruthy();

    await userEvent.click(head);
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.queryByText(/Type C arrow boards must be used/i),
    ).toBeNull();
  });

  it("empty families render nothing — Greeley has no device mandates, so no chip", () => {
    const g = jur("greeley");
    expect(g.chips.device).toHaveLength(0);
    mount(g);
    expect(
      screen.queryByRole("button", { name: /device mandates/i }),
    ).toBeNull();
  });

  it("the collapsed summary carries the family's counts, not its detail", () => {
    mount(jur("greeley"));
    const head = chipHead(/personnel gates/i);
    // Greeley fixture: 2 personnel chips, 1 conditional.
    expect(head.textContent).toMatch(/2/);
    expect(head.textContent).toMatch(/1.*conditional/i);
    // Full rule text stays behind the click.
    expect(
      screen.queryByText(/Traffic Control Review Form signer/i),
    ).toBeNull();
  });
});

describe("hours chip auto-expand — plan-invalidating states only", () => {
  it("OUTSIDE the window: auto-expands with the amber accent and the backend violations visible", () => {
    // Loveland fixture's hours_eval is baked OUTSIDE (8:00 start
    // overlaps the 7:00–8:30 ban).
    mount(jur("loveland"));
    const head = screen.getByRole("button", { name: /work hours — loveland/i });
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(head.textContent).toMatch(/outside window · review schedule/i);
    // Violations readable without any click — this is the exception the
    // contract reserves for plan-invalidating facts.
    expect(screen.getByText(/0\.5 h overlaps/i)).toBeTruthy();
    const chip = head.closest(".refchip")!;
    expect(chip.className).toContain("auto-expand");
    expect(chip.className).toContain("sev-warn");
  });

  it("INSIDE the window: stays collapsed with the pass verdict on the summary", () => {
    const l = jur("loveland");
    const inside: JurisdictionBlock = {
      ...l,
      hours_eval: { status: "inside", violations: [] } as HoursEval,
    };
    mount(inside);
    const head = screen.getByRole("button", { name: /work hours — loveland/i });
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(head.textContent).toMatch(/inside window ✓/i);
    expect(head.closest(".refchip")!.className).not.toContain("auto-expand");
  });

  it("UNKNOWN + user chose 'Not set': collapsed, chromeless 'not checked' — absence of signal is not an error", () => {
    const l = jur("loveland");
    const unknown: JurisdictionBlock = {
      ...l,
      hours_eval: { status: "unknown", violations: [] } as HoursEval,
    };
    render(
      <JurisdictionSection
        jurisdiction={unknown}
        loading={false}
        streetClass="arterial"
        schedule={{ date_mode: "tbd" }}
      />,
    );
    const head = screen.getByRole("button", { name: /work hours — loveland/i });
    expect(head.getAttribute("aria-expanded")).toBe("false");
    // "not checked" is reserved for the deliberate choice (inc-8).
    expect(head.textContent).toMatch(/not checked/i);
    const chip = head.closest(".refchip")!;
    expect(chip.className).toContain("sev-info");
    expect(chip.className).not.toContain("auto-expand");
  });

  it("UNKNOWN + schedule merely unentered: collapsed, prompts Setup entry instead of claiming 'not checked'", () => {
    const l = jur("loveland");
    const unknown: JurisdictionBlock = {
      ...l,
      hours_eval: { status: "unknown", violations: [] } as HoursEval,
    };
    render(
      <JurisdictionSection
        jurisdiction={unknown}
        loading={false}
        streetClass="arterial"
        schedule={null}
      />,
    );
    const head = screen.getByRole("button", { name: /work hours — loveland/i });
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(head.textContent).toMatch(/set date & times in Setup/i);
    expect(head.textContent).not.toMatch(/not checked/i);
  });

  it("a manual collapse of an auto-expanded chip is respected", async () => {
    mount(jur("loveland"));
    const head = screen.getByRole("button", { name: /work hours — loveland/i });
    expect(head.getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(head);
    expect(head.getAttribute("aria-expanded")).toBe("false");
  });
});
