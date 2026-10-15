// @vitest-environment happy-dom
//
// #242 (R151): the nav's one line when a newer frontend is live.  Absent
// while the tab is current; "New version. Reload" when it isn't; pressing
// it reloads (the page never reloads itself).  Mounted (Rule 11).

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({ stale: false }));
vi.mock("@/lib/new-version", () => ({ useNewVersion: () => state.stale }));
vi.mock("@clerk/nextjs", () => ({
  OrganizationSwitcher: () => null,
  SignedIn: () => null,
  SignedOut: () => null,
  UserButton: () => null,
}));

import { AppNav } from "./AppNav";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";

function nav() {
  return render(
    <AppNav
      mode="sandbox"
      citation={null}
      scenario={DEFAULT_SCENARIO as Scenario}
      planId={null}
      planName={null}
      onSaved={() => {}}
    />,
  );
}

afterEach(() => {
  cleanup();
  state.stale = false;
  vi.restoreAllMocks();
});

describe("AppNav new-version line (#242)", () => {
  it("is absent while the tab runs the live build", () => {
    nav();
    expect(screen.queryByTestId("nav-new-version")).toBeNull();
    expect(screen.queryByText(/New version/)).toBeNull();
  });

  it("reads 'New version. Reload' inside the polite live region when a newer build is live", () => {
    state.stale = true;
    nav();
    const b = screen.getByRole("button", { name: "New version. Reload" });
    expect(b.closest('[role="status"]')).not.toBeNull();
  });

  it("reloads only when pressed", () => {
    state.stale = true;
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      reload,
    } as Location);
    nav();
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("nav-new-version"));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
