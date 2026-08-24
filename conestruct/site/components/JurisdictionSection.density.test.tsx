// @vitest-environment happy-dom
//
// THE DENSITY CONTRACT, tier edition (#219 — migrated from the chip
// stack's suite; every assertion keeps its substance, re-targeted at
// the ruled consequence tiers):
//   * the ledger line always renders, all four counted tokens, zeros
//     included (flag k);
//   * ✓ / ◌ / i containers are collapsed by default; one click reveals
//     full detail;
//   * ONLY ▲ CHANGED and ⚠ NEEDS ATTENTION auto-open, and only when
//     non-empty — the hours OUTSIDE verdict now auto-opens ⚠ (the
//     #188-family contract at tier level);
//   * empty tiers render no container;
//   * a manual collapse of an auto-opened tier is respected.
// Mounted-flow tests over the real regenerated fixture data.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mountTiered } from "./tiered-test-utils";
import type { HoursEval, JurisdictionBlock } from "@/lib/jurisdiction";
import demo from "./__fixtures__/jurisdiction-demo.json";

const jur = (key: string): JurisdictionBlock =>
  (demo as { jurisdictions: Record<string, unknown> }).jurisdictions[
    key
  ] as JurisdictionBlock;

const SCHEDULE = {
  date_mode: "single" as const,
  work_date: "2026-07-22",
  start_time: 8.0,
  end_time: 15.0,
};

afterEach(cleanup);

describe("Zone 3 density contract — tiers", () => {
  it("the ledger renders all four counted tokens, zeros included", () => {
    mountTiered(jur("greeley"), SCHEDULE);
    const ledger = screen.getByTestId("tier-ledger");
    expect(ledger.textContent).toMatch(/\d+ changes?/);
    expect(ledger.textContent).toMatch(/\d+ needs attention/);
    expect(ledger.textContent).toMatch(/\d+ checked/);
    expect(ledger.textContent).toMatch(/\d+ pending/);
    expect(ledger.textContent).toMatch(/reference/);
  });

  it("▲ auto-opens when a delta fires — the fired rule reads without a click", () => {
    mountTiered(jur("greeley"), SCHEDULE);
    const head = screen.getByRole("button", { name: /changed this plan/i });
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByText(/Type C arrow boards must be used/i),
    ).toBeTruthy();
  });

  it("collapsed tiers hide detail; a click reveals it; a second click collapses", async () => {
    mountTiered(jur("greeley"), SCHEDULE);
    const head = screen.getByRole("button", { name: /reference/i });
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /permit — greeley/i })).toBeNull();

    await userEvent.click(head);
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: /permit — greeley/i })).toBeTruthy();

    await userEvent.click(head);
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /permit — greeley/i })).toBeNull();
  });

  it("empty families render nothing — Greeley has no device mandates, so no obligations group for them", () => {
    const g = jur("greeley");
    expect(g.chips.device).toHaveLength(0);
    mountTiered(g, SCHEDULE);
    expect(screen.queryByText(/device mandates — obligations/i)).toBeNull();
  });

  it("obligations surface in ⚠ (ruled flag b): Greeley's 2 personnel gates, auto-open", () => {
    mountTiered(jur("greeley"), SCHEDULE);
    const head = screen.getByRole("button", { name: /needs attention/i });
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/personnel gates — obligations/i)).toBeTruthy();
    // Full rule text now reads in place — obligations are decisions owed.
    expect(
      screen.getByText(/Traffic Control Review Form signer/i),
    ).toBeTruthy();
  });
});

describe("hours verdict placement — plan-invalidating states only auto-open", () => {
  it("OUTSIDE: ⚠ auto-opens with the backend violations readable, no click", () => {
    // Loveland fixture's hours_eval is baked OUTSIDE (8:00 start
    // overlaps the 7:00–8:30 ban).
    mountTiered(jur("loveland"), SCHEDULE);
    const head = screen.getByRole("button", { name: /needs attention/i });
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/0\.5 h overlaps/i)).toBeTruthy();
    const chip = head.closest(".refchip")!;
    expect(chip.className).toContain("auto-expand");
    expect(chip.className).toContain("sev-warn");
  });

  it("INSIDE: the verdict sits in ✓, collapsed — no auto-open", () => {
    const l = jur("loveland");
    const inside: JurisdictionBlock = {
      ...l,
      hours_eval: { status: "inside", violations: [] } as HoursEval,
    };
    mountTiered(inside, SCHEDULE);
    const head = screen.getByRole("button", { name: /checked & passed/i });
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/Within the permitted window/i)).toBeNull();
  });

  it("UNKNOWN + 'Not set': ◌ holds the chromeless 'not checked' arm — absence is not an error", async () => {
    const l = jur("loveland");
    const unknown: JurisdictionBlock = {
      ...l,
      hours_eval: { status: "unknown", violations: [] } as HoursEval,
    };
    mountTiered(unknown, { date_mode: "tbd" });
    const head = screen.getByRole("button", { name: /pending \/ not verified/i });
    expect(head.getAttribute("aria-expanded")).toBe("false");
    const chip = head.closest(".refchip")!;
    expect(chip.className).toContain("sev-pending");
    expect(chip.className).not.toContain("auto-expand");
    await userEvent.click(head);
    expect(
      screen.getByText(/Schedule marked .Not set. — the windows above are/i),
    ).toBeTruthy();
  });

  it("UNKNOWN + schedule merely unentered: ◌ prompts Setup entry instead of claiming 'not checked'", async () => {
    const l = jur("loveland");
    const unknown: JurisdictionBlock = {
      ...l,
      hours_eval: { status: "unknown", violations: [] } as HoursEval,
    };
    // #199: mid-entry is a chosen date mode whose times aren't in yet.
    mountTiered(unknown, { date_mode: "single" });
    await userEvent.click(
      screen.getByRole("button", { name: /pending \/ not verified/i }),
    );
    expect(
      screen.getByText(/enter the\s+work date and start\/end times in the Setup panel/i),
    ).toBeTruthy();
    expect(screen.queryByText(/Schedule marked .Not set./i)).toBeNull();
  });

  it("a manual collapse of an auto-opened tier is respected", async () => {
    mountTiered(jur("loveland"), SCHEDULE);
    const head = screen.getByRole("button", { name: /needs attention/i });
    expect(head.getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(head);
    expect(head.getAttribute("aria-expanded")).toBe("false");
  });
});
