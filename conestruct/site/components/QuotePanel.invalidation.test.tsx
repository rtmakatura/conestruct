// @vitest-environment happy-dom
//
// #185 — the quote breakdown carries the #197 input-identity stamp.
// Pre-fix, the previewed figures (panel body + collapsed card headline)
// survived every settings edit while the XLSX download read the LIVE
// settings at click time — stale money presented as current, and screen
// vs file disagreeing in opposite directions on the bid surface.
// Post-fix the acceptance is: screen and XLSX cannot disagree — either
// both reflect current settings, or the screen says re-preview.
//
// Mounted through PricingCard so the collapsed headline (the number a
// user quotes from without expanding) is pinned too.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import { PricingCard } from "./PricingCard";
import {
  DEFAULT_QUOTE_SETTINGS,
  type QuoteSettings,
} from "@/lib/quote-settings";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import type {
  DeliveryStatus,
  FlaggerSource,
} from "./QuotePanel";

const BREAKDOWN = {
  equipment_lines: [],
  labor_lines: [],
  delivery_lines: [],
  is_night: false,
  night_multiplier: 1.0,
  overhead_pct: 0.1,
  profit_pct: 0.1,
  equipment_total: 148.0,
  labor_total: 1035.0,
  delivery_total: 300.0,
  subtotal: 1483.0,
  overhead: 148.3,
  profit: 163.13,
  total: 1794.43,
};

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/quote-breakdown")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => BREAKDOWN,
    } as unknown as Response);
  }
  if (url.includes("/api/render/quote")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      blob: async () => new Blob(["xlsx"]),
    } as unknown as Response);
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

// Shell-alike harness: owns settings the way GeneratorShell does (spread
// replace per edit), pins lat/lng to 0 so the distance auto-resolve
// effect stays out of the way.
function Harness() {
  const [settings, setSettings] = useState<QuoteSettings>(
    DEFAULT_QUOTE_SETTINGS,
  );
  const [flaggerSource, setFlaggerSource] = useState<FlaggerSource>("auto");
  const [delivery, setDelivery] = useState<DeliveryStatus>({ state: "idle" });
  const scenario = DEFAULT_SCENARIO as Scenario;
  return (
    <PricingCard
      mode={{ kind: "public", scenario }}
      settings={settings}
      setSettings={setSettings}
      flaggerSource={flaggerSource}
      setFlaggerSource={setFlaggerSource}
      delivery={delivery}
      setDelivery={setDelivery}
    />
  );
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

async function openAndPreview() {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: /Pricing quote/ }));
  fireEvent.click(screen.getByRole("button", { name: "Preview breakdown" }));
  await screen.findAllByText("$1,794");
}

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("quote breakdown invalidates on settings edits (#185)", () => {
  it("an overhead edit clears the figures and the collapsed headline, and says re-preview", async () => {
    await openAndPreview();
    expect(screen.getByText("Total estimate")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Overhead (%)"), {
      target: { value: "20" },
    });
    await flush();

    // No dollar figure — panel body or headline — presents as current.
    expect(screen.queryAllByText("$1,794")).toHaveLength(0);
    expect(screen.queryByText("Total estimate")).toBeNull();
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
    expect(screen.getByText(/Preview again for current totals/)).toBeTruthy();
    expect(
      screen.getByText(/expand to configure & preview/i),
    ).toBeTruthy();
  });

  it("re-preview restores current figures", async () => {
    await openAndPreview();
    fireEvent.change(screen.getByLabelText("Overhead (%)"), {
      target: { value: "20" },
    });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Preview breakdown" }));
    expect(await screen.findAllByText("$1,794")).toHaveLength(2);
    expect(screen.queryByText(/inputs changed/i)).toBeNull();
  });

  it("screen and XLSX cannot disagree: after an edit the download posts the CURRENT settings while the screen says re-preview", async () => {
    await openAndPreview();
    fireEvent.change(screen.getByLabelText("Overhead (%)"), {
      target: { value: "20" },
    });
    await flush();
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /Download Quote \(XLSX\)/ }),
    );
    await flush();
    const quoteCalls = fetchMock.mock.calls.filter(
      ([u]) =>
        String(u).includes("/api/render/quote") &&
        !String(u).includes("quote-breakdown"),
    );
    expect(quoteCalls.length).toBe(1);
    const init = (quoteCalls[0] as unknown as [unknown, RequestInit])[1];
    const body = JSON.parse(String(init.body)) as {
      settings: { overhead_pct: number };
    };
    expect(body.settings.overhead_pct).toBeCloseTo(0.2, 10);
  });

  it("an unchanged input keeps the previewed figures (no over-invalidation)", async () => {
    await openAndPreview();
    // Collapse/expand cycles must not clear the stamped answer.
    fireEvent.click(screen.getByRole("button", { name: /Pricing quote/ }));
    fireEvent.click(screen.getByRole("button", { name: /Pricing quote/ }));
    expect(screen.getAllByText("$1,794")).toHaveLength(2);
    expect(screen.getByText("Total estimate")).toBeTruthy();
  });
});
