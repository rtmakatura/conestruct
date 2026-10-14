// #297 step 3: ACKNOWLEDGE on NEEDS YOU's jurisdiction-delta rows.
//
// Ryan, 2026-10-14: "ACKNOWLEDGE only on NEEDS YOU items with no write
// action (the jurisdiction deltas) ... record acknowledgements in
// meta.acknowledged keyed by stable id."  A click stages an intent; Apply
// writes `meta.acknowledged` and nothing else; an acknowledged row keeps
// rendering, its provenance saying so.

import { describe, expect, it } from "vitest";
import type { AppliedDelta } from "./jurisdiction";
import { buildNeedsYouItems, withAck, type AckState } from "./needs-you-items";
import { itemProvenance, type NeedsYouItem } from "./needs-you";
import {
  applyStaged,
  isFlagStaged,
  stage,
  stagedEnumeration,
  stagedKey,
  unstage,
  withAcknowledged,
} from "./scenarios/site-corrections";
import { DEFAULT_SHOULDER } from "./scenarios";
import type { StagedCorrection } from "./scenarios/types";
import type { TierSources } from "./tier-sources";

const delta = (over: Partial<AppliedDelta> = {}): AppliedDelta =>
  ({
    severity: "count",
    rule: "Double posting of signs is required on state highways with a median.",
    effect: { op: "add", device: "sign" },
    status: "conditional",
    source: { doc: "Lakewood typical TCP sheet", section: "note 6" },
    ...over,
  }) as AppliedDelta;

function sources(over: Partial<TierSources>): TierSources {
  return {
    deltas: [],
    jurisdictionName: "Lakewood",
    deltasChanged: [],
    siteChanged: [],
    finesItem: null,
    finesApplicable: false,
    deltasAttention: [],
    coloradoFails: [],
    siteScanItem: null,
    corridorItem: null,
    geometryItem: null,
    approachesSpec: null,
    approachesSignalized: false,
    ...over,
  } as unknown as TierSources;
}

const KEYED = delta({ key: "lakewood:a1070ec38f" });
const ID = "jur:delta:lakewood:a1070ec38f";
const none: AckState = { acknowledged: [], staged: new Map() };

const build = (acks: AckState | undefined, extra: Partial<TierSources> = {}) =>
  buildNeedsYouItems({
    sources: sources({ deltas: [KEYED], deltasAttention: [KEYED], ...extra }),
    siteLabel: (f) => f,
    acks,
  });

describe("which rows offer ACKNOWLEDGE", () => {
  it("a keyed jurisdiction delta does", () => {
    const [item] = build(none);
    expect(item.id).toBe(ID);
    expect(item.action).toEqual({ kind: "acknowledge", label: "Acknowledge" });
  });

  it("a delta without the backend's key does not: its id would move", () => {
    const d = delta();
    const [item] = buildNeedsYouItems({
      sources: sources({ deltas: [d], deltasAttention: [d] }),
      siteLabel: (f) => f,
      acks: none,
    });
    expect(item.action).toBeNull();
  });

  it("no other row gains a button (ruling d holds for them)", () => {
    const items = build(none, {
      coloradoFails: [{ pass: false, label: "Night lighting", citation: "c", detail: "" }],
    } as Partial<TierSources>);
    const others = items.filter((i) => !i.id.startsWith("jur:delta:"));
    expect(others.length).toBeGreaterThan(0);
    expect(others.every((i) => i.action === null)).toBe(true);
  });

  it("without acknowledgement state, nothing changes (the pre-#297 rendering)", () => {
    expect(build(undefined)[0].action).toBeNull();
  });
});

describe("a row's control and words in each state", () => {
  const base: NeedsYouItem = build(undefined)[0];

  it("staged: Undo, and the provenance says so", () => {
    const item = withAck(base, { acknowledged: [], staged: new Map([[ID, true]]) });
    expect(item.action).toEqual({ kind: "undo", label: "Undo" });
    expect(itemProvenance(item)).toMatch(/ · acknowledgement staged$/);
  });

  it("acknowledged: still renders, Withdraw, provenance says acknowledged", () => {
    const item = withAck(base, { acknowledged: [ID], staged: new Map() });
    expect(item.tier).toBe(base.tier);
    expect(item.title).toBe(base.title);
    expect(item.action).toEqual({ kind: "withdraw", label: "Withdraw" });
    expect(itemProvenance(item)).toMatch(/ · acknowledged$/);
  });

  it("withdrawal staged: Undo", () => {
    const item = withAck(base, { acknowledged: [ID], staged: new Map([[ID, false]]) });
    expect(item.action).toEqual({ kind: "undo", label: "Undo" });
    expect(itemProvenance(item)).toMatch(/ · withdrawal staged$/);
  });
});

describe("staging and Apply", () => {
  const meta = DEFAULT_SHOULDER.meta;

  it("Apply writes meta.acknowledged and nothing else", () => {
    const staged = stage([], { acknowledge: ID, set: true });
    const next = applyStaged(meta, staged);
    expect(next.acknowledged).toEqual([ID]);
    const { acknowledged: _a, ...rest } = next;
    expect(rest).toEqual(meta);
  });

  it("withdraw then Apply removes it, and the key drops when empty", () => {
    const acked = withAcknowledged(meta, ID, true);
    const back = applyStaged(acked, [{ acknowledge: ID, set: false }]);
    expect("acknowledged" in back).toBe(false);
    expect(back).toEqual(meta);
  });

  it("Undo un-stages it; one entry per item", () => {
    const s1 = stage([], { acknowledge: ID, set: true });
    const s2 = stage(s1, { acknowledge: ID, set: false });
    expect(s2).toHaveLength(1);
    expect(stagedKey(s2[0])).toBe(`ack:${ID}`);
    expect(unstage(s2, `ack:${ID}`)).toEqual([]);
  });

  it("the staged sentence names an acknowledgement as one", () => {
    const staged: StagedCorrection[] = [
      { acknowledge: ID, set: true },
      { field: "speed", label: "Speed", from: 30, to: 35 },
    ];
    expect(stagedEnumeration(staged)).toBe("1 field · 1 acknowledgement");
  });

  it("no site-condition reader mistakes it for a correction", () => {
    expect(isFlagStaged({ acknowledge: ID, set: true })).toBe(false);
  });
});
