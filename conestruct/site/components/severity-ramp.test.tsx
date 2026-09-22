// @vitest-environment happy-dom
//
// Severity-ramp role assignments (diff-note §4): one color, one job —
// orange (--dim) marks generated output ONLY, cyan (--act) marks
// interactive controls, and nothing informational borrows either.
// These pin the class/markup level the JSX controls; the CSS maps the
// classes to the role tokens.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ResultsHero } from "./ResultsHero";
import { JurisdictionControls } from "./JurisdictionSection";
import { referenceSummary } from "@/lib/reference-summary";
import { PricingCard } from "./PricingCard";
import type { DeviceBreakdownState } from "./DeviceBreakdown";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import { DEFAULT_QUOTE_SETTINGS } from "@/lib/quote-settings";
import type { Scenario } from "@/lib/scenarios";

const noop = () => {};

const READY: DeviceBreakdownState = {
  state: "ready",
  data: {
    devices: [
      {
        device: "Arrow Board (Type C)",
        code: "—",
        function: "Jurisdiction-required",
        qty: 1,
        jurisdiction_required: true,
        jurisdiction_source: { doc: "Greeley PS Reqs", status: "verified" },
      },
    ],
    total_devices: 33,
    unique_types: 11,
    zone_geometry: {
      taper_l_ft: 100,
      buffer_b_ft: 250,
      device_spacing_ft: 20,
      work_len_ft: 400,
    },
  },
};

const JUR = {
  key: "greeley",
  name: "Greeley",
  tcp_term: "MHT",
  row_term: "public space",
  authority: "city",
  chain: ["MUTCD + Colorado Supplement", "Greeley PS Reqs (Mar 2025)"],
  class_required: false,
  classification_map_url: null,
} as unknown as JurisdictionBlock;

afterEach(cleanup);

describe("severity-ramp role assignments", () => {
  it("hero numerals are output cells (.num inside .hero) and only counts get the <b> output accent", () => {
    const { container } = render(
      <ResultsHero breakdown={READY} jurisdiction={JUR} />,
    );
    const nums = Array.from(container.querySelectorAll(".hero .num"));
    expect(nums.map((n) => n.textContent)).toEqual(["33", "11"]);
    // The jurisdiction-required tally is backend-flag-derived output.
    const subAccents = Array.from(
      container.querySelectorAll(".hero .sub b"),
    ).map((b) => b.textContent);
    expect(subAccents).toContain("+1");
    // Geometry values are output-meta (mono .mv), never controls.
    expect(container.querySelector(".hero-meta .row .mv")).not.toBeNull();
    expect(container.querySelectorAll(".hero button")).toHaveLength(0);
  });

  it("the spec chain is a document name, so it takes no generated-number accent", () => {
    // #288 · §8.31 (Ryan's hand-check at f44377e): the bar this test
    // rendered is DELETED, and the chain now rides the Reference row's
    // summary line.  The CLAIM survives the move and is what matters —
    // orange belongs to generated numbers, and a document name is not
    // one — so it is asserted against the line that carries the chain
    // now.  The `.seg.local` treatment retired with the bar's markup.
    const line = referenceSummary({ jurisdiction: JUR, streetClass: null });
    expect(line).toContain("Greeley");
    for (const link of JUR.chain) {
      expect(line).toContain(typeof link === "string" ? link : link.display_name);
    }
    // The summary is plain text in the row's provenance slot: there is no
    // element on it to carry an accent at all.
    expect(line).not.toMatch(/--dim|--orange|<[a-z]/i);
  });

  it("street-class pills carry pressed state, not hue alone", () => {
    // Pills live in the interactive controls now (Surface B), not the
    // read-only top strip.
    const { container } = render(
      <JurisdictionControls
        jurisdiction={null}
        jurisdictionKey={null}
        setJurisdictionKey={noop}
        streetClass="arterial"
        setStreetClass={noop}
      />,
    );
    const pressed = Array.from(
      container.querySelectorAll('.classpick button[aria-pressed="true"]'),
    );
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toBe("Arterial");
  });

  it("pricing card: the collapsed total is orange output only when a backend total exists", () => {
    render(
      <PricingCard
        mode={{ kind: "public", scenario: { meta: {} } as unknown as Scenario }}
        settings={DEFAULT_QUOTE_SETTINGS}
        setSettings={noop}
        flaggerSource="auto"
        setFlaggerSource={noop}
        delivery={{ state: "idle" }}
        setDelivery={noop}
      />,
    );
    // No preview has run: the head must NOT show a mock/estimated
    // number — an explicit unset note instead (no EST constant ships).
    // #288 clause 4 made the quote a rule-87 disclosure ROW (Part 1
    // §8.11), so the bespoke `.total` span gave way to the row's
    // provenance line; the CLAIM is unchanged — no currency before a
    // preview, and the "not a permit fee" framing always.
    const head = screen.getByRole("button", { name: /Pricing quote/i });
    const prov = head.querySelector(".disc-prov")!;
    expect(prov.textContent).toContain("expand to configure & preview");
    expect(prov.querySelector(".quote-total")).toBeNull();
    expect(prov.textContent).not.toMatch(/\$/);
    expect(head.textContent).toContain("FYI");
    // Rule 89: the quote is not a counted tier, so it shows no numeral —
    // not a zero, which would read as a total of nothing.
    expect(head.querySelector(".disc-count")).toBeNull();
  });
});
