// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  JurisdictionEvidence,
  JurisdictionWarnings,
  StreetClassEvidence,
  type JurisdictionLookup,
} from "./JurisdictionSection";
import { mountTiered } from "./tiered-test-utils";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import demo from "./__fixtures__/jurisdiction-demo.json";

// The fixture is REGENERATED FROM THE REAL DATA FILES by
// scripts/regen_jurisdiction_demo_fixtures.py (spec §1.4: the design
// package's demo corpus is miscast and never ported).  Casting per the
// approved plan: delta panel → Greeley/Englewood · hours → Loveland ·
// permit FYI → El Paso · trust → Parker.  These are mounted-flow tests
// (CLAUDE.md rule 11): they assert the rendered output a user reads.

const jur = (key: string): JurisdictionBlock =>
  (demo as { jurisdictions: Record<string, unknown> }).jurisdictions[
    key
  ] as JurisdictionBlock;

const noop = () => {};

afterEach(cleanup);

describe("Zone 3 tiers — real-data rendering (#219-migrated)", () => {
  it("renders no tier containers when no jurisdiction is selected (no ledger line, no heading)", () => {
    const { container } = mountTiered(null, null, null);
    expect(container.querySelectorAll(".refchip")).toHaveLength(0);
    // #235-C: the zero ledger is not restated anywhere — no line, no "0 changes".
    expect(container.querySelector("[data-testid=tier-ledger]")).toBeNull();
    expect(document.body.textContent).not.toContain("0 changes");
    expect(container.querySelectorAll("h1, h2, h3, h4, h5, h6")).toHaveLength(0);
    expect(container.querySelector(".tr-section")!.textContent).toBe("Plan reference");
  });

  it("Greeley delta panel: the fired Type C arrow-board delta reads in ▲, auto-open", () => {
    mountTiered(jur("greeley"), null);
    // Fired count delta → CHANGED THIS PLAN, open by default; the rule
    // text and its verbatim source citation read without a click.
    const head = screen.getByRole("button", { name: /changed this plan/i });
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByText(
        /Type C arrow boards must be used on all arterial and collector roadways/i,
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText(/Greeley Permitting Requirements/i).length,
    ).toBeGreaterThan(0);
  });

  it("Loveland hours: the backend violation + exposure read in ⚠; the metered badge rides the Reference card", async () => {
    mountTiered(jur("loveland"), {
      date_mode: "single",
      work_date: "2026-07-22",
      start_time: 8.0,
      end_time: 15.0,
    });
    // The verdict comes from the BACKEND hours_eval baked into the
    // fixture: 8:00 start overlaps the 7:00–8:30 ban by 0.5 h — an
    // OUTSIDE verdict auto-opens ⚠.
    expect(
      screen.getByText(/0\.5 h overlaps the 7:00 AM–8:30 AM ban/i),
    ).toBeTruthy();
    const exposure = screen.getAllByText(/metered exposure estimate/i)[0];
    expect(exposure.textContent).toMatch(/≈\s*\$700/);
    expect(exposure.textContent).toMatch(/provisional schedule/i);
    // The band chart + metered badge stay Reference-tier facts.
    await userEvent.click(screen.getByRole("button", { name: /reference/i }));
    expect(screen.getByText(/Metered \$700 \/ ½-hr/i)).toBeTruthy();
  });

  it("Parker trust treatment: conflict footnote renders 9:00–3:30 with both sources", async () => {
    mountTiered(jur("parker"), null);
    // The conflict footnote is part of the hours card (Reference tier).
    await userEvent.click(screen.getByRole("button", { name: /reference/i }));
    // Parker's fixture eval is OUTSIDE, so the card auto-expands the
    // moment the tier opens — click only if it's still collapsed.
    const hoursHead = screen.getByRole("button", { name: /work hours/i });
    if (hoursHead.getAttribute("aria-expanded") === "false") {
      await userEvent.click(hoursHead);
    }
    expect(
      screen.getByText(/two adopted sources disagree\. Showing the conservative value\./i),
    ).toBeTruthy();
    expect(screen.getByText("Town TC Manual + RDCCM (Jan 2026)")).toBeTruthy();
    expect(screen.getByText("9:00–3:30")).toBeTruthy();
    expect(screen.getByText("2025 Overview")).toBeTruthy();
    expect(screen.getByText("8:30–3:00")).toBeTruthy();
    expect(
      screen.getByText(/Rendering 9:00–3:30 per the adopted manual\./),
    ).toBeTruthy();
  });

  it("El Paso permit FYI: formula structure + digital-on-site, all provisional-flagged", async () => {
    mountTiered(jur("el_paso"), { date_mode: "single", work_date: "2026-07-22" });
    // A permit reference is never plan-invalidating: Reference tier,
    // collapsed, then the permit chip inside it.
    await userEvent.click(screen.getByRole("button", { name: /reference/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /permit: el paso/i }),
    );
    expect(
      screen.getByText(/fee = f\(lanes_closed, zone_length_ft, days\)/i),
    ).toBeTruthy();
    expect(screen.getByText(/'paper, phone, tablet'/i)).toBeTruthy();
    expect(screen.getByText(/✓ digital copies accepted/i)).toBeTruthy();
    // The whole-record provisional flag surfaces on the section header.
    expect(screen.getByText(/contains provisional facts/i)).toBeTruthy();
    // Lead-time table computes "start no later than" from the work date
    // (display derivation only): 10 business days before Wed 2026-07-22.
    expect(screen.getByText(/full closures and detours/i)).toBeTruthy();
    expect(screen.getByText(/≈ Wed, Jul 8/)).toBeTruthy();
  });

  it("E-470: personnel gates read in ⚠ as obligations; the $50,000/day fiber hazard stays a Reference meter", async () => {
    mountTiered(jur("e470"), null, null);
    // Obligations the tool cannot discharge auto-open in ⚠ (ruled
    // flag b) — the gate text reads without a click.
    expect(
      screen.getByText(/registered professional traffic engineer OR an ATSSA\/CCA-certified TCS/i),
    ).toBeTruthy();
    // Standing hazard meters describe the jurisdiction (ruled flag c):
    // Reference tier, worst-$ named on the hazard chip's collapsed
    // summary once the tier opens.
    await userEvent.click(screen.getByRole("button", { name: /reference/i }));
    const hazardHead = screen.getByRole("button", {
      name: /public highway authority hazards/i,
    });
    expect(hazardHead.textContent).toMatch(/\$50,000 \/ day/);
  });

  it("Westminster: TCS-authorship gate rendered with its source, in ⚠", () => {
    mountTiered(jur("westminster"), null);
    expect(
      screen.getByText(/prepared by a certified Traffic Control Supervisor/i),
    ).toBeTruthy();
    expect(
      screen.getAllByText(/Westminster Standards & Specifications Ch\. 8/i).length,
    ).toBeGreaterThan(0);
  });
});

