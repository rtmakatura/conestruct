import { describe, expect, it } from "vitest";

import { stampMatches, type AnswerStamp } from "./answer-stamp";

// #197 — the shared input-identity stamp.  These tests pin the contract
// the strip's forScenario check established: strict identity, never
// structural equality — a value-equal clone is a DIFFERENT input, because
// every state writer in this codebase replaces objects on edit.

describe("stampMatches (#197 idiom)", () => {
  const scenario = { kind: "shoulder", speed: 35 };
  const settings = { overhead_pct: 0.1 };

  it("matches when every input is the same object", () => {
    const stamp: AnswerStamp = [settings, scenario];
    expect(stampMatches(stamp, [settings, scenario])).toBe(true);
  });

  it("a value-equal clone is a different input", () => {
    const stamp: AnswerStamp = [settings, scenario];
    expect(stampMatches(stamp, [{ ...settings }, scenario])).toBe(false);
    expect(stampMatches(stamp, [settings, { ...scenario }])).toBe(false);
  });

  it("single-input stamps behave like the strip's forScenario check", () => {
    expect(stampMatches([scenario], [scenario])).toBe(true);
    expect(stampMatches([scenario], [{ ...scenario }])).toBe(false);
  });

  it("an absent stamp never reads current (unstamped answer is not an answer for this input)", () => {
    expect(stampMatches(undefined, [scenario])).toBe(false);
    expect(stampMatches([undefined], [scenario])).toBe(false);
  });

  it("arity mismatch never reads current", () => {
    expect(stampMatches([scenario], [scenario, settings])).toBe(false);
    expect(stampMatches([], [scenario])).toBe(false);
  });

  it("primitive inputs compare by Object.is (NaN-safe key support)", () => {
    expect(stampMatches(["cdot", 35], ["cdot", 35])).toBe(true);
    expect(stampMatches([NaN], [NaN])).toBe(true);
    expect(stampMatches([35], [40])).toBe(false);
  });
});
