// @vitest-environment happy-dom
//
// #186 — no location, no certification (mounted).
//
// A fresh session has never chosen a site: meta.lat/lng sit at the 0/0
// unset sentinel.  The strip renders AWAITING LOCATION — no verdict, no
// green READY — and Generate is disabled with a stated reason.  Setting a
// location (here through the manual-entry fallback, the same setMeta
// writer the picker uses) flips both surfaces; everything downstream is
// unchanged.  Precedence: a genuine problem with what the user actually
// edited (INVALID INPUT / PLAN DECLINED) outranks the missing pin.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => <div>OUTPUT-CARDS</div> }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

// #221: the button queries name the CTA exactly ("Generate plan") --
// the progress rail's trailing "Generate" jump entry is a second
// /generate/i button on every mount now.
import { GeneratorShell } from "./GeneratorShell";
import { answerSide, confirmKind } from "./__fixtures__/band-helpers";
import { TEST_SIDE, corridorGeometryResponse } from "./test-fixtures";
import { DEFAULT_SHOULDER, hasLocation } from "@/lib/scenarios";
import type { ShoulderScenario } from "@/lib/scenarios";

// A real site (the standing E Colfax test spot) — the pinned counterpart
// to the fresh-load default.  #290: with its side answered (ruling 10 —
// a located plan's checks wait on the side).
const PINNED: ShoulderScenario = {
  ...DEFAULT_SHOULDER,
  meta: { ...DEFAULT_SHOULDER.meta, lat: 39.73997, lng: -104.96632, work: { ...TEST_SIDE } },
};

const CLEAN_AUDIT = {
  summary: {
    ta: "TA-3",
    cdot_sheet: "S-630-1",
    case_id: "Case 11",
    taper_length_ft: 183,
    taper_label: "L/3 (shoulder taper)",
    buffer_space_ft: 495,
    device_spacing_taper_ft: 55,
    device_spacing_tangent_ft: 110,
    step_count: 8,
  },
  sections: {
    taper: {},
    buffer: {},
    spacing: {},
    advance: {},
    colorado: {},
    case: {},
    flagger: {},
    corridor_validation: { checked: false, warnings: [] },
    geometry_validation: { violations: [], all_pass: true },
  },
  pending_verification: { count: 0, note: "", tracking_issue: null },
  plan_flags: {
    validation_warnings: 0,
    compliance_fails: 0,
    v1_limitations: 0,
    is_clean: true,
  },
};

const OK_BD = {
  devices: [],
  total_devices: 12,
  unique_types: 4,
  zone_geometry: {
    taper_l_ft: 100,
    buffer_b_ft: 200,
    device_spacing_ft: 40,
    work_len_ft: 500,
  },
};

let renderPosts: string[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (init?.method === "POST" && url.includes("/api/render/")) {
    renderPosts.push(url);
  }
  if (url.includes("/api/render/audit")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => CLEAN_AUDIT,
    } as unknown as Response);
  }
  if (url.includes("/api/render/device-breakdown")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => OK_BD,
    } as unknown as Response);
  }
  // #290: the WHERE band's geometry read — the side control's choices.
  if (url.includes("/api/render/corridor-geometry")) {
    return Promise.resolve(corridorGeometryResponse());
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

// #182: scenario edits reach the wire through the 350 ms fetch debounce —
// wait it out (real timers) before asserting a settled verdict.
async function flushDebounce() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 360));
  });
}

