// @vitest-environment happy-dom
//
// #132 — the nav "status dot" was a hardcoded always-green pulse beside
// the MUTCD edition badge: no props, no derivation, one permanent state.
// The issue's repro assumed states that never existed (the #175 lesson);
// the fix is removal — under Rule 10 the honest render of no signal is
// absence, and the edition text (6.00:1 on --canvas-tint since #289
// fidelity F3 re-valued it to #16232f; 5.61:1 before) is
// the badge.  This suite is the regression: no hue-only status chrome
// may return to the nav.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@clerk/nextjs", () => ({
  SignedIn: () => null,
  SignedOut: () => null,
  UserButton: () => null,
  OrganizationSwitcher: () => null,
  SignInButton: () => null,
}));

import { AppNav } from "./AppNav";
import { DEFAULT_FLAGGER } from "@/lib/scenarios";

afterEach(cleanup);

function mountNav() {
  return render(
    <AppNav
      mode="sandbox"
      citation="TA-10 · S-630-1"
      scenario={DEFAULT_FLAGGER}
      planId={null}
      planName={null}
      onSaved={() => {}}
    />,
  );
}

describe("nav edition badge (#132)", () => {
  it("renders the edition badge as text, with no status dot", () => {
    const { container } = mountNav();
    expect(screen.getByText(/MUTCD 2023 · CDOT/)).toBeTruthy();
    // The removed dot's two identities: the pulse animation and the
    // --pass fill.  Neither may exist anywhere in the nav.
    expect(container.querySelector("nav .animate-pulse")).toBeNull();
    expect(container.querySelector('nav [class*="--pass"]')).toBeNull();
  });

  it("carries no color-styled empty spans (hue-only signal shape)", () => {
    // Structural form of Rule 13 for this surface: any empty span whose
    // class paints a background is a color-only signal candidate.
    const { container } = mountNav();
    const emptyPainted = Array.from(container.querySelectorAll("nav span")).filter(
      (el) => el.textContent === "" && /bg-\[/.test(el.className),
    );
    expect(emptyPainted).toEqual([]);
  });
});

// #289 fidelity F4 — Part 2 rules 22–23 and the Q2 ruling.
describe("the nav, per rules 22–23 (#289 fidelity F4)", () => {
  const nav = (citation: string | null) =>
    render(
      <AppNav
        mode="sandbox"
        citation={citation}
        scenario={DEFAULT_FLAGGER}
        planId={null}
        planName={null}
        onSaved={() => {}}
      />,
    );

  it("pre-generate: the right slot reads 'MUTCD 2023 · CDOT' alone, and no empty citation cell renders", () => {
    nav(null);
    expect(screen.getByTestId("nav-citation").textContent).toBe("MUTCD 2023 · CDOT");
    // The old middle cell rendered a bare "·" between two empty strings.
    const bareDots = Array.from(document.querySelectorAll("nav span")).filter(
      (el) => el.textContent?.trim() === "·",
    );
    expect(bareDots).toEqual([]);
  });

  it("post-generate: the TA / sheet citation joins the right slot's one static string (rule 23)", () => {
    nav("TA-3 · S-630-1");
    expect(screen.getByTestId("nav-citation").textContent).toBe(
      "TA-3 · S-630-1 · MUTCD 2023 · CDOT",
    );
  });

  it("no v0.4 tag; DEMO in the nav items' normal colour, not the numerals' orange (ruled Q2)", () => {
    nav(null);
    expect(screen.queryByText("v0.4")).toBeNull();
    const demo = screen.getByText("Demo");
    expect(demo.className).not.toMatch(/--dim/);
    expect(demo.closest("span[class*='ink-on-dark-faint']")).not.toBeNull();
  });
});
