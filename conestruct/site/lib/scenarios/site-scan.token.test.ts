// #307: withScanToken adds the signed scan to a scanned wire scenario only.
import { describe, expect, it } from "vitest";

import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import { withScanToken, withSiteScan } from "./site-scan";

describe("withScanToken (#307)", () => {
  it("adds the token beside proceed_if_unavailable", () => {
    const wire = withSiteScan(DEFAULT_SCENARIO as Scenario, true);
    expect(withScanToken(wire, "t").site_scan).toEqual({ proceed_if_unavailable: true, token: "t" });
    expect(wire.site_scan).toEqual({ proceed_if_unavailable: true });
  });

  it("leaves a scenario that requests no scan alone", () => {
    const pre = DEFAULT_SCENARIO as Scenario;
    expect(withScanToken(pre, "t")).toBe(pre);
  });
});
