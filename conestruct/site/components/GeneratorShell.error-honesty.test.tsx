// @vitest-environment happy-dom
//
// #184 — error honesty at the strip, mounted.
//
// A mirrored schema violation (the drawable-half-road check the client
// can see) renders as INVALID INPUT — the strip agreeing with the form's
// inline error instead of contradicting it with VERIFICATION UNAVAILABLE.
//
// A NON-mirrored schema rejection reaches the client as the proxy's
// translated 400 (validationPassthrough, this arc) and takes the #180
// no-affordance PLAN DECLINED shape: the validator's message rendered
// exactly once, no Retry offered anywhere.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
// #186: the 429/refusal mounts assert strip voices past the pin.
import { PINNED_SHOULDER } from "./test-fixtures";
import type { ShoulderScenario } from "@/lib/scenarios";
import { openWhat } from "./__fixtures__/band-helpers";

// The issue's reproduction: each chip value valid alone, the combination
// beyond the drawable half-road.
// #289 Phase 2: the lane-width cell lives in the WHAT band, and the WHAT
// band is the open one once there is a pin.  The fixture takes
// PINNED_SHOULDER's coordinates for that reason and for no other — the
// invalid combination it exists to exercise (4 lanes x 14 ft) is
// unchanged, and so is the strip's verdict for it.
const FOUR_BY_FOURTEEN: ShoulderScenario = {
  ...DEFAULT_SHOULDER,
  lanes: 4,
  laneWidth: 14,
  meta: { ...DEFAULT_SHOULDER.meta, lat: 39.71466, lng: -104.94071, work: { side: "right", heading: "N" } /* #290: the side a located plan now carries */ },
};

// What a non-mirrored 422 (workZoneSpeed > posted speed) looks like after
// the proxy's translation — the {"detail": string} shape of a backend 400.
const TRANSLATED_422_MSG =
  "workZoneSpeed (55) must be <= posted speed (45).";

type Deferred = { resolve: (r: Response) => void };
let auditCalls: Deferred[] = [];
let bdCalls: Deferred[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) {
    return new Promise<Response>((resolve) => auditCalls.push({ resolve }));
  }
  if (url.includes("/api/render/device-breakdown")) {
    return new Promise<Response>((resolve) => bdCalls.push({ resolve }));
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
    json: async () => ({
      devices: [],
      total_devices: 12,
      unique_types: 4,
      zone_geometry: {
        taper_l_ft: 100,
        buffer_b_ft: 200,
        device_spacing_ft: 40,
        work_len_ft: 500,
      },
    }),
  }) as unknown as Response;

const translated400 = (msg: string) =>
  ({
    ok: false,
    status: 400,
    json: async () => ({ detail: msg }),
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

describe("strip error honesty (#184)", () => {
  it("a mirrored invalid combination renders INVALID INPUT, agreeing with the form — never UNAVAILABLE", async () => {
    render(
      <GeneratorShell mode="sandbox" initialScenario={FOUR_BY_FOURTEEN} />,
    );
    await release(bdCalls, 0, okBd());
    // Whatever the wire says (here: the proxy's translated 400), the
    // client already knows this input is invalid.
    await release(
      auditCalls,
      0,
      translated400(
        "4 lanes x 14.0 ft + 8 ft shoulder = 64.0 ft exceeds the plan sheet's drawable half-road (52 ft) — use a lane width of 11.0 ft or less, or reduce the lane count.",
      ),
    );

    expect(document.body.textContent).toContain("INVALID INPUT");
    // The strip and the form speak with one voice (validateLanes text).
    expect(
      screen.getAllByText(/wider than the plan sheet can draw/).length,
    ).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain(
      "VERIFICATION UNAVAILABLE",
    );
    expect(document.body.textContent).not.toContain("PLAN DECLINED");
    // No Retry for an input problem.
    expect(screen.queryByRole("button", { name: /^Retry$/ })).toBeNull();
  });

  it("a non-mirrored translated 422 takes the PLAN DECLINED no-affordance shape: message once, no Retry", async () => {
    render(
      <GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />,
    );
    await release(bdCalls, 0, okBd());
    await release(auditCalls, 0, translated400(TRANSLATED_422_MSG));

    expect(document.body.textContent).toContain("PLAN DECLINED");
    // The validator's sentence renders exactly once on the whole screen.
    expect(screen.getAllByText(new RegExp("must be <= posted speed"))).toHaveLength(1);
    expect(document.body.textContent).not.toContain(
      "VERIFICATION UNAVAILABLE",
    );
    expect(document.body.textContent).not.toContain("INVALID INPUT");
    // #289 hand-check, 2026-09-23, correction 2: the audit trail panel is
    // a RESULTS-zone panel and Part 1 §2.1 gives the page no results zone
    // before Generate, so pre-generate its line is not on screen and its
    // Retry is not either.  The panel's own declined / paused lines are
    // covered where the panel lives (AuditTrail.declined-stale.test.tsx);
    // what this suite is about — the STRIP's vocabulary — is unchanged.
    expect(
      screen.queryByText(/unavailable while generation is declined/),
    ).toBeNull();
    expect(document.querySelector("section.zone.results")?.textContent).toBe("");
    expect(screen.queryByRole("button", { name: /^Retry$/ })).toBeNull();
  });

  it("a 429 names the throttle — VERIFICATION PAUSED with a working Retry, never the outage voice (#182)", async () => {
    render(
      <GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />,
    );
    await release(bdCalls, 0, okBd());
    await release(auditCalls, 0, {
      ok: false,
      status: 429,
      json: async () => {
        throw new Error("not json");
      },
      text: async () => {
        throw new Error("body consumed");
      },
    } as unknown as Response);

    expect(document.body.textContent).toContain("VERIFICATION PAUSED");
    expect(document.body.textContent).toContain(
      "too many updates in the last minute",
    );
    expect(document.body.textContent).not.toContain(
      "VERIFICATION UNAVAILABLE",
    );
    // Correction 2: pre-generate the panel is not on screen, so the
    // strip carries the whole message — including where the retry is.
    // Retrying still genuinely helps once the minute rolls, and
    // pre-generate the control that retries is Generate.
    expect(screen.queryByText(/Audit trail paused/)).toBeNull();
    expect(document.body.textContent).toContain(
      "Generate in a moment to check again",
    );
    expect(screen.queryByRole("button", { name: /^Retry$/ })).toBeNull();
  });

  it("clearing the invalid combination returns the strip to the verifying path", async () => {
    render(
      <GeneratorShell mode="sandbox" initialScenario={FOUR_BY_FOURTEEN} />,
    );
    await release(bdCalls, 0, okBd());
    expect(document.body.textContent).toContain("INVALID INPUT");

    // Drop lane width back into the drawable domain (10.5 ft fits 4 lanes
    // on the divided default).
    //
    // #289 Phase 2: lane width is the WHAT grid's cell — a select at
    // rule 136's 44 px, not a range slider.  The domain is the same one
    // the slider enforced (lib/scenarios/what-cells.ts, traced to the
    // form it came from).
    await openWhat();
    const width = document.querySelector("#what-lane-width") as HTMLSelectElement;
    expect(width).toBeTruthy();
    await act(async () => {
      fireEvent.change(width, { target: { value: "10.5" } });
    });
    expect(document.body.textContent).not.toContain("INVALID INPUT");
  });
});
