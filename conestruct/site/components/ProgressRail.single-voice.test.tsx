// @vitest-environment happy-dom
//
// #228 — the single-voice proof: every glyph, word, info line, and
// aria phrase a rail row shows comes from deriveRail's return.  The
// entries below carry sentinel strings no component could invent, and
// the DOM must show EXACTLY the sentinels — a component that still
// owns a glyph map, a state-word literal, or an aria template fails
// here.  Red-proved against the #221 component (which owned all
// three); the failure output is committed with the arc evidence.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProgressRail } from "./ProgressRail";
import type { Rail, RailEntry } from "@/lib/scenarios/rail";

afterEach(cleanup);

const SENTINEL_ENTRY: RailEntry = {
  id: "road",
  label: "Road",
  anchorId: "rail-step-road",
  state: "stale",
  issues: [],
  step: 42,
  glyph: "__GLYPH__",
  word: "__WORD__",
  info: "__INFO__",
  aria: "__ARIA__",
};

describe("#228 single voice — the component renders, never derives", () => {
  it("shows exactly the derivation's glyph, step, word, info, and aria", () => {
    const rail: Rail = { entries: [SENTINEL_ENTRY], blocker: null };
    render(<ProgressRail rail={rail} generateAnchorId="g" />);
    const btn = screen.getByRole("button", { name: "__ARIA__" });
    expect(btn.querySelector(".rail-glyph")?.textContent).toBe("__GLYPH__");
    expect(btn.querySelector(".rail-step")?.textContent).toBe("42");
    expect(btn.querySelector(".rail-note")?.textContent).toBe("__WORD__");
    expect(btn.querySelector(".rail-info")?.textContent).toBe("__INFO__");
    // Nothing beyond the derivation's strings and the label — a
    // component-side word or glyph would surface right here.
    expect(btn.textContent).toBe("__GLYPH__42Road__WORD____INFO__");
  });

  it("an attention entry repeats the derivation's glyph once per issue", () => {
    const rail: Rail = {
      entries: [
        {
          ...SENTINEL_ENTRY,
          state: "attention",
          glyph: "__G2__",
          issues: [{ text: "a" }, { text: "b" }],
        },
      ],
      blocker: null,
    };
    render(<ProgressRail rail={rail} generateAnchorId="g" />);
    const btn = screen.getByRole("button", { name: "__ARIA__" });
    expect(
      Array.from(btn.querySelectorAll(".rail-glyph")).map(
        (g) => g.textContent,
      ),
    ).toEqual(["__G2__", "__G2__"]);
  });

  it("the owning entry renders the blocker string in the word's place — both from the derivation", () => {
    const rail: Rail = {
      entries: [
        {
          ...SENTINEL_ENTRY,
          state: "attention",
          glyph: "__G3__",
          issues: [{ text: "__BLOCKER__" }],
        },
      ],
      blocker: { message: "__BLOCKER__", entryId: "road" },
    };
    render(<ProgressRail rail={rail} generateAnchorId="g" />);
    const btn = screen.getByRole("button", { name: "__ARIA__" });
    expect(btn.querySelector(".rail-blocker")?.textContent).toBe(
      "__BLOCKER__",
    );
    // The state word yields to the blocker string, exactly as before.
    expect(btn.querySelector(".rail-note")).toBeNull();
  });
});
