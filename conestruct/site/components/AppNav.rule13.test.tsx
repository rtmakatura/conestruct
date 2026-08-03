// @vitest-environment happy-dom
//
// #132 — the nav "status dot" was a hardcoded always-green pulse beside
// the MUTCD edition badge: no props, no derivation, one permanent state.
// The issue's repro assumed states that never existed (the #175 lesson);
// the fix is removal — under Rule 10 the honest render of no signal is
// absence, and the edition text (measured 5.61:1 on --canvas-tint) is
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
      ta="TA-10"
      cdotSheet="S-630-1"
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
