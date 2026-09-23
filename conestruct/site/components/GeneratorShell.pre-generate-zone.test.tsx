// @vitest-environment happy-dom
//
// #289 hand-check, 2026-09-23, correction 2 — PRE-GENERATE RENDERS NO
// RESULTS ZONE (Part 1 §2.1), including under INVALID INPUT.
//
// The zone-staging suite already asserts the empty zone for a bare
// pinned scenario.  It passed while the defect was live, because the
// defect needed one more fact on screen: a JURISDICTION.  `referenceMounts`
// read `Boolean(scenario.jurisdiction_key) || Boolean(jurisdictionBlock)`,
// so picking Denver before Generate mounted the reference disclosure in
// the results stack with no plan behind it — and an audit error mounted
// it at a pin.  Rule 11: the bug lives in the mounted shell with a
// jurisdiction set, so that is what this suite mounts.
//
// The strip is REAL here (most shell suites stub it): correction 2 also
// re-aims its "retry from the audit trail panel below" pointer, and a
// pointer is only honest if the thing it names exists.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER, MIN_AUDIT } from "./test-fixtures";
import type { ShoulderScenario } from "@/lib/scenarios";

// A picked jurisdiction — the one extra fact that made the disclosure
// mount with nothing to disclose.
const WITH_JURISDICTION: ShoulderScenario = {
  ...PINNED_SHOULDER,
  jurisdiction_key: "denver",
};

// #184: the lanes × lane-width mirror that the strip reports as INVALID
// INPUT and the CTA reports as its disabled reason — one derivation,
// two surfaces (rule 139).
const INVALID: ShoulderScenario = {
  ...PINNED_SHOULDER,
  jurisdiction_key: "denver",
  lanes: 4,
  laneWidth: 14,
};

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

let auditFails = false;

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) {
    return auditFails
      ? Promise.resolve({
          ok: false,
          status: 503,
          json: async () => ({}),
          text: async () => "upstream down",
        } as unknown as Response)
      : Promise.resolve({
          ok: true,
          status: 200,
          json: async () => MIN_AUDIT,
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

function resultsZone(): HTMLElement {
  const el = document.querySelector("section.zone.results");
  if (!el) throw new Error("no results zone in the document");
  return el as HTMLElement;
}

beforeEach(() => {
  auditFails = false;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = vi.fn() as never;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("no results zone before Generate (Part 1 §2.1)", () => {
  it("a picked jurisdiction does not mount the reference disclosure — and Generate brings it back", async () => {
    const user = userEvent.setup();
    render(
      <GeneratorShell mode="sandbox" initialScenario={WITH_JURISDICTION} />,
    );
    await settle();

    // The zone is MOUNTED — it is the landing and focus target (ruling
    // 192) — and it holds nothing.
    expect(resultsZone().textContent).toBe("");
    expect(document.querySelector("#reference")).toBeNull();
    expect(document.querySelector(".results-disc")).toBeNull();
    expect(document.body.textContent).not.toContain("No package yet");

    // The jurisdiction is not hidden, it is where it belongs: the WHAT
    // band's own cell, with ruling 196's provenance line under it.
    expect(document.querySelector('[data-testid="cell-jurisdiction"]')).not.toBeNull();

    // Not a deletion — a Generate mounts it.
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await settle();
    expect(document.querySelector("#reference")).not.toBeNull();
  });

  it("INVALID INPUT is a strip variant and a disabled reason, not a results zone", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={INVALID} />);
    await settle();

    // Rule 139's one derivation, on its two surfaces.
    expect(document.querySelector(".status-bar")?.textContent).toContain(
      "INVALID INPUT",
    );
    const cta = screen.getByRole("button", {
      name: /Generate plan/,
    }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);

    // And nothing else.  An invalid input is not a declined plan: no
    // placeholder, no reference disclosure, no empty-state panel.
    expect(resultsZone().textContent).toBe("");
    expect(document.body.textContent).not.toContain("No package yet");
    expect(document.querySelector("#reference")).toBeNull();
  });

  it("an audit error pre-generate points at Generate, not at a panel that is not there", async () => {
    auditFails = true;
    render(
      <GeneratorShell mode="sandbox" initialScenario={WITH_JURISDICTION} />,
    );
    await settle();

    const strip = document.querySelector(".status-bar")?.textContent ?? "";
    expect(strip).toContain("VERIFICATION UNAVAILABLE");
    expect(strip).toContain("Generate to check again");
    // Rule 10: the old pointer named a panel this state does not render.
    expect(strip).not.toContain("audit trail panel below");
    expect(resultsZone().textContent).toBe("");
  });
});
