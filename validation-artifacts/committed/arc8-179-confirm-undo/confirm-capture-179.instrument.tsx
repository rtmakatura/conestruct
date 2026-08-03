// @vitest-environment happy-dom
//
// Arc 8 (#179) capture instrument — records the tick lifecycle of every
// confirm row: pre-tick payload, post-tick payload + marker, and what
// the DOM offers for going back (expected: nothing).  Log-only; asserts
// nothing about right or wrong, so the SAME file runs pre-fix and
// post-fix and the diff of its output is the evidence.
//
// Scratch file — delete after capture.  Run by copying to
// conestruct/site/components/ConfirmCapture179.scratch.test.tsx then:
//   npx vitest run components/ConfirmCapture179.scratch.test.tsx

import { afterEach, describe, expect, it, vi } from "vitest";
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

// E Colfax relays (the standing #86 spot): total 5, forward 3 — arms the
// multilane row live.
const COLFAX = { detectedLanesTotal: 5, detectedLanesForward: 3 } as const;
const MISMATCH = {
  detectedLanesTotal: 2,
  detectedLanesForward: 1,
  detectedLanesBackward: 2,
} as const;

function payload(s: Scenario): string {
  // What actually rides the wire: undefined drops at JSON serialization.
  return JSON.stringify(s);
}

function domAffordances(): string {
  const rows = Array.from(
    document.querySelectorAll("[role='checkbox'], [role='alert'] button"),
  ).map((el) => ({
    role: el.getAttribute("role") ?? "button-in-alert",
    checked: el.getAttribute("aria-checked"),
    text: (el as HTMLElement).textContent?.trim().slice(0, 70),
  }));
  return JSON.stringify(rows);
}

function FlaggerHarness({ initial }: { initial: FlaggerLaneClosureScenario }) {
  const [s, setS] = useState<FlaggerLaneClosureScenario>(initial);
  return (
    <>
      <FlaggerForm scenario={s} setScenario={setS} />
      <output data-testid="payload">{payload(s)}</output>
    </>
  );
}

function NIHarness({ initial }: { initial: NearIntersectionScenario }) {
  const [s, setS] = useState<NearIntersectionScenario>(initial);
  const [confirm, setConfirm] = useState({ pending: true, reason: null });
  return (
    <>
      <NearIntersectionForm
        scenario={s}
        setScenario={setS}
        approachConfirm={confirm}
        clearApproachConfirm={() => setConfirm({ pending: false, reason: null })}
      />
      <output data-testid="payload">{payload(s)}</output>
    </>
  );
}

const currentPayload = () => screen.getByTestId("payload").textContent;

describe("#179 capture — tick lifecycle per confirm row", () => {
  it("A: #86 multilane confirm (E Colfax shape)", () => {
    render(<FlaggerHarness initial={{ ...DEFAULT_FLAGGER, ...COLFAX }} />);
    console.log("A pre-tick payload:", currentPayload());
    console.log("A pre-tick DOM rows:", domAffordances());
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Road has one through lane in each direction/,
      }),
    );
    console.log("A post-tick payload:", currentPayload());
    console.log("A post-tick DOM rows (the way back):", domAffordances());
    expect(true).toBe(true);
  });

  it("B: #136 single-lane confirm", () => {
    render(
      <FlaggerHarness
        initial={{ ...DEFAULT_FLAGGER, detectedLanesTotal: 1 }}
      />,
    );
    console.log("B pre-tick payload:", currentPayload());
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Road has one lane in each direction/ }),
    );
    console.log("B post-tick payload:", currentPayload());
    console.log("B post-tick DOM rows:", domAffordances());
    expect(true).toBe(true);
  });

  it("C: #158 two-way confirm", () => {
    render(<FlaggerHarness initial={{ ...DEFAULT_FLAGGER, oneway: "yes" }} />);
    console.log("C pre-tick payload:", currentPayload());
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Road carries two-way traffic/ }),
    );
    console.log("C post-tick payload:", currentPayload());
    console.log("C post-tick DOM rows:", domAffordances());
    expect(true).toBe(true);
  });

  it("D: multi-tick — #86 then #158, order preserved on the marker list", () => {
    render(
      <FlaggerHarness
        initial={{ ...DEFAULT_FLAGGER, ...COLFAX, oneway: "yes" }}
      />,
    );
    console.log("D pre-tick DOM rows:", domAffordances());
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Road has one through lane in each direction/,
      }),
    );
    console.log("D after tick 1 DOM rows:", domAffordances());
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Road carries two-way traffic/ }),
    );
    console.log("D after tick 2 payload:", currentPayload());
    console.log("D after tick 2 DOM rows:", domAffordances());
    expect(true).toBe(true);
  });

  it("E: NI 'Lane count is right' confirm (gated kind — mounted only)", () => {
    render(
      <NIHarness
        initial={{
          ...DEFAULT_NEAR_INTERSECTION,
          approaches: DEFAULT_NEAR_INTERSECTION.approaches.map((a) => ({
            ...a,
            ...MISMATCH,
          })),
        }}
      />,
    );
    console.log("E pre-tick payload:", currentPayload());
    fireEvent.click(screen.getByRole("button", { name: "Lane count is right" }));
    console.log("E post-tick payload:", currentPayload());
    console.log("E post-tick DOM rows:", domAffordances());
    expect(true).toBe(true);
  });

  it("F: ordering hazard — NI confirm tick, then manual lane edit", () => {
    render(
      <NIHarness
        initial={{
          ...DEFAULT_NEAR_INTERSECTION,
          approaches: DEFAULT_NEAR_INTERSECTION.approaches.map((a) => ({
            ...a,
            ...MISMATCH,
          })),
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Lane count is right" }));
    console.log("F after confirm payload:", currentPayload());
    // Manual edit AFTER the confirm: what does the payload carry now?
    fireEvent.click(screen.getAllByRole("button", { name: "3" }).at(-1)!);
    console.log("F after confirm-then-edit payload:", currentPayload());
    expect(true).toBe(true);
  });
});
