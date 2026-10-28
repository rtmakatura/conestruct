// #401 (W11): every sandbox download was named plan.*, so two plans in one
// Downloads folder collided as "plan (1).pdf".  A plan with no project name
// is now named for its road, its kind, the day and a fingerprint of the
// plan; a project name is kept.
import { describe, expect, it } from "vitest";

import {
  packageFilename,
  planBaseName,
  planFilename,
  planFingerprint,
} from "./download-name";
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios";

const DAY = new Date(2026, 9, 27, 23, 30); // local 2026-10-27

function onRoad(base: Scenario, name: string | null, ref: string | null = null): Scenario {
  return {
    ...base,
    meta: { ...base.meta, confirmedRoad: { candidate: { name, ref } } },
  } as unknown as Scenario;
}

const COLFAX = onRoad(DEFAULT_SHOULDER, "East Colfax Avenue");

describe("planBaseName (#401)", () => {
  it("a sandbox plan is named road_kind_day_fingerprint", () => {
    const fp = planFingerprint(COLFAX);
    expect(fp).toMatch(/^[0-9a-f]{6}$/);
    expect(planBaseName(COLFAX, DAY)).toBe(`East-Colfax-Avenue_shoulder_2026-10-27_${fp}`);
    expect(planFilename(COLFAX, "crew.pdf", DAY)).toBe(
      `East-Colfax-Avenue_shoulder_2026-10-27_${fp}.crew.pdf`,
    );
  });

  it("two plans on the same road, kind and day get different names", () => {
    const left = {
      ...COLFAX,
      meta: { ...COLFAX.meta, work: { side: "left" } },
    } as Scenario;
    const right = {
      ...COLFAX,
      meta: { ...COLFAX.meta, work: { side: "right" } },
    } as Scenario;
    const longer = { ...COLFAX, workLen: 1200 } as Scenario;
    const names = [COLFAX, left, right, longer].map((s) => planFilename(s, "pdf", DAY));
    expect(new Set(names).size).toBe(4);
  });

  it("the same plan keeps its name, a new scan token included", () => {
    const scanned = { ...COLFAX, site_scan: { proceed_if_unavailable: false } } as Scenario;
    const tokenA = { ...scanned, site_scan: { proceed_if_unavailable: false, token: "a" } } as Scenario;
    const tokenB = { ...scanned, site_scan: { proceed_if_unavailable: false, token: "b" } } as Scenario;
    expect(planFilename(tokenA, "pdf", DAY)).toBe(planFilename(scanned, "pdf", DAY));
    expect(planFilename(tokenB, "pdf", DAY)).toBe(planFilename(tokenA, "pdf", DAY));
    expect(planFilename({ ...COLFAX } as Scenario, "pdf", DAY)).toBe(planFilename(COLFAX, "pdf", DAY));
  });

  it("different kinds and roads differ, a nameless road uses its ref, and no road leaves the kind", () => {
    const flagger = onRoad(DEFAULT_FLAGGER, "North Williams Street");
    expect(planBaseName(flagger, DAY)).toMatch(
      /^North-Williams-Street_flagger-lane-closure_2026-10-27_[0-9a-f]{6}$/,
    );
    expect(planBaseName(onRoad(DEFAULT_SHOULDER, null, "US 40"), DAY)).toMatch(
      /^US-40_shoulder_2026-10-27_[0-9a-f]{6}$/,
    );
    expect(planBaseName(DEFAULT_SHOULDER, DAY)).toMatch(/^shoulder_2026-10-27_[0-9a-f]{6}$/);
  });

  it("a project name is kept exactly as before", () => {
    const named = { ...COLFAX, meta: { ...COLFAX.meta, project: "Test Job #4" } } as Scenario;
    expect(planFilename(named, "pdf", DAY)).toBe("Test_Job__4.pdf");
  });

  it("the zip is <name>_package.zip, with no 'mht'", () => {
    expect(packageFilename(COLFAX, DAY)).toBe(`${planBaseName(COLFAX, DAY)}_package.zip`);
    expect(packageFilename(COLFAX, DAY)).not.toMatch(/mht/i);
  });
});
