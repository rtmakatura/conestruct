// @vitest-environment happy-dom
//
// #397 — untouched setup values never read as the operator's (mission
// provenance-marks, #408).  Rule 10 and suggest-never-set: a value no
// operator edit produced says "default", never "typed", "yours" or
// "operator-set"; an edit flips it to "✓ yours" (R110 Q8's treatment).
//
// Rule 11: where the bug lives.  W1 is a mounted flow (the sandbox shell,
// pin, side, then the operator's length); W2 and W3 are the rendered
// cells.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  carryAcrossKinds,
  DEFAULT_FLAGGER,
  DEFAULT_NEAR_INTERSECTION,
  DEFAULT_SCENARIO,
  DEFAULT_SHOULDER,
  defaultFor,
} from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import { setLanes, setRoadType } from "@/lib/scenarios/what-writes";
import { applyClassification } from "@/lib/scenarios/auto-apply";

vi.mock("../AppNav", () => ({ AppNav: () => null }));
vi.mock("../AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("../AppFooter", () => ({ AppFooter: () => null }));
vi.mock("../StatusBar", () => ({ StatusBar: () => null }));
vi.mock("../OutputCards", () => ({ OutputCards: () => null }));
vi.mock("../TieredReference", () => ({ TieredReference: () => null }));
vi.mock("../DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));
vi.mock("../LocationPickerModal", () => ({
  LocationPickerModal: ({ onSave }: { onSave: (r: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSave({
          address: "1600 E Colfax Ave, Denver",
          lat: 39.74003,
          lng: -104.96555,
          // #290: the picker carries no length.
          classification: null,
          overrides: {},
        })
      }
    >
      APPLY_PIN
    </button>
  ),
}));

import { GeneratorShell } from "../GeneratorShell";
import { PlanDetailCells } from "./PlanDetails";
import { WhatBand, whatHeader } from "./WhatBand";
import { answerSide, openWhere } from "../__fixtures__/band-helpers";
import { corridorGeometryResponse, withOperatorSpeed } from "../test-fixtures";

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
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
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const FALSE_CLAIMS = /\byours\b|\btyped\b|operator-set|your answer|your change/;

describe("W1: the starting 1,000 ft reads 'default' until the operator commits a length", () => {
  it("mounted flow: ledger and field say 'default' after the pin and side; typing a length flips both", async () => {
    const user = userEvent.setup();
    // The sandbox opens on DEFAULT_SCENARIO (GeneratorShell.tsx:210); the
    // speed record stands in for the operator's speed so checks can arm.
    render(<GeneratorShell mode="sandbox" initialScenario={withOperatorSpeed(DEFAULT_SCENARIO)} />);
    await act(async () => {
      await Promise.resolve();
    });
    await openWhere();
    await user.click(screen.getByText("Pick on map"));
    await user.click(screen.getByText("APPLY_PIN"));
    await answerSide();
    await openWhere();

    // Nothing was typed: the ledger names the producer "default".
    const extentRow = screen.getByTestId("move-extent");
    expect(extentRow.textContent).toContain("1,000 ft · default");
    expect(extentRow.textContent).not.toMatch(FALSE_CLAIMS);
    // The field's marker and its line say the same.
    expect(screen.getByTestId("info-toggle-worklen").textContent).toBe("default");
    const prov = screen.getByTestId("prov-worklen").textContent!;
    expect(prov).toBe("default · the plan's starting length; enter the real one");

    // The operator commits a length: "typed" and "✓ yours".
    const extent = document.getElementById("band-worklen") as HTMLInputElement;
    await user.clear(extent);
    await user.type(extent, "400{Enter}");
    await waitFor(() =>
      expect(screen.getByTestId("info-toggle-worklen").textContent).toBe("✓ yours"),
    );
    expect(screen.getByTestId("move-extent").textContent).toContain("400 ft · typed");
    expect(screen.getByTestId("prov-worklen").textContent).toBe(
      "your answer · the extent the plan is built for",
    );
  });

  it("mounted flow: typing 1000 over the starting 1,000 is the operator's answer too", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={withOperatorSpeed(DEFAULT_SCENARIO)} />);
    await act(async () => {
      await Promise.resolve();
    });
    await openWhere();
    await user.click(screen.getByText("Pick on map"));
    await user.click(screen.getByText("APPLY_PIN"));
    await answerSide();
    await openWhere();
    expect(screen.getByTestId("info-toggle-worklen").textContent).toBe("default");
    const extent = document.getElementById("band-worklen") as HTMLInputElement;
    await user.clear(extent);
    await user.type(extent, "1000{Enter}");
    await waitFor(() =>
      expect(screen.getByTestId("info-toggle-worklen").textContent).toBe("✓ yours"),
    );
    expect(screen.getByTestId("move-extent").textContent).toContain("1,000 ft · typed");
  });
});

// ---------------------------------------------------------------------------

function mountJob(scenario: Scenario) {
  const setScenario = vi.fn();
  render(
    <div className="a-col">
      <PlanDetailCells group="job" scenario={scenario} setScenario={setScenario} />
    </div>,
  );
  return setScenario;
}

describe("W2: Work type reads plain 'default' until changed (Ryan 2026-10-26, amending R110 Q8)", () => {
  it.each([
    ["shoulder", DEFAULT_SHOULDER],
    ["flagger", DEFAULT_FLAGGER],
    ["near-intersection", DEFAULT_NEAR_INTERSECTION],
  ])("%s: the kind's own default reads plain 'default', no mark", (_k, s) => {
    mountJob(s);
    expect(screen.getByTestId("info-toggle-work-type").textContent).toBe("default");
    expect(screen.getByTestId("prov-work-type").textContent).not.toMatch(FALSE_CLAIMS);
  });

  it("a pick is recorded and reads '✓ yours', even a pick back to the default", () => {
    const setScenario = mountJob(DEFAULT_SHOULDER);
    const select = document.getElementById("pd-work-type") as HTMLSelectElement;
    const other = Array.from(select.options).find((o) => o.value !== DEFAULT_SHOULDER.workType)!;
    fireEvent.change(select, { target: { value: other.value } });
    const written = setScenario.mock.calls[0][0] as Scenario;
    expect(written.workType).toBe(other.value);
    expect(written.meta.operatorSet).toContain("workType");
    cleanup();
    mountJob({ ...written, workType: DEFAULT_SHOULDER.workType } as Scenario);
    expect(screen.getByTestId("info-toggle-work-type").textContent).toBe("✓ yours");
  });

  it("a kind switch starts the new kind's work type fresh, so its record goes", () => {
    const mine = {
      ...DEFAULT_SHOULDER,
      meta: { ...DEFAULT_SHOULDER.meta, operatorSet: ["workType", "workLen"] },
    } as Scenario;
    const next = carryAcrossKinds(mine, defaultFor("flagger_lane_closure"));
    expect(next.meta.operatorSet ?? []).not.toContain("workType");
    // The length is carried, and its record with it.
    expect(next.meta.operatorSet).toContain("workLen");
  });
});

// ---------------------------------------------------------------------------

function road(lanesPerDirection: number, detectedLanesTotal: number): ConfirmedRoad {
  return {
    candidate: {
      way_id: "427683596",
      highway_class: "primary",
      name: "Wadsworth Boulevard",
      ref: null,
      bearing: 0,
      snap_distance_m: 4,
      snapped_lat: 39.7334,
      snapped_lng: -105.0815,
      tags: {
        oneway: "yes",
        maxspeed: "45 mph",
        lanes: String(detectedLanesTotal),
        lanes_forward: null,
        lanes_backward: null,
        lanes_both_ways: null,
        turn_lanes: null,
        turn_lanes_forward: null,
        turn_lanes_backward: null,
      },
      signal_distance_m: null,
      geometry: [
        [39.733, -105.0815],
        [39.734, -105.0815],
      ],
    },
    classification: {
      roadType: "urban_arterial",
      divided: false,
      laneWidthFt: 12,
      lanesPerDirection,
      detectedLanesTotal,
      speedLimitMph: 45,
      confidence: "high",
      source: "osm-tags",
      raw: {
        class: "primary",
        oneway: true,
        roadName: "Wadsworth Boulevard",
        roadRef: null,
        placeName: "Lakewood",
        osmLanesTag: String(detectedLanesTotal),
        osmMaxspeedTag: "45 mph",
      },
      fields: {
        speed: { value: 45, confidence: "high", source: "OSM maxspeed tag", method: "measured" },
        lanes: { value: lanesPerDirection, confidence: "medium", source: "OSM lanes tag", method: "measured" },
        roadType: { value: "urban_arterial", confidence: "high", source: "class", method: "measured" },
        divided: { value: false, confidence: "high", source: "oneway", method: "measured" },
      },
    },
    method: "operator_pick",
    overrides: {},
    isUrban: true,
    placeName: "Lakewood",
    pinLat: 39.7334,
    pinLng: -105.0815,
  } as unknown as ConfirmedRoad;
}

function pinned<S extends Scenario>(base: S, r: ConfirmedRoad, over: Partial<S> = {}): S {
  return {
    ...base,
    speed: 45,
    roadType: "urban_arterial",
    meta: { ...base.meta, lat: 39.7334, lng: -105.0815, confirmedRoad: r },
    ...over,
  } as S;
}

function mountWhat(scenario: Scenario) {
  render(
    <WhatBand
      scenario={scenario}
      setScenario={() => {}}
      setMeta={() => {}}
      jurisdictionBlock={null}
      jurisdictionLoading={false}
      jurisdictionErrored={false}
      stepIndex="STEP 2 OF 4"
    />,
  );
}

const lanesText = () => document.querySelector('[data-testid="cell-lanes"]')!.textContent!;

describe("W3: Lanes never read 'operator-set' for a count nobody picked", () => {
  it("near-intersection on Wadsworth: the kind's 2 reads plain 'default', and the ⚠ sits on the line saying why the map's 4 isn't used", () => {
    mountWhat(pinned(DEFAULT_NEAR_INTERSECTION, road(4, 8)));
    // Ryan 2026-10-26 (#397): the row reads plain "default"; the ⚠ moves to
    // the doubt line (Rule 10: the tool's doubt is still said).
    expect(screen.getByTestId("info-toggle-lanes").textContent).toBe("default");
    expect(screen.getByTestId("prov-lanes").textContent).toBe("default · set the real count");
    expect(screen.getByTestId("detect-lanes-doubt").textContent).toBe(
      "⚠ not confirmed · the map reads 4 per side, but turn lanes can inflate counts near an intersection",
    );
    expect(lanesText()).not.toMatch(FALSE_CLAIMS);
    expect(lanesText()).not.toContain("withdrawn");
    // The header's N equals the ⚠ markers on show (P2); Lanes shows none.
    const warned = Array.from(document.querySelectorAll('[data-testid^="info-toggle-"]')).filter(
      (e) => e.textContent!.startsWith("⚠"),
    ).length;
    // On this fixture nothing else is a guess, so the header has none to
    // count (it read "1 guess marked ⚠" while Lanes carried the ⚠).
    expect(warned).toBe(0);
    expect(document.body.textContent).toContain(whatHeader(warned, true));
  });

  it("near-intersection: the operator's count is recorded and reads '✓ yours'", () => {
    const base = pinned(DEFAULT_NEAR_INTERSECTION, road(4, 8));
    const mine = setLanes(base, 3);
    expect(mine.meta.operatorSet).toContain("lanes");
    mountWhat(mine);
    expect(screen.getByTestId("info-toggle-lanes").textContent).toBe("✓ yours");
  });

  it("shoulder after the operator's edit: 'withdrawn' is said in plain words in the row's details", () => {
    const r = road(2, 4);
    // The edit cleared the relay (setLanes' ownership story): withdrawn.
    const edited = setLanes(pinned(DEFAULT_SHOULDER, r, { lanes: 2 }), 3);
    mountWhat(edited);
    expect(screen.getByTestId("prov-lanes-withdrawn").textContent).toBe(
      "withdrawn · you changed the count, so the plan no longer uses the map's",
    );
  });

  it("shoulder on a road with no lane count: the untouched count reads plain 'default', not '✓ yours'", () => {
    const r = road(2, 4);
    const noLanes = {
      ...r,
      classification: { ...r.classification, lanesPerDirection: undefined, detectedLanesTotal: undefined },
    } as unknown as ConfirmedRoad;
    mountWhat(pinned(DEFAULT_SHOULDER, noLanes));
    expect(screen.getByTestId("info-toggle-lanes").textContent).toBe("default");
    expect(screen.getByTestId("prov-lanes").textContent).not.toMatch(FALSE_CLAIMS);
  });

  it("shoulder on a road with no lane count: a deliberate pick of 2 (the default) reads '✓ yours'", () => {
    const r = road(2, 4);
    const noLanes = {
      ...r,
      classification: { ...r.classification, lanesPerDirection: undefined, detectedLanesTotal: undefined },
    } as unknown as ConfirmedRoad;
    const picked = setLanes(pinned(DEFAULT_SHOULDER, noLanes, { lanes: 2 }), 2);
    expect(picked.meta.operatorSet).toContain("lanes");
    mountWhat(picked);
    expect(screen.getByTestId("info-toggle-lanes").textContent).toBe("✓ yours");
  });

  it("shoulder: a divided flip that resets the count drops the operator's record of it", () => {
    const mine = setLanes(pinned(DEFAULT_SHOULDER, road(2, 4), { lanes: 2, divided: true, roadType: "rural_divided" }), 3);
    const flipped = setRoadType(mine, "rural_undivided");
    expect((flipped as { lanes: number }).lanes).toBe(1);
    expect(flipped.meta.operatorSet ?? []).not.toContain("lanes");
  });
});

// ---------------------------------------------------------------------------
// Repair cycle 3 (the reviewer's five findings, and Ryan's 2026-10-26
// ruling: a default reads plain "default", no mark).

const guessesOnShow = () =>
  Array.from(document.querySelectorAll('[data-testid^="info-toggle-"]')).filter((e) =>
    e.textContent!.startsWith("⚠"),
  ).length;

function withoutLaneCount(r: ConfirmedRoad): ConfirmedRoad {
  return {
    ...r,
    classification: { ...r.classification, lanesPerDirection: undefined, detectedLanesTotal: undefined },
  } as unknown as ConfirmedRoad;
}

describe("Repair 3: no false 'yours', no map where none was read", () => {
  it("finding 1: with nothing detected the WHAT header doesn't call every value 'yours'", () => {
    mountWhat(DEFAULT_SHOULDER);
    const header = document.body.textContent!;
    expect(header).toContain("nothing detected; set what the plan needs");
    expect(header).not.toContain("every value here is yours");
  });

  it("finding 5: a shoulder plan with no detection names no map on its lanes line", () => {
    mountWhat(DEFAULT_SHOULDER);
    expect(screen.getByTestId("info-toggle-lanes").textContent).toBe("default");
    expect(screen.getByTestId("prov-lanes").textContent).toBe("default · set the real count");
    expect(lanesText()).not.toMatch(/\bmap\b/);
  });

  it("finding 4: a count a road lookup wrote never reads 'yours' after a re-pick onto a road with no count", () => {
    const counted = road(4, 8);
    const bare = withoutLaneCount(counted);
    // The operator picks 3 on a road with no count (recorded) ...
    const picked = setLanes(pinned(DEFAULT_SHOULDER, bare, { lanes: 2 }), 3);
    expect(picked.meta.operatorSet).toContain("lanes");
    // ... a road with a count rewrites it, and the record goes ...
    const relooked = applyClassification(picked, counted.classification).scenario;
    expect((relooked as { lanes: number }).lanes).toBe(4);
    expect(relooked.meta.operatorSet ?? []).not.toContain("lanes");
    // ... and a re-pick onto a road with no count keeps the 4, which is
    // not the operator's.  The plan is mounted as the re-pick left it.
    const again = applyClassification(relooked, bare.classification).scenario;
    expect((again as { lanes: number }).lanes).toBe(4);
    mountWhat(pinned(again as typeof DEFAULT_SHOULDER, bare));
    expect((document.getElementById("what-lanes") as HTMLSelectElement).value).toBe("4");
    expect(screen.getByTestId("info-toggle-lanes").textContent).toBe("default");
    expect(screen.getByTestId("prov-lanes").textContent).toBe(
      "default · not from this road; the map has no count here; set the real count",
    );
    expect(lanesText()).not.toMatch(FALSE_CLAIMS);
  });

  it("finding 3a (stated): an edited near-intersection count is '✓ yours', its doubt line goes, and N doesn't change", () => {
    const base = pinned(DEFAULT_NEAR_INTERSECTION, road(4, 8));
    mountWhat(base);
    const before = guessesOnShow();
    expect(screen.getByTestId("info-toggle-lanes").textContent).toBe("default");
    cleanup();
    mountWhat(setLanes(base, 3));
    expect(screen.getByTestId("info-toggle-lanes").textContent).toBe("✓ yours");
    expect(screen.queryByTestId("detect-lanes-doubt")).toBeNull();
    expect(guessesOnShow()).toBe(before);
  });

  it("finding 3b (stated): a near-intersection way with lanes:forward and no total reads 'default' with the doubt line", () => {
    const r = road(3, 8);
    const forwardOnly = {
      ...r,
      classification: { ...r.classification, detectedLanesTotal: undefined, detectedLanesForward: 3 },
    } as unknown as ConfirmedRoad;
    mountWhat(pinned(DEFAULT_NEAR_INTERSECTION, forwardOnly));
    expect(screen.getByTestId("info-toggle-lanes").textContent).toBe("default");
    expect(screen.getByTestId("detect-lanes-doubt").textContent).toContain("⚠ not confirmed · the map reads 3 per side");
  });

  it("a near-intersection plan with no map count reads plain 'default'", () => {
    mountWhat(DEFAULT_NEAR_INTERSECTION);
    expect(screen.getByTestId("info-toggle-lanes").textContent).toBe("default");
    expect(screen.getByTestId("prov-lanes").textContent).toBe("default · set the real count");
    expect(screen.queryByTestId("detect-lanes-doubt")).toBeNull();
  });

  // The length and work type rows are W1's and W2's.
  it("Ryan 2026-10-26: no '✓ default' on the lanes or road-type rows", () => {
    mountWhat(DEFAULT_SHOULDER);
    for (const id of ["lanes", "road-type"]) {
      const t = screen.queryByTestId(`info-toggle-${id}`)?.textContent ?? "";
      expect(t).not.toBe("✓ default");
    }
    expect(screen.getByTestId("info-toggle-road-type").textContent).toBe("default");
  });
});
