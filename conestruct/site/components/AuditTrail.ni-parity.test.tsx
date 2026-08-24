// s2-arc7 (Refs #223) — the NI trace-parity pin.
//
// Red baseline (commit 1): buildScenarioItems has NO near_intersection
// branch, so the flagship kind renders ZERO per-kind trace items where
// shoulder renders six — even though the recorded wire fixture proves
// the backend ships taper/buffer/spacing/advance/colorado/case for NI
// today (tests/fixtures/tiering/adv-ni-denver.json, recorded via the
// real API).  Commit 2 adds buildNearIntersectionItems and flips this
// file to the parity assertions.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildScenarioItems } from "./AuditTrail";
import type { AuditResponse, AuditState } from "../lib/render-types";
import type { Scenario } from "../lib/scenarios";

const FIXTURE_DIR = join(__dirname, "..", "..", "..", "tests", "fixtures", "tiering");

const fx: { scenario: Scenario; audit: AuditResponse } = JSON.parse(
  readFileSync(join(FIXTURE_DIR, "adv-ni-denver.json"), "utf-8"),
);

const ready: AuditState = { state: "ready", data: fx.audit };
const r = (n: number | string) => String(n);

describe("near_intersection trace parity (#223)", () => {
  it("PINNED DEFECT: the NI kind renders zero per-kind trace items", () => {
    const items = buildScenarioItems(fx.scenario, ready, true, r);
    expect(items).toHaveLength(0);
  });
});
