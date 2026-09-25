// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

// #180 — one refusal, one voice (mounted-flow, the layer-11 wiring test).
// A backend gate 400 used to render verbatim on three surfaces at once
// (under-Generate red text, the INVALID INPUT banner, the audit trail
// header) while the confirm row rendered a fourth.  These tests mount the
// REAL shell + StatusBar + sidebar + FlaggerForm + AuditTrail (only leaf
// panels and the Mapbox modal are mocked) and pin the consolidation:
//   * refusal WITH a confirm affordance → the row's note is the primary
//     voice, the banner is a short pointer, and the verbatim 400 renders
//     ZERO times anywhere on screen;
//   * refusal WITHOUT an affordance → the banner renders the full 400
//     exactly once (its only voice), declined vocabulary, no re-quotes;
//   * the audit trail never quotes a refusal and offers no Retry for it;
//   * a 5xx is still an error — VERIFICATION UNAVAILABLE, unreframed.

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
// Cut the mapbox edge — the modal isn't part of this flow.
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
// #186: mounts assert a verdict / enabled Generate — start located.
import { PINNED_SHOULDER } from "./test-fixtures";
import { DEFAULT_FLAGGER } from "@/lib/scenarios";
import type { FlaggerLaneClosureScenario } from "@/lib/scenarios";
import { openWhat } from "./__fixtures__/band-helpers";

// The backend's #86 gate message, verbatim (render_api.py
// _ensure_lane_eligible) — the text that must NOT render when the
// multilane confirm row is on screen.
const MULTILANE_400 =
  "This road appears to carry more lanes than a flagger operation covers " +
  "— TA-10 applies where one through lane runs in each direction. If " +
  "detection is wrong, confirm 'Road has one through lane in each " +
  "direction' in the form and regenerate.";

// The backend's geometry floor message (validators.py phrasing) — a
// refusal with NO confirm affordance.
const FLOOR_400 =
  "Work zone length (50 ft) is shorter than the required shoulder taper " +
  "(L/3) of 184 ft at 55 mph. Increase the work zone to at least 184 ft, " +
  "or reduce the speed limit.";

// #289 Phase 2: the recovery confirms live in the WHAT band's kind row,
// and the column opens WHAT once there is a pin.  The fixture takes a pin
// for that reason alone — the refusal it exercises (a multi-lane road on
// a flagger plan) and its 400 are unchanged.
const FLAGGER_MULTILANE: FlaggerLaneClosureScenario = {
  ...DEFAULT_FLAGGER,
  detectedLanesTotal: 4,
  meta: { ...DEFAULT_FLAGGER.meta, lat: 39.71466, lng: -104.94071, work: { side: "right", heading: "N" } /* #290: the side a located plan now carries */ },
};

type Deferred = {
  resolve: (r: Response) => void;
  reject: (e: Error) => void;
};

