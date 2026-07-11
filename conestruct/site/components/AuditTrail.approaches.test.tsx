// approachesItem — the React audit-panel builder for the backend's
// sections.approaches (near_intersection kind, #117).  Deferred from
// increment 3 (the PDF builder shipped first); this mirrors the fields
// src/rendering/audit_blocks.py _approaches_blocks reads, driven by
// fixture data shaped exactly like src/api/audit.py approaches_section.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { approachesItem } from "./AuditTrail";

function renderBody(item: { body: React.ReactNode } | null): string {
  if (!item) throw new Error("expected an ItemSpec, got null");
  return renderToStaticMarkup(<>{item.body}</>);
}

const SECTION = {
  side: "far",
  along_station_ft: 900,
  narrative:
    "Each cross-street leg carries its own advance signing keyed to its " +
    "own speed and road type.",
  source: "MUTCD §6N.12; CDOT S-630-1 Sheet 10, Cases 18/19 (advance-signing key)",
  approaches: [
    {
      id: "cross_n",
      speed_mph: 45,
      road_type: "rural",
      signalized: false,
      a_dist_ft: 500,
      key_text: "Sheet 10 key: A = 500 ft for 45 mph rural",
      sign_table: [
        {
          Code: "W20-1",
          "Station (ft from curb line)": "1,000",
          "Placement rule": "2A upstream of the curb line",
        },
        {
          Code: "R2-10",
          "Station (ft from curb line)": "500",
          "Placement rule": "A upstream of the curb line",
        },
        {
          Code: "R2-11",
          "Station (ft from curb line)": "500",
          "Placement rule": "A past the curb line, departure side",
        },
      ],
    },
    {
      id: "cross_s",
      speed_mph: 30,
      road_type: "urban_low",
      signalized: true,
      a_dist_ft: 100,
      key_text: "Sheet 10 key: A = 100 ft for 30 mph urban",
      sign_table: [
        {
          Code: "W20-1",
          "Station (ft from curb line)": "200",
          "Placement rule": "2A upstream of the curb line",
        },
      ],
    },
  ],
};

describe("approachesItem", () => {
  it("self-suppresses when the section is absent (every non-near_intersection plan)", () => {
    expect(approachesItem(undefined)).toBeNull();
  });

  it("renders the header line, both legs, and the source citation", () => {
    const item = approachesItem(SECTION);
    expect(item?.title).toBe("Cross-street approaches");
    expect(item?.result).toBe("2 legs · far-side work");
    const html = renderBody(item);
    expect(html).toContain("far side of the work zone");
    expect(html).toContain("900");
    expect(html).toContain("cross_n");
    expect(html).toContain("cross_s");
    expect(html).toContain("45 mph");
    expect(html).toContain("Sheet 10 key: A = 500 ft for 45 mph rural");
    expect(html).toContain("CDOT S-630-1 Sheet 10");
  });

  it("renders the per-leg sign table with the backend's column names", () => {
    const html = renderBody(approachesItem(SECTION));
    expect(html).toContain("Station (ft from curb line)");
    expect(html).toContain("W20-1");
    expect(html).toContain("R2-10");
    expect(html).toContain("R2-11");
    expect(html).toContain("2A upstream of the curb line");
  });

  it("calls out the signalized leg (and only that leg)", () => {
    const html = renderBody(approachesItem(SECTION));
    const firstIdx = html.indexOf("cross_n");
    const secondIdx = html.indexOf("cross_s");
    const signalizedIdx = html.indexOf("SIGNALIZED");
    expect(signalizedIdx).toBeGreaterThan(secondIdx);
    expect(html.match(/SIGNALIZED/g)).toHaveLength(1);
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it("survives a sparse section without throwing (deploy-window shape drift)", () => {
    const item = approachesItem({});
    expect(item).not.toBeNull();
    const html = renderBody(item);
    expect(html).toContain("side of the work zone");
  });
});
