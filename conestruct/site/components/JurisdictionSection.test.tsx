// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  JurisdictionContextBar,
  JurisdictionControls,
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
  it("renders no tier containers when no jurisdiction is selected (ledger zeros only)", () => {
    const { container } = mountTiered(null, null, null);
    expect(container.querySelectorAll(".refchip")).toHaveLength(0);
    expect(screen.getByTestId("tier-ledger").textContent).toMatch(/0 changes/);
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
      screen.getByText(/two adopted sources disagree — conservative value rendered/i),
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
      screen.getByRole("button", { name: /permit — el paso/i }),
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

// Surface B (#152): the dropdown, pills, and auth line moved into the
// interactive JurisdictionControls; the top bar is a read-only summary.
describe("JurisdictionControls", () => {
  it("offers the ship-list picker and echoes the local term (MHT for Parker)", async () => {
    let picked: string | null = null;
    render(
      <JurisdictionControls
        jurisdiction={jur("parker")}
        jurisdictionKey="parker"
        setJurisdictionKey={(k) => {
          picked = k;
        }}
        streetClass={null}
        setStreetClass={noop}
      />,
    );
    const select = screen.getByLabelText<HTMLSelectElement>(/jurisdiction/i);
    expect(select.value).toBe("parker");
    // Terminology decision §1.2: surfaces echo the local term.
    expect(screen.getByText(/calls this plan a/i).textContent).toMatch(/MHT/);
    await userEvent.selectOptions(select, "englewood");
    expect(picked).toBe("englewood");
  });

  it("street-class pills expose pressed state (no hue-alone signal)", async () => {
    let cls: string | null = null;
    render(
      <JurisdictionControls
        jurisdiction={null}
        jurisdictionKey={null}
        setJurisdictionKey={noop}
        streetClass="collector"
        setStreetClass={(c) => {
          cls = c;
        }}
      />,
    );
    const collector = screen.getByRole("button", { name: "Collector" });
    expect(collector.getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Arterial" }));
    expect(cls).toBe("arterial");
  });
});

describe("JurisdictionContextBar (read-only summary)", () => {
  it("Castle Rock context: chain renders with the local override last", () => {
    render(
      <JurisdictionContextBar
        jurisdiction={jur("castle_rock")}
        jurisdictionKey="castle_rock"
        streetClass={null}
      />,
    );
    // Compact breadcrumb (inc-9): the authored display_name renders; the
    // full title (edition included) rides the hover detail.
    const mutcdSeg = screen.getByText("MUTCD + CO Suppl.");
    expect(mutcdSeg.getAttribute("title")).toMatch(/most recent edition/i);
    // class_required with no captured URL → honest look-it-up note, not a dead link.
    expect(
      screen.getByText(/classifies via its published map/i),
    ).toBeTruthy();
  });
});
