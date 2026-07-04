// @vitest-environment happy-dom
// Dev-only replication-snapshot button (Refs #102) — TEMPORARY scaffolding.
// Pins (a) the ?debug=1 gate: the button renders NOTHING without it, so it
// is unreachable in a default production configuration, and (b) the
// frontend section builder: default-vs-changed marking against the same
// defaultFor(kind) object the form seeds from.

import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import { DEFAULT_QUOTE_SETTINGS } from "@/lib/quote-settings";
import type { RoadClassification } from "@/lib/road-detection/types";
import {
  DebugSnapshotButton,
  buildFrontendSections,
} from "./DebugSnapshotButton";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

const CLASSIFICATION: RoadClassification = {
  roadType: "freeway",
  divided: true,
  laneWidthFt: 12,
  lanesPerDirection: 2,
  speedLimitMph: 65,
  confidence: "high",
  source: "osm-tags",
  raw: {
    class: "motorway",
    oneway: true,
    roadName: "I-25",
    roadRef: "I 25",
    placeName: "Denver",
    osmLanesTag: "2",
    osmMaxspeedTag: "65 mph",
  },
  fields: {
    speed: { value: 65, confidence: "high", source: "maxspeed tag" },
    lanes: { value: 2, confidence: "high", source: "lanes tag" },
    roadType: { value: "freeway", confidence: "high", source: "highway class" },
    divided: { value: true, confidence: "medium", source: "oneway tag" },
  },
};

describe("gate", () => {
  it("renders nothing without ?debug=1", () => {
    window.history.replaceState({}, "", "/");
    const { container } = render(
      <DebugSnapshotButton
        scenario={DEFAULT_SHOULDER}
        settings={DEFAULT_QUOTE_SETTINGS}
        detection={null}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the button with ?debug=1", async () => {
    window.history.replaceState({}, "", "/?debug=1");
    render(
      <DebugSnapshotButton
        scenario={DEFAULT_SHOULDER}
        settings={DEFAULT_QUOTE_SETTINGS}
        detection={null}
      />,
    );
    expect(
      await screen.findByRole("button", { name: /replication snapshot/i }),
    ).toBeTruthy();
  });
});

describe("buildFrontendSections", () => {
  it("marks untouched fields default and touched fields CHANGED", () => {
    const scenario = { ...DEFAULT_SHOULDER, speed: 55 };
    const md = buildFrontendSections(
      scenario,
      DEFAULT_QUOTE_SETTINGS,
      null,
    );
    expect(md).toContain("## 2 Scenario configuration");
    // speed changed: 55 vs the seed's 65 default.
    expect(md).toMatch(/\| speed \| 55 \| 65 \| CHANGED \|/);
    // workLen untouched.
    expect(md).toMatch(
      new RegExp(
        `\\| workLen \\| ${DEFAULT_SHOULDER.workLen} \\| ${DEFAULT_SHOULDER.workLen} \\| default \\|`,
      ),
    );
  });

  it("marks changed quote settings the same way", () => {
    const md = buildFrontendSections(
      DEFAULT_SHOULDER,
      { ...DEFAULT_QUOTE_SETTINGS, project_duration_days: 5 },
      null,
    );
    expect(md).toMatch(/\| project_duration_days \| 5 \| 1 \| CHANGED \|/);
  });

  it("includes location and road-detection fields when available", () => {
    const scenario = {
      ...DEFAULT_SHOULDER,
      meta: {
        ...DEFAULT_SHOULDER.meta,
        address: "123 Main St",
        lat: 39.7,
        lng: -105.0,
        bearingDeg: 90,
      },
    };
    const md = buildFrontendSections(scenario, DEFAULT_QUOTE_SETTINGS, {
      classification: CLASSIFICATION,
      lat: 39.7,
      lng: -105.0,
    });
    expect(md).toContain("## 1 Location & road detection");
    expect(md).toContain("123 Main St");
    expect(md).toContain("39.7");
    expect(md).toContain("I-25");
    expect(md).toContain("motorway");
    expect(md).toContain("divided");
    // Pin matches the capture point — no stale warning.
    expect(md).not.toContain("STALE WARNING");
  });

  it("flags a stale detection when the pin moved after capture", () => {
    const scenario = {
      ...DEFAULT_SHOULDER,
      meta: { ...DEFAULT_SHOULDER.meta, lat: 40.0, lng: -104.5 },
    };
    const md = buildFrontendSections(scenario, DEFAULT_QUOTE_SETTINGS, {
      classification: CLASSIFICATION,
      lat: 39.7,
      lng: -105.0,
    });
    expect(md).toContain("STALE WARNING");
    expect(md).toContain("captured at pin 39.7, -105");
  });

  it("says so when no detection ran this session", () => {
    const md = buildFrontendSections(
      DEFAULT_SHOULDER,
      DEFAULT_QUOTE_SETTINGS,
      null,
    );
    expect(md.toLowerCase()).toContain("no road detection");
  });

  it("notes the plan-sheet exclusion in the header", () => {
    const md = buildFrontendSections(
      DEFAULT_SHOULDER,
      DEFAULT_QUOTE_SETTINGS,
      null,
    );
    expect(md.toLowerCase()).toContain("plan-sheet");
  });
});
