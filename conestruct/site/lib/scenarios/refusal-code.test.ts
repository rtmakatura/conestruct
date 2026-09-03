// #224 phase 2 — the first code-keyed refusal entry (the #180 header
// note's option (i)).  ONE entry, matched on the backend 400's
// ``detail.error`` — never on message text.  The scenario-predicate
// matcher is untouched: a shoulder scenario with no lane dispute still
// matches nothing there, whatever the wire said.

import { describe, expect, it } from "vitest";
import { matchRefusalAffordance, matchRefusalCode } from "./auto-apply";
import { SITE_SCAN_UNAVAILABLE_CODE } from "./site-scan";
import { DEFAULT_SHOULDER } from "./index";

describe("matchRefusalCode (#224 phase 2)", () => {
  it("matches exactly the site_scan_unavailable code", () => {
    const m = matchRefusalCode(SITE_SCAN_UNAVAILABLE_CODE);
    expect(m?.code).toBe("site_scan_unavailable");
    expect(m?.pointer).toMatch(/Results/);
  });

  it("matches nothing else — no message sniffing, no other codes", () => {
    expect(matchRefusalCode(undefined)).toBeNull();
    expect(matchRefusalCode(null)).toBeNull();
    expect(matchRefusalCode("")).toBeNull();
    expect(matchRefusalCode("Site scan unavailable — the plan can't verify")).toBeNull();
    expect(matchRefusalCode("flagger_multilane")).toBeNull();
  });

  it("the scenario matcher is unchanged: the code never reaches it", () => {
    expect(matchRefusalAffordance(DEFAULT_SHOULDER)).toBeNull();
    expect(
      matchRefusalAffordance({
        ...DEFAULT_SHOULDER,
        site_scan: { proceed_if_unavailable: false },
      }),
    ).toBeNull();
  });
});
