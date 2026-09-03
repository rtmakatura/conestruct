// s2-arc7 (Refs #219) — the tier classifier's proof set:
//   1. cross-surface pin: assignTiers over the recorded wire fixtures
//      equals tests/fixtures/tiering/tiering-expectations.json — the
//      SAME file src/rendering/tier_ledger.py is pinned to (Refs #220),
//      so the TS and Python mirrors cannot drift independently.
//   2. the ruled status→tier permutation grid (GO flags a–k).
//   3. ledger-sums-to-all: every fact lands in exactly one tier; the
//      four counted tokens sum to the non-reference fact count.
//   4. ◌-never-elsewhere: pending-verification items classify pending,
//      always.
//   5. plan_flags coherence: the tier counts never contradict the
//      backend's #60 rollup on the recorded fixtures.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assignTiers, ledgerLine, type TieringInput } from "./tiering";
import type { JurisdictionBlock } from "./jurisdiction";
import type { AuditResponse } from "./render-types";

const FIXTURE_DIR = join(__dirname, "..", "..", "..", "tests", "fixtures", "tiering");

// The recorded wire fixtures the pin covers.  s2-arc17 (#224 phase 3)
// added the two scanned recordings — the pin's first growth since
// s2-arc7; the two originals' expectations are byte-identical.
const FIXTURES = ["control-lakewood", "adv-ni-denver", "scanned-lakewood", "scanned-not-checked"];

interface RecordedFixture {
  audit: AuditResponse;
  jurisdiction: JurisdictionBlock;
  scenario: { kind: string };
}

function loadFixture(name: string): RecordedFixture {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), "utf-8"));
}

const expectations: Record<
  string,
  { ledger: Record<string, number>; facts: Record<string, string> }
> = JSON.parse(readFileSync(join(FIXTURE_DIR, "tiering-expectations.json"), "utf-8"));

// ---------------------------------------------------------------------------
// 1 · Cross-surface pin
// ---------------------------------------------------------------------------

describe("recorded fixtures match the shared expectation file", () => {
  for (const name of FIXTURES) {
    it(name, () => {
      const fx = loadFixture(name);
      const model = assignTiers({ jurisdiction: fx.jurisdiction, audit: fx.audit });
      const got = Object.fromEntries(model.facts.map((f) => [f.id, f.tier]));
      expect(got).toEqual(expectations[name].facts);
      expect(model.ledger).toEqual(expectations[name].ledger);
    });
  }
});

// ---------------------------------------------------------------------------
// 2 · The permutation grid — minimal synthetic wire fragments per status
// ---------------------------------------------------------------------------

const SOURCE = { doc: "Test Doc", status: "verified" } as const;

function jurWith(over: Partial<JurisdictionBlock>): JurisdictionBlock {
  return {
    key: "t",
    name: "Test",
    tcp_term: "TCP",
    row_term: "ROW",
    authority: "city",
    chain: [],
    class_required: false,
    classification_map_url: null,
    hours: { shape: "none", windows: [], holiday_rule: "none", conflict: null },
    fees: { model: "unpublished", items: [], formula: null },
    meters: [],
    applied_deltas: [],
    chips: { personnel: [], device: [], hazard: [] },
    hours_eval: { status: "unknown", violations: [] },
    permit: {
      tier_suggested: null,
      tier_reason: "",
      tiers: [],
      notes: [],
      multi_agency: [],
      leads: [],
      notices: [],
      onsite: { items: [], digital_ok: null },
    },
    conflicts: [],
    provisional: false,
    ...over,
  };
}

function auditWith(sections: Partial<AuditResponse["sections"]>, pending?: AuditResponse["pending_verification"]): AuditResponse {
  return {
    summary: {} as AuditResponse["summary"],
    sections: {
      taper: {},
      buffer: {},
      spacing: {},
      advance: {},
      colorado: {},
      case: {},
      flagger: {},
      corridor_validation: {},
      geometry_validation: {},
      ...sections,
    } as AuditResponse["sections"],
    pending_verification: pending ?? { count: 0, note: "", tracking_issue: null },
  };
}

function tierOf(input: TieringInput, id: string): string | undefined {
  return assignTiers(input).facts.find((f) => f.id === id)?.tier;
}

