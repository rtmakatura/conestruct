// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { NeedsYou } from "./NeedsYou";
import { deriveNeedsYou, type NeedsYouItem } from "@/lib/needs-you";

// #288 Phase 1 — rules 72–79 + rulings 185/186 + ruling d.
//
// Rule 11: tested at the rendered output, not at the derivation alone —
// ruling d's whole point is what does and does not appear on screen, and
// a pure-function test of `action: null` would pass while a button
// shipped.

const item = (over: Partial<NeedsYouItem> & Pick<NeedsYouItem, "id" | "tier">): NeedsYouItem => ({
  title: "Adjacent at-grade intersection",
  result: "DETECTED",
  cite: "MUTCD § 6C.02",
  action: null,
  ...over,
});

const renderModel = (items: NeedsYouItem[]) =>
  render(<NeedsYou model={deriveNeedsYou(items)} />);

describe("NeedsYou (rules 72–79)", () => {
  it("renders nothing at zero items — an empty block would assert a want that isn't there", () => {
    const { container } = renderModel([]);
    expect(container.querySelector(".needs-you")).toBeNull();
  });

  it("ruling 185: the header number is the SUM, and the split is provenance not a second numeral", () => {
    // Scoped to this render's own container: `document` would read the
    // previous test's mount, which is how the first draft of this suite
    // failed for the wrong reason.
    const { container } = renderModel([
      item({ id: "a", tier: "changed" }),
      item({ id: "b", tier: "changed" }),
      item({ id: "c", tier: "attention" }),
    ]);
    expect(container.querySelector(".ny-count")?.textContent).toBe("3");
    // The decomposition rides the provenance line, in words.
    const sub = container.querySelector(".ny-sub");
    expect(sub?.textContent).toContain("2 changed this plan");
    expect(sub?.textContent).toContain("1 needs attention");
    // …and there is exactly one numeral element in the header.
    expect(container.querySelectorAll(".ny-count").length).toBe(1);
  });

  it("Rule 10: a zero side renders as absence, not as '0 needs attention'", () => {
    const { container } = renderModel([item({ id: "a", tier: "changed" })]);
    const sub = container.querySelector(".ny-sub");
    expect(sub?.textContent).toContain("1 changed this plan");
    expect(sub?.textContent).not.toContain("0 needs attention");
    expect(sub?.textContent).not.toContain("needs attention ·");
  });

  it("ruling d: an item whose action writes nothing renders WITH provenance and WITHOUT a button", () => {
    const { container } = renderModel([
      item({ id: "ack", tier: "attention", title: "Standing hazard meter", action: null }),
    ]);
    // The item is on screen…
    expect(screen.getByText("Standing hazard meter")).toBeTruthy();
    // …its provenance names the tier in words (rule 75)…
    expect(container.querySelector(".ny-prov")?.textContent).toContain("needs attention");
    // …and no control rendered for it.
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("rule 77: one button per row, two only for a true pair", () => {
    const { container } = renderModel([
      item({
        id: "one",
        tier: "changed",
        action: { kind: "correct-in-setup", label: "CORRECT IN SETUP" },
      }),
      item({
        id: "pair",
        tier: "attention",
        action: {
          kind: "dismiss",
          label: "DISMISS",
          pair: { kind: "keep", label: "KEEP" },
        },
      }),
    ]);
    const rows = container.querySelectorAll(".ny-item");
    expect(rows[0].querySelectorAll("button").length).toBe(1);
    expect(rows[1].querySelectorAll("button").length).toBe(2);
  });

  it("every rendered control declares its write (the write-lock honesty test)", () => {
    const { container } = renderModel([
      item({ id: "w", tier: "changed", action: { kind: "correct-in-setup", label: "CORRECT IN SETUP" } }),
    ]);
    for (const b of Array.from(container.querySelectorAll("button"))) {
      expect(b.getAttribute("data-write")).toBeTruthy();
    }
  });

  it("rule 75: the provenance carries the wire's evidence and nothing it did not", () => {
    const { container } = renderModel([
      item({ id: "e", tier: "attention", evidence: "nearest 41 ft" }),
    ]);
    const prov = container.querySelector(".ny-prov")?.textContent ?? "";
    expect(prov).toContain("needs attention");
    expect(prov).toContain("nearest 41 ft");
  });

  it("orders ▲ changed before ⚠ attention, preserving wire order inside a tier", () => {
    const { container } = renderModel([
      item({ id: "att1", tier: "attention", title: "A1" }),
      item({ id: "chg1", tier: "changed", title: "C1" }),
      item({ id: "att2", tier: "attention", title: "A2" }),
    ]);
    const titles = Array.from(container.querySelectorAll(".ny-body")).map((e) => e.textContent);
    expect(titles).toEqual(["C1", "A1", "A2"]);
  });

  it("ruling 186: always expanded — the header is not a disclosure control", () => {
    const { container } = renderModel([item({ id: "a", tier: "changed" })]);
    const head = container.querySelector(".ny-head");
    expect(head?.querySelector("button")).toBeNull();
    expect(head?.textContent).not.toContain("›");
  });
});
