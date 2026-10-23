// @vitest-environment happy-dom
//
// #373 — an equipment line with no daily rate (the flagger plan's pilot car,
// `unpriced`; or a jurisdiction device with no single rate,
// `jurisdiction_unmapped`) shows "—" in Daily and Extended, never $0.00.
// The backend excludes it from the total and the XLSX already prints "—";
// a $0.00 on screen would read the device as free (Rule 10, #151/#154).
// Mounted through PricingCard, as the panel ships.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";

import { PricingCard } from "./PricingCard";
import {
  DEFAULT_QUOTE_SETTINGS,
  type QuoteSettings,
} from "@/lib/quote-settings";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import type { DeliveryStatus, FlaggerSource } from "./QuotePanel";

const LINE = {
  label: "",
  description: "",
  unit: "EACH",
  days: 1,
  note: "",
  jurisdiction_required: false,
  jurisdiction_unmapped: false,
};

const BREAKDOWN = {
  equipment_lines: [
    { ...LINE, item_number: 1, device_type: "DRUM", qty: 6, daily_rate: 4.5, extended: 27.0 },
    {
      ...LINE,
      item_number: 2,
      device_type: 'Pilot car with G20-4 "PILOT CAR/FOLLOW ME" sign',
      qty: 1,
      daily_rate: 0.0,
      extended: 0.0,
      unpriced: true,
    },
    {
      ...LINE,
      item_number: 3,
      device_type: "Advance Warning Signs (jurisdiction-required)",
      qty: 1,
      daily_rate: 0.0,
      extended: 0.0,
      jurisdiction_required: true,
      jurisdiction_unmapped: true,
    },
  ],
  labor_lines: [],
  delivery_lines: [],
  is_night: false,
  night_multiplier: 1.0,
  overhead_pct: 0.1,
  profit_pct: 0.1,
  equipment_total: 27.0,
  labor_total: 0.0,
  delivery_total: 0.0,
  subtotal: 27.0,
  overhead: 2.7,
  profit: 2.97,
  total: 32.67,
};

const fetchMock = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => BREAKDOWN,
  } as unknown as Response),
);

function Harness() {
  const [settings, setSettings] = useState<QuoteSettings>(DEFAULT_QUOTE_SETTINGS);
  const [flaggerSource, setFlaggerSource] = useState<FlaggerSource>("auto");
  const [delivery, setDelivery] = useState<DeliveryStatus>({ state: "idle" });
  return (
    <PricingCard
      mode={{ kind: "public", scenario: DEFAULT_SCENARIO as Scenario }}
      settings={settings}
      setSettings={setSettings}
      flaggerSource={flaggerSource}
      setFlaggerSource={setFlaggerSource}
      delivery={delivery}
      setDelivery={setDelivery}
    />
  );
}

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function rowFor(name: string): HTMLElement {
  const row = screen.getByText(name).closest("tr");
  expect(row).toBeTruthy();
  return row as HTMLElement;
}

describe("unpriced equipment lines (#373)", () => {
  it("shows — for the pilot car and an unmapped jurisdiction line, never $0.00", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Pricing quote/ }));
    fireEvent.click(screen.getByRole("button", { name: "Preview breakdown" }));
    fireEvent.click(await screen.findByRole("button", { name: /Equipment Rental/ }));

    for (const name of [
      'Pilot car with G20-4 "PILOT CAR/FOLLOW ME" sign',
      "Advance Warning Signs (jurisdiction-required)",
    ]) {
      const row = rowFor(name);
      expect(within(row).getAllByText("—").length).toBeGreaterThanOrEqual(2);
      expect(within(row).queryByText("$0")).toBeNull();
      expect(within(row).queryByText("$0.00")).toBeNull();
    }
    // A priced line still shows its money.
    expect(within(rowFor("DRUM")).getAllByText(/^\$/).length).toBe(2);
  });
});