describe("the ruled status→tier grid", () => {
  it("delta fires/count → changed (▲)", () => {
    const j = jurWith({
      applied_deltas: [
        { severity: "count", rule: "r", effect: { op: "add_device", qty: 1 }, status: "fires", source: SOURCE },
      ],
    });
    expect(tierOf({ jurisdiction: j, audit: null }, "jur:delta:0")).toBe("changed");
  });
  it("delta fires/op → changed (flag a: method changes are plan changes)", () => {
    const j = jurWith({
      applied_deltas: [{ severity: "op", rule: "r", effect: { op: "x" }, status: "fires", source: SOURCE }],
    });
    expect(tierOf({ jurisdiction: j, audit: null }, "jur:delta:0")).toBe("changed");
  });
  it("delta fires/admin → reference (flag g)", () => {
    const j = jurWith({
      applied_deltas: [{ severity: "admin", rule: "r", effect: { op: "x" }, status: "fires", source: SOURCE }],
    });
    expect(tierOf({ jurisdiction: j, audit: null }, "jur:delta:0")).toBe("reference");
  });
  it.each(["conditional", "unknown"] as const)("delta %s → attention", (status) => {
    const j = jurWith({
      applied_deltas: [{ severity: "count", rule: "r", effect: { op: "x" }, status, source: SOURCE }],
    });
    expect(tierOf({ jurisdiction: j, audit: null }, "jur:delta:0")).toBe("attention");
  });
  it("personnel + device mandates → attention obligations (flag b), any status", () => {
    const j = jurWith({
      chips: {
        personnel: [{ rule: "cert", status: "fires", source: SOURCE }],
        device: [{ rule: "plates", status: "conditional", source: SOURCE }],
        hazard: [],
      },
    });
    const input = { jurisdiction: j, audit: null };
    expect(tierOf(input, "jur:personnel:0")).toBe("attention");
    expect(tierOf(input, "jur:device:0")).toBe("attention");
  });
  it("standing hazard meters → reference, uncounted (flag c)", () => {
    const j = jurWith({
      chips: {
        personnel: [],
        device: [],
        hazard: [{ rule: "denied", status: "fires", source: SOURCE }],
      },
    });
    const model = assignTiers({ jurisdiction: j, audit: null });
    expect(model.facts.find((f) => f.id === "jur:hazard:0")?.tier).toBe("reference");
    expect(model.ledger.attention).toBe(0);
  });
  it.each([
    ["outside", "attention"],
    ["inside", "checked"],
    ["unknown", "pending"],
  ] as const)("hours %s → %s (flags d/8/9)", (status, tier) => {
    const j = jurWith({ hours_eval: { status, violations: [] } });
    expect(tierOf({ jurisdiction: j, audit: null }, "jur:hours")).toBe(tier);
  });
  it("traces + case → checked", () => {
    const input = { jurisdiction: null, audit: auditWith({}) };
    for (const id of ["audit:taper", "audit:buffer", "audit:spacing", "audit:advance", "audit:case"]) {
      expect(tierOf(input, id)).toBe("checked");
    }
  });
  it("colorado pass → checked; FAIL → attention (flag i)", () => {
    const a = auditWith({ colorado: { checks: [{ pass: true }, { pass: false }], info_items: [{}] } });
    const input = { jurisdiction: null, audit: a };
    expect(tierOf(input, "audit:colorado:check:0")).toBe("checked");
    expect(tierOf(input, "audit:colorado:check:1")).toBe("attention");
    expect(tierOf(input, "audit:colorado:info:0")).toBe("checked");
  });
  it("site adjustment: devices added/modified → changed; advisory → checked", () => {
    const a = auditWith({
      site_adjustments: [
        { flag: "pedestrian_facility", action: "", rule: "", citation: "", devices_added: 6 },
        { flag: "school_zone", action: "", rule: "", citation: "", devices_added: 0, devices_modified: 2 },
        { flag: "driveways_present", action: "", rule: "", citation: "", devices_added: 0 },
      ],
    });
    const input = { jurisdiction: null, audit: a };
    expect(tierOf(input, "audit:site:pedestrian_facility")).toBe("changed");
    expect(tierOf(input, "audit:site:school_zone")).toBe("changed");
    expect(tierOf(input, "audit:site:driveways_present")).toBe("checked");
  });
  it("corridor: warnings → attention; checked-and-clean → the new ✓ row (flag h); unchecked → nothing", () => {
    const warned = auditWith({ corridor_validation: { checked: true, warnings: [{}] } });
    expect(tierOf({ jurisdiction: null, audit: warned }, "audit:corridor:warning:0")).toBe("attention");
    const clean = auditWith({ corridor_validation: { checked: true, warnings: [] } });
    expect(tierOf({ jurisdiction: null, audit: clean }, "audit:corridor:clean")).toBe("checked");
    const unchecked = auditWith({ corridor_validation: { checked: false, warnings: [] } });
    const ids = assignTiers({ jurisdiction: null, audit: unchecked }).facts.map((f) => f.id);
    expect(ids.some((i) => i.startsWith("audit:corridor"))).toBe(false);
  });
  it("geometry violations → attention", () => {
    const a = auditWith({ geometry_validation: { violations: [{}], all_pass: false } });
    expect(tierOf({ jurisdiction: null, audit: a }, "audit:geometry:0")).toBe("attention");
  });
  it("fines double: applicable → changed; carve-out → checked (flag e)", () => {
    const yes = auditWith({ fines_double: { applicable: true } });
    expect(tierOf({ jurisdiction: null, audit: yes }, "audit:fines_double")).toBe("changed");
    const no = auditWith({ fines_double: { applicable: false } });
    expect(tierOf({ jurisdiction: null, audit: no }, "audit:fines_double")).toBe("checked");
  });
  it("approaches: signalized → attention; none signalized → checked", () => {
    const sig = auditWith({ approaches: { approaches: [{ signalized: true }, { signalized: false }] } });
    expect(tierOf({ jurisdiction: null, audit: sig }, "audit:approaches")).toBe("attention");
    const quiet = auditWith({ approaches: { approaches: [{ signalized: false }] } });
    expect(tierOf({ jurisdiction: null, audit: quiet }, "audit:approaches")).toBe("checked");
  });
  it("flagger SSD present → checked; absent → no fact (never a computed fallback)", () => {
    const withSsd = auditWith({ flagger: { sight_distance_ft: 305 } });
    expect(tierOf({ jurisdiction: null, audit: withSsd }, "audit:flagger_ssd")).toBe("checked");
    const without = auditWith({ flagger: {} });
    expect(tierOf({ jurisdiction: null, audit: without }, "audit:flagger_ssd")).toBeUndefined();
  });
  it("audit failure → one attention fact (rule 10: the Retry's tier is never empty-and-collapsed)", () => {
    expect(tierOf({ jurisdiction: null, audit: null, auditFailed: true }, "audit:unavailable")).toBe(
      "attention",
    );
  });
});

