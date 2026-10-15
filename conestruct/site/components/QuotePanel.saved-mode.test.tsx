// @vitest-environment happy-dom
//
// #194 — on a saved plan the quote route sends no settings, so the XLSX
// prices at DEFAULT_QUOTE_SETTINGS.  The eight rate fields used to accept
// typing that reached no request, and the flagger caption read "Auto · 0
// from layout" though no count was computed.  Saved mode now renders no
// fields and states the defaults the quote uses; public mode is unchanged.
// Mounted through PricingCard, as the shell mounts it (Rule 11).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import { PricingCard } from "./PricingCard";
import { savedDefaultsLine, type DeliveryStatus, type FlaggerSource } from "./QuotePanel";
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

describe("saved-mode quote panel (#194)", () => {
  it("renders no rate field and no auto caption", () => {
    open({ kind: "saved", planId: "plan-1" });
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.queryByText(/Auto ·/)).toBeNull();
    expect(screen.queryByLabelText("Flagger ($/hr)")).toBeNull();
  });

  it("states the defaults the saved quote is priced at", () => {
    open({ kind: "saved", planId: "plan-1" });
    const line = screen.getByTestId("quote-saved-defaults").textContent;
    expect(line).toBe(
      "This saved plan's quote uses the default settings: 1 day, 0 flaggers, " +
        "20 mi delivery, 10% overhead, 10% profit, and $55 flagger, $75 TCS " +
        "and $45 crew per hour. Custom rates can't be saved with a plan yet.",
    );
    // The line is read from the one source the route prices with.
    expect(line).toBe(savedDefaultsLine(DEFAULT_QUOTE_SETTINGS));
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
    expect(screen.queryByTestId("quote-saved-defaults")).toBeNull();
  });
});

describe("savedDefaultsLine", () => {
  it("pluralises from the values", () => {
    const s = { ...DEFAULT_QUOTE_SETTINGS, project_duration_days: 3, num_flaggers: 1 };
    expect(savedDefaultsLine(s)).toContain("3 days, 1 flagger,");
  });
});
