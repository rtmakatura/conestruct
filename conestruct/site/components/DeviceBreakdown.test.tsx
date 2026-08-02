// @vitest-environment happy-dom
//
// #184 — the device chip's declined contract, mounted at the chip (the
// Retry-on-refusal lived in this component's error rendering).  A 400 is
// the backend declining the input: the chip mirrors AuditTrail's
// declined line and offers no Retry — retrying an unchanged input
// re-earns the same 400.  Every other failure keeps the failed line and
// its Retry, unreframed.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { DeviceBreakdown } from "./DeviceBreakdown";

afterEach(cleanup);

describe("DeviceBreakdown error honesty (#184)", () => {
  it("a 400 renders the declined line with no Retry", () => {
    const onRetry = vi.fn();
    render(
      <DeviceBreakdown
        state={{
          state: "error",
          message: "workZoneSpeed (55) must be <= posted speed (45).",
          httpStatus: 400,
        }}
        onRetry={onRetry}
      />,
    );
    expect(
      screen.getByText(
        /Device schedule unavailable while generation is declined/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/unavailable — generation declined/),
    ).toBeTruthy();
    // The chip neither re-quotes the refusal (StatusBar's single voice)
    // nor offers a Retry.
    expect(screen.queryByText(/must be <= posted speed/)).toBeNull();
    expect(screen.queryByRole("button", { name: /^Retry$/ })).toBeNull();
  });

  it("a 5xx keeps the failed line and a working Retry", () => {
    const onRetry = vi.fn();
    render(
      <DeviceBreakdown
        state={{ state: "error", message: "HTTP 502", httpStatus: 502 }}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText(/Device breakdown failed: HTTP 502/)).toBeTruthy();
    const retry = screen.getByRole("button", { name: /^Retry$/ });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("a network error (no httpStatus) keeps the failed line and Retry", () => {
    render(
      <DeviceBreakdown
        state={{ state: "error", message: "Network error" }}
        onRetry={() => {}}
      />,
    );
    expect(
      screen.getByText(/Device breakdown failed: Network error/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Retry$/ })).toBeTruthy();
  });
});
