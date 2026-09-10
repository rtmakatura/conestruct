// #253 — the next-steps derivation, pure (the deriveRail idiom: one
// derivation, the component renders it verbatim).  Every count names its
// wire field; every null names its cause (rule 10); every figure is
// counted from the wire, never a literal (rule 12).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DOWNLOADS_ANCHOR,
  REFERENCE_ANCHOR,
  deriveNextSteps,
  nextStepChips,
  type NextSteps,
} from "./next-steps";
import { BUNDLE_PART_KINDS, type AuditResponse, type AuditState } from "./render-types";
import { SITE_CORRECTIONS_ANCHOR } from "./scenarios/site-corrections";
import type { StagedCorrection } from "./scenarios/types";

const BUCKETS_DETECTED = {
  intersections: { detected: true, count: 26 },
  interchanges: { detected: false, count: 0 },
  sidewalks: { detected: true, count: 18 },
  bike_facilities: { detected: false, count: 0 },
  schools: { detected: false, count: 0 },
  hospitals: { detected: true, count: 1 }, // keyless: never counted
};
const audit = (site_scan: unknown, pending = 0): AuditResponse =>
  ({
    summary: {},
    sections: { site_scan },
    pending_verification: { count: pending, note: "", tracking_issue: null },
    plan_flags: { validation_warnings: 0, compliance_fails: 0, v1_limitations: 0, is_clean: true },
  }) as unknown as AuditResponse;
const okScan = (corrections: unknown[] = []) => ({
  status: "ok",
  mode: "corridor",
  measured_at: "2026-09-04T12:00:00+00:00",
  buckets: BUCKETS_DETECTED,
  flags: {},
  corrections,
});
const ready = (data: AuditResponse): AuditState => ({ state: "ready", data });
const staged1: StagedCorrection[] = [{ flag: "adjacent_intersection", marker: null }];
const staged2: StagedCorrection[] = [
  { flag: "adjacent_intersection", marker: null },
  { flag: "pedestrian_facility", marker: null },
];

const base = {
  generated: true,
  landed: true,
  planDeclined: false,
  breakdownError: false,
  staged: [] as StagedCorrection[],
};

describe("#253 deriveNextSteps — null iff no plan landed (rule 10)", () => {
  it("pre-generate, not yet landed since Generate, declined (c2 included), an audit error, and loading with nothing held are all null", () => {
    const a = ready(audit(okScan()));
    expect(deriveNextSteps({ ...base, generated: false, stripAudit: a })).toBeNull();
    expect(deriveNextSteps({ ...base, landed: false, stripAudit: a })).toBeNull();
    expect(deriveNextSteps({ ...base, planDeclined: true, stripAudit: a })).toBeNull();
    expect(
      deriveNextSteps({ ...base, stripAudit: { state: "error", message: "Network error", lastReady: null } }),
    ).toBeNull();
    expect(deriveNextSteps({ ...base, stripAudit: { state: "loading", lastReady: null } })).toBeNull();
  });

  it("a response without pending_verification is no plan verdict — null, never a defaulted 0", () => {
    const a = { ...audit(okScan()) } as unknown as Record<string, unknown>;
    delete a.pending_verification;
    expect(deriveNextSteps({ ...base, stripAudit: ready(a as unknown as AuditResponse) })).toBeNull();
  });
});

describe("#253 deriveNextSteps — chip 1 from sections.site_scan", () => {
  it("open = detected keyed buckets without a server correction; total = keyed buckets on the wire (2 of 5, the keyless hospital never counted)", () => {
    const s = deriveNextSteps({ ...base, stripAudit: ready(audit(okScan())) })!;
    expect(s.site).toEqual({ kind: "counted", open: 2, total: 5, staged: 0 });
  });

  it("a server correction (applied or moot) closes its row; the count changes only with the served scan", () => {
    const applied = [{ flag: "adjacent_intersection", action: "dismiss", status: "applied", disclosure: "…" }];
    const moot = [{ flag: "pedestrian_facility", action: "assert", status: "moot", disclosure: "…" }];
    expect(deriveNextSteps({ ...base, stripAudit: ready(audit(okScan(applied))) })!.site).toMatchObject({ open: 1, total: 5 });
    expect(deriveNextSteps({ ...base, stripAudit: ready(audit(okScan([...applied, ...moot]))) })!.site).toMatchObject({ open: 0, total: 5 });
  });

  it("staged corrections are appended, never subtracted — open stays the server's number", () => {
    const s = deriveNextSteps({ ...base, staged: staged2, stripAudit: ready(audit(okScan())) })!;
    expect(s.site).toEqual({ kind: "counted", open: 2, total: 5, staged: 2 });
    const chips = nextStepChips(s);
    expect(chips[0].numeral).toBe("2");
    expect(chips[0].rest).toBe("OPEN/5 · 2 STAGED");
    expect(nextStepChips(deriveNextSteps({ ...base, staged: staged1, stripAudit: ready(audit(okScan())) })!)[0].rest).toBe(
      "OPEN/5 · 1 STAGED",
    );
  });

  it("◌ NOT SCANNED only on the wire's not_run / unavailable (and an absent section: nothing was scanned)", () => {
    for (const status of ["not_run", "unavailable"] as const) {
      const s = deriveNextSteps({ ...base, stripAudit: ready(audit({ status, reason: null })) })!;
      expect(s.site).toEqual({ kind: "not_scanned", status });
      const c = nextStepChips(s)[0];
      expect(c.glyph).toBe("◌");
      expect(c.numeral).toBeNull();
      expect(c.rest).toBe("NOT SCANNED");
      expect(c.inert).toBe(false); // the link leads to the block that explains why
    }
    expect(deriveNextSteps({ ...base, stripAudit: ready(audit(undefined)) })!.site).toEqual({ kind: "not_scanned", status: "not_run" });
  });
});