beforeEach(() => {
  renderPosts = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("hasLocation (#186)", () => {
  it("0/0 is unset; a partial coordinate is not a location; both nonzero is", () => {
    expect(hasLocation(DEFAULT_SHOULDER.meta)).toBe(false);
    expect(hasLocation({ ...DEFAULT_SHOULDER.meta, lat: 39.7 })).toBe(false);
    expect(hasLocation({ ...DEFAULT_SHOULDER.meta, lng: -104.9 })).toBe(false);
    expect(hasLocation(PINNED.meta)).toBe(true);
  });
});

describe("no location, no certification (#186)", () => {
  it("fresh load: AWAITING LOCATION, no verdict, Generate disabled with the stated reason", async () => {
    render(<GeneratorShell mode="sandbox" />);
    await settle();

    const text = document.body.textContent ?? "";
    expect(text).toContain("AWAITING LOCATION");
    // #260 (P2): the strip's line is the state alone; the instruction
    // below is the CTA reason's (one speaker).  #289 hand-check,
    // 2026-09-22: rule 18's ◌ leads it, as TEXT (rule 17) and
    // aria-hidden, so the SENTENCE and what the region speaks are both
    // unchanged.
    expect(document.querySelector(".status-bar")?.textContent).toBe(
      "◌" + "AWAITING LOCATION · no site chosen",
    );
    expect(text).not.toContain("READY FOR TCS REVIEW");
    expect(text).not.toContain("VERIFIED");
    // Not an error voice: the user did nothing wrong.
    expect(text).not.toContain("INVALID INPUT");
    expect(text).not.toContain("PLAN DECLINED");

    const btn = screen.getByRole("button", {
      name: /Generate plan/,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(text).toContain(
      "Set a location first — pick on map or enter manually.",
    );

    // A click on the gated CTA must not flip the stage: no results hero
    // (its "Total devices" cell is the post-generate marker — OutputCards
    // themselves are visible from first paint by design) and no further
    // render POST (the verification fetches already fired; the count
    // must not grow).
    const postsBefore = renderPosts.length;
    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve();
    });
    expect(document.body.textContent).not.toContain("Total devices");
    expect(renderPosts.length).toBe(postsBefore);
  });

  it("a pinned scenario shows the verdict and an enabled Generate — post-pin behavior unchanged", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED} />);
    await settle();

    const text = document.body.textContent ?? "";
    expect(text).not.toContain("AWAITING LOCATION");
    expect(text).toContain("READY FOR TCS REVIEW");
    const btn = screen.getByRole("button", {
      name: /Generate plan/,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("typing coordinates in the manual fallback enables both surfaces", async () => {
    render(<GeneratorShell mode="sandbox" />);
    await settle();
    expect(document.body.textContent).toContain("AWAITING LOCATION");

    // No Mapbox token in the test env → the manual fallback is already
    // open.  The two step="0.000001" number inputs are lat, then lng.
    const coords = () =>
      Array.from(
        document.querySelectorAll('input[type="number"][step="0.000001"]'),
      ) as HTMLInputElement[];
    expect(coords().length).toBe(2);
    await act(async () => {
      fireEvent.change(coords()[0], { target: { value: "39.73997" } });
    });
    // Lat alone is not a location yet (hasLocation needs both) — the
    // strip stays honest.
    //
    // #289 Phase 2: the old Location section's `hasPin` sentinel (lat OR
    // lng) flipped to a summary view here and unmounted the manual
    // inputs, so this case used to have to reopen the editor.  The WHERE
    // band has no such flip — the manual fallback is a disclosure the
    // operator opened and nothing closes it under them — so the inputs
    // are still there.  One fewer surprise, and one fewer click.
    expect(document.body.textContent).toContain("AWAITING LOCATION");
    const lngInput = coords()[1];
    expect(lngInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(lngInput, { target: { value: "-104.96632" } });
    });
    await flushDebounce();
    await settle();

    const text = document.body.textContent ?? "";
    expect(text).not.toContain("AWAITING LOCATION");
    // #289 finding 1 (Rule 10): with the pin down and no kind confirmed,
    // the strip names the state — no verdict.  This line used to read
    // READY FOR TCS REVIEW here: a verdict for the placeholder kind nobody
    // picked, which is the finding.  The instruction is the disabled
    // primary's alone (#260 P2), asserted just below.
    expect(text).not.toContain("READY FOR TCS REVIEW");
    const strip = screen.getByTestId("strip-kind-unconfirmed");
    expect(strip.textContent).toBe("◌AWAITING KIND OF WORK");
    expect(strip.textContent).not.toContain("choose");
    const btn = () =>
      screen.getByRole("button", { name: /Generate plan/ }) as HTMLButtonElement;
    // #289 hand-check, 2026-09-23, defect 1: a pin is no longer enough.
    // The kind is owed first — and on THIS path (no token, no picker
    // save, `confirmedRoad` undefined) the chips must still render, or
    // the operator could never answer it (ruled 2026-09-23).
    expect(btn().disabled).toBe(true);
    expect(
      document.querySelector('[data-testid="cta-reason"]')?.textContent,
    ).toContain("Choose the kind of work");
    await act(async () => {
      fireEvent.click(screen.getByTestId("kind-chip-shoulder"));
    });
    await confirmKind();
    await flushDebounce();
    await settle();
    // #290 (RULE 5, stated): the kind is not the last thing owed any more.
    // Ruling 10 — a located plan's side is needs-you, and nothing is
    // checked until it is answered.  With no road confirmed (this path),
    // the side control offers the four headings (open-points ruling 1).
    expect(btn().disabled).toBe(true);
    expect(screen.getByTestId("strip-side-unconfirmed").textContent).toBe(
      "◌AWAITING OCCUPIED SIDE",
    );
    expect(document.body.textContent).not.toContain("READY FOR TCS REVIEW");
    await answerSide();
    await flushDebounce();
    await settle();
    expect(btn().disabled).toBe(false);
    // Confirmed: the checks fire, and the verdict the strip used to show
    // too early is now the answer for a kind (and a side) a person chose.
    expect(document.body.textContent).toContain("READY FOR TCS REVIEW");
  });

  it("a genuine input error outranks the missing pin (INVALID INPUT wins)", async () => {
    const invalidUnpinned: ShoulderScenario = {
      ...DEFAULT_SHOULDER,
      lanes: 4,
      laneWidth: 14,
    };
    render(
      <GeneratorShell mode="sandbox" initialScenario={invalidUnpinned} />,
    );
    await settle();

    const text = document.body.textContent ?? "";
    expect(text).toContain("INVALID INPUT");
    expect(text).not.toContain("AWAITING LOCATION");
  });
});
