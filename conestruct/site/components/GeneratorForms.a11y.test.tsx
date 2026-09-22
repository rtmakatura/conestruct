// @vitest-environment happy-dom
//
// fix-spec-02 P1·05·03 — label association asserted on the MOUNTED
// surfaces (rule 11: test at the layer the bug lives).  Every select,
// slider, and text/number input an operator can reach must be reachable
// by its visible label.  getByLabelText fails unless the
// <label htmlFor> ↔ id pair actually resolves in the DOM.
//
// #289 Phase 2 — the controls moved, so the suite follows them.  Four of
// the six this file used to check are cells in the WHAT band's grid now
// (§8.22: road type, speed, lane width — and lanes, which the ledger had
// no label for at all), one is in the WHERE band (the work-zone length,
// FLOW.md §5a move 3), and the per-kind work type stayed in the form.
// The fact being asserted is unchanged: a visible label resolves to its
// control.
//
// Two assertions CHANGE SHAPE, deliberately, because the control did:
//   · speed and lane width were range sliders and are selects now.  Rule
//     136 fixes a field at 44 px with the value legible in it; a slider
//     shows its value in the label and its position nowhere an assistive
//     technology can read as a choice.  The domains are the same ones the
//     sliders enforced (lib/scenarios/what-cells.ts, each traced to the
//     form it came from).
//   · the lanes control was a `ChipRow` of unlabelled buttons — which is
//     why this file never asserted it.  It has a label now.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import { ShoulderForm } from "./ShoulderForm";
import { FlaggerForm } from "./FlaggerForm";
import { WhatBand } from "./bands/WhatBand";
import { WhereBand } from "./bands/WhereBand";

afterEach(cleanup);

// LabelRow renders the right-hand value ("65 mph") inside the label, so
// the accessible name is "Speed limit65 mph" — match on the label text.
const byLabel = (re: RegExp) => screen.getByLabelText(re) as HTMLElement;

/** A pinned scenario: the WHERE band only mounts the extent field once
 *  there is somewhere to measure from. */
const pinned = (s: Scenario): Scenario =>
  ({ ...s, meta: { ...s.meta, lat: 39.71466, lng: -104.94071 } }) as Scenario;

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

function mountWhere(scenario: Scenario) {
  render(
    <WhereBand
      scenario={pinned(scenario)}
      setScenario={() => {}}
      setMeta={() => {}}
      onOpenPicker={() => {}}
      onKindChange={() => {}}
      onConfirm={() => {}}
      handoff={[]}
      stepIndex="STEP 1 OF 4"
    />,
  );
}

describe("the WHAT grid's cells carry their visible labels", () => {
  it("shoulder: every cell resolves from its label", () => {
    mountWhat(DEFAULT_SHOULDER);
    expect(byLabel(/^Road type/).tagName).toBe("SELECT");
    expect(byLabel(/^Speed limit/).tagName).toBe("SELECT");
    expect(byLabel(/^Lane width/).tagName).toBe("SELECT");
    expect(byLabel(/^Lanes per direction/).tagName).toBe("SELECT");
    expect(byLabel(/^Jurisdiction/).tagName).toBe("SELECT");
    expect((byLabel(/^Work dates/) as HTMLInputElement).type).toBe("date");
  });

  it("flagger: the lanes cell is read-only with its reason, and still labelled", () => {
    mountWhat(DEFAULT_FLAGGER);
    expect(byLabel(/^Road type/).tagName).toBe("SELECT");
    expect(byLabel(/^Speed limit/).tagName).toBe("SELECT");
    expect(byLabel(/^Lane width/).tagName).toBe("SELECT");
    // #209's read-only-with-reason: the kind has no lane count, so the
    // cell states the one the plan uses rather than vanishing.
    const lanes = screen.getByLabelText(
      /Lanes per direction \(fixed by this plan kind\)/,
    ) as HTMLInputElement;
    expect(lanes.readOnly).toBe(true);
  });
});

describe("the WHERE band's extent field carries its visible label", () => {
  it("one work-zone length field for every kind, not three", () => {
    mountWhere(DEFAULT_SHOULDER);
    expect((byLabel(/^Work zone length/) as HTMLInputElement).type).toBe(
      "number",
    );
    cleanup();
    mountWhere(DEFAULT_FLAGGER);
    expect((byLabel(/^Work zone length/) as HTMLInputElement).type).toBe(
      "number",
    );
  });
});

describe("the per-kind forms' own controls carry their visible labels", () => {
  it("ShoulderForm: the work type stayed here", () => {
    render(<ShoulderForm scenario={DEFAULT_SHOULDER} setScenario={() => {}} />);
    expect(byLabel(/^Work type/).tagName).toBe("SELECT");
  });

  it("FlaggerForm: the work type stayed here", () => {
    render(<FlaggerForm scenario={DEFAULT_FLAGGER} setScenario={() => {}} />);
    expect(byLabel(/^Work type/).tagName).toBe("SELECT");
  });
});
