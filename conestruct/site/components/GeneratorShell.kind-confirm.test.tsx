// @vitest-environment happy-dom
//
// #289 hand-check, 2026-09-23, DEFECT 1 — "the kind is confirmed, never
// inferred" (FLOW.md §5a, #281 §4.4, P21).
//
// Ryan: "Shoulder work arrives pre-selected and the confirm only appears
// under CHANGE ... Test it at payload level: no scenario kind is set
// without a click."
//
// Rule 11: the claim is about what reaches the WIRE, so this suite reads
// request bodies, not component props.  `scenario.kind` is a discriminant
// and always holds a value — DEFAULT_SCENARIO's `shoulder` included — so
// "no kind is set without a click" is asserted where it can be true:
//
//   · with no chip clicked, nothing the operator can press produces a
//     GENERATE-path request (the Generate primary is disabled, and
//     pressing it fires nothing);
//   · the generated payload's kind is the one the operator CLICKED, and a
//     generate exists only after the chip AND the WHERE primary;
//   · the chips arrive with NONE pressed, and re-picking the default's
//     own chip is the choice (the record moves; the value does not).
//
// Fresh sandbox session throughout — no `initialScenario`, which is the
// production /sandbox path (app/sandbox/page.tsx) — except the last case,
// which pins the one path that legitimately starts confirmed.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  RoadCandidate,
  RoadClassification,
} from "@/lib/road-detection/types";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./OutputCards", () => ({
  OutputCards: ({ onDownloadAll }: { onDownloadAll?: () => void }) => (
    <button type="button" onClick={onDownloadAll}>
      ALL_ZIP
    </button>
  ),
}));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));

// A two-lane-each-way urban arterial.  Consistent relays (2 + 2, no
// both-ways lane), so no gate relay arms and nothing but the kind can
// block Generate — the suite's subject is the kind and only the kind.
const ROAD: RoadClassification = {
  roadType: "urban_arterial",
  divided: false,
  laneWidthFt: 12,
  speedLimitMph: 35,
  lanesPerDirection: 1,
  detectedLanesTotal: 2,
  detectedLanesForward: 1,
  detectedLanesBackward: 1,
  confidence: "high",
  source: "osm-tags",
  raw: {
    class: "secondary",
    oneway: false,
    roadName: "East 17th Avenue",
    placeName: "Denver",
    osmLanesTag: "2",
    osmMaxspeedTag: "30 mph",
  },
  fields: {
    speed: { value: 35, confidence: "high", source: "OSM maxspeed tag", method: "measured" },
    lanes: { value: 1, confidence: "high", source: "OSM lanes tag", method: "measured" },
    roadType: { value: "urban_arterial", confidence: "high", source: "class", method: "measured" },
    divided: { value: false, confidence: "high", source: "oneway", method: "measured" },
  },
} as RoadClassification;

const CANDIDATE: RoadCandidate = {
  way_id: "778899",
  highway_class: "secondary",
  name: "East 17th Avenue",
  ref: null,
  bearing: 90,
  snap_distance_m: 3.2,
  snapped_lat: 39.7436,
  snapped_lng: -104.9707,
  tags: {
    oneway: null,
    maxspeed: "30 mph",
    lanes: "2",
    lanes_forward: null,
    lanes_backward: null,
    lanes_both_ways: null,
    turn_lanes: null,
    turn_lanes_forward: null,
    turn_lanes_backward: null,
  },
  signal_distance_m: null,
} as RoadCandidate;

const PICKER_RESULT = {
  address: "E 17th Ave & Clarkson St, Denver",
  lat: 39.7436,
  lng: -104.9707,
  bearingDeg: 90,
  workZoneFt: 500,
  classification: ROAD,
  overrides: {},
  crossStreet: null,
  confirmedRoad: {
    candidate: CANDIDATE,
    classification: ROAD,
    method: "auto_single" as const,
    overrides: {},
    isUrban: true,
    placeName: "Denver",
    pinLat: 39.7436,
    pinLng: -104.9707,
  },
};

