// s2-arc7 (Refs #223) — the NI trace-parity assertions.
//
// Commit 1 pinned the red state (zero per-kind NI trace items while the
// recorded wire fixture ships all six sections); this commit adds
// buildNearIntersectionItems and flips the pin to parity: the flagship
// kind now traces its full computed set — taper, buffer, spacing,
// advance, Colorado checks, and the side-aware case match — every value
// read from the backend response (rule 3), never a literal.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { buildScenarioItems } from "./AuditTrail";
import type { AuditResponse, AuditState } from "../lib/render-types";
import type { Scenario } from "../lib/scenarios";

const FIXTURE_DIR = join(__dirname, "..", "..", "..", "tests", "fixtures", "tiering");

const fx: { scenario: Scenario; audit: AuditResponse } = JSON.parse(
  readFileSync(join(FIXTURE_DIR, "adv-ni-denver.json"), "utf-8"),
);

const ready: AuditState = { state: "ready", data: fx.audit };
const errored: AuditState = { state: "error", message: "boom", lastReady: fx.audit };
const r = (n: number | string) => String(n);

describe("near_intersection trace parity (#223)", () => {
  it("renders the six-item trace set, at parity with shoulder's composition", () => {
    const items = buildScenarioItems(fx.scenario, ready, true, r);
    expect(items.map((i) => i.title)).toEqual([
      "Taper length calculation",
      "Buffer space calculation",
      "Channelizing device spacing",
      "Advance warning sign set",
      "Colorado requirements (CDOT S-630-1)",
      `${fx.audit.summary.ta} · S-630-1 reference`,
    ]);
  });

  it("values come from the backend response — the side-aware TA and the real case id", () => {
    const items = buildScenarioItems(fx.scenario, ready, true, r);
    // The fixture's approaches sit on the far side → TA-22 (audit.py's
    // side-aware projection), and the case is the backend's Case 18
    // string — asserting against the FIXTURE, not literals, so a
    // backend re-derivation updates this test's expectation with it.
    expect(fx.audit.summary.ta).toBe("TA-22");
    expect(items[5].result).toBe(fx.audit.summary.case_id);
    expect(items[0].result).toBe(`L = ${fx.audit.summary.taper_length_ft} ft`);
    expect(items[1].result).toBe(`B = ${fx.audit.summary.buffer_space_ft} ft`);
    const advanceHtml = renderToStaticMarkup(items[3].body as ReactElement);
    for (const row of (fx.audit.sections.advance as { sign_table: Array<{ Code: string }> })
      .sign_table) {
      expect(advanceHtml).toContain(row.Code);
    }
  });

  it("on error, rows blank per #187/#192 — no prior numbers under a failed banner", () => {
    const items = buildScenarioItems(fx.scenario, errored, true, r);
    expect(items).toHaveLength(6);
    expect(items[0].result).toBe("L = —");
    expect(items[1].result).toBe("B = — ft");
  });
});