let auditCalls: Deferred[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) {
    return new Promise<Response>((resolve, reject) => {
      auditCalls.push({ resolve, reject });
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

function refusal400(message: string): Response {
  return {
    ok: false,
    status: 400,
    json: async () => ({ detail: message }),
  } as unknown as Response;
}

function server500(): Response {
  return {
    ok: false,
    status: 500,
    json: async () => ({ detail: "render failed: boom" }),
  } as unknown as Response;
}

async function releaseAudit(index: number, response: Response) {
  await act(async () => {
    auditCalls[index].resolve(response);
    await Promise.resolve();
    await Promise.resolve();
  });
}

function strip(): string {
  const el = document.querySelector(".status-bar");
  if (!el) throw new Error("status strip not rendered");
  return el.textContent ?? "";
}

function occurrences(needle: string): number {
  return (document.body.textContent ?? "").split(needle).length - 1;
}

beforeEach(() => {
  auditCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("one refusal, one voice (#180)", () => {
  it("with-affordance refusal: row note primary, short pointer, verbatim 400 renders zero times", async () => {
    render(
      <GeneratorShell mode="sandbox" initialScenario={FLAGGER_MULTILANE} />,
    );
    await releaseAudit(0, refusal400(MULTILANE_400));

    // #289 Phase 2: the flagger's four recovery confirms stayed in the
    // form (they are gates' affordances, not grid cells), and the form is
    // the WHAT band's kind row — one click away, exactly as for a user.
    await openWhat();

    // The affordance row's own note — the primary voice at the point of
    // action (FlaggerForm #86 row).
    expect(
      occurrences(
        "Detection saw a multi-lane road — confirm to enable this plan",
      ),
    ).toBeGreaterThan(0);

    // The banner shortens to a pointer with declined vocabulary.
    expect(strip()).toContain("PLAN DECLINED");
    expect(strip()).toContain(
      "Detection saw a multi-lane road — confirm the lane count in the Road section to proceed.",
    );
    expect(strip()).toContain("NEEDS REVIEW");
    expect(strip()).not.toContain("INVALID INPUT");

    // One voice: the verbatim 400 renders NOWHERE on screen.
    expect(occurrences("more lanes than a flagger operation covers")).toBe(0);

    // Under-Generate: a short pointer, not a re-quote.
    expect(
      screen
        .getAllByRole("alert")
        .some((el) =>
          (el.textContent ?? "").includes(
            "Generation declined — see the notice below.",
          ),
        ),
    ).toBe(true);

    // #289 hand-check, 2026-09-23, correction 2: the audit trail panel
    // is a RESULTS-zone panel, and Part 1 §2.1 gives the page no results
    // zone before Generate — so pre-generate it does not render at all,
    // and its declined line renders zero times rather than once.  The
    // #180 claim is untouched and in fact strengthened: with one fewer
    // surface on screen, the refusal still has exactly one voice.  The
    // panel's own declined line is covered where the panel lives, in
    // AuditTrail.declined-stale.test.tsx.
    expect(
      occurrences(
        "Audit trail unavailable while generation is declined — see the notice above.",
      ),
    ).toBe(0);
    expect(document.querySelector("section.zone.results")?.textContent).toBe("");
    expect(occurrences("Audit trail failed")).toBe(0);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("without-affordance refusal: the full 400 renders exactly once, declined vocabulary", async () => {
    // DEFAULT shoulder scenario — the geometry floor has no confirm row.
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await releaseAudit(0, refusal400(FLOOR_400));

    expect(strip()).toContain("PLAN DECLINED");
    expect(strip()).toContain("NEEDS INPUT");
    expect(strip()).not.toContain("INVALID INPUT");

    // Exactly once: the banner is the only verbatim render — the audit
    // trail's declined line and the under-Generate pointer don't quote.
    expect(occurrences(FLOOR_400)).toBe(1);
    expect(occurrences("Audit trail failed")).toBe(0);
    // #289 hand-check, 2026-09-23, correction 2: the audit trail panel
    // is a RESULTS-zone panel, and Part 1 §2.1 gives the page no results
    // zone before Generate — so pre-generate it does not render at all,
    // and its declined line renders zero times rather than once.  The
    // #180 claim is untouched and in fact strengthened: with one fewer
    // surface on screen, the refusal still has exactly one voice.  The
    // panel's own declined line is covered where the panel lives, in
    // AuditTrail.declined-stale.test.tsx.
    expect(
      occurrences(
        "Audit trail unavailable while generation is declined — see the notice above.",
      ),
    ).toBe(0);
    expect(document.querySelector("section.zone.results")?.textContent).toBe("");
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("a 500 is broken, not declined — unreframed, with the audit trail's Retry intact", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await releaseAudit(0, server500());

    expect(strip()).toContain("VERIFICATION UNAVAILABLE");
    expect(strip()).not.toContain("PLAN DECLINED");
    // Correction 2: pre-generate the panel that carries "Audit trail
    // failed" and its Retry is not on the page, so the strip's pointer
    // names the control that IS — Generate, which refires both fetches
    // (rule 10: a pointer must land on something that exists).
    expect(occurrences("Audit trail failed")).toBe(0);
    expect(strip()).toContain("Generate to check again");
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});