// ---------------------------------------------------------------------------
// 3 · Ledger invariants
// ---------------------------------------------------------------------------

describe("ledger invariants", () => {
  it("sums to all non-reference facts, on both recorded fixtures", () => {
    for (const name of FIXTURES) {
      const fx = loadFixture(name);
      const model = assignTiers({ jurisdiction: fx.jurisdiction, audit: fx.audit });
      const counted = model.facts.filter((f) => f.tier !== "reference").length;
      const sum =
        model.ledger.changed + model.ledger.attention + model.ledger.checked + model.ledger.pending;
      expect(sum).toBe(counted);
    }
  });

  it("◌-never-elsewhere: every pending-verification item classifies pending", () => {
    const fx = loadFixture("adv-ni-denver");
    const model = assignTiers({ jurisdiction: fx.jurisdiction, audit: fx.audit });
    const pendingFacts = model.facts.filter((f) => f.id.startsWith("audit:pending:"));
    expect(pendingFacts.length).toBe(fx.audit.pending_verification.items?.length ?? 0);
    expect(pendingFacts.every((f) => f.tier === "pending")).toBe(true);
  });

  it("flat pending shape (no items[]) still yields one pending fact", () => {
    const a = auditWith({}, { count: 2, note: "n", tracking_issue: null });
    const model = assignTiers({ jurisdiction: null, audit: a });
    expect(model.facts.filter((f) => f.tier === "pending" && f.id.startsWith("audit:pending"))).toHaveLength(1);
  });

  it("all four counted tokens render, zeros included (flag k)", () => {
    expect(ledgerLine({ changed: 0, attention: 0, checked: 0, pending: 0 })).toBe(
      "0 changes · 0 needs attention · 0 checked · 0 pending · reference",
    );
    expect(ledgerLine({ changed: 1, attention: 2, checked: 14, pending: 2 })).toBe(
      "1 change · 2 needs attention · 14 checked · 2 pending · reference",
    );
  });

  it("plan_flags coherence: tier counts never contradict the #60 rollup", () => {
    for (const name of FIXTURES) {
      const fx = loadFixture(name);
      const flags = fx.audit.plan_flags;
      if (!flags) continue;
      const model = assignTiers({ jurisdiction: fx.jurisdiction, audit: fx.audit });
      // Every compliance fail the strip counts is an attention fact here;
      // every v1 limitation is a pending fact here.
      expect(model.ledger.attention).toBeGreaterThanOrEqual(flags.compliance_fails);
      expect(model.ledger.pending).toBeGreaterThanOrEqual(flags.v1_limitations);
    }
  });
});

