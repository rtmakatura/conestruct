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
import { DEFAULT_SHOULDER, hasLocation } from "@/lib/scenarios";
import type { ShoulderScenario } from "@/lib/scenarios";

// A real site (the standing E Colfax test spot) — the pinned counterpart
// to the fresh-load default.
const PINNED: ShoulderScenario = {
  ...DEFAULT_SHOULDER,
  meta: { ...DEFAULT_SHOULDER.meta, lat: 39.73997, lng: -104.96632 },
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
    // strip stays honest even though the Location section's own older
    // ``hasPin`` sentinel (lat OR lng) already flips it to the summary
    // view here, unmounting the manual inputs.  That pre-existing UI
    // behavior is untouched this arc; reopen the manual editor and
    // finish the entry the way a real operator would.
    expect(document.body.textContent).toContain("AWAITING LOCATION");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /edit manually/i }));
    });
    const lngInput = coords()[1];
    expect(lngInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(lngInput, { target: { value: "-104.96632" } });
    });
    await flushDebounce();
    await settle();

    const text = document.body.textContent ?? "";
    expect(text).not.toContain("AWAITING LOCATION");
    expect(text).toContain("READY FOR TCS REVIEW");
    const btn = screen.getByRole("button", {
      name: /Generate plan/,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
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
