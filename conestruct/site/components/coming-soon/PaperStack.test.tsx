// @vitest-environment happy-dom
//
// coming-soon-gate R21 — 02's four stacks, each with its own hover move,
// mounted.  What moves and how it eases is CSS (lib/design/motion.test.ts
// pins that it exists only under prefers-reduced-motion: no-preference,
// on --fan / --k); here: which card is in which state, that touch leaves
// a card static, and that each card's marks replay in the ruled order.

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Page from "@/app/page";

afterEach(cleanup);

const stacks = () => {
  const c = render(<Page />).container;
  return [...c.querySelectorAll<HTMLElement>(".cs-stack")];
};
const idx = (el: Element) => Number((el as HTMLElement).style.getPropertyValue("--i"));

describe("R21 — one move per card", () => {
  it("the four cards carry their own moves, in 02's order", () => {
    expect(stacks().map((s) => s.dataset.move)).toEqual(["plan", "quote", "audit", "crew"]);
  });

  it("hovering a card moves that card and no other; leaving puts it back", () => {
    const all = stacks();
    all.forEach((s, k) => {
      fireEvent.pointerEnter(s, { pointerType: "mouse" });
      expect(all.map((o) => o.classList.contains("is-fanned"))).toEqual(all.map((_, j) => j === k));
      fireEvent.pointerLeave(s, { pointerType: "mouse" });
      expect(all.some((o) => o.classList.contains("is-fanned"))).toBe(false);
    });
  });

  it("a pen moves it too; touch shows the static stack", () => {
    const [plan, quote] = stacks();
    fireEvent.pointerEnter(plan, { pointerType: "pen" });
    expect(plan.classList.contains("is-fanned")).toBe(true);
    fireEvent.pointerEnter(quote, { pointerType: "touch" });
    expect(quote.classList.contains("is-fanned")).toBe(false);
  });

  it("nothing animates inline — the marks carry only their place in the sequence", () => {
    for (const el of stacks().flatMap((s) => [...s.querySelectorAll<HTMLElement>("[style]")])) {
      expect(el.style.animation, el.outerHTML.slice(0, 80)).toBe("");
      expect(el.style.transition, el.outerHTML.slice(0, 80)).toBe("");
      expect(el.style.transform, el.outerHTML.slice(0, 80)).toBe("");
    }
  });
});

describe("R21 — each card's marks, in order", () => {
  it("1 · the plan sheet: the four taper devices appear one after another along the taper", () => {
    const marks = [...stacks()[0].querySelectorAll(".cs-seq")];
    expect(marks.every((m) => m.classList.contains("cs-seq-appear"))).toBe(true);
    expect(marks.map(idx)).toEqual([0, 1, 2, 3]);
    // Along the taper: left to right, edge up to the lane line.
    const xs = marks.map((m) => parseFloat(m.getAttribute("x")!));
    const ys = marks.map((m) => Number(m.getAttribute("y")));
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect([...ys].sort((a, b) => b - a)).toEqual(ys);
  });

  it("2 · the count and the quote: the orange amount bars fill in turn, ending on the total", () => {
    const marks = [...stacks()[1].querySelectorAll(".cs-seq")];
    expect(marks.every((m) => m.classList.contains("cs-seq-fill") && m.classList.contains("cs-bar-dim"))).toBe(true);
    expect(marks.map(idx)).toEqual([0, 1, 2, 3, 4]);
    const ys = marks.map((m) => Number(m.getAttribute("y")));
    expect(ys).toEqual([60, 82, 104, 126, 166]);
    expect(Number(marks[4].getAttribute("height"))).toBeGreaterThan(Number(marks[0].getAttribute("height")));
  });

  it("3 · the audit: the citation box beside each § row draws its outline, one by one", () => {
    const marks = [...stacks()[2].querySelectorAll(".cs-seq")];
    expect(marks).toHaveLength(5);
    expect(marks.every((m) => m.classList.contains("cs-seq-draw") && m.getAttribute("pathLength") === "1")).toBe(true);
    expect(marks.map(idx)).toEqual([0, 1, 2, 3, 4]);
    const ys = marks.map((m) => Number(m.getAttribute("y")));
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });

  it("4 · the crew sheet: the four numbered squares fill in turn, 1 → 4, and no ✓ (reserved for verdicts)", () => {
    const s = stacks()[3];
    const marks = [...s.querySelectorAll(".cs-seq")];
    expect(marks.every((m) => m.classList.contains("cs-seq-ink"))).toBe(true);
    expect(marks.map(idx)).toEqual([0, 1, 2, 3]);
    expect(marks.map((m) => m.parentElement?.querySelector("text")?.textContent)).toEqual(["1", "2", "3", "4"]);
    expect(s.textContent).not.toContain("✓");
  });
});
