// @vitest-environment happy-dom
//
// #289 hand-check, 2026-09-23, DEFECT 2 — "CHANGE ONE THING opens speed
// without asking.  The user picks the field."
//
// The choice (rulings.md, "D2 — the choice, recorded"): each value on the
// setup fact line is its own link.  The five staged fields open S7 on
// THAT field; kind, location and extent open the column on WHERE; dates
// open it on WHAT.
//
// Rule 11: the claims are about which field is STAGED and which field the
// one APPLY writes, so they are read off request bodies — the preview's
// and the apply's — not off the editor's props.  The test that would
// have caught the defect is the first S7 case below: press LANES, and the
// preview and the apply must move lanes and leave speed where it was.

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
import { PINNED_FLAGGER, PINNED_SHOULDER } from "./test-fixtures";
import type { Scenario } from "@/lib/scenarios";
import auditFull from "./__fixtures__/audit-shoulder-full.json";
import { applyRevision, changeOneThing } from "./__fixtures__/band-helpers";

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
const scenarioOf = (c: Call) => c.body.scenario as Record<string, unknown>;
const openBand = () =>
  document.querySelector('[data-testid="band-stack"]')?.getAttribute("data-open-band");

async function generated(initial: Scenario = PINNED_SHOULDER) {
  const user = userEvent.setup();
  render(<GeneratorShell mode="sandbox" initialScenario={initial} />);
  await settle();
  await user.click(screen.getByRole("button", { name: /Generate plan/ }));
  await settle();
  calls = [];
  return user;
}

async function pick(editorId: string, value: string) {
  const el = document.getElementById(editorId) as HTMLSelectElement | null;
  if (!el) throw new Error(`no ${editorId} on screen`);
  await act(async () => {
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
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

describe("defect 2 — the setup line's values are the links", () => {
  it("every value is its own link, and the single CHANGE ONE THING is gone", async () => {
    await generated();
    for (const k of [
      "kind",
      "location",
      "extent",
      "speed",
      "lanes",
      "laneWidth",
      "roadType",
      "jurisdiction",
      "dates",
    ]) {
      expect(screen.getByTestId(`setup-link-${k}`), k).toBeTruthy();
    }
    expect(document.querySelector('[data-testid="fact-link-setup"]')).toBeNull();
    expect(document.body.textContent).not.toContain("CHANGE ONE THING");
    // Rule 134: the row's right track is a word, not a second link.
    expect(screen.getByTestId("setup-links-hint").textContent).toBe(
      "pick a value to change it",
    );
    // The line still reads as one sentence.
    expect(screen.getByTestId("setup-values").textContent).toContain(" · 65 mph · ");
  });

  it("each link says which field it is, not just its value", async () => {
    await generated();
    expect(screen.getByTestId("setup-link-speed").getAttribute("aria-label")).toBe(
      "Speed limit: 65 mph — change",
    );
  });

  it("a kind with no lane count has no lanes link", async () => {
    await generated(PINNED_FLAGGER);
    expect(document.querySelector('[data-testid="setup-link-lanes"]')).toBeNull();
    expect(screen.getByTestId("setup-link-speed")).toBeTruthy();
  });
});

describe("defect 2 — a staged field opens S7 on THAT field", () => {
  it("PAYLOAD: pressing LANES stages lanes — the preview and the apply move lanes, never speed", async () => {
    await generated();
    await changeOneThing("lanes");

    // The band names the field the operator picked.
    expect(document.body.textContent).toContain("REVISING · LANES PER DIRECTION");
    expect(document.getElementById("revise-lanes")).toBeTruthy();
    expect(document.getElementById("revise-speed")).toBeNull();

    await pick("revise-lanes", "3");
    // The preview asked about lanes = 3 at the speed on the plan.
    expect(breakdowns()).toHaveLength(1);
    const preview = scenarioOf(breakdowns()[0]);
    expect(preview.preview).toBe(true);
    expect(preview.lanes).toBe(3);
    expect(preview.speed).toBe(65);
    // The staged record's "was" is the LANES value, not speed's.
    expect(screen.getByTestId("prov-revise").textContent).toBe("staged · was 2 lanes");

    calls = [];
    await applyRevision();
    await settle();
    const applied = breakdowns().map(scenarioOf).filter((s) => !s.preview);
    expect(applied.length).toBeGreaterThan(0);
    expect(applied.at(-1)!.lanes).toBe(3);
    expect(applied.at(-1)!.speed).toBe(65);
  });

  it("PAYLOAD: road type, lane width and jurisdiction each stage themselves", async () => {
    const cases: Array<[string, string, string, string, unknown]> = [
      ["roadType", "REVISING · ROAD TYPE", "revise-roadType", "freeway", "freeway"],
      ["laneWidth", "REVISING · LANE WIDTH", "revise-laneWidth", "11", 11],
      [
        "jurisdiction",
        "REVISING · JURISDICTION",
        "revise-jurisdiction_key",
        "denver",
        "denver",
      ],
    ];
    for (const [key, head, editor, value, onWire] of cases) {
      cleanup();
      calls = [];
      await generated();
      await changeOneThing(key);
      expect(document.body.textContent, key).toContain(head);
      await pick(editor, value);
      const wireKey =
        key === "jurisdiction" ? "jurisdiction_key" : key;
      const preview = scenarioOf(breakdowns()[0]);
      expect(preview[wireKey], key).toBe(onWire);
      expect(preview.speed, key).toBe(65);
    }
  });

  it("pressing a second value while revising moves to that field and KEEPS the first staged", async () => {
    await generated();
    await changeOneThing("speed");
    await pick("revise-speed", "55");
    await changeOneThing("lanes");
    expect(document.body.textContent).toContain("REVISING · LANES PER DIRECTION");
    await pick("revise-lanes", "3");
    // Ruling 191: one APPLY carries both, and the sentence says so.
    expect(screen.getByTestId("revise-sentence").textContent).toContain("2 fields");

    calls = [];
    await applyRevision();
    await settle();
    const applied = breakdowns().map(scenarioOf).filter((s) => !s.preview).at(-1)!;
    expect(applied.speed).toBe(55);
    expect(applied.lanes).toBe(3);
  });
});

describe("defect 2 — kind, location, extent and dates open the band that owns them", () => {
  for (const [key, band] of [
    ["kind", "where"],
    ["location", "where"],
    ["extent", "where"],
    ["dates", "what"],
  ] as const) {
    it(`${key} → the column, ${band.toUpperCase()} open, no request`, async () => {
      await generated();
      await changeOneThing(key);
      await settle();
      expect(openBand()).toBe(band);
      // Not S7: no revision band, no staged editor.
      expect(document.body.textContent).not.toContain("REVISING ·");
      // Opening a band is navigation — it asks the backend nothing.
      expect(calls).toHaveLength(0);
    });
  }

  it("the kind link lands on the chips, the kind still pressed (already confirmed)", async () => {
    await generated();
    await changeOneThing("kind");
    expect(
      screen.getByTestId("kind-chip-shoulder").getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
