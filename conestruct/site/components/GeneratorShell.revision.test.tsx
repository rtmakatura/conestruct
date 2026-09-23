// @vitest-environment happy-dom
//
// #289 Phase 2, S7 — revision, through the real shell.
//
// Rule 11: the claims below are about REQUESTS and WRITES, and neither
// is visible from a component test.  What this suite pins, from ruling e
// and #289's own acceptance:
//
//   · a staged edit writes NOTHING and fires exactly ONE request — the
//     preview, which carries #282's flag and hits the breakdown path
//     only (never the audit, never the scan, never a PDF);
//   · DISCARD un-stages and fires ZERO requests (#289's acceptance —
//     "Escape is DISCARD, and it must fire zero requests");
//   · APPLY is the one write and the one generate, and it carries both
//     halves of the staged set (ruling 191);
//   · the preview is never presented as the applied plan (#198's
//     family, and the reason #282's echo exists).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";
import auditFull from "./__fixtures__/audit-shoulder-full.json";
import {
  applyRevision,
  changeOneThing,
  discardRevision,
  stageRevision,
} from "./__fixtures__/band-helpers";

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

type Call = { url: string; body: Record<string, unknown> };
let calls: Call[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
  if (url.includes("/api/render/audit")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => auditFull,
    } as unknown as Response);
  }
  if (url.includes("/api/render/device-breakdown")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => BREAKDOWN,
    } as unknown as Response);
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
    await Promise.resolve();
  });
}

const breakdowns = () => calls.filter((c) => c.url.includes("device-breakdown"));
const audits = () => calls.filter((c) => c.url.includes("audit"));
const scenarioOf = (c: Call) => c.body.scenario as Record<string, unknown>;

async function generated() {
  const user = userEvent.setup();
  render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
  await settle();
  await user.click(screen.getByRole("button", { name: /Generate plan/ }));
  await settle();
  calls = [];
  return user;
}

beforeEach(() => {
  calls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = vi.fn() as never;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a preview is a read (#282, ruling e)", () => {
  it("a staged edit fires ONE request — the breakdown, with preview: true", async () => {
    await generated();
    await stageRevision("35");
    await settle();

    expect(breakdowns()).toHaveLength(1);
    expect(scenarioOf(breakdowns()[0]).preview).toBe(true);
    expect(scenarioOf(breakdowns()[0]).speed).toBe(35);
    // Never the audit, never a PDF: the backend refuses those for a
    // preview with a named 400, and asking would be the defect.
    expect(audits()).toHaveLength(0);
    expect(calls.filter((c) => c.url.includes("bundle"))).toHaveLength(0);
  });

  it("the scenario is NOT written — the plan on screen still says what it said", async () => {
    await generated();
    await stageRevision("35");
    await settle();
    // §1.1: nothing is written until APPLY.  The setup fact line is the
    // plan's, so it still reads the applied speed.
    expect(
      document.querySelector('[data-testid="fact-setup"]')?.textContent,
    ).toContain("65 mph");
  });

  it("the panel names the staged value and the computation behind it", async () => {
    await generated();
    await stageRevision("35");
    await settle();
    expect(screen.getByTestId("panel-note").textContent).toBe(
      "for 35 mph · before site conditions",
    );
    expect(screen.getByTestId("panel-status").textContent).toBe(
      "computed for 35 mph · taper, buffer, spacing and counts only",
    );
  });
});

describe("DISCARD fires zero requests (#289 acceptance)", () => {
  it("un-stages, and asks for nothing", async () => {
    await generated();
    await stageRevision("35");
    await settle();
    calls = [];

    await discardRevision();
    await settle();
    expect(calls).toHaveLength(0);
    // And the revision is gone — no panel, no staged set.
    expect(document.querySelector('[data-testid="revision-panel"]')).toBeNull();
  });

  it("re-opening after a discard starts clean — 7a, not the old answer", async () => {
    await generated();
    await stageRevision("35");
    await settle();
    await discardRevision();
    await changeOneThing();
    expect(
      document.querySelector('[data-testid="revision-panel"]')?.getAttribute(
        "data-preview",
      ),
    ).toBe("idle");
  });
});

describe("APPLY is the one write and the one generate (ruling e)", () => {
  it("writes the staged field and re-generates — with the scan, and no preview flag", async () => {
    await generated();
    await stageRevision("35");
    await settle();
    calls = [];

    await applyRevision();
    await settle();

    // The generate asks the full question again: the audit is back, and
    // the request is NOT a preview.
    expect(audits().length).toBeGreaterThan(0);
    const applied = breakdowns().at(-1)!;
    expect(scenarioOf(applied).speed).toBe(35);
    expect(scenarioOf(applied).preview).toBeFalsy();
    // And the plan on screen is the applied one now.
    expect(
      document.querySelector('[data-testid="fact-setup"]')?.textContent,
    ).toContain("35 mph");
  });

  it("the revision closes behind it — one cycle, not a state you have to leave", async () => {
    await generated();
    await stageRevision("35");
    await settle();
    await applyRevision();
    await settle();
    expect(document.querySelector('[data-testid="revision-panel"]')).toBeNull();
  });
});
