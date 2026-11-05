// #443: the shared mount for the suites that read the three sections.  It
// computes the ledger the way GeneratorShell does (assignTiers over the same
// inputs) and opens sections and rows by clicking, as a user does (Rule 11).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { expect } from "vitest";
import type userEvent from "@testing-library/user-event";

import { ReferenceSections } from "./ReferenceSections";
import { PINNED_SHOULDER } from "./test-fixtures";
import type { JurisdictionBlock, StreetClass, WorkScheduleInput } from "@/lib/jurisdiction";
import type { AuditResponse } from "@/lib/render-types";
import type { SectionId } from "@/lib/reference-sections";
import type { Scenario } from "@/lib/scenarios";
import { assignTiers } from "@/lib/tiering";

export const FIXTURE_DIR = join(__dirname, "..", "..", "..", "tests", "fixtures", "tiering");

export interface Recorded {
  scenario: Scenario;
  audit: AuditResponse;
  jurisdiction: JurisdictionBlock;
}

export const loadFixture = (name: string): Recorded =>
  JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), "utf-8"));

export const expectations: Record<string, { ledger: Record<string, number> }> = JSON.parse(
  readFileSync(join(FIXTURE_DIR, "tiering-expectations.json"), "utf-8"),
);

export const ledgerOf = (fx: Pick<Recorded, "audit" | "jurisdiction">) =>
  assignTiers({ jurisdiction: fx.jurisdiction, audit: fx.audit, auditFailed: false }).ledger;

type Extra = Partial<ComponentProps<typeof ReferenceSections>>;

/** A generated plan over a recorded fixture, as the shell mounts it. */
export function mountFixture(fx: Recorded, extra: Extra = {}) {
  const ledger = ledgerOf(fx);
  return render(
    <ReferenceSections
      jurisdiction={fx.jurisdiction}
      jurisdictionLoading={false}
      revalidating={false}
      streetClass={null}
      schedule={fx.scenario.schedule ?? null}
      scenario={fx.scenario}
      audit={{ state: "ready", data: fx.audit }}
      onRetry={() => {}}
      generated={true}
      showAudit={true}
      breakdown={{ state: "loading" }}
      checkedCount={ledger.checked}
      pendingCount={ledger.pending}
      cited={true}
      referenceDefaultOpen={false}
      {...extra}
    />,
  );
}

/** The pre-generation shape: jurisdiction only, the counted sections absent. */
export function mountJurisdiction(
  jurisdiction: JurisdictionBlock | null,
  schedule: WorkScheduleInput | null = null,
  streetClass: StreetClass | null = "arterial",
  extra: Extra = {},
) {
  return render(
    <ReferenceSections
      jurisdiction={jurisdiction}
      jurisdictionLoading={false}
      revalidating={false}
      streetClass={streetClass}
      schedule={schedule}
      scenario={PINNED_SHOULDER}
      audit={{ state: "loading", lastReady: null }}
      onRetry={() => {}}
      generated={false}
      showAudit={false}
      breakdown={{ state: "loading" }}
      checkedCount={null}
      pendingCount={null}
      cited={false}
      referenceDefaultOpen={true}
      {...extra}
    />,
  );
}

type User = ReturnType<typeof userEvent.setup>;

export const sectionEl = (id: SectionId) =>
  document.querySelector(`[data-section=${id}]`) as HTMLElement;

const titleOf = (row: Element) =>
  (row.querySelector(".rr-title")?.textContent ?? "").replace(/:$/, "");

export const rowsIn = (id: SectionId): HTMLElement[] =>
  Array.from(sectionEl(id)?.querySelectorAll<HTMLElement>(".rr") ?? []);

/** The row named `title` in a section; null when it isn't drawn. */
export const rowOf = (id: SectionId, title: string): HTMLElement | null =>
  rowsIn(id).find((r) => titleOf(r) === title) ?? null;

export async function openSection(user: User, id: SectionId) {
  const head = sectionEl(id).querySelector("button.rs-head") as HTMLElement | null;
  if (head && head.getAttribute("aria-expanded") !== "true") await user.click(head);
  const more = screen.queryByRole("button", { name: /^Show \d+ more check/ });
  if (id === "checked" && more) await user.click(more);
}

export async function openRow(user: User, row: HTMLElement) {
  const head = row.querySelector(".rr-head") as HTMLElement;
  if (head.getAttribute("aria-expanded") !== "true") await user.click(head);
  return row;
}

/** Every section present, every "Show N more", every row. */
export async function openEverything(user: User) {
  for (const id of ["checked", "pending", "reference"] as const) {
    if (!sectionEl(id)) continue;
    await openSection(user, id);
    for (const row of rowsIn(id)) await openRow(user, row);
  }
}

/** The two counted section headers read the ledger's numbers (Rule 12). */
export function expectHeaderCounts(l: { checked: number; pending: number }) {
  const summary = (id: SectionId) => sectionEl(id).querySelector(".rs-summary")?.textContent ?? "";
  if (sectionEl("checked")) {
    expect(summary("checked")).toMatch(new RegExp(`^${l.checked} check${l.checked === 1 ? "" : "s"}`));
  }
  if (sectionEl("pending")) {
    expect(summary("pending")).toMatch(new RegExp(`^${l.pending} item${l.pending === 1 ? "" : "s"} for the TCS`));
  }
}
