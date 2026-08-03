// @vitest-environment happy-dom
//
// Confirm-row undo (issue #179), asserted on the MOUNTED forms with real
// state (rule 11 — the #177 provenance suite mocks setScenario and never
// re-renders, so it cannot see the vanish or the restore).  The tick now
// keeps the row rendered, checked, describing what it overrode; untick
// removes the marker and restores the recorded relays, so a
// tick-then-untick payload is byte-identical to one never confirmed
// (acceptance).  Focus never moves through either transition: the row no
// longer unmounts, which is the whole focus policy (#193 seam).

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { DEFAULT_FLAGGER, DEFAULT_NEAR_INTERSECTION } from "@/lib/scenarios";
import type {
  FlaggerLaneClosureScenario,
  NearIntersectionScenario,
  Scenario,
} from "@/lib/scenarios/types";
import { FlaggerForm } from "./FlaggerForm";
import { NearIntersectionForm } from "./NearIntersectionForm";

afterEach(cleanup);

// The standing E Colfax shape (#86 spot): total 5, forward 3.
const COLFAX = { detectedLanesTotal: 5, detectedLanesForward: 3 } as const;
const MISMATCH = {
  detectedLanesTotal: 2,
  detectedLanesForward: 1,
  detectedLanesBackward: 2,
} as const;

function FlaggerHarness({ initial }: { initial: FlaggerLaneClosureScenario }) {
  const [s, setS] = useState<FlaggerLaneClosureScenario>(initial);
  return (
    <>
      <FlaggerForm scenario={s} setScenario={setS} />
      <output data-testid="payload">{JSON.stringify(s)}</output>
    </>
  );
}

function NIHarness({ initial }: { initial: NearIntersectionScenario }) {
  const [s, setS] = useState<NearIntersectionScenario>(initial);
  const [confirm, setConfirm] = useState<{
    pending: boolean;
    reason: string | null;
  }>({ pending: true, reason: null });
  return (
    <>
      <NearIntersectionForm
        scenario={s}
        setScenario={setS}
        approachConfirm={confirm}
        clearApproachConfirm={() =>
          setConfirm({ pending: false, reason: null })
        }
      />
      <output data-testid="payload">{JSON.stringify(s)}</output>
    </>
  );
}

const payload = () => screen.getByTestId("payload").textContent!;
const row = (name: RegExp) =>
  screen.getByRole("checkbox", { name }) as HTMLButtonElement;

function niWithRelays(): NearIntersectionScenario {
  return {
    ...DEFAULT_NEAR_INTERSECTION,
    approaches: DEFAULT_NEAR_INTERSECTION.approaches.map((a) => ({
      ...a,
      ...MISMATCH,
    })),
  };
}

