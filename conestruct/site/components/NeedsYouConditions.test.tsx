// @vitest-environment happy-dom
// #437 (UX group 2, Option B) — NEEDS YOU's condition rows after the
// question flow took the detected ones (rulings.md rulings 3, 8, S5).
//
// Rule 5, declared: the old suite tested the detected rows' Dismiss, the
// reason picker, the fold's "Show N", the Apply row and the scan footer.
// All five left this component (the question flow owns detected rows, its
// last button is Apply, the scan time moved into each question's Details),
// so those tests left with them; the question flow's own suite is
// NeedsYouQuestion.test.tsx.  What stays here: the non-question records,
// ruling 8's one row with "Show them", and the Assert writes inside it.

import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import type { StagedCorrection } from "@/lib/scenarios/types";
import type { SiteScanProvenance } from "@/lib/render-types";
import { OtherConditions, SiteConditionRows, hasConditionRows } from "./NeedsYouConditions";

afterEach(cleanup);

function ok(over: Partial<SiteScanProvenance> = {}): SiteScanProvenance {
  return {
    status: "ok",
    mode: "corridor",
    measured_at: "2026-09-04T12:00:00+00:00",
    buckets: {
      intersections: { detected: true, count: 26, nearest_distance_ft: 34.1 },
      interchanges: { detected: false, count: 0 },
      sidewalks: { detected: true, count: 18, nearest_distance_ft: 46.6 },
      bike_facilities: { detected: false, count: 0 },
      schools: { detected: false, count: 0 },
    },
    flags: { adjacent_intersection: true, pedestrian_facility: true },
    corrections: [],
    ...over,
  };
}

let lastStaged: StagedCorrection[] = [];

function Host({
  siteScan,
  scenario = DEFAULT_SCENARIO,
  inFlight = false,
  nothingElse = true,
}: {
  siteScan: SiteScanProvenance;
  scenario?: Scenario;
  inFlight?: boolean;
  nothingElse?: boolean;
}) {
  const [staged, setStagedState] = useState<StagedCorrection[]>([]);
  const setStaged = (next: StagedCorrection[]) => {
    lastStaged = next;
    setStagedState(next);
  };
  const common = { scenario, siteScan, inFlight, staged, setStaged };
  return (
    <div className="workbench">
      <ul className="needs-you">
        <SiteConditionRows
          {...common}
          questionFlags={new Set(["adjacent_intersection", "pedestrian_facility"])}
        />
      </ul>
      <OtherConditions {...common} nothingElse={nothingElse} />
    </div>
  );
}

describe("hasConditionRows", () => {
  it("an ok scan with keyed buckets has rows; none, or a failed scan with no record, has none", () => {
    expect(hasConditionRows(ok())).toBe(true);
    expect(hasConditionRows(null)).toBe(false);
    expect(hasConditionRows(ok({ buckets: {} }))).toBe(false);
    expect(hasConditionRows(ok({ status: "unavailable", buckets: undefined }))).toBe(false);
  });
});

describe("#437 ruling 8: the other conditions, one row", () => {
  it("the detected (question) flags draw no row here; the rest fold into one counted row", () => {
    lastStaged = [];
    const { container } = render(<Host siteScan={ok()} />);
    // 3 none found + 2 manual keys not asserted = 5 (D8).
    expect(screen.getByText("5 other conditions checked. Nothing else needs you.")).toBeTruthy();
    expect(container.querySelectorAll(".needs-you li").length).toBe(0);
    expect(screen.queryByText("Pedestrian sidewalks")).toBeNull();
    const toggle = screen.getByRole("button", { name: "Show them" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    // A read: it stays live under the write lock (P13).
    expect(toggle.hasAttribute("data-read")).toBe(true);
  });

  it("Show them opens the rows with their Assert actions unchanged; Assert stages one marker", () => {
    lastStaged = [];
    render(<Host siteScan={ok()} />);
    fireEvent.click(screen.getByRole("button", { name: "Show them" }));
    expect(screen.getByRole("button", { name: "Hide them" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("School zone")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Assert" }).length).toBe(5);
    fireEvent.click(screen.getAllByRole("button", { name: "Assert" })[0]);
    expect(lastStaged).toHaveLength(1);
    const s = lastStaged[0] as { flag: string; marker: { action: string } };
    expect(s.flag).toBe("adjacent_interchange");
    expect(s.marker.action).toBe("assert");
  });

  it("Rule 10: with other items on the plan, the row drops 'Nothing else needs you.'", () => {
    render(<Host siteScan={ok()} nothingElse={false} />);
    expect(screen.getByText("5 other conditions checked.")).toBeTruthy();
    expect(screen.queryByText(/Nothing else needs you/)).toBeNull();
  });

  it("in flight, Assert is disabled and Show them stays live", () => {
    render(<Host siteScan={ok()} inFlight />);
    const toggle = screen.getByRole("button", { name: "Show them" });
    expect((toggle as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(toggle);
    for (const b of screen.getAllByRole("button", { name: "Assert" })) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
  });
});

describe("#437: the listed rows that are not questions stay records with Undo", () => {
  it("an asserted manual key is a record above, not in the fold's count", () => {
    const scenario = {
      ...DEFAULT_SCENARIO,
      meta: { ...DEFAULT_SCENARIO.meta, siteConditions: { limited_sight_distance: true } },
    } as Scenario;
    lastStaged = [];
    render(<Host siteScan={ok()} scenario={scenario} />);
    expect(screen.getByText("asserted by you")).toBeTruthy();
    expect(screen.getByText("4 other conditions checked. Nothing else needs you.")).toBeTruthy();
    // #457 rulings 1, 3: the shared link, nothing else.
    expect(screen.getByRole("button", { name: "Undo" }).className).toBe("undo-link");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(lastStaged).toEqual([{ flag: "limited_sight_distance", on: false }]);
  });

  it("an applied assert on a condition the scan found none of renders the backend sentence with Undo", () => {
    const scan = ok({
      corrections: [
        {
          flag: "school_zone",
          action: "assert",
          status: "applied",
          disclosure: "Operator asserted School zone. Verify on site.",
          record_clause: "Operator asserted School zone.",
        } as never,
      ],
    });
    lastStaged = [];
    render(<Host siteScan={scan} />);
    expect(screen.getByText("Operator asserted School zone.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" }).className).toBe("undo-link"); // #457
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(lastStaged).toEqual([{ flag: "school_zone", marker: null }]);
  });
});
