// @vitest-environment happy-dom
//
// #182 — the fetch debounce, tested at the request timeline (Rule 11:
// the bug was the timeline, one request pair per keystroke against two
// 30/min/IP rate buckets).  Leading + trailing, 350 ms (chosen — see
// FETCH_DEBOUNCE_MS): a discrete edit fires immediately; a burst
// collapses to the leading fetch plus one trailing fetch carrying the
// final value; Retry bypasses.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { DEFAULT_FLAGGER } from "@/lib/scenarios";

type Deferred = { resolve: (r: Response) => void; body: string };
let auditCalls: Deferred[] = [];
let bdCalls: Deferred[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const body = typeof init?.body === "string" ? init.body : "";
  if (url.includes("/api/render/audit")) {
    return new Promise<Response>((resolve) =>
      auditCalls.push({ resolve, body }),
    );
  }
  if (url.includes("/api/render/device-breakdown")) {
    return new Promise<Response>((resolve) => bdCalls.push({ resolve, body }));
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

const speedRange = () =>
  document.querySelector('input[type="range"]') as HTMLInputElement;

const drag = async (value: number) => {
  await act(async () => {
    fireEvent.change(speedRange(), { target: { value: String(value) } });
  });
};

const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  auditCalls = [];
  bdCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetch debounce (#182)", () => {
  it("a 12-step burst collapses to leading + one trailing pair carrying the final value", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_FLAGGER} />);
    expect(auditCalls.length).toBe(1); // mount
    expect(bdCalls.length).toBe(1);

    // Idle past the window so the burst's first step earns a leading fire.
    await advance(400);
    const steps = [25, 30, 25, 30, 25, 30, 25, 30, 25, 30, 25, 30];
    for (const v of steps) {
      await drag(v);
      await advance(50); // 50 ms between slider notches — inside the window
    }
    // Leading fetch only, for the burst's FIRST value.
    expect(auditCalls.length).toBe(2);
    expect(auditCalls[1].body).toContain('"speed":25');

    // The burst pauses: exactly one trailing pair, carrying the FINAL value.
    await advance(350);
    expect(auditCalls.length).toBe(3);
    expect(bdCalls.length).toBe(3);
    expect(auditCalls[2].body).toContain('"speed":30');

    // Quiet afterwards: nothing else fires.
    await advance(2000);
    expect(auditCalls.length).toBe(3);
  });

  it("a discrete edit after a quiet period verifies immediately (leading edge)", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_FLAGGER} />);
    await advance(1000);
    await drag(40);
    // No timer advance needed — the fetch is already dispatched.
    expect(auditCalls.length).toBe(2);
    expect(auditCalls[1].body).toContain('"speed":40');
  });

  it("the strip shows VERIFYING through the deferred window — never the previous verdict as current", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_FLAGGER} />);
    await advance(400);
    await drag(45);
    await drag(50); // second write inside the window → deferred
    // A fetch for speed 45 is in flight, speed 50 is pending: the strip
    // must not claim anything settled.
    expect(document.body.textContent).toContain("VERIFYING");
    await advance(350);
    expect(auditCalls[auditCalls.length - 1].body).toContain('"speed":50');
  });

  it("Retry bypasses the debounce", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_FLAGGER} />);
    await act(async () => {
      auditCalls[0].resolve({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error("not json");
        },
        text: async () => {
          throw new Error("consumed");
        },
      } as unknown as Response);
      await Promise.resolve();
      await Promise.resolve();
    });
    const before = auditCalls.length;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Retry$/ }));
    });
    expect(auditCalls.length).toBe(before + 1); // immediate, no advance
  });
});
