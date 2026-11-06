// #446 ruling 3: the least scroll that shows the ✓ row and "Next question".
import { describe, expect, it } from "vitest";
import { REVEAL_MARGIN_PX, revealDelta } from "./cross-street-reveal";

const NAV = 52;
const VIEW = 800;

describe("revealDelta", () => {
  it("both in view: no scroll, wherever the bar's words are", () => {
    expect(revealDelta(200, 500, 700, NAV, VIEW)).toBe(0);
    expect(revealDelta(-100, NAV, VIEW, NAV, VIEW)).toBe(0);
  });
  it("the button below the fold: just enough, with the margin", () => {
    expect(revealDelta(300, 600, 900, NAV, VIEW)).toBe(100 + REVEAL_MARGIN_PX);
  });
  it("T19 B: the row and the button win, and the bar's words go", () => {
    const wordsTop = 200;
    const delta = revealDelta(wordsTop, 700, 1200, NAV, VIEW);
    expect(delta).toBe(400 + REVEAL_MARGIN_PX);
    expect(wordsTop - delta).toBeLessThan(NAV);
  });
  it("T19 B: the margin alone gives way to the words", () => {
    // 10 px needed, 16 px wanted, 12 px of room: the words stay exactly clear.
    expect(revealDelta(NAV + 12, 600, VIEW + 10, NAV, VIEW)).toBe(12);
    // 10 px of room, 10 px needed: the button lands on the edge, no margin.
    expect(revealDelta(NAV + 10, 600, VIEW + 10, NAV, VIEW)).toBe(10);
  });
  it("T19 B: the button is never cut for the words, even by a little", () => {
    // 1440x700's shape: 1.8 px past the words' room; the margin goes, the button shows.
    expect(revealDelta(NAV + 100, 300, VIEW + 101.8, NAV, VIEW)).toBeCloseTo(101.8);
  });
  it("T19 B: words lost by more than the margin keep the margin", () => {
    expect(revealDelta(NAV, 600, 900, NAV, VIEW)).toBe(100 + REVEAL_MARGIN_PX);
    expect(revealDelta(NAV - 30, 600, 900, NAV, VIEW)).toBe(100 + REVEAL_MARGIN_PX);
  });
  it("T19 B: the scroll still stops with the row's top at the nav", () => {
    expect(revealDelta(NAV - 30, 150, 1500, NAV, VIEW)).toBe(150 - NAV);
    expect(revealDelta(500, 150, 1500, NAV, VIEW)).toBe(150 - NAV);
  });
  it("the row above the view (scrolled past it): back up to it", () => {
    expect(revealDelta(-300, 40, 300, NAV, VIEW)).toBe(40 - NAV);
  });
});
