// @vitest-environment happy-dom
//
// s2-arc7 (Refs #219) — the mounted half of the ledger invariants: the
// RENDERED section agrees with the classifier (and therefore with the
// shared expectation file) on the recorded wire fixtures.  Rule 11:
// test where the bug lives — the counts a user reads.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TieredReference } from "./TieredReference";
import { ledgerLine } from "@/lib/tiering";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import type { AuditResponse } from "../lib/render-types";
import type { Scenario } from "@/lib/scenarios";

const FIXTURE_DIR = join(__dirname, "..", "..", "..", "tests", "fixtures", "tiering");

interface Recorded {
  scenario: Scenario;
  audit: AuditResponse;
  jurisdiction: JurisdictionBlock;
}

function load(name: string): Recorded {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), "utf-8"));
}

const expectations: Record<string, { ledger: Record<string, number> }> = JSON.parse(
  readFileSync(join(FIXTURE_DIR, "tiering-expectations.json"), "utf-8"),
);

function mountFixture(fx: Recorded) {
  return render(
    <TieredReference
      jurisdiction={fx.jurisdiction}
      jurisdictionLoading={false}
      streetClass={null}
      schedule={fx.scenario.schedule ?? null}
      scenario={fx.scenario}
      audit={{ state: "ready", data: fx.audit }}
      onRetry={() => {}}
      generated={true}
      showAudit={true}
      breakdown={{ state: "loading" }}
    />,
  );
}

afterEach(cleanup);

describe("the rendered ledger equals the shared expectation", () => {
  for (const name of ["control-lakewood", "adv-ni-denver"]) {
    it(name, () => {
      mountFixture(load(name));
      const l = expectations[name].ledger;
      expect(screen.getByTestId("tier-ledger").textContent).toContain(
        ledgerLine({
          changed: l.changed,
          attention: l.attention,
          checked: l.checked,
          pending: l.pending,
        }),
      );
    });
  }
});

describe("tier open states and pending isolation (adv-ni-denver)", () => {
  it("▲ and ⚠ auto-open; ✓ and ◌ start collapsed", () => {
    mountFixture(load("adv-ni-denver"));
    expect(
      screen
        .getByRole("button", { name: /changed this plan/i })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: /needs attention/i })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: /checked & passed/i })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: /pending \/ not verified/i })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("◌-never-elsewhere: pending labels render only inside the ◌ tier", async () => {
    const fx = load("adv-ni-denver");
    mountFixture(fx);
    const firstPending = fx.audit.pending_verification.items![0].label.slice(0, 40);
    // Not visible while ◌ is collapsed — so not hosted by any open tier.
    expect(screen.queryByText(new RegExp(firstPending, "i"))).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: /pending \/ not verified/i }),
    );
    expect(screen.getByText(new RegExp(firstPending, "i"))).toBeTruthy();
  });

  it("#223 parity, mounted: the six NI trace heads read inside ✓", async () => {
    const fx = load("adv-ni-denver");
    mountFixture(fx);
    await userEvent.click(screen.getByRole("button", { name: /checked & passed/i }));
    for (const title of [
      "Taper length calculation",
      "Buffer space calculation",
      "Channelizing device spacing",
      "Advance warning sign set",
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    // The side-aware case match (TA-22, far-side fixture) as a ✓ row.
    expect(screen.getByText(`${fx.audit.summary.ta} · S-630-1 reference`)).toBeTruthy();
    // Every Colorado check named at a glance (ruled): all four pass rows.
    const checks = fx.audit.sections.colorado.checks as { label: string }[];
    for (const c of checks) {
      expect(screen.getAllByText(new RegExp(c.label.slice(0, 25))).length).toBeGreaterThan(0);
    }
  });

  it("the signalized approaches land in ⚠ with the review-required voice", () => {
    mountFixture(load("adv-ni-denver"));
    // ⚠ is auto-open; the approaches item head reads without a click.
    expect(screen.getByText("Cross-street approaches")).toBeTruthy();
    expect(screen.getByText(/2 legs · far-side work/)).toBeTruthy();
  });
});
