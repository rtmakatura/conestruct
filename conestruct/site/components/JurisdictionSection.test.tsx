// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  JurisdictionEvidence,
  JurisdictionWarnings,
  StreetClassEvidence,
  type JurisdictionLookup,
} from "./JurisdictionSection";
import {
  mountJurisdiction as mountTiered,
  openEverything,
  openRow,
  openSection,
  rowOf,
  rowsIn,
  sectionEl,
} from "./reference-test-utils";
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

afterEach(cleanup);

describe("section 3 — real-data rendering (#219-migrated, #443)", () => {
  it("no jurisdiction: 'Site facts', no rows, no heading, no restated zero", async () => {
    const user = userEvent.setup();
    const { container } = mountTiered(null, null, null);
    await openSection(user, "reference");
    expect(rowsIn("reference")).toHaveLength(0);
    expect(document.body.textContent).not.toContain("0 changes");
    expect(container.querySelectorAll("h1, h2, h3, h4, h5, h6")).toHaveLength(0);
    expect(sectionEl("reference").querySelector(".rs-name")!.textContent).toBe("Site facts");
  });

  it("Greeley: the fired Type C arrow-board delta is a ▲ row with its rule and source", async () => {
    const user = userEvent.setup();
    mountTiered(jur("greeley"), null);
    await openEverything(user);
    expect(screen.getByText(/Type C arrow boards must be used on all arterial and collector roadways/i)).toBeTruthy();
    expect(sectionEl("reference").textContent).toMatch(/Greeley Permitting Requirements/i);
  });

  it("Loveland hours: the backend violation, the exposure and the metered rate read in the open row", async () => {
    const user = userEvent.setup();
    mountTiered(jur("loveland"), { date_mode: "single", work_date: "2026-07-22", start_time: 8.0, end_time: 15.0 });
    // The verdict comes from the BACKEND hours_eval baked into the fixture:
    // 8:00 start overlaps the 7:00-8:30 ban by 0.5 h; OUTSIDE starts open.
    await openSection(user, "reference");
    expect(screen.getByText(/0\.5 h overlaps the 7:00 AM–8:30 AM ban/i)).toBeTruthy();
    const exposure = screen.getAllByText(/metered exposure estimate/i)[0];
    expect(exposure.textContent).toMatch(/≈\s*\$700/);
    expect(exposure.textContent).toMatch(/provisional schedule/i);
    const row = rowOf("reference", "Work hours")!;
    expect(within(row).getByText("Metered")).toBeTruthy();
    expect(row.textContent).toMatch(/\$700 \/ ½-hr/);
  });

  it("the hours meter is the street class's own, not simply the first on record", async () => {
    const user = userEvent.setup();
    const l = jur("loveland");
    const base = l.meters.find((m) => m.kind === "hours_violation")!;
    const scoped: JurisdictionBlock = {
      ...l,
      meters: [
        { ...base, classes: ["local"], amount_cents: 11100 },
        { ...base, classes: ["arterial"], amount_cents: 22200 },
      ],
    };
    mountTiered(scoped, null, "arterial");
    await openSection(user, "reference");
    await openRow(user, rowOf("reference", "Work hours")!);
    const text = rowOf("reference", "Work hours")!.textContent!;
    expect(text).toContain("$222");
    expect(text).not.toContain("$111");
  });

  it("Parker trust treatment: the conflict reads whole, with both sources and the verdict", async () => {
    const user = userEvent.setup();
    mountTiered(jur("parker"), null);
    await openSection(user, "reference");
    await openRow(user, rowOf("reference", "Work hours")!);
    expect(screen.getByText(/two adopted sources disagree\. Showing the conservative value\./i)).toBeTruthy();
    expect(screen.getByText("Town TC Manual + RDCCM (Jan 2026)")).toBeTruthy();
    expect(screen.getByText("9:00–3:30")).toBeTruthy();
    expect(screen.getByText("2025 Overview")).toBeTruthy();
    expect(screen.getByText("8:30–3:00")).toBeTruthy();
    expect(screen.getByText(/Rendering 9:00–3:30 per the adopted manual\./)).toBeTruthy();
  });

  it("El Paso permit: formula structure and digital-on-site, flagged provisional", async () => {
    const user = userEvent.setup();
    mountTiered(jur("el_paso"), { date_mode: "single", work_date: "2026-07-22" });
    await openSection(user, "reference");
    const row = rowOf("reference", "Permit")!;
    await openRow(user, row);
    expect(row.textContent).toContain("f(lanes_closed, zone_length_ft, days)");
    expect(row.textContent).toMatch(/'paper, phone, tablet'/i);
    expect(row.textContent).toMatch(/digital copies accepted/i);
    // The whole-record provisional flag surfaces at the top of the section.
    expect(screen.getByText(/contains provisional facts/i)).toBeTruthy();
    // "Start no later than" from the work date (display derivation only):
    // 10 business days before Wed 2026-07-22.
    expect(row.textContent).toMatch(/full closures and detours/i);
    expect(row.textContent).toMatch(/≈ Wed, Jul 8/);
  });

  it("E-470: the personnel gates are obligations; the $50,000/day hazard names its worst in the row", async () => {
    const user = userEvent.setup();
    mountTiered(jur("e470"), null, null);
    await openSection(user, "reference");
    expect(rowOf("reference", "Fines and hazards")!.textContent).toMatch(/\$50,000 \/ day/);
    await openEverything(user);
    expect(screen.getByText(/registered professional traffic engineer OR an ATSSA\/CCA-certified TCS/i)).toBeTruthy();
  });

  it("Westminster: the TCS-authorship gate reads with its source", async () => {
    const user = userEvent.setup();
    mountTiered(jur("westminster"), null);
    await openEverything(user);
    expect(screen.getByText(/prepared by a certified Traffic Control Supervisor/i)).toBeTruthy();
    expect(sectionEl("reference").textContent).toMatch(/Westminster Standards & Specifications Ch\. 8/i);
  });

  it("R116: a rule's status reads in words, never its key", async () => {
    const user = userEvent.setup();
    mountTiered(jur("greeley"), null, null);
    await openEverything(user);
    expect(sectionEl("reference").textContent).not.toMatch(/\b(conditional|unknown) ·/);
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
      screen.getByText("The boundary check failed, so nothing was filled in from the pin."),
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
