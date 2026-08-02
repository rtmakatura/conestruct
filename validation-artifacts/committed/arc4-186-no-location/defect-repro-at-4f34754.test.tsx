// @vitest-environment happy-dom
//
// #186 — Step-2 defect reproduction (HISTORICAL — run at pre-fix HEAD
// 4f34754, PASSES ON THE DEFECT; see defect-repro-output.txt).  Fresh
// /sandbox session, no picker interaction, nothing typed: the
// verification fetches POST meta.lat 0 / meta.lng 0 (the Gulf of
// Guinea), the strip certifies VERIFIED - READY FOR TCS REVIEW, Generate
// is enabled, and a click flips to the post-generate stage.  These
// assertions INVERT under the fix — the in-tree regression suites
// (GeneratorShell.no-location.test.tsx, StatusBar.test.tsx) are the
// ongoing proof.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => <div>OUTPUT-CARDS</div> }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";

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

let postedBodies: { url: string; body: unknown }[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (init?.body && typeof init.body === "string") {
    postedBodies.push({ url, body: JSON.parse(init.body) });
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

beforeEach(() => {
  postedBodies = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("#186 reproduction — fresh session, no location ever set", () => {
  it("POSTs lat 0 / lng 0 to the verification endpoints and certifies READY", async () => {
    render(<GeneratorShell mode="sandbox" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const audit = postedBodies.find((p) => p.url.includes("/api/render/audit"));
    const bd = postedBodies.find((p) =>
      p.url.includes("/api/render/device-breakdown"),
    );
    const auditMeta = (audit?.body as { scenario?: { meta?: { lat?: number; lng?: number } } })
      ?.scenario?.meta;
    const bdMeta = (bd?.body as { scenario?: { meta?: { lat?: number; lng?: number } } })
      ?.scenario?.meta;
    console.log(
      `CAPTURE audit POST meta: lat=${auditMeta?.lat} lng=${auditMeta?.lng}`,
    );
    console.log(`CAPTURE device POST meta: lat=${bdMeta?.lat} lng=${bdMeta?.lng}`);
    expect(auditMeta).toMatchObject({ lat: 0, lng: 0 });
    expect(bdMeta).toMatchObject({ lat: 0, lng: 0 });

    // The strip's strongest claim, about nothing:
    expect(document.body.textContent).toContain("VERIFIED");
    expect(document.body.textContent).toContain("READY FOR TCS REVIEW");
    console.log("CAPTURE strip verdict: VERIFIED - READY FOR TCS REVIEW at 0/0");
  });

  it("Generate is enabled with no location and a click flips to the post-generate stage", async () => {
    render(<GeneratorShell mode="sandbox" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const btn = screen.getByRole("button", { name: /generate/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve();
    });
    // The results hero ("Total devices") is the post-generate marker —
    // OutputCards themselves are visible from first paint by design.
    expect(document.body.textContent).toContain("Total devices");
    console.log(
      "CAPTURE Generate: enabled at 0/0; click flipped to the post-generate stage (results hero rendered)",
    );
  });
});
