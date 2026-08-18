// @vitest-environment happy-dom
// #207 — the detect-site body relays the confirmed road's centerline.
//
// Rule 11: the defect class lives in the POSTed payload (a body without
// the geometry classifies on the chord server-side), so the assertions
// read the actual fetch body from a mounted form, not helper returns.
// The relay must obey the same staleness rule as the render payloads
// (#140): exact pin match or no geometry on the wire.

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import { SiteConditionsField } from "./SiteConditionsField";

const GEOMETRY: Array<[number, number]> = [
  [39.742, -105.239],
  [39.743, -105.24],
  [39.744, -105.241],
];

function confirmedAt(pinLat: number, pinLng: number): ConfirmedRoad {
  return {
    candidate: {
      way_id: "17070828",
      highway_class: "tertiary",
      name: "Lookout Mountain Road",
      ref: null,
      bearing: 155.9,
      snap_distance_m: 0.5,
      snapped_lat: pinLat,
      snapped_lng: pinLng,
      tags: {
        oneway: null,
        maxspeed: null,
        lanes: null,
        lanes_forward: null,
        lanes_backward: null,
        lanes_both_ways: null,
        turn_lanes: null,
        turn_lanes_forward: null,
        turn_lanes_backward: null,
      },
      signal_distance_m: null,
      geometry: GEOMETRY,
    },
    classification: null as never, // not read by the relay
    method: "auto_single",
    overrides: {},
    isUrban: false,
    placeName: null,
    pinLat,
    pinLng,
  };
}

function scenarioWith(meta: Partial<Scenario["meta"]>): Scenario {
  return {
    ...DEFAULT_SHOULDER,
    meta: {
      ...DEFAULT_SHOULDER.meta,
      lat: 39.742,
      lng: -105.239,
      bearingDeg: 155.9,
      ...meta,
    },
  };
}

const EMPTY_DETECTION = { mode: "corridor" as const };

function mockDetectFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => EMPTY_DETECTION,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function detectBody(scenario: Scenario): Promise<Record<string, unknown>> {
  const fetchMock = mockDetectFetch();
  const { getByRole } = render(
    <SiteConditionsField scenario={scenario} setMeta={() => {}} step={5} />,
  );
  fireEvent.click(
    getByRole("button", { name: /detect nearby site conditions/i }),
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as unknown as [
    string,
    { body: string },
  ];
  expect(url).toBe("/api/render/detect-site");
  return JSON.parse(init.body) as Record<string, unknown>;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("detect-site centerline relay (#207)", () => {
  it("sends the confirmed road's geometry when the pin matches", async () => {
    const body = await detectBody(
      scenarioWith({ confirmedRoad: confirmedAt(39.742, -105.239) }),
    );
    expect(body.centerline).toEqual(GEOMETRY);
    // The corridor fields ride alongside — same request as before.
    expect(body.bearing_deg).toBe(155.9);
    expect(body.closure_type).toBeDefined();
  });

  it("omits the geometry when the pin moved after confirmation", async () => {
    const body = await detectBody(
      scenarioWith({ confirmedRoad: confirmedAt(39.9, -104.9) }),
    );
    expect(body.centerline).toBeUndefined();
    expect(body.bearing_deg).toBe(155.9);
  });

  it("omits the geometry without a confirmed road", async () => {
    const body = await detectBody(scenarioWith({ confirmedRoad: null }));
    expect(body.centerline).toBeUndefined();
  });
});