// ---------------------------------------------------------------------------
// 4 · The scan family (#224 phase 3, s2-arc17) — the ruled edges
// ---------------------------------------------------------------------------

describe("the scan family's ruled edges (#224 phase 3)", () => {
  const ok = (buckets: Record<string, { detected: boolean }>) =>
    auditWith({ site_scan: { status: "ok", buckets } as never });

  it("ok + absent key → audit:scan:<flag> checked (the named pass)", () => {
    const a = ok({ schools: { detected: false }, interchanges: { detected: false } });
    expect(tierOf({ jurisdiction: null, audit: a }, "audit:scan:school_zone")).toBe("checked");
    expect(tierOf({ jurisdiction: null, audit: a }, "audit:scan:adjacent_interchange")).toBe("checked");
  });
  it("ok + detected key → NO scan fact (the evidence rides the audit:site row — never two facts)", () => {
    const a = ok({ sidewalks: { detected: true } });
    const ids = assignTiers({ jurisdiction: null, audit: a }).facts.map((f) => f.id);
    expect(ids.some((i) => i.startsWith("audit:scan:"))).toBe(false);
  });
  it("ok + keyless bucket → reference, uncounted", () => {
    const a = ok({ hospitals: { detected: true }, road_curvature: { detected: false } });
    const model = assignTiers({ jurisdiction: null, audit: a });
    expect(model.facts.find((f) => f.id === "audit:scan:hospitals")?.tier).toBe("reference");
    expect(model.facts.find((f) => f.id === "audit:scan:road_curvature")?.tier).toBe("reference");
    expect(model.ledger).toEqual({ changed: 0, attention: 0, checked: 5, pending: 0 });
  });
  it("ok + a bucket missing from the wire → nothing (absence of signal is not absence of a feature)", () => {
    const a = ok({});
    const ids = assignTiers({ jurisdiction: null, audit: a }).facts.map((f) => f.id);
    expect(ids.some((i) => i.startsWith("audit:scan:"))).toBe(false);
  });
  it("unavailable + proceeded_anyway → ONE counted attention fact; refused-without-proceed and not_run → nothing", () => {
    const proceeded = auditWith({
      site_scan: { status: "unavailable", proceeded_anyway: true } as never,
    });
    expect(tierOf({ jurisdiction: null, audit: proceeded }, "audit:scan:not_checked")).toBe("attention");
    expect(assignTiers({ jurisdiction: null, audit: proceeded }).ledger.attention).toBe(1);
    for (const scan of [
      { status: "unavailable", proceeded_anyway: false },
      { status: "not_run", reason: "not_requested" },
    ]) {
      const a = auditWith({ site_scan: scan as never });
      const ids = assignTiers({ jurisdiction: null, audit: a }).facts.map((f) => f.id);
      expect(ids.some((i) => i.startsWith("audit:scan:"))).toBe(false);
    }
  });
});