describe("#253 deriveNextSteps — chip 2 from pending_verification.count, chip 3 from BUNDLE_PART_KINDS", () => {
  it("pending is the wire count; 0 renders ✓ 0 OPEN, N renders ▲ N OPEN", () => {
    const zero = nextStepChips(deriveNextSteps({ ...base, stripAudit: ready(audit(okScan(), 0)) })!)[1];
    expect(zero).toMatchObject({ glyph: "✓", state: "clear", numeral: null, rest: "0 OPEN" });
    const three = nextStepChips(deriveNextSteps({ ...base, stripAudit: ready(audit(okScan(), 3)) })!)[1];
    expect(three).toMatchObject({ glyph: "▲", state: "open", numeral: "3", rest: "OPEN" });
  });

  it("files ready = BUNDLE_PART_KINDS.length (the zip's parts, rule 12); a broken breakdown renders ◌ NOT PRODUCED, inert", () => {
    const s = deriveNextSteps({ ...base, stripAudit: ready(audit(okScan())) })!;
    expect(s.files).toEqual({ kind: "ready", n: BUNDLE_PART_KINDS.length });
    const c = nextStepChips(s)[2];
    expect(c).toMatchObject({ glyph: "✓", state: "ready", numeral: String(BUNDLE_PART_KINDS.length), rest: "FILES READY", inert: false });
    const broken = deriveNextSteps({ ...base, breakdownError: true, stripAudit: ready(audit(okScan())) })!;
    expect(broken.files).toEqual({ kind: "not_produced" });
    expect(nextStepChips(broken)[2]).toMatchObject({ glyph: "◌", state: "none", numeral: null, rest: "NOT PRODUCED", inert: true });
  });

  it("under the band the strip reads the last confirmed answer (lastReady) — counts hold, never tick", () => {
    const last = audit(okScan(), 2);
    const s = deriveNextSteps({ ...base, stripAudit: { state: "loading", lastReady: last } })!;
    expect(s.site).toMatchObject({ open: 2, total: 5 });
    expect(s.pending).toBe(2);
  });
});

describe("#253 nextStepChips — three chips, in order, with their anchors and the fixed vocabulary", () => {
  const s: NextSteps = { site: { kind: "counted", open: 0, total: 5, staged: 0 }, pending: 0, files: { kind: "ready", n: 4 } };
  it("01 Site conditions → #site-corrections · 02 Pending items → #reference · 03 Download → #downloads", () => {
    const chips = nextStepChips(s);
    expect(chips.map((c) => [c.index, c.name, c.anchor])).toEqual([
      ["01", "Site conditions", SITE_CORRECTIONS_ANCHOR],
      ["02", "Pending items", REFERENCE_ANCHOR],
      ["03", "Download", DOWNLOADS_ANCHOR],
    ]);
    expect(REFERENCE_ANCHOR).toBe("reference");
    expect(DOWNLOADS_ANCHOR).toBe("downloads");
  });
  it("zero remaining is ✓ 0 OPEN/5 — no chip is ever dropped, never a filled state", () => {
    const c = nextStepChips(s)[0];
    expect(c).toMatchObject({ glyph: "✓", state: "clear", numeral: null, rest: "0 OPEN/5" });
    expect(nextStepChips(s)).toHaveLength(3);
  });
  it('the words "done" / "complete" / "NOT YET EVALUATED" never appear in the derivation or the strip (spec 9; conflict 3)', () => {
    for (const f of ["lib/next-steps.ts", "components/ResultsHead.tsx"]) {
      const src = readFileSync(join(__dirname, "..", f), "utf-8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
      expect(src, f).not.toMatch(/\bdone\b|\bcomplete\b|NOT YET EVALUATED/i);
    }
    const all = nextStepChips(s).flatMap((c) => [c.rest, c.numeral ?? ""]).join(" ");
    expect(all).not.toMatch(/done|complete|evaluated/i);
  });
});