vi.mock("./LocationPickerModal", () => ({
  LocationPickerModal: ({ onSave }: { onSave: (r: unknown) => void }) => (
    <button type="button" onClick={() => onSave(PICKER_RESULT)}>
      SAVE_ROAD
    </button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { MIN_AUDIT, PINNED_SHOULDER, corridorGeometryResponse } from "./test-fixtures";
import { answerSide, confirmKind } from "./__fixtures__/band-helpers";

type Call = { url: string; body: Record<string, unknown> };
let calls: Call[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(String(init?.body ?? "{}"));
  } catch {
    body = {};
  }
  calls.push({ url, body });
  if (url.includes("/api/render/bundle")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      blob: async () => new Blob(["zip"]),
    } as unknown as Response);
  }
  if (url.includes("/api/render/audit")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => MIN_AUDIT,
    } as unknown as Response);
  }
  // #290: the WHERE band's geometry read (the side control's choices).
  if (url.includes("/api/render/corridor-geometry")) {
    return Promise.resolve(corridorGeometryResponse());
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

beforeEach(() => {
  calls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = vi.fn() as never;
  Object.defineProperty(URL, "createObjectURL", {
    value: () => "blob:mock",
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: () => {},
    configurable: true,
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
    await Promise.resolve();
  });
}

/** A fresh /sandbox session with a road confirmed through the picker —
 *  the state Ryan's hand-check starts from.  #290: and, by default, the
 *  occupied side answered, so the cases below speak about the KIND alone;
 *  the side's own gating is pinned in its own cases (`side: false`). */
async function freshWithRoad({ side = true }: { side?: boolean } = {}) {
  const user = userEvent.setup();
  render(<GeneratorShell mode="sandbox" />);
  await settle();
  await user.click(screen.getByTestId("where-open-picker"));
  await user.click(screen.getByText("SAVE_ROAD"));
  await settle();
  if (side) {
    await answerSide();
    await settle();
  }
  return user;
}

const chip = (k: string) => screen.getByTestId(`kind-chip-${k}`);
const pressed = () =>
  Array.from(document.querySelectorAll('.a-chips [aria-pressed="true"]')).map(
    (el) => el.getAttribute("data-testid"),
  );
const generateBtn = () =>
  screen.getByRole("button", { name: /Generate plan/ }) as HTMLButtonElement;
const openBand = () =>
  document.querySelector('[data-testid="band-stack"]')?.getAttribute("data-open-band");
const bundles = () => calls.filter((c) => c.url.includes("/api/render/bundle"));
/** Every request that carries the scenario's kind to the backend before
 *  a generate: the audit, the breakdown, and the picker's corridor spec
 *  (the picker is mocked here, so that one is pinned in its own case). */
const liveChecks = () =>
  calls.filter(
    (c) =>
      c.url.includes("/api/render/audit") ||
      c.url.includes("/api/render/device-breakdown") ||
      c.url.includes("/api/render/corridor-spec"),
  );

describe("defect 1 — the kind is confirmed, never inferred", () => {
  it("after a road is confirmed: three chips, NONE pressed; the primary disabled with the reason", async () => {
    await freshWithRoad();

    // The WHERE band stays open — the pin no longer skips the question.
    expect(openBand()).toBe("where");
    expect(chip("shoulder")).toBeTruthy();
    expect(chip("flagger_lane_closure")).toBeTruthy();
    expect(chip("near_intersection")).toBeTruthy();
    expect(pressed()).toEqual([]);

    const confirm = screen.getByTestId("where-confirm");
    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    // The confirm names no kind, because none was chosen.
    expect(confirm.textContent).toBe("Confirm");
    expect(screen.getByTestId("where-confirm-reason").textContent).toBe(
      "choose the kind of work",
    );
    expect(confirm.getAttribute("aria-describedby")).toBe("where-confirm-reason");

    // WHAT is a pending line with the same reason; no link into it.
    const what = document.querySelector('[data-testid="fact-what"]')!;
    expect(what.getAttribute("data-fact-state")).toBe("pending");
    expect(what.textContent).toContain("kind of work not chosen");
    expect(what.querySelector("button")).toBeNull();
    // (The WHERE line's own value string drops the placeholder kind until
    // it is confirmed — lib/scenarios/band-facts.test.ts, where the
    // string is produced.)
  });

  it("PAYLOAD: with no chip clicked, Generate is refused and fires nothing", async () => {
    const user = await freshWithRoad();

    expect(generateBtn().disabled).toBe(true);
    expect(
      document.querySelector('[data-testid="cta-reason"]')?.textContent,
    ).toContain("Choose the kind of work");

    // RULE 5, stated (#301): the WHERE band's two READS — the geometry read
    // and the aerial's picture, both enumerated beside GeneratorShell's
    // senders as reads that form no verdict — fire on their own debounce,
    // and the aerial's can land inside this click's window.  What this case
    // pins is that the GENERATE path sends nothing, so reads are not counted.
    const READS = ["/api/render/corridor-geometry", "/api/corridor-map"];
    const sent = () => calls.filter((c) => !READS.some((r) => c.url.includes(r))).length;
    const before = sent();
    await user.click(generateBtn());
    await settle();
    // No request of any kind — so no generate-path payload exists for a
    // kind nobody chose.
    expect(sent()).toBe(before);
    expect(bundles()).toHaveLength(0);
    // And the column did not move on: still the WHERE band, no results.
    expect(openBand()).toBe("where");
    expect(document.querySelector('[data-testid="results-head-slot"]')).toBeNull();
  });

  it("FINDING 1, PAYLOAD: no live check is sent until the kind is confirmed", async () => {
    // Ryan, 2026-09-23: "the live checks send no kind ... until the kind
    // is confirmed — no verdict for a kind nobody picked (Rule 10)."
    // `scenario.kind` always holds a value, so "send no kind" is "send
    // nothing": from the mount, through the pin and the road, the audit
    // and the breakdown never fire.
    await freshWithRoad();
    expect(liveChecks()).toHaveLength(0);
    // The WHERE band's corridor rows say what they wait on instead of
    // showing lengths for the placeholder kind.
    expect(screen.getByTestId("corridor-extent-note").textContent).toBe(
      "corridor lengths wait on the kind of work",
    );
  });

  it("FINDING 1: a kind re-picked after a confirmation pauses the checks and drops the held lengths", async () => {
    const user = await freshWithRoad();
    await user.click(chip("shoulder"));
    await confirmKind();
    await settle();
    expect(liveChecks().length).toBeGreaterThan(0);

    await user.click(screen.getByTestId("fact-link-where"));
    calls = [];
    await user.click(chip("flagger_lane_closure"));
    await settle();
    // Picked again, not confirmed: nothing is asked about flagger yet.
    expect(liveChecks()).toHaveLength(0);
    // And the shoulder answer is not shown as flagger's.
    expect(screen.getByTestId("corridor-extent-note").textContent).toBe(
      "corridor lengths wait on the kind of work",
    );
  });

  it("the primary does nothing while disabled — pressing it is not a confirmation", async () => {
    const user = await freshWithRoad();
    await user.click(screen.getByTestId("where-confirm"));
    await settle();
    expect(openBand()).toBe("where");
    expect(generateBtn().disabled).toBe(true);
  });

  it("only a click selects — and re-picking the default's own chip IS the choice", async () => {
    const user = await freshWithRoad();
    // `shoulder` is already the scenario's kind (the discriminant's
    // placeholder).  Clicking its chip changes no value; it records that
    // a person chose it.
    await user.click(chip("shoulder"));
    expect(pressed()).toEqual(["kind-chip-shoulder"]);
    const confirm = screen.getByTestId("where-confirm");
    expect(confirm.getAttribute("aria-disabled")).toBeNull();
    expect(confirm.textContent).toBe("Confirm — shoulder work");
    expect(document.querySelector('[data-testid="where-confirm-reason"]')).toBeNull();

    // Selected is not confirmed: WHAT stays pending and Generate blocked
    // until the primary is pressed.
    expect(openBand()).toBe("where");
    expect(generateBtn().disabled).toBe(true);

    await confirmKind();
    expect(openBand()).toBe("what");
    expect(generateBtn().disabled).toBe(false);
  });

  // #290 hand-check (RULE 5, stated — this case asserted one row answered
  // by side AND kind, which kept saying needs-you with "Choose the kind of
  // work" under it after the side was picked).  Ryan, 2026-09-25: "once
  // the side is chosen, the ledger's 'Which side is occupied?' row ticks
  // with the side as its value; the kind question gets its own row ('Kind
  // of work — confirm below')."
  it("the side row ticks with the side once it is chosen; the kind has its own row until Confirm", async () => {
    const user = await freshWithRoad({ side: false });
    const side = () => screen.getByTestId("move-side");
    const kind = () => screen.getByTestId("move-kind");
    expect(side().getAttribute("data-move-state")).toBe("attention");
    expect(side().textContent).toContain("Which side is occupied?");
    expect(side().textContent).toContain("needs you");
    expect(side().textContent).toContain("Say which side is occupied to lay out the work");
    expect(kind().getAttribute("data-move-state")).toBe("attention");
    expect(kind().textContent).toContain("Kind of work — confirm below");

    await answerSide();
    await settle();
    // The side is answered: its row ticks, with the side as its value, and
    // does not speak for the kind.
    expect(side().getAttribute("data-move-state")).toBe("done");
    expect(side().textContent).toContain("East side · traffic heads north");
    expect(side().textContent).not.toContain("needs you");
    expect(side().textContent).not.toContain("Choose the kind of work");
    // The kind is still owed, on its own row.
    expect(kind().getAttribute("data-move-state")).toBe("attention");
    expect(kind().textContent).toContain("Kind of work — confirm below");
    expect(kind().textContent).toContain("needs you");

    await user.click(chip("shoulder"));
    await confirmKind();
    await user.click(screen.getByTestId("fact-link-where"));
    await settle();
    expect(kind().getAttribute("data-move-state")).toBe("done");
    expect(kind().textContent).toContain("Shoulder work");
    expect(kind().textContent).not.toContain("confirm below");
    expect(side().getAttribute("data-move-state")).toBe("done");
    expect(screen.getByTestId("move-grow").getAttribute("data-move-state")).toBe("done");
  });

  // #290 prod sweep finding (flagger-*-04-kind-confirmed-side-owed): the
  // kind confirmed BEFORE the side used to open WHAT with the side control
  // folded away.  Ryan, 2026-09-25: "WHERE's Confirm doesn't move on to
  // WHAT while the side is owed, and the side control stays open on WHERE
  // until chosen."
  it("confirming the kind before the side keeps WHERE open on the side control, then moves on when it is chosen", async () => {
    const user = await freshWithRoad({ side: false });
    await user.click(chip("flagger_lane_closure"));
    await confirmKind();
    await settle();
    expect(openBand()).toBe("where");
    expect(document.querySelectorAll('[data-testid="side-option"]').length).toBeGreaterThan(0);
    expect(screen.getByTestId("move-kind").getAttribute("data-move-state")).toBe("done");
    expect(screen.getByTestId("move-side").getAttribute("data-move-state")).toBe("attention");

    await answerSide();
    await settle();
    expect(openBand()).toBe("what");
  });

  it("#290, PAYLOAD: a confirmed kind with no side fires no check, and Generate names the side", async () => {
    const user = await freshWithRoad({ side: false });
    await user.click(chip("shoulder"));
    await confirmKind();
    await settle();
    expect(liveChecks()).toHaveLength(0);
    expect(generateBtn().disabled).toBe(true);
    expect(
      document.querySelector('[data-testid="cta-reason"]')?.textContent,
    ).toContain("Say which side is occupied to lay out the work");

    await answerSide();
    await settle();
    expect(liveChecks().length).toBeGreaterThan(0);
    const audit = calls.filter((c) => c.url.includes("/api/render/audit"));
    // Every check request carries the side — none went out before it,
    // including in the debounce window after the click (`fetchArmed`).
    const checks = calls.filter(
      (c) => c.url.includes("/api/render/audit") || c.url.includes("/api/render/device-breakdown"),
    );
    expect(audit.length).toBeGreaterThan(0);
    for (const c of checks) {
      const sent = (c.body.scenario ?? c.body) as { meta: { work?: unknown } };
      expect(sent.meta.work, c.url).toEqual({ side: "right", heading: "N" });
    }
    expect(generateBtn().disabled).toBe(false);
  });

  it("PAYLOAD: the generated plan carries the kind the operator clicked", async () => {
    const user = await freshWithRoad();

    await user.click(chip("flagger_lane_closure"));
    await settle();
    // Picked is not confirmed: still no live check (finding 1).
    expect(liveChecks()).toHaveLength(0);

    await confirmKind();
    await settle();
    // The confirmation arms the checks, and the first of them carries the
    // kind the operator clicked.
    const audit = calls.filter((c) => c.url.includes("/api/render/audit"));
    expect(audit.length).toBeGreaterThan(0);
    expect((audit[0].body.scenario as { kind: string }).kind).toBe(
      "flagger_lane_closure",
    );
    await user.click(generateBtn());
    await settle();
    await user.click(screen.getByText("ALL_ZIP"));
    await waitFor(() => expect(bundles()).toHaveLength(1));
    expect((bundles()[0].body.scenario as { kind: string }).kind).toBe(
      "flagger_lane_closure",
    );
  });

  it("changing the kind after confirming asks for the confirm again", async () => {
    const user = await freshWithRoad();
    await user.click(chip("shoulder"));
    await confirmKind();
    expect(generateBtn().disabled).toBe(false);

    // Back into WHERE through its fact line, and a different chip.
    await user.click(screen.getByTestId("fact-link-where"));
    await user.click(chip("flagger_lane_closure"));
    expect(pressed()).toEqual(["kind-chip-flagger_lane_closure"]);
    expect(generateBtn().disabled).toBe(true);
    expect(
      document.querySelector('[data-testid="fact-what"]')?.getAttribute("data-fact-state"),
    ).toBe("pending");
  });

  it("a saved plan (initialScenario) is not re-asked — its kind was chosen when it was made", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    expect(openBand()).toBe("what");
    expect(generateBtn().disabled).toBe(false);
  });
});
