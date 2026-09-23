// @vitest-environment happy-dom
//
// #289 hand-check, 2026-09-23, correction 3 — the move ledger takes rule
// 68's form, and each row's VALUE is the answer the design names.
//
// Ryan's words: "The move ledger rows take rule 68's form: symbol ·
// label · dotted leader · value · link.  'Found the spot' value = road +
// direction + jurisdiction; 'Work starts' value = the ruled interim
// (road name) formatted as a fact, with 'MOVE'; 'Extent' = '1,000 ft ·
// typed'."
//
// Rule 11 — where the bug lived.  Three of these four were producer
// defects (`deriveMoveLedger` composed the wrong strings) and one was a
// STYLESHEET defect: the rows always emitted the leader span, but
// `.a-lead` was declared for `.a-fact` only, so a move row printed its
// label and value with a bare gap and read as a list item rather than a
// ledger line.  The producer is tested against its own output; the
// leader is tested against globals.css, which is the file that was
// wrong.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import { deriveMoveLedger, type MoveRow } from "@/lib/scenarios/move-ledger";

const PIN = { lat: 39.73997, lng: -104.96632 };

/** A confirmed road at the pin, in the picker's own candidate shape —
 *  the one `candidateLabel` reads, so the label under test is composed
 *  the way the column composes it everywhere else (#234). */
const CONFIRMED: Scenario = {
  ...DEFAULT_SHOULDER,
  workLen: 1000,
  meta: {
    ...DEFAULT_SHOULDER.meta,
    ...PIN,
    address: "1600 E Colfax Ave",
    confirmedRoad: {
      pinLat: PIN.lat,
      pinLng: PIN.lng,
      placeName: "Denver",
      // The picker's own candidate shape: `bearing` (degrees) and
      // `highway_class` are what `candidateLabel` reads — 90° is
      // "Eastbound" (lib/road-detection/labels.ts).
      candidate: {
        way_id: 12345,
        name: "E Colfax Ave",
        bearing: 90,
        highway_class: "primary",
      },
    },
  },
} as unknown as Scenario;

const row = (s: Scenario, id: MoveRow["id"], jurisdiction: string | null = null) => {
  const found = deriveMoveLedger(s, jurisdiction).rows.find((r) => r.id === id);
  if (!found) throw new Error(`no ${id} row`);
  return found;
};

describe("rule 68's values (correction 3)", () => {
  it("'Found the spot' is road + direction + jurisdiction", () => {
    const r = row(CONFIRMED, "spot", "Denver");
    expect(r.value).toBe("E Colfax Ave Eastbound · Denver");
    expect(r.verb).toBe("CHANGE");
  });

  it("with no evaluated jurisdiction the clause is absent, not invented (rule 10)", () => {
    expect(row(CONFIRMED, "spot", null).value).toBe("E Colfax Ave Eastbound");
  });

  it("'Work starts' prints the ruled interim as a fact, with MOVE", () => {
    const r = row(CONFIRMED, "start", "Denver");
    // The road name — the tag's honest stand-in until the
    // nearest-intersection producer exists — and never "pin set", which
    // named the act rather than the answer.
    expect(r.value).toBe("E Colfax Ave Eastbound");
    expect(r.verb).toBe("MOVE");
  });

  it("a pin with no confirmed road falls back to the address, then to nothing", () => {
    const addressOnly = {
      ...DEFAULT_SHOULDER,
      meta: { ...DEFAULT_SHOULDER.meta, ...PIN, address: "1600 E Colfax Ave" },
    } as Scenario;
    expect(row(addressOnly, "start").value).toBe("1600 E Colfax Ave");
    const bare = {
      ...DEFAULT_SHOULDER,
      meta: { ...DEFAULT_SHOULDER.meta, ...PIN, address: "" },
    } as Scenario;
    expect(row(bare, "start").value).toBeNull();
  });

  it("'Extent' separates the value from its producer with the column's middle dot", () => {
    expect(row(CONFIRMED, "extent").value).toBe("1,000 ft · typed");
  });

  it("every row still offers a link OR a word, never neither (rule 68)", () => {
    for (const r of deriveMoveLedger(CONFIRMED, "Denver").rows) {
      expect((r.verb === null) !== (r.word === null)).toBe(true);
    }
  });
});

describe("rule 68's form (correction 3)", () => {
  const css = readFileSync(
    join(__dirname, "..", "..", "app", "globals.css"),
    "utf8",
  );

  it("a move row's leader is a dotted rule, like the fact line's", () => {
    const block = css.slice(
      css.indexOf(".workbench .a-moves .a-move .a-lead"),
    );
    expect(block.slice(0, 200)).toContain("border-bottom: 1px dotted");
  });

  it("the move row's value declares the body-value register, not a literal", () => {
    const block = css.slice(css.indexOf(".workbench .a-moves .a-move .a-val"));
    expect(block.slice(0, 200)).toContain("var(--fs-body-value)");
  });

  it("at 380 the leader collapses with the fact line's — one rule, both rows", () => {
    // The sheet is CRLF in the working tree (core.autocrlf), so the line
    // breaks are matched rather than typed.
    expect(css).toMatch(
      /\.workbench \.a-fact \.a-lead,\s*\.workbench \.a-moves \.a-move \.a-lead \{\s*display: none;/,
    );
  });
});
