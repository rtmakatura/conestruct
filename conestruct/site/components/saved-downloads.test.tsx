// @vitest-environment happy-dom
//
// #203 — a saved plan's downloads used to be <a href download> anchors: a
// failed render navigated the tab to a bare "Render failed" page.  They
// are fetch-driven now: a failure prints in the card (or the quote panel's
// error line) with the sandbox's wording and a "Try again", the page
// stays, and a success saves the file under the route's own name.
// Mounted (Rule 11).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";

import { OutputCards } from "./OutputCards";
import { PricingCard } from "./PricingCard";
import type { DeliveryStatus, FlaggerSource } from "./QuotePanel";
import { DEFAULT_QUOTE_SETTINGS, type QuoteSettings } from "@/lib/quote-settings";
import type { AuditSummary } from "@/lib/render-types";

const SUMMARY = {
  checks_run: 13,
  issues_flagged: 0,
} as unknown as AuditSummary;

type Saved = { kind: "saved"; planId: string | null; dirty?: boolean };

function cards(mode: Saved) {
  return (
    <OutputCards
      summary={SUMMARY}
      generated={true}
      mode={mode}
      breakdown={{ state: "ok", data: { devices: [], total_devices: 0, unique_types: 0 } } as never}
      auditChecked={13}
    />
  );
}

let clicks: string[] = [];

beforeEach(() => {
  clicks = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push(this.download);
  });
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function respond(res: Response | Error) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => (res instanceof Error ? Promise.reject(res) : Promise.resolve(res))),
  );
}

const firstButton = (c: HTMLElement) =>
  c.querySelector<HTMLButtonElement>(".dl-card button.dl-btn")!;

describe("saved-plan download cards (#203)", () => {
  it("a 502 stays on the page: the card prints the sandbox's message and offers Try again", async () => {
    respond(new Response("Render failed", { status: 502 }));
    const { container } = render(cards({ kind: "saved", planId: "plan-1" }));
    fireEvent.click(firstButton(container));
    expect(await screen.findByText("Render failed (502)")).toBeTruthy();
    expect(firstButton(container).textContent).toContain("Try again");
    expect(clicks).toEqual([]);
  });

  it("a 400 prints the backend's message", async () => {
    respond(
      new Response(JSON.stringify({ detail: { message: "Work zone shorter than the taper." } }), {
        status: 400,
      }),
    );
    const { container } = render(cards({ kind: "saved", planId: "plan-1" }));
    fireEvent.click(firstButton(container));
    expect(await screen.findByText("Work zone shorter than the taper.")).toBeTruthy();
  });

  it("a thrown fetch prints Network error", async () => {
    respond(new Error("offline"));
    const { container } = render(cards({ kind: "saved", planId: "plan-1" }));
    fireEvent.click(firstButton(container));
    expect(await screen.findByText("Network error")).toBeTruthy();
  });

  it("a 200 saves under the route's filename and prints nothing", async () => {
    respond(
      new Response("pdf", {
        status: 200,
        headers: { "content-disposition": 'attachment; filename="Broadway_SB.pdf"' },
      }),
    );
    const { container } = render(cards({ kind: "saved", planId: "plan-1" }));
    fireEvent.click(firstButton(container));
    await waitFor(() => expect(clicks).toEqual(["Broadway_SB.pdf"]));
    expect(screen.queryByText(/Render failed|Network error/)).toBeNull();
  });

  it("an edit (dirty) drops the error, and saving again does not bring it back", async () => {
    respond(new Response("Render failed", { status: 502 }));
    const { container, rerender } = render(cards({ kind: "saved", planId: "plan-1" }));
    fireEvent.click(firstButton(container));
    await screen.findByText("Render failed (502)");
    rerender(cards({ kind: "saved", planId: "plan-1", dirty: true }));
    expect(screen.queryByText("Render failed (502)")).toBeNull();
    rerender(cards({ kind: "saved", planId: "plan-1", dirty: false }));
    await waitFor(() => expect(screen.queryByText("Render failed (502)")).toBeNull());
    expect(firstButton(container).textContent).not.toContain("Try again");
  });
});

function Quote({ mode }: { mode: Saved }) {
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

describe("saved-plan quote download (#203)", () => {
  it("a 502 prints on the panel's error line and the page stays", async () => {
    respond(new Response("Render failed", { status: 502 }));
    render(<Quote mode={{ kind: "saved", planId: "plan-1" }} />);
    fireEvent.click(screen.getByRole("button", { name: /Pricing quote/ }));
    fireEvent.click(screen.getByRole("button", { name: /Download Quote \(XLSX\)/ }));
    expect(await screen.findByText("Render failed (502)")).toBeTruthy();
    expect(clicks).toEqual([]);
  });

  it("a 200 saves under the route's filename", async () => {
    respond(
      new Response("xlsx", {
        status: 200,
        headers: { "content-disposition": 'attachment; filename="Broadway_SB.xlsx"' },
      }),
    );
    render(<Quote mode={{ kind: "saved", planId: "plan-1" }} />);
    fireEvent.click(screen.getByRole("button", { name: /Pricing quote/ }));
    fireEvent.click(screen.getByRole("button", { name: /Download Quote \(XLSX\)/ }));
    await waitFor(() => expect(clicks).toEqual(["Broadway_SB.xlsx"]));
  });
});
