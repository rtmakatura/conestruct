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
    expect(screen.getByTestId("panel-status-line").textContent).toBe(
      "computed for 35 mph · taper, buffer, spacing and counts only",
    );
  });
});

// #289 fidelity follow-up — rule 95.4 7d and rule 94, mounted.
describe("7d's RETRY PREVIEW re-asks the same read; APPLY names the write", () => {
  it("PAYLOAD: a failed preview offers RETRY PREVIEW, and it fires one breakdown with preview: true for the staged value", async () => {
    await generated();
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({ ok: false, status: 503, json: async () => ({}) } as unknown as Response),
    );
    await stageRevision("35");
    await settle();
    expect(screen.getByTestId("revision-panel").getAttribute("data-preview")).toBe("error");
    calls = [];

    await act(async () => {
      screen.getByTestId("panel-retry").click();
    });
    await settle();
    expect(breakdowns()).toHaveLength(1);
    expect(scenarioOf(breakdowns()[0]).preview).toBe(true);
    expect(scenarioOf(breakdowns()[0]).speed).toBe(35);
    expect(audits()).toHaveLength(0);
    // Answered: 7c, and the retry control is gone with 7d.
    expect(screen.getByTestId("revision-panel").getAttribute("data-preview")).toBe("ready");
    expect(screen.queryByTestId("panel-retry")).toBeNull();
  });

  it("rule 94: the write is labelled APPLY — RE-GENERATE", async () => {
    await generated();
    await stageRevision("35");
    await settle();
    expect(screen.getByTestId("revise-apply").textContent?.trim()).toBe("APPLY — RE-GENERATE");
  });
});

// #289 acceptance: "Escape cancels with zero requests" (Part 1 §5.6).
describe("Escape cancels S7 with zero requests (#289 acceptance)", () => {
  it("PAYLOAD: Escape un-stages, closes S7 and asks for nothing — the plan keeps its value", async () => {
    const user = await generated();
    await stageRevision("35");
    await settle();
    expect(screen.getByTestId("revision-panel")).toBeTruthy();
    calls = [];

    await user.keyboard("{Escape}");
    await settle();
    expect(calls).toHaveLength(0);
    expect(document.querySelector('[data-testid="revision-panel"]')).toBeNull();
    // Nothing was written: the setup line still reads the plan's speed.
    expect(document.querySelector('[data-testid="fact-setup"]')?.textContent).toContain("65 mph");
  });

  it("Escape on the S7 <select> only leaves it — the staged edit survives; the next Escape discards", async () => {
    const user = await generated();
    await stageRevision("35");
    await settle();
    const editor = document.getElementById("revise-speed") as HTMLSelectElement;
    editor.focus();
    expect(document.activeElement).toBe(editor);
    calls = [];

    // An Escape aimed at the select (its option list) must not cost the edit.
    await user.keyboard("{Escape}");
    await settle();
    expect(screen.getByTestId("revision-panel")).toBeTruthy();
    expect(editor.value).toBe("35");
    expect(document.activeElement).not.toBe(editor);

    // The next Escape is the discard — still zero requests.
    await user.keyboard("{Escape}");
    await settle();
    expect(document.querySelector('[data-testid="revision-panel"]')).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("Escape with nothing staged still closes S7, with zero requests", async () => {
    const user = await generated();
    await changeOneThing("speed");
    await settle();
    expect(screen.getByTestId("revision-panel")).toBeTruthy();
    calls = [];
    await user.keyboard("{Escape}");
    await settle();
    expect(calls).toHaveLength(0);
    expect(document.querySelector('[data-testid="revision-panel"]')).toBeNull();
  });

  it("outside S7 Escape does nothing to the plan and asks for nothing", async () => {
    const user = await generated();
    calls = [];
    await user.keyboard("{Escape}");
    await settle();
    expect(calls).toHaveLength(0);
    expect(document.querySelector('[data-testid="fact-setup"]')).not.toBeNull();
  });
});

// #289 acceptance: "A preview writes nothing — no band, no lock, no memo —
// asserted at payload level."  #281's ruling, as preview.ts quotes it: "A
// preview is a read.  No band, no lock, never memoised, never written."
// The one-request / not-written half is above; this is the rest, at the
// surface and on the wire.
describe("a preview writes nothing — no band, no lock, no memo (#289 acceptance)", () => {
  it("in flight AND landed: no working band, no lock, the editor and every write control live", async () => {
    await generated();
    // Hold the preview open so the in-flight state is observable.
    let release: (r: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((r) => {
        release = r;
      }),
    );
    await stageRevision("35");
    await act(async () => {
      await Promise.resolve();
    });
    const assertNothingWritten = () => {
      // No band: the working band is apply's, never a preview's (rule 95.1).
      expect(document.querySelector(".working-band")).toBeNull();
      // No lock: the root never takes the write lock for a read.
      expect(document.querySelector(".workbench")!.classList.contains("ws-locked")).toBe(false);
      // The field stays editable while its preview is in flight.
      expect((document.getElementById("revise-speed") as HTMLSelectElement).disabled).toBe(false);
      const writers = Array.from(document.querySelectorAll<HTMLElement>("[data-write]"));
      expect(writers.length).toBeGreaterThan(0);
      for (const w of writers) {
        expect((w as HTMLButtonElement).disabled ?? false, w.outerHTML.slice(0, 80)).toBe(false);
        expect(w.getAttribute("aria-disabled")).not.toBe("true");
      }
    };
    expect(screen.getByTestId("revision-panel").getAttribute("data-preview")).toBe("loading");
    assertNothingWritten();

    await act(async () => {
      release({ ok: true, status: 200, json: async () => BREAKDOWN } as unknown as Response);
    });
    await settle();
    expect(screen.getByTestId("revision-panel").getAttribute("data-preview")).toBe("ready");
    assertNothingWritten();
  });

  it("PAYLOAD, no memo: the preview's answer never becomes the plan's — the results keep the settled count, and APPLY asks afresh", async () => {
    await generated();
    const settledTotal = document.querySelector(".hero .hero-cell .num")?.textContent;
    expect(settledTotal).toBe(String(BREAKDOWN.total_devices));

    // The preview answers with a different plan.  (A once-mock replaces
    // the recorder too, so it records the call itself.)
    fetchMock.mockImplementationOnce((input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ...BREAKDOWN, total_devices: BREAKDOWN.total_devices + 7 }),
      } as unknown as Response);
    });
    await stageRevision("35");
    await settle();
    // On the wire: the read is flagged, so the backend skips the scan and
    // its memo (src/api/schemas.py, the #282 preview mixin).
    expect(scenarioOf(breakdowns()[0]).preview).toBe(true);
    // On screen: the panel shows the preview; the results do not.
    expect(screen.getByTestId("panel-row-devices").textContent).toContain(
      String(BREAKDOWN.total_devices + 7),
    );
    expect(document.querySelector(".hero .hero-cell .num")?.textContent).toBe(settledTotal);

    // APPLY does not reuse the preview's answer: a fresh, unflagged request.
    calls = [];
    await applyRevision();
    await settle();
    const applied = breakdowns().map(scenarioOf);
    expect(applied.length).toBeGreaterThan(0);
    expect(applied.every((s) => s.preview !== true)).toBe(true);
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
