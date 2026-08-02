// @vitest-environment happy-dom
//
// Arc 3 Step-2 defect reproductions (#184 + #182), written to PASS on the
// DEFECTIVE behavior at eeee27f (pre-arc HEAD).  Each pass is a
// reproduction, not an endorsement — the fixes invert these assertions.
//
// #184 — a backend 422 (already collapsed to 502 by the render proxy;
// live capture in repro-422 output) renders as VERIFICATION UNAVAILABLE
// with "Audit trail failed: HTTP 502" and a Retry that re-fires the
// byte-identical doomed request.
//
// #182 — every scenario write dispatches one audit + one device-breakdown
// request with no debounce (the request timeline is 1:1 with keystrokes /
// slider steps), and a 429 renders as the same VERIFICATION UNAVAILABLE
// outage voice with a Retry.

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

const BREAKDOWN = {
  devices: [],
  total_devices: 42,
  unique_types: 6,
  zone_geometry: {
    taper_l_ft: 183,
    buffer_b_ft: 495,
    device_spacing_ft: 55,
    work_len_ft: 500,
  },
};

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

const okBd = () =>
  ({
    ok: true,
    status: 200,
    json: async () => BREAKDOWN,
  }) as unknown as Response;

// What the render proxy actually serves for a backend 422 (live capture:
// plain-text "Audit trail failed", status 502).  res.json() rejects on the
// text body; the follow-up res.text() rejects too (body already consumed
// by the json() attempt) — the client lands on the `HTTP ${status}`
// fallback.
const proxied502 = () =>
  ({
    ok: false,
    status: 502,
    json: async () => {
      throw new Error("not json");
    },
    text: async () => {
      throw new Error("body consumed");
    },
  }) as unknown as Response;

// A rate-limit 429 from rateLimitOr429 (plain text "Too many requests").
const throttled429 = () =>
  ({
    ok: false,
    status: 429,
    json: async () => {
      throw new Error("not json");
    },
    text: async () => {
      throw new Error("body consumed");
    },
  }) as unknown as Response;

async function release(q: Deferred[], index: number, response: Response) {
  await act(async () => {
    q[index].resolve(response);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  auditCalls = [];
  bdCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Arc 3 defect reproductions at eeee27f", () => {
  it("#184: a proxied 422 (502) renders as an outage — UNAVAILABLE + 'HTTP 502' + Retry re-firing the identical doomed request", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_FLAGGER} />);
    await release(bdCalls, 0, okBd());
    await release(auditCalls, 0, proxied502());

    // The strip blames availability, not the input.
    expect(document.body.textContent).toContain("VERIFICATION UNAVAILABLE");
    expect(document.body.textContent).not.toContain("PLAN DECLINED");
    // The panel shows the bare transport code — the backend's validation
    // message (captured live: "4 lanes x 14.0 ft ... use a lane width of
    // 11.0 ft or less") is nowhere in the DOM.
    expect(screen.getByText(/Audit trail failed: HTTP 502/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("lane width");

    // Retry re-fires the byte-identical request (same scenario) — doomed
    // to the same 422→502 forever.
    const retry = screen.getByRole("button", { name: /^Retry$/ });
    await act(async () => {
      fireEvent.click(retry);
    });
    expect(auditCalls.length).toBe(2);
    expect(auditCalls[1].body).toBe(auditCalls[0].body);
    await release(bdCalls, 1, okBd());
    await release(auditCalls, 1, proxied502());
    expect(screen.getByText(/Audit trail failed: HTTP 502/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Retry$/ })).toBeTruthy();
  });

  it("#182: the request timeline is 1:1 with edits — a 12-step slider drag dispatches 12 more request pairs, no debounce", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_FLAGGER} />);
    await release(bdCalls, 0, okBd());
    expect(auditCalls.length).toBe(1);

    const range = document.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    // Each drag step lands on a new 5-mph notch (React dedupes a write
    // to the same value, so consecutive steps must differ — as they do
    // in a real drag).
    for (let step = 1; step <= 12; step++) {
      await act(async () => {
        fireEvent.change(range, {
          target: { value: String(step % 2 === 0 ? 50 : 55) },
        });
      });
    }
    // One audit + one device-breakdown request per write: 1 initial + 12.
    expect(auditCalls.length).toBe(13);
    expect(bdCalls.length).toBe(13);
    // 26 requests from a two-second drag against two 30/min/IP buckets.
  });

  it("#182: a 429 renders as the outage voice — VERIFICATION UNAVAILABLE + Retry, nothing names the throttle", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_FLAGGER} />);
    await release(bdCalls, 0, okBd());
    await release(auditCalls, 0, throttled429());

    expect(document.body.textContent).toContain("VERIFICATION UNAVAILABLE");
    expect(screen.getByText(/Audit trail failed: HTTP 429/)).toBeTruthy();
    // Nothing distinguishes "you edited fast" from "the service is down".
    expect(document.body.textContent).not.toMatch(/too many|throttl|pause/i);
    // And the offered Retry burns another request from the same bucket.
    expect(screen.getByRole("button", { name: /^Retry$/ })).toBeTruthy();
  });
});
