// @vitest-environment happy-dom
// Dev-only replication-snapshot button (Refs #102) — TEMPORARY scaffolding.
// Pins (a) the ?debug=1 gate: the button renders NOTHING without it, so it
// is unreachable in a default production configuration, and (b) the
// frontend section builder: default-vs-changed marking against the same
// defaultFor(kind) object the form seeds from.

import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SHOULDER, defaultFor } from "@/lib/scenarios";
import { DEFAULT_QUOTE_SETTINGS } from "@/lib/quote-settings";
import type { RoadClassification } from "@/lib/road-detection/types";
import {
  DebugSnapshotButton,
  buildFrontendSections,
  divergenceLines,
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
    speed: { value: 65, confidence: "high", source: "maxspeed tag", method: "measured" },
    lanes: { value: 2, confidence: "high", source: "lanes tag", method: "measured" },
    roadType: { value: "freeway", confidence: "high", source: "highway class", method: "measured" },
    divided: { value: true, confidence: "medium", source: "oneway tag", method: "measured" },
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

  it("stamps the frontend build id (or its honest sentinel) and the host (#178)", () => {
    const md = buildFrontendSections(
      DEFAULT_SHOULDER,
      DEFAULT_QUOTE_SETTINGS,
      null,
    );
    // The env is not set in tests — the sentinel proves the fallback
    // path, never a fabricated id. Hostname is runtime-real.
    expect(md).toContain("> Frontend build: ");
    expect(md).toContain(`host: ${window.location.hostname}`);
  });

  it("prints all four relay-source tags and the raw oneway string (#178)", () => {
    const md = buildFrontendSections(DEFAULT_SHOULDER, DEFAULT_QUOTE_SETTINGS, {
      classification: DETECTING_CLASSIFICATION,
      lat: DEFAULT_SHOULDER.meta.lat,
      lng: DEFAULT_SHOULDER.meta.lng,
    });
    expect(md).toContain(
      "lanes=5 lanes:forward=3 lanes:backward=2 lanes:both_ways=- " +
        "maxspeed=65 mph oneway=yes (folded: true)",
    );
  });
});

// #178 item 3 — detection and payload were printed side by side but
// never compared; the Colfax case required a reader to cross-reference
// by eye and know to look.
const DETECTING_CLASSIFICATION: RoadClassification = {
  ...CLASSIFICATION,
  detectedLanesTotal: 5,
  detectedLanesForward: 3,
  detectedOneway: "yes",
  raw: {
    ...CLASSIFICATION.raw,
    osmLanesTag: "5",
    osmLanesForwardTag: "3",
    osmLanesBackwardTag: "2",
    osmLanesBothWaysTag: null,
    osmOnewayTag: "yes",
  },
};

describe("divergenceLines (#178)", () => {
  it("flags each relay the payload no longer carries", () => {
    const lines = divergenceLines(DEFAULT_SHOULDER, DETECTING_CLASSIFICATION);
    expect(lines).toContain(
      "**DIVERGENCE: detection said lanes=5, payload carries (none)**",
    );
    expect(lines).toContain(
      "**DIVERGENCE: detection said lanes:forward=3, payload carries (none)**",
    );
  });

  it("stays silent when detection and payload agree", () => {
    const scenario = {
      ...DEFAULT_SHOULDER,
      detectedLanesTotal: 5,
      detectedLanesForward: 3,
    };
    expect(divergenceLines(scenario, DETECTING_CLASSIFICATION)).toEqual([]);
  });

  it("annotates — never suppresses — a divergence a #177 marker explains", () => {
    const scenario = {
      ...DEFAULT_SHOULDER,
      detectionOverrides: [
        {
          via: "shoulder_lane_edit" as const,
          detectedLanesTotal: 5,
          asserted: "2 lanes per direction",
        },
      ],
    };
    const lines = divergenceLines(scenario, DETECTING_CLASSIFICATION);
    const lanesLine = lines.find((l) => l.includes("lanes=5"));
    expect(lanesLine).toContain(
      "explained by a recorded override (shoulder_lane_edit)",
    );
    // The marker carries no lanes:forward value — that line stays plain.
    const forwardLine = lines.find((l) => l.includes("lanes:forward=3"));
    expect(forwardLine).not.toContain("explained by");
  });

  it("compares the raw oneway relay for flagger payloads", () => {
    const scenario = defaultFor("flagger_lane_closure");
    const lines = divergenceLines(scenario, DETECTING_CLASSIFICATION);
    expect(lines).toContain(
      "**DIVERGENCE: detection said oneway=yes, payload carries (none)**",
    );
  });

  it("returns nothing for kinds without the top-level relays", () => {
    expect(
      divergenceLines(defaultFor("near_intersection"), DETECTING_CLASSIFICATION),
    ).toEqual([]);
  });

  it("embeds the divergence lines in section 1", () => {
    const md = buildFrontendSections(DEFAULT_SHOULDER, DEFAULT_QUOTE_SETTINGS, {
      classification: DETECTING_CLASSIFICATION,
      lat: DEFAULT_SHOULDER.meta.lat,
      lng: DEFAULT_SHOULDER.meta.lng,
    });
    expect(md).toContain("**DIVERGENCE: detection said lanes=5");
  });
});
