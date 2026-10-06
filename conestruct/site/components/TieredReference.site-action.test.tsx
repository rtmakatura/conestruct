// @vitest-environment happy-dom
//
// #308 R94 — the pedestrian adjustment's row prints the backend's own
// sentence.  A one-way street gets 2 Type III barricades, not 4
// (src/rules/site_adjustments.py); a static "4 Type III barricades" line
// would contradict page 1's device summary (Rule 10, P2).  Mounted on the
// recorded scanned-lakewood fixture with its record rewritten the way the
// backend writes it for a one-way street (Rule 11).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { TieredReference } from "./TieredReference";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import type { AuditResponse } from "../lib/render-types";
import type { Scenario } from "@/lib/scenarios";

const FIXTURE_DIR = join(__dirname, "..", "..", "..", "tests", "fixtures", "tiering");
interface Recorded {
  scenario: Scenario;
  audit: AuditResponse;
  jurisdiction: JurisdictionBlock;
}

const ONE_WAY_ACTION =
  "Added 2 Type III barricades (sidewalk closure points) and 2 R9-9 SIDEWALK CLOSED " +
  "signs at the upstream and downstream ends of the work zone.";

afterEach(cleanup);

it("the pedestrian row says what the backend added", () => {
  const fx: Recorded = JSON.parse(
    readFileSync(join(FIXTURE_DIR, "scanned-lakewood.json"), "utf-8"),
  );
  const records = fx.audit.sections.site_adjustments as unknown as {
    flag: string;
    action: string;
    devices_added: number;
  }[];
  const ped = records.find((r) => r.flag === "pedestrian_facility");
  expect(ped).toBeTruthy();
  ped!.action = ONE_WAY_ACTION;
  ped!.devices_added = 4;

  render(
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
  const changed = screen.getByText("Changed this plan").closest(".refchip") as HTMLElement;
  const row = within(changed)
    .getByText("Pedestrian sidewalks present")
    .closest(".check-list-item") as HTMLElement;
  expect(row.textContent).toContain(ONE_WAY_ACTION);
  expect(row.textContent).not.toContain("4 Type III");
});
