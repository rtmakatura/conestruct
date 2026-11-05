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

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mountJurisdiction as mountTiered, openRow, openSection, rowOf, sectionEl } from "./reference-test-utils";
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

// The #187 cue, in the words the results stack renders it
// (GeneratorShell.tsx; mounted and counted once in
// AuditTrail.declined-stale.test.tsx).  The zero-count below is only a
// claim if this string is one the product can render, so that test
// first pins it to the shell's source.
const REFRESH_CUE = "◌ previous answer, refreshing…";

afterEach(cleanup);

describe("Zone 3 density contract — tiers", () => {
  // #187 survives the ledger's deletion as ONE tr-prov cue in a slot of
  // reserved height (P1): "◌ previous answer, refreshing…" while a
  // same-jurisdiction refetch is open; the slot stays, empty, when not.
  //
  // #288 clause 4 MOVED that slot out of this component and into the
  // results stack, because ✓ and ◌ were promoted to rows of the stack and
  // a cue inside a closed disclosure cannot say the counts above it are
  // stale (Rule 10).  The claim is unchanged and now lives where the
  // stack owns it — GeneratorShell.disclosures.test.tsx — so this suite
  // asserts only that the component no longer carries a second copy.
  it("the #187 cue is NOT duplicated here — the stack owns the one copy", () => {
    const { container } = mountTiered(jur("greeley"), SCHEDULE, "arterial", { revalidating: true });
    expect(
      readFileSync(join(__dirname, "GeneratorShell.tsx"), "utf-8"),
      "the cue text is the shell's own",
    ).toContain(REFRESH_CUE);
    expect(container.querySelector(".tier-cue")).toBeNull();
    expect(screen.queryAllByText(REFRESH_CUE)).toHaveLength(0);
    expect(document.body.textContent).not.toContain("checking against");
    cleanup();
    const settled = mountTiered(jur("greeley"), SCHEDULE);
    expect(settled.container.querySelector(".tier-cue")).toBeNull();
    expect(document.body.textContent).not.toContain("refreshing");
  });

  it("a fired delta is a ▲ row; its rule reads when the row opens", async () => {
    const user = userEvent.setup();
    mountTiered(jur("greeley"), SCHEDULE);
    await openSection(user, "reference");
    const row = sectionEl("reference").querySelector("[data-row=delta-0]") as HTMLElement;
    expect(row.querySelector(".rr-glyph")?.textContent).toBe("▲");
    await openRow(user, row);
    expect(screen.getByText(/Type C arrow boards must be used/i)).toBeTruthy();
  });

  it("a closed section holds no rows; a click reveals them; a second click closes it", async () => {
    const user = userEvent.setup();
    mountTiered(jur("greeley"), SCHEDULE);
    const head = sectionEl("reference").querySelector("button.rs-head") as HTMLElement;
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(rowOf("reference", "Permit")).toBeNull();
    await user.click(head);
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(rowOf("reference", "Permit")).not.toBeNull();
    await user.click(head);
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(rowOf("reference", "Permit")).toBeNull();
  });

  it("an empty family adds no line: the rule count is the rules on record", async () => {
    const user = userEvent.setup();
    const g = jur("greeley");
    expect(g.chips.device).toHaveLength(0);
    mountTiered(g, SCHEDULE);
    await openSection(user, "reference");
    const row = sectionEl("reference").querySelector("[data-row=keep-in-mind]") as HTMLElement;
    await openRow(user, row);
    expect(row.querySelectorAll(".rr-lines li").length).toBe(
      g.chips.personnel.length + g.applied_deltas.filter((d) => d.status !== "fires").length,
    );
  });

  it("obligations read under the ⚠ row (ruled flag b): Greeley's personnel gates", async () => {
    const user = userEvent.setup();
    mountTiered(jur("greeley"), SCHEDULE);
    await openSection(user, "reference");
    const row = sectionEl("reference").querySelector("[data-row=keep-in-mind]") as HTMLElement;
    expect(row.querySelector(".rr-glyph")?.textContent).toBe("⚠");
    await openRow(user, row);
    expect(screen.getByText(/Traffic Control Review Form signer/i)).toBeTruthy();
  });
});

describe("the work-hours row — only the plan-invalidating state starts open", () => {
  const unknown = (): JurisdictionBlock => ({
    ...jur("loveland"),
    hours_eval: { status: "unknown", violations: [] } as HoursEval,
  });

  it("OUTSIDE: the row starts open with the backend violations readable, ⚠ with words", async () => {
    const user = userEvent.setup();
    // Loveland's hours_eval is baked OUTSIDE (8:00 start overlaps the 7:00-8:30 ban).
    mountTiered(jur("loveland"), SCHEDULE);
    await openSection(user, "reference");
    const row = rowOf("reference", "Work hours")!;
    expect(row.querySelector(".rr-head")?.getAttribute("aria-expanded")).toBe("true");
    expect(row.querySelector(".rr-glyph")?.textContent).toBe("⚠");
    expect(row.textContent).toContain("outside the window");
    expect(screen.getByText(/0\.5 h overlaps/i)).toBeTruthy();
  });

  it("INSIDE: ✓, closed", async () => {
    const user = userEvent.setup();
    mountTiered({ ...jur("loveland"), hours_eval: { status: "inside", violations: [] } as HoursEval }, SCHEDULE);
    await openSection(user, "reference");
    const row = rowOf("reference", "Work hours")!;
    expect(row.querySelector(".rr-head")?.getAttribute("aria-expanded")).toBe("false");
    expect(row.querySelector(".rr-glyph")?.textContent).toBe("✓");
    expect(screen.queryByText(/Within the permitted window/i)).toBeNull();
  });

  it("UNKNOWN + 'Not set': ◌, closed, and the 'not checked' arm when opened; absence is not an error", async () => {
    const user = userEvent.setup();
    mountTiered(unknown(), { date_mode: "tbd" });
    await openSection(user, "reference");
    const row = rowOf("reference", "Work hours")!;
    expect(row.querySelector(".rr-head")?.getAttribute("aria-expanded")).toBe("false");
    expect(row.querySelector(".rr-glyph")?.textContent).toBe("◌");
    await openRow(user, row);
    expect(screen.getByText(/Schedule marked .Not set.. The windows above are/i)).toBeTruthy();
  });

  it("UNKNOWN + schedule merely unentered: prompts Setup entry instead of claiming 'not checked'", async () => {
    const user = userEvent.setup();
    // #199: mid-entry is a chosen date mode whose times aren't in yet.
    mountTiered(unknown(), { date_mode: "single" });
    await openSection(user, "reference");
    await openRow(user, rowOf("reference", "Work hours")!);
    expect(screen.getByText(/enter the\s+work date and start\/end times in the Setup panel/i)).toBeTruthy();
    expect(screen.queryByText(/Schedule marked .Not set./i)).toBeNull();
  });

  it("a manual close of the row that started open is respected", async () => {
    const user = userEvent.setup();
    mountTiered(jur("loveland"), SCHEDULE);
    await openSection(user, "reference");
    const head = rowOf("reference", "Work hours")!.querySelector(".rr-head") as HTMLElement;
    await user.click(head);
    expect(head.getAttribute("aria-expanded")).toBe("false");
  });
});
