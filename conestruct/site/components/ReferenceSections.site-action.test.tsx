// @vitest-environment happy-dom
//
// #308 R94, redrawn by #443 — the pedestrian adjustment's row prints the
// backend's own sentence.  A one-way street gets 2 Type III barricades, not 4
// (src/rules/site_adjustments.py); a static "4 Type III barricades" line
// would contradict page 1's device summary (Rule 10, P2).  Mounted on the
// recorded scanned-lakewood fixture with its record rewritten the way the
// backend writes it for a one-way street (Rule 11).

import { afterEach, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { loadFixture, mountFixture, openSection, rowOf } from "./reference-test-utils";

const ONE_WAY_ACTION =
  "Added 2 Type III barricades (sidewalk closure points) and 2 R9-9 SIDEWALK CLOSED " +
  "signs at the upstream and downstream ends of the work zone.";

afterEach(cleanup);

it("the pedestrian row says what the backend added", async () => {
  const fx = loadFixture("scanned-lakewood");
  const records = fx.audit.sections.site_adjustments as unknown as {
    flag: string;
    action: string;
    devices_added: number;
  }[];
  const ped = records.find((r) => r.flag === "pedestrian_facility");
  expect(ped).toBeTruthy();
  ped!.action = ONE_WAY_ACTION;
  ped!.devices_added = 4;

  const user = userEvent.setup();
  mountFixture(fx);
  await openSection(user, "reference");
  const row = rowOf("reference", "Pedestrian sidewalks present")!;
  expect(row.textContent).toContain(ONE_WAY_ACTION);
  expect(row.textContent).not.toContain("4 Type III");
});
