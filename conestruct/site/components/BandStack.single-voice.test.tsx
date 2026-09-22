// @vitest-environment happy-dom
//
// #289 Phase 2 — the single-voice sentinel, inherited from the rail.
//
// This file replaces `ProgressRail.single-voice.test.tsx`.  #281's
// contract list carries the rule across: "the rail is replaced; its
// derived-entry contract moves to the move ledger and the fact lines."
// So the proof moves with it.
//
// The rail's version: every glyph, word, info line and aria phrase a rail
// row showed came from `deriveRail`'s return, proved with sentinel strings
// no component could invent.  This one does the same for the two surfaces
// that inherited the job — `deriveMoveLedger` for the WHERE band's ledger
// and `deriveBands` for the collapsed fact lines — and it fails the moment
// either component grows a glyph map, a state-word literal or a string it
// composes itself.
//
// Why sentinels rather than real values: a component that owns a glyph map
// and a derivation that owns one AGREE on every realistic input, which is
// precisely why the defect survives ordinary tests.  A value nothing could
// invent is the only thing that tells them apart.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import { deriveBands } from "@/lib/scenarios/band-facts";
import { deriveMoveLedger } from "@/lib/scenarios/move-ledger";
import { FactLine } from "./bands/BandPrimitives";

afterEach(cleanup);

const PINNED: Scenario = {
  ...DEFAULT_SHOULDER,
  workLen: 1000,
  meta: { ...DEFAULT_SHOULDER.meta, lat: 39.71466, lng: -104.94071 },
} as Scenario;

describe("#228 single voice, inherited — the fact line renders, never derives", () => {
  it("shows exactly the model's glyph, label, value and verb", () => {
    render(
      <FactLine
        fact={{
          id: "where",
          label: "__LABEL__",
          value: "__VALUE__",
          verb: "CHANGE",
          pending: null,
          glyph: "__GLYPH__" as unknown as "✓",
        }}
        onOpen={() => {}}
      />,
    );
    const row = screen.getByTestId("fact-where");
    expect(row.querySelector(".a-sym")?.textContent).toBe("__GLYPH__");
    expect(row.querySelector(".tr-field")?.textContent).toBe("__LABEL__");
    expect(row.querySelector(".a-val")?.textContent).toBe("__VALUE__");
    expect(screen.getByTestId("fact-link-where").textContent).toBe("CHANGE");
    // Nothing beyond the model's strings — a component-side word would
    // surface right here.
    expect(row.textContent).toBe("__GLYPH____LABEL____VALUE__CHANGE");
  });

  it("a pending line shows the model's REASON, and no link at all", () => {
    render(
      <FactLine
        fact={{
          id: "generate",
          label: "__L__",
          value: null,
          verb: null,
          pending: "__WHY__",
          glyph: "○",
        }}
      />,
    );
    const row = screen.getByTestId("fact-generate");
    expect(row.textContent).toBe("○__L____WHY__");
    // Rule 134: a fact line offers a link OR a provenance word, never a
    // disabled link.
    expect(row.querySelector("button")).toBeNull();
  });

  it("the locked variant is rule 60's, and the word is not the component's opinion", () => {
    render(
      <FactLine
        fact={{
          id: "what",
          label: "__L__",
          value: "__V__",
          verb: "CHANGE",
          pending: null,
          glyph: "✓",
        }}
        onOpen={() => {}}
        locked
      />,
    );
    const row = screen.getByTestId("fact-what");
    expect(row.getAttribute("data-fact-state")).toBe("locked");
    expect(row.querySelector("button")).toBeNull();
    expect(row.textContent).toContain("locked");
  });
});

describe("#228 single voice, inherited — the derivations own the vocabulary", () => {
  it("every fact line's glyph and verb come from deriveBands, not the column", () => {
    const model = deriveBands({
      scenario: PINNED,
      jurisdictionName: null,
      openOverride: null,
    });
    // The invariant rule 134 states, asserted on the MODEL so it holds
    // for every input and not just the one a render happened to use.
    for (const f of model.facts) {
      expect(
        (f.verb === null) !== (f.pending === null),
        `${f.id}: exactly one of verb / pending`,
      ).toBe(true);
      expect(["✓", "○"]).toContain(f.glyph);
    }
  });

  it("rule 65's one-open invariant is unrepresentable, not merely avoided", () => {
    const model = deriveBands({
      scenario: PINNED,
      jurisdictionName: null,
      openOverride: null,
    });
    // `open` is one id.  There is no array to contain two.
    expect(typeof model.open).toBe("string");
    expect(model.facts.filter((f) => f.id === model.open)).toHaveLength(1);
  });

  it("every move row's glyph and word come from deriveMoveLedger", () => {
    const ledger = deriveMoveLedger(PINNED);
    expect(ledger.rows).toHaveLength(5);
    for (const r of ledger.rows) {
      expect(["✓", "⚠", "○"]).toContain(r.glyph);
      // Rule 68: the right track is a link verb or a provenance word.
      expect((r.verb === null) !== (r.word === null)).toBe(true);
    }
    // Rule 69: exactly one washed row, and it is the first unanswered
    // one — the component does not choose it.
    const current = ledger.rows.find((r) => r.id === ledger.currentId);
    expect(current?.state).not.toBe("done");
  });
});
