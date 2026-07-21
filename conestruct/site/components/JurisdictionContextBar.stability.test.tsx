// @vitest-environment happy-dom
//
// Jurisdiction-bar geometric stability — structural layer.  happy-dom
// has no layout engine, so the HEIGHT assertion lives in the browser
// (scripts/verify-jbar-stability.mjs asserts bar height identical
// across none / every launch-8 selection / the loading skeleton, at
// 1440 and 1100 — run it with the dev server up).  This file pins the
// structure that makes those measurements hold: the three reserved
// slots are ALWAYS mounted, and the chain slot renders a skeleton
// while the jurisdiction fetch is in flight.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { JurisdictionContextBar } from "./JurisdictionSection";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import demo from "./__fixtures__/jurisdiction-demo.json";

const jur = (key: string): JurisdictionBlock =>
  (demo as { jurisdictions: Record<string, unknown> }).jurisdictions[
    key
  ] as JurisdictionBlock;

const noop = () => {};

function mount(j: JurisdictionBlock | null, key: string | null, loading = false) {
  return render(
    <JurisdictionContextBar
      jurisdiction={j}
      jurisdictionKey={key}
      setJurisdictionKey={noop}
      streetClass={null}
      setStreetClass={noop}
      loading={loading}
    />,
  );
}

const SLOTS = [".jbar-slot-auth", ".jbar-slot-hint", ".jbar-slot-chain"];

afterEach(cleanup);

describe("jurisdiction bar reserved slots", () => {
  it("all three reserved slots are mounted with NO jurisdiction selected", () => {
    const { container } = mount(null, null);
    for (const sel of SLOTS) {
      expect(container.querySelector(sel), sel).not.toBeNull();
    }
    // Baseline chain renders inside the slot; no skeleton.
    expect(container.querySelector(".jbar-slot-chain .chain")).not.toBeNull();
    expect(container.querySelector(".chain-skeleton")).toBeNull();
  });

  it("all three reserved slots are mounted with a jurisdiction selected", () => {
    const { container } = mount(jur("parker"), "parker");
    for (const sel of SLOTS) {
      expect(container.querySelector(sel), sel).not.toBeNull();
    }
    expect(container.querySelector(".jbar-slot-chain .chain")).not.toBeNull();
  });

  it("the hint slot stays mounted (space reserved) even when the jurisdiction needs no hint", () => {
    const noHint = { ...jur("parker"), class_required: false };
    const { container } = mount(noHint, "parker");
    expect(container.querySelector(".jbar-slot-hint")).not.toBeNull();
  });

  it("during the jurisdiction fetch the chain slot renders a skeleton, not the stale/baseline chain", () => {
    const { container } = mount(null, "denver", true);
    expect(container.querySelector(".chain-skeleton")).not.toBeNull();
    expect(container.querySelector(".jbar-slot-chain .chain")).toBeNull();
    // The other slots hold their space through the load too.
    for (const sel of SLOTS) {
      expect(container.querySelector(sel), sel).not.toBeNull();
    }
  });

  it("skeleton clears when the block lands", () => {
    const { container } = mount(jur("denver"), "denver", false);
    expect(container.querySelector(".chain-skeleton")).toBeNull();
    expect(
      container.querySelectorAll(".jbar-slot-chain .chain .seg").length,
    ).toBeGreaterThan(1);
  });
});
