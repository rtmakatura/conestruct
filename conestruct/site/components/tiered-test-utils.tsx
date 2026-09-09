// s2-arc7 (Refs #219) — shared mount helper for the migrated Zone 3
// suites: TieredReference with jurisdiction-only inputs (the audit
// group off), the shape the pre-generation zone renders.

import { expect } from "vitest";
import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { TieredReference } from "./TieredReference";
import { PINNED_SHOULDER } from "./test-fixtures";
import type { Ledger } from "@/lib/tiering";
import type {
  JurisdictionBlock,
  StreetClass,
  WorkScheduleInput,
} from "@/lib/jurisdiction";

export function mountTiered(
  jurisdiction: JurisdictionBlock | null,
  schedule: WorkScheduleInput | null = null,
  streetClass: StreetClass | null = "arterial",
  extra: Partial<ComponentProps<typeof TieredReference>> = {},
) {
  return render(
    <TieredReference
      jurisdiction={jurisdiction}
      jurisdictionLoading={false}
      streetClass={streetClass}
      schedule={schedule}
      scenario={PINNED_SHOULDER}
      audit={{ state: "loading", lastReady: null }}
      onRetry={() => {}}
      generated={false}
      showAudit={false}
      breakdown={{ state: "loading" }}
      {...extra}
    />,
  );
}

// #235-C (P2): the ledger line is gone — the chips are the one voice for
// the four counts.  The rendered ledger IS the chip numerals: a counted
// tier with a non-zero count must render its chip, and every rendered
// chip's numeral equals the shared expectation (the lib/tiering pin).
// No ledger element, no "checking…" / "(refreshing…)" copy anywhere.
const TIER_LABEL: Record<keyof Ledger, string> = {
  changed: "Changed this plan",
  attention: "Needs attention",
  checked: "Checked & passed",
  pending: "Pending / not verified",
};

export function chipNumeral(label: string): number | null {
  const chip = Array.from(document.querySelectorAll(".refchip .chip-sum")).find(
    (b) => b.querySelector(".label")?.textContent === label,
  );
  if (!chip) return null;
  const b = chip.querySelector(".detail b");
  expect(b, `chip "${label}" has no numeral`).not.toBeNull();
  return Number(b!.textContent);
}

export function expectChipLedger(l: Ledger) {
  expect(document.querySelector("[data-testid=tier-ledger]")).toBeNull();
  expect(document.body.textContent).not.toContain("checking against the updated inputs");
  expect(document.body.textContent).not.toContain("(refreshing…)");
  for (const key of Object.keys(TIER_LABEL) as Array<keyof Ledger>) {
    const n = chipNumeral(TIER_LABEL[key]);
    if (l[key] > 0) {
      expect(n, `${key} = ${l[key]} but no "${TIER_LABEL[key]}" chip`).not.toBeNull();
    }
    if (n !== null) expect(n, `${TIER_LABEL[key]} numeral`).toBe(l[key]);
  }
}