describe("flagger confirm rows stay visible and untick restores (#179)", () => {
  const ROUND_TRIPS: Array<{
    label: string;
    name: RegExp;
    initial: FlaggerLaneClosureScenario;
    confirmedDesc: RegExp;
  }> = [
    {
      label: "#86 multilane",
      name: /Road has one through lane in each direction/,
      initial: { ...DEFAULT_FLAGGER, ...COLFAX },
      confirmedDesc: /Map data reported 5 total lanes \(3 forward\)/,
    },
    {
      label: "#136 single-lane",
      name: /Road has one lane in each direction/,
      initial: { ...DEFAULT_FLAGGER, detectedLanesTotal: 1 },
      confirmedDesc: /Map data reported 1 total lane/,
    },
    {
      label: "#158 one-way",
      name: /Road carries two-way traffic/,
      initial: { ...DEFAULT_FLAGGER, oneway: "yes" },
      confirmedDesc: /Map data reported a one-way road \(oneway=yes\)/,
    },
  ];

  for (const rt of ROUND_TRIPS) {
    it(`${rt.label}: tick renders checked in place; untick restores byte-identically; focus never moves`, () => {
      render(<FlaggerHarness initial={rt.initial} />);
      const preTick = payload();
      const el = row(rt.name);
      el.focus();

      // Tick: the row stays, checked, describing what it overrode.
      fireEvent.click(el);
      expect(row(rt.name)).toBe(el); // same node — never unmounted
      expect(el.getAttribute("aria-checked")).toBe("true");
      expect(el.textContent).toMatch(rt.confirmedDesc);
      expect(el.textContent).toMatch(/untick to restore detection/);
      expect(document.activeElement).toBe(el);
      expect(payload()).toContain('"detectionOverrides"');

      // Untick: marker removed, relays restored — byte-identical payload,
      // row re-armed.
      fireEvent.click(el);
      expect(payload()).toBe(preTick);
      expect(el.getAttribute("aria-checked")).toBe("false");
      expect(document.activeElement).toBe(el);
    });
  }

  it("tick-untick-tick produces exactly one marker (acceptance)", () => {
    render(<FlaggerHarness initial={{ ...DEFAULT_FLAGGER, ...COLFAX }} />);
    const el = row(/Road has one through lane in each direction/);
    fireEvent.click(el);
    fireEvent.click(el);
    fireEvent.click(el);
    const s = JSON.parse(payload()) as FlaggerLaneClosureScenario;
    expect(s.detectionOverrides).toHaveLength(1);
    expect(s.detectionOverrides![0].via).toBe("flagger_multilane_confirm");
  });

  it("multi-tick: unticking one row restores only its fields, the other stays confirmed", () => {
    render(
      <FlaggerHarness
        initial={{ ...DEFAULT_FLAGGER, ...COLFAX, oneway: "yes" }}
      />,
    );
    fireEvent.click(row(/Road has one through lane in each direction/));
    fireEvent.click(row(/Road carries two-way traffic/));
    let s = JSON.parse(payload()) as FlaggerLaneClosureScenario;
    expect(s.detectionOverrides).toHaveLength(2);

    // Untick #86 only.
    fireEvent.click(row(/Road has one through lane in each direction/));
    s = JSON.parse(payload()) as FlaggerLaneClosureScenario;
    expect(s.detectedLanesTotal).toBe(5);
    expect(s.detectedLanesForward).toBe(3);
    expect(s.oneway).toBeUndefined(); // the #158 confirm stands
    expect(s.detectionOverrides).toHaveLength(1);
    expect(s.detectionOverrides![0].via).toBe("flagger_twoway_confirm");
    expect(
      row(/Road carries two-way traffic/).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      row(/Road has one through lane in each direction/).getAttribute(
        "aria-checked",
      ),
    ).toBe("false");
  });
});

describe("NI approach confirm: confirmed note + undo (#179, gated kind)", () => {
  it("confirm renders the note; undo restores relays byte-identically and removes it", () => {
    render(<NIHarness initial={niWithRelays()} />);
    const preTick = payload();
    fireEvent.click(screen.getByRole("button", { name: "Lane count is right" }));

    expect(
      screen.getByText(/Cross-street lane count confirmed/).textContent,
    ).toMatch(/map data reported 2 total lanes \(1 forward, 2 backward\)/);
    fireEvent.click(
      screen.getByRole("button", { name: /Undo — restore detected lane data/ }),
    );
    expect(payload()).toBe(preTick);
    expect(screen.queryByText(/Cross-street lane count confirmed/)).toBeNull();
    // The one-time sidebar hold is UI state and deliberately does not
    // return; the restored relays re-engage the backend gate (the only
    // blocking path).
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a no-dispute confirm leaves no note — nothing was erased, nothing to undo", () => {
    render(<NIHarness initial={DEFAULT_NEAR_INTERSECTION} />);
    fireEvent.click(screen.getByRole("button", { name: "Lane count is right" }));
    expect(screen.queryByText(/Cross-street lane count confirmed/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Undo — restore detected lane data/ }),
    ).toBeNull();
  });

  it("confirm-then-edit: undo restores relays and preserves the manual count", () => {
    render(<NIHarness initial={niWithRelays()} />);
    fireEvent.click(screen.getByRole("button", { name: "Lane count is right" }));
    // Manual lane edit after the confirm (capture F's hazard).
    fireEvent.click(screen.getAllByRole("button", { name: "3" }).at(-1)!);
    fireEvent.click(
      screen.getByRole("button", { name: /Undo — restore detected lane data/ }),
    );
    const s = JSON.parse(payload()) as NearIntersectionScenario;
    expect(s.approaches[0].lanesPerDirection).toBe(3); // the edit survives
    expect(s.approaches[0].detectedLanesTotal).toBe(2); // detection is back
    expect(s.approaches[0].detectedLanesForward).toBe(1);
    expect(s.approaches[0].detectedLanesBackward).toBe(2);
    expect(s.detectionOverrides).toBeUndefined();
  });
});

// Type-level sanity that the harness payload helper serializes the
// discriminated union the same way the wire does.
const _serialize: (s: Scenario) => string = (s) => JSON.stringify(s);
void _serialize;
