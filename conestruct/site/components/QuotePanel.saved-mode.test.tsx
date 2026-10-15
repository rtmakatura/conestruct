// @vitest-environment happy-dom
//
// #194 then #202 — on a saved plan the quote fields used to accept typing
// that reached no request (the row route priced at DEFAULT_QUOTE_SETTINGS),
// and the flagger caption read "Auto · 0 from layout" though nothing was
// computed.  #194 hid the fields; #202 persists the settings with the plan
// and the row route prices with them, so the eight fields are live again.
// The "Auto ·" caption stays public-only (only public mode computes it).
// Mounted through PricingCard, as the shell mounts it (Rule 11).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import { PricingCard } from "./PricingCard";
import type { DeliveryStatus, FlaggerSource } from "./QuotePanel";
import { DEFAULT_QUOTE_SETTINGS, type QuoteSettings } from "@/lib/quote-settings";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";

type Mode =
  | { kind: "public"; scenario: Scenario }
  | { kind: "saved"; planId: string | null; dirty?: boolean };

function Harness({ mode }: { mode: Mode }) {
  const [settings, setSettings] = useState<QuoteSettings>(DEFAULT_QUOTE_SETTINGS);
  const [flaggerSource, setFlaggerSource] = useState<FlaggerSource>("auto");
  const [delivery, setDelivery] = useState<DeliveryStatus>({ state: "idle" });
  return (
    <PricingCard
      mode={mode}
      settings={settings}
      setSettings={setSettings}
      flaggerSource={flaggerSource}
      setFlaggerSource={setFlaggerSource}
      delivery={delivery}
      setDelivery={setDelivery}
    />
  );
}

function open(mode: Mode) {
  render(<Harness mode={mode} />);
  fireEvent.click(screen.getByRole("button", { name: /Pricing quote/ }));
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({}) })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("saved-mode quote panel (#194, #202)", () => {
  it("renders the eight fields, now that they reach the saved quote", () => {
    open({ kind: "saved", planId: "plan-1" });
    expect(screen.getAllByRole("spinbutton")).toHaveLength(8);
    expect(screen.queryByTestId("quote-saved-defaults")).toBeNull();
  });

  it("asserts no auto count it didn't compute", () => {
    open({ kind: "saved", planId: "plan-1" });
    expect(screen.queryByText(/Auto ·/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Flaggers"), { target: { value: "2" } });
    expect(screen.getByText("Manual override")).toBeTruthy();
  });

  it("keeps the row-backed download", () => {
    open({ kind: "saved", planId: "plan-1" });
    // #203: a button that GETs the plan's quote route (no anchor).
    expect(screen.queryByRole("link", { name: /Download Quote \(XLSX\)/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Download Quote \(XLSX\)/ }));
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/plans/plan-1/quote");
  });

  it("public mode still renders the eight fields and the flagger caption", () => {
    open({ kind: "public", scenario: DEFAULT_SCENARIO as Scenario });
    expect(screen.getAllByRole("spinbutton")).toHaveLength(8);
    expect(screen.getByText(/Auto · \d+ from layout/)).toBeTruthy();
  });
});
