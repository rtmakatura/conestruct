// #289 Phase 2, S7 — revision's producers, at the layer they live in.
//
// Ruling e: "staged field edits live in the shell beside #254's staged
// corrections — one staging mechanism, never per editor … APPLY folds
// staged fields and corrections into one write with the enumerating
// sentence; DISCARD un-stages; pin move clears all."
//
// Rule 11: the staging contract, the fold and the sentence are producer
// claims — provable without a DOM, and this is where they are proved.
// The surface's own claims (the four situations, the reserved row, the
// six rows) are in components/bands/RevisionPanel.test.tsx.

import { describe, expect, it } from "vitest";
import { DEFAULT_SHOULDER } from "./index";
import type { Scenario, StagedCorrection, StagedFieldEdit } from "./types";
import {
  applyStaged,
  isFieldStaged,
  stage,
  stagedKey,
  unstage,
} from "./site-corrections";
import { applyStagedFields, stagedEnumeration } from "./what-writes";
import { blindApplySentence, previewHeaderNote, previewStatusLine } from "./preview";

const speedTo = (to: number): StagedFieldEdit => ({
  field: "speed",
  label: "Speed limit",
  from: 65,
  to,
});

const correction: StagedCorrection = {
  flag: "school_zone",
  marker: {
    flag: "school_zone",
    action: "assert",
    at: "2026-09-23T00:00:00Z",
  } as never,
};

describe("one staging mechanism (ruling e)", () => {
  it("fields and corrections share the list, and are told apart by shape", () => {
    const staged = stage(stage([], correction), speedTo(35));
    expect(staged).toHaveLength(2);
    expect(staged.filter(isFieldStaged)).toHaveLength(1);
    expect(staged.map(stagedKey)).toEqual(["school_zone", "field:speed"]);
  });

  it("a second edit of one field REPLACES the first — the set is a difference, not a history", () => {
    const staged = stage(stage([], speedTo(35)), speedTo(45));
    expect(staged).toHaveLength(1);
    expect((staged[0] as StagedFieldEdit).to).toBe(45);
  });

  it("unstage takes a field out by its own key, leaving the corrections", () => {
    const staged = stage(stage([], correction), speedTo(35));
    const left = unstage(staged, "field:speed");
    expect(left).toHaveLength(1);
    expect(isFieldStaged(left[0])).toBe(false);
  });
});

describe("APPLY folds both halves (ruling 191)", () => {
  it("the field half writes through the field's own writer, bookkeeping and all", () => {
    // A staged speed BELOW a standing work-zone reduction: `setSpeed`'s
    // own clamp drops the reduction, which is exactly why the fold goes
    // through the writer instead of setting the field.
    const withReduction = {
      ...DEFAULT_SHOULDER,
      speed: 65,
      workZoneSpeed: 55,
    } as Scenario;
    const next = applyStagedFields(withReduction, [speedTo(35)]);
    expect(next.speed).toBe(35);
    expect((next as { workZoneSpeed?: number }).workZoneSpeed).toBeUndefined();
  });

  it("the corrections half ignores field edits, so one list can carry both", () => {
    const meta = applyStaged(DEFAULT_SHOULDER.meta, [speedTo(35)]);
    // Nothing staged for the meta ⇒ the same meta back (no spurious
    // write), which is the contract `applyStaged` already had.
    expect(meta).toEqual(DEFAULT_SHOULDER.meta);
  });

  it("nothing is written before APPLY — staging returns a new list, never a scenario", () => {
    const before = { ...DEFAULT_SHOULDER } as Scenario;
    const staged = stage([], speedTo(35));
    expect(staged).toHaveLength(1);
    // §1.1: the scenario is untouched until the fold runs.
    expect(before.speed).toBe(DEFAULT_SHOULDER.speed);
  });
});

describe("the enumerating sentence (ruling 191)", () => {
  it("names both halves when both are staged", () => {
    const staged = stage(stage(stage([], correction), speedTo(35)), {
      flag: "pedestrian_facility",
      marker: null,
    });
    expect(stagedEnumeration(staged)).toBe("1 field · 2 corrections");
  });

  it("names only what is there — an empty half is not a clause (rule 10)", () => {
    expect(stagedEnumeration([speedTo(35)])).toBe("1 field");
    expect(stagedEnumeration([correction])).toBe("1 correction");
    expect(stagedEnumeration([])).toBe("");
  });
});

describe("the preview's words", () => {
  it("rule 201's status row names the value and the scope", () => {
    expect(previewStatusLine("35 mph")).toBe(
      "computed for 35 mph · taper, buffer, spacing and counts only",
    );
  });

  it("rule 91 + R3: the header note says which value AND which computation", () => {
    expect(previewHeaderNote("35 mph")).toBe("for 35 mph · before site conditions");
  });

  it("ruling 202's two blind-apply sentences, verbatim, and only in 7b / 7d", () => {
    expect(blindApplySentence({ kind: "loading" }, "1 field")).toBe(
      "1 field staged · preview still computing — Apply re-generates the full plan either way",
    );
    expect(blindApplySentence({ kind: "error" }, "1 field")).toBe(
      "1 field staged · preview failed — Apply re-generates the full plan without a preview",
    );
    expect(blindApplySentence({ kind: "idle" }, "1 field")).toBeNull();
    expect(
      blindApplySentence(
        { kind: "ready", data: { devices: [], total_devices: 1, unique_types: 1 }, forValue: "35 mph" },
        "1 field",
      ),
    ).toBeNull();
  });
});