// R108 (setup-what-redesign): JurisdictionControls is DELETED with the
// confirm step it hosted — its dropdown and auth line had been the WHAT
// band's jurisdiction row since #289 §8.21 (WhatBand.jurisdiction.test),
// its pills are R107's segmented control (PlanDetails.test).  What
// survives here is the EVIDENCE behind the two guesses (Rule 10,
// checkpoint D4): each sentence the slots carried, now the rows' details.
const READY: JurisdictionLookup = {
  status: "ready",
  data: {
    suggestion: "denver",
    reason:
      "Pin is inside Denver municipal limits (US Census TIGER/Line Place boundaries, 2025 vintage).",
    confidence: "near_boundary" as const,
    distance_to_boundary_ft: 310.0,
    warnings: [
      {
        kind: "near_boundary" as const,
        message:
          "Pin is 310 ft from the Glendale boundary. Jurisdiction lines here are jigsawed; verify which side the work zone falls on.",
        source: { doc: "TIGER", date: "2025", status: "verified" as const },
      },
    ],
    boundary_source: { source: "US Census TIGER/Line Place boundaries", vintage: "2025" },
  },
};

describe("the jurisdiction guess's evidence (R108)", () => {
  it("says where the pin is, why, and to confirm with the permitting authority", () => {
    render(<JurisdictionEvidence lookup={READY} />);
    expect(screen.getByText(/The pin is in Denver \(near a boundary\)\./)).toBeTruthy();
    expect(screen.getByText(/Pin is inside Denver municipal limits/)).toBeTruthy();
    expect(
      screen.getByText(/Boundary data is approximate .* Confirm the jurisdiction with the permitting authority\./),
    ).toBeTruthy();
  });

  it("the lookup in flight says so in words: no skeleton (rule 14)", () => {
    const { container } = render(
      <JurisdictionEvidence lookup={{ status: "loading", data: null }} />,
    );
    expect(container.querySelector("[class*='skel'], .animate-pulse")).toBeNull();
    expect(container.textContent).toContain("Checking boundary data…");
  });

  it("a failed lookup says nothing was filled in from the pin", () => {
    render(<JurisdictionEvidence lookup={{ status: "error", data: null }} />);
    expect(
      screen.getByText("The boundary lookup didn't answer, so nothing was filled in from the pin."),
    ).toBeTruthy();
  });

  it("the boundary warnings stay on show, amber with ⚠ as their second channel", () => {
    const { container } = render(<JurisdictionWarnings lookup={READY} />);
    const w = container.querySelector('[data-testid="jurisdiction-warning"]')!;
    expect(w.className).toContain("is-amber");
    expect(w.textContent).toMatch(/^⚠ Pin is 310 ft from the Glendale boundary/);
  });

  it("no warnings, no line", () => {
    const { container } = render(
      <JurisdictionWarnings lookup={{ ...READY, data: { ...READY.data!, warnings: [] } }} />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("the street-class guess's evidence (R108)", () => {
  it("names the tier, and points at the adopted map where one is on record", () => {
    render(
      <StreetClassEvidence
        tier="primary"
        jurisdiction={{
          ...jur("parker"),
          class_required: true,
          classification_map_url: "https://example.gov/map",
        }}
      />,
    );
    expect(screen.getByText("detected road tier: OSM primary")).toBeTruthy();
    expect(screen.getByText(/The road tier is a proxy; the adopted map governs\./)).toBeTruthy();
    expect(
      (screen.getByRole("link", { name: /Parker's functional-classification map/ }) as HTMLAnchorElement)
        .href,
    ).toContain("example.gov/map");
  });

  it("nothing to say, nothing rendered", () => {
    const { container } = render(<StreetClassEvidence tier={null} jurisdiction={null} />);
    expect(container.textContent).toBe("");
  });
});

// #288 · §8.31: the JurisdictionContextBar describe block is DELETED
// with the component it tested.  Its facts are asserted now on the
// Reference row's summary line — lib/reference-summary.test.ts for the
// derivation, GeneratorShell.class-stability.test.tsx for the mounted
// "never a stale jurisdiction" claim.
