// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  JurisdictionContextBar,
  JurisdictionSection,
} from "./JurisdictionSection";
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

describe("JurisdictionSection — real-data rendering", () => {
  it("renders nothing when no jurisdiction is selected", () => {
    const { container } = render(
      <JurisdictionSection
        jurisdiction={null}
        loading={false}
        streetClass={null}
        schedule={null}
        setSchedule={noop}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("Greeley delta panel: the Type C arrow-board delta from the real record", async () => {
    render(
      <JurisdictionSection
        jurisdiction={jur("greeley")}
        loading={false}
        streetClass="arterial"
        schedule={null}
        setSchedule={noop}
      />,
    );
    // Collapsed by default (wired-prototype behavior) with the count summary.
    const head = screen.getByRole("button", { name: /what greeley changes/i });
    expect(head.textContent).toMatch(/1 deltas · 1 affect count/i);
    await userEvent.click(head);
    expect(
      screen.getByText(
        /Type C arrow boards must be used on all arterial and collector roadways/i,
      ),
    ).toBeTruthy();
    // Source citation rendered verbatim from the record.
    expect(
      screen.getAllByText(/Greeley Permitting Requirements/i).length,
    ).toBeGreaterThan(0);
  });

  it("Loveland hours card: metered badge, backend violation, and exposure estimate", () => {
    render(
      <JurisdictionSection
        jurisdiction={jur("loveland")}
        loading={false}
        streetClass="arterial"
        schedule={{
          date_mode: "single",
          work_date: "2026-07-22",
          start_time: 8.0,
          end_time: 15.0,
        }}
        setSchedule={noop}
      />,
    );
    // The metered badge reads the real arterial half-hour meter ($700).
    expect(screen.getByText(/Metered \$700 \/ ½-hr/i)).toBeTruthy();
    // The verdict comes from the BACKEND hours_eval baked into the
    // fixture: 8:00 start overlaps the 7:00–8:30 ban by 0.5 h.
    expect(
      screen.getByText(/0\.5 h overlaps the 7:00 AM–8:30 AM ban/i),
    ).toBeTruthy();
    // Exposure estimate: one half-hour × $700 = $700, rendered as dollars
    // (the figure sits in a nested span, so match on the container text).
    const exposure = screen.getByText(/metered exposure estimate/i);
    expect(exposure.textContent).toMatch(/≈\s*\$700/);
    expect(exposure.textContent).toMatch(/provisional schedule/i);
  });

  it("Parker trust treatment: conflict footnote renders 9:00–3:30 with both sources", () => {
    render(
      <JurisdictionSection
        jurisdiction={jur("parker")}
        loading={false}
        streetClass="arterial"
        schedule={null}
        setSchedule={noop}
      />,
    );
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

  it("El Paso permit FYI: formula structure + digital-on-site, all provisional-flagged", () => {
    render(
      <JurisdictionSection
        jurisdiction={jur("el_paso")}
        loading={false}
        streetClass="arterial"
        schedule={{ date_mode: "single", work_date: "2026-07-22" }}
        setSchedule={noop}
      />,
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

  it("E-470 chips: personnel gates + the $50,000/day fiber hazard from the real meter", () => {
    render(
      <JurisdictionSection
        jurisdiction={jur("e470")}
        loading={false}
        streetClass={null}
        schedule={null}
        setSchedule={noop}
      />,
    );
    expect(screen.getByText(/personnel gates/i)).toBeTruthy();
    expect(
      screen.getByText(/registered professional traffic engineer OR an ATSSA\/CCA-certified TCS/i),
    ).toBeTruthy();
    expect(screen.getByText(/high-severity hazards/i)).toBeTruthy();
    // The hazard chip's dollar figure joins from the meters list —
    // never restated in the chip record (spec §2.4).
    expect(screen.getByText(/\$50,000 \/ day/)).toBeTruthy();
  });

  it("Westminster chips: TCS-authorship gate rendered with its source", () => {
    render(
      <JurisdictionSection
        jurisdiction={jur("westminster")}
        loading={false}
        streetClass="arterial"
        schedule={null}
        setSchedule={noop}
      />,
    );
    expect(
      screen.getByText(/prepared by a certified Traffic Control Supervisor/i),
    ).toBeTruthy();
    expect(
      screen.getAllByText(/Westminster Standards & Specifications Ch\. 8/i).length,
    ).toBeGreaterThan(0);
  });
});

describe("JurisdictionContextBar", () => {
  it("offers the ship-list picker and echoes the local term (MHT for Parker)", async () => {
    let picked: string | null = null;
    render(
      <JurisdictionContextBar
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
      <JurisdictionContextBar
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

  it("Castle Rock context: chain renders with the local override last", () => {
    render(
      <JurisdictionContextBar
        jurisdiction={jur("castle_rock")}
        jurisdictionKey="castle_rock"
        setJurisdictionKey={noop}
        streetClass={null}
        setStreetClass={noop}
      />,
    );
    expect(screen.getByText(/MUTCD \(most recent edition\)/i)).toBeTruthy();
    // class_required with no captured URL → honest look-it-up note, not a dead link.
    expect(
      screen.getByText(/classifies via its published map/i),
    ).toBeTruthy();
  });
});
