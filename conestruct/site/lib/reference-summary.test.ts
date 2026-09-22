// #288 · §8.31 pulled forward — the Reference row's summary line.
//
// The jurisdiction context bar is deleted and its three facts land here.
// A bar with three labelled cells could afford a skeleton, a glossary and
// a class-required note; one provenance line cannot. What this suite
// pins is that the three FACTS survive the compression, and that each
// unset one renders as a word rather than as nothing or as a guess.

import { describe, expect, it } from "vitest";

import { referenceSummary, BASELINE_CHAIN_DISPLAY } from "./reference-summary";
import type { JurisdictionBlock } from "./jurisdiction";

const GREELEY = {
  key: "greeley",
  name: "Greeley",
  tcp_term: "MHT",
  row_term: "public space",
  authority: "city",
  chain: [
    { title: "MUTCD 11th Ed. + Colorado Supplement", display_name: "MUTCD 11th + CO Suppl." },
    { title: "Greeley Public Space Requirements (Mar 2025)", display_name: "Greeley PS Reqs" },
  ],
} as unknown as JurisdictionBlock;

describe("§8.31 — the three facts, as one line", () => {
  it("names the jurisdiction, the street class and the chain, in §8.31's own order", () => {
    expect(referenceSummary({ jurisdiction: GREELEY, streetClass: "arterial" })).toBe(
      "Greeley · Arterial · MUTCD 11th + CO Suppl. › Greeley PS Reqs",
    );
  });

  it("rule 14: an unset value renders as a WORD — never blank, never a guess", () => {
    expect(referenceSummary({ jurisdiction: null, streetClass: null })).toBe(
      `Not set · Not set · ${BASELINE_CHAIN_DISPLAY.join(" › ")}`,
    );
    // Half-set is half-named, not rounded up or down.
    expect(referenceSummary({ jurisdiction: null, streetClass: "local" })).toContain(
      "Not set · Local",
    );
    expect(referenceSummary({ jurisdiction: GREELEY, streetClass: null })).toContain(
      "Greeley · Not set",
    );
  });

  it("no jurisdiction means the STATEWIDE FLOOR, not an empty chain", () => {
    // The bar showed these two links when nothing was selected, and they
    // are a real claim about what governs: MUTCD + the Colorado
    // Supplement, and CDOT's §630.  Dropping them would understate the
    // spec chain to nothing, which is not what "Not set" means.
    const line = referenceSummary({ jurisdiction: null, streetClass: null });
    for (const link of BASELINE_CHAIN_DISPLAY) expect(line).toContain(link);
  });

  it("loading says CHECKING, not a stale name and not a skeleton", () => {
    // #252 allows no skeletons anywhere; rule 10 forbids presenting a
    // prior jurisdiction's answer as this one's.  A word is the only
    // honest option left, and it is the one the bar's own skeleton stood
    // in for.
    const line = referenceSummary({ jurisdiction: null, streetClass: "arterial", loading: true });
    expect(line).toContain("Checking…");
    expect(line).not.toContain("Not set ·");
    // The chain still falls back to the floor: what governs while a
    // jurisdiction loads is the statewide floor, which is true.
    expect(line).toContain(BASELINE_CHAIN_DISPLAY[0]);
  });

  it("a settled jurisdiction beats the loading flag — the answer is here", () => {
    // `loading` can still be true for a moment after the block lands;
    // the block is the better evidence and wins.
    expect(referenceSummary({ jurisdiction: GREELEY, streetClass: null, loading: true })).toContain(
      "Greeley",
    );
  });

  it("a pre-display_name backend's plain-string chain still reads (#inc-9 adapter)", () => {
    const old = { ...GREELEY, chain: ["MUTCD 11th Ed.", "CDOT §630"] } as unknown as JurisdictionBlock;
    expect(referenceSummary({ jurisdiction: old, streetClass: null })).toBe(
      "Greeley · Not set · MUTCD 11th Ed. › CDOT §630",
    );
  });
});
