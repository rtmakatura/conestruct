// #440 — the WHERE band's cross-street mark: the one place its state lives
// (the tap in flight, a failure, Move's re-arm, the tap's pixel, Undo's
// snapshot).  GeneratorSidebar owns it and hands it down; the band only
// renders it.
//
// Authority: validation-artifacts/committed/ux-group4-cross-street/
// rulings.md, rulings 3-6 and X3-X8, X11.
//
// The tap's pixel becomes a coordinate on the backend (POST
// /api/aerial-point, X3; Rule 3), the coordinate goes through the picker's
// own lookup (`lookupCrossStreet`, X4) and the street it names goes
// through the picker Save's own apply (the sidebar's `applyCandidate`,
// X4).  Nothing is written until the lookup names a street (X8).

import { useEffect, useRef, useState } from "react";
import { intersectionRecord, lookupCrossStreet } from "./road-detection/cross-street-lookup";
import type { CrossStreetCandidate } from "./road-detection/cross-street";
import type { IntersectionRecord, Scenario } from "./scenarios/types";

export type CrossMarkPhase = "idle" | "resolving" | "none" | "error";

/** Where the tap landed in the picture it was made on (X5): the box and
 *  the label sit there while that same picture is on screen. */
export interface CrossMarkPixel {
  x: number;
  y: number;
  frameKey: string;
}

export interface CrossTap {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  frameKey: string;
}

export interface CrossStreetMark {
  phase: CrossMarkPhase;
  /** X11: Move re-armed the tap over a standing mark. */
  rearmed: boolean;
  /** The tap's pixel, while the mark it made is the scenario's crossing. */
  pixel: CrossMarkPixel | null;
  /** #446 T7: the tap's pixel while it has no result: looking, or the
   *  lookup failed or found no street.  A found street turns it into
   *  `pixel`. */
  ring: CrossMarkPixel | null;
  /** #446 ruling 3: counts the taps that found a street, so the card can
   *  bring its row into view for those and nothing else (T6). */
  foundCount: number;
  /** #446 T15, T21: the last found tap's scroll may still run.  Move, Undo,
   *  Cancel and the picker opening end it (ruling 5). */
  revealOwed: boolean;
  /** #446 T20: forgets a tap's failed or "no street" answer, and any lookup
   *  still out.  The picker's Save calls it. */
  clear: () => void;
  /** #446 T5, T21: the picker is opening: drops a lookup still out and a
   *  scroll still owed, so neither happens behind it.  A failed answer stays
   *  until the picker saves (T20). */
  leaveForPicker: () => void;
  tap: (t: CrossTap) => void;
  retry: () => void;
  move: () => void;
  cancel: () => void;
  undo: () => void;
}

/** What the sidebar keeps outside the scenario for one apply: the lane
 *  hold and the fresh-content guard's memory (X7 restores them too). */
export interface CrossApplyMemory {
  hold: { pending: boolean; reason: string | null };
  appliedJson: string | null;
}

interface Snapshot {
  before: Scenario;
  memory: CrossApplyMemory;
  written: IntersectionRecord;
  after: string;
}

function hasKey(o: object, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, k);
}

/** X7: the fields the mark wrote, back to their pre-mark values, on top of
 *  whatever else changed since.  When nothing else changed the pre-mark
 *  scenario itself comes back, byte for byte. */
export function restoreBeforeMark(cur: Scenario, snap: { before: Scenario; after: string }): Scenario {
  if (JSON.stringify(cur) === snap.after) return snap.before;
  const b = snap.before as unknown as Record<string, unknown> & { meta: Record<string, unknown> };
  const meta = { ...cur.meta } as Record<string, unknown>;
  if (hasKey(b.meta, "intersection")) meta.intersection = b.meta.intersection;
  else delete meta.intersection;
  // The approach speed's operator flag only: every other flag is the
  // operator's own since.
  const hadFlag = ((b.meta.operatorSet as string[] | undefined) ?? []).includes("approachSpeed");
  const flags = ((meta.operatorSet as string[] | undefined) ?? []).filter((f) => f !== "approachSpeed");
  if (hadFlag) flags.push("approachSpeed");
  if (flags.length > 0) meta.operatorSet = flags;
  else delete meta.operatorSet;
  const out = { ...cur, meta } as unknown as Record<string, unknown>;
  for (const k of ["approaches", "detectionOverrides"]) {
    if (hasKey(b, k)) out[k] = b[k];
    else delete out[k];
  }
  return out as unknown as Scenario;
}

/** #446 T20: what a tap's answer was an answer about. */
function answerKey(s: Scenario): string {
  return JSON.stringify([s.meta.lat, s.meta.lng, s.meta.intersection ?? null]);
}

function sameRecord(a: IntersectionRecord | null | undefined, b: IntersectionRecord | null): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b);
}

export function useCrossStreetMark({
  scenario,
  getScenario,
  setScenario,
  applyCandidate,
  memory,
  restoreMemory,
}: {
  scenario: Scenario;
  getScenario: () => Scenario;
  setScenario: (s: Scenario) => void;
  /** The picker Save's own cross-street apply (X4). */
  applyCandidate: (next: Scenario, cs: CrossStreetCandidate) => Scenario;
  memory: () => CrossApplyMemory;
  restoreMemory: (m: CrossApplyMemory) => void;
}): CrossStreetMark {
  const [phase, setPhase] = useState<CrossMarkPhase>("idle");
  const [rearmed, setRearmed] = useState(false);
  const [pixel, setPixel] = useState<CrossMarkPixel | null>(null);
  const [ring, setRing] = useState<CrossMarkPixel | null>(null);
  const [foundCount, setFoundCount] = useState(0);
  const [revealOwed, setRevealOwed] = useState(false);
  const [askedAbout, setAskedAbout] = useState<string | null>(null);
  const snapRef = useRef<Snapshot | null>(null);
  const tokenRef = useRef(0);
  // Try again repeats the same point: the coordinate once the backend
  // answered, else the tap itself.
  const lastRef = useRef<{ tap: CrossTap; point: { lat: number; lng: number } | null } | null>(null);

  const clear = () => {
    tokenRef.current++;
    lastRef.current = null;
    setRing(null);
    setRevealOwed(false);
    setPhase("idle");
  };
  const cancel = () => {
    tokenRef.current++;
    setRing(null);
    setRearmed(false);
    setRevealOwed(false);
    setPhase("idle");
  };
  // T20 (Rule 10): the pin or the crossing changed under a failed tap, so
  // its answer is about something else.  Hidden in this render, forgotten
  // for good right after, so an Undo can't bring it back.
  const nowAbout = answerKey(scenario);
  const stale = phase !== "idle" && askedAbout !== nowAbout;
  useEffect(() => {
    if (stale) clear();
  });

  const written = snapRef.current?.written ?? null;
  const markStands = written !== null && sameRecord(scenario.meta.intersection, written);

  const run = async (tap: CrossTap, known: { lat: number; lng: number } | null) => {
    const my = ++tokenRef.current;
    lastRef.current = { tap, point: known };
    setPhase("resolving");
    setRing({ x: tap.x, y: tap.y, frameKey: tap.frameKey });
    setAskedAbout(answerKey(getScenario()));
    const pin = getScenario().meta;
    let point = known;
    if (point === null) {
      try {
        const r = await fetch("/api/aerial-point", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lat: pin.lat,
            lng: pin.lng,
            width: tap.width,
            height: tap.height,
            ...(tap.zoom !== 0 ? { zoom: tap.zoom } : {}),
            x: tap.x,
            y: tap.y,
          }),
        });
        if (tokenRef.current !== my) return;
        if (!r.ok) {
          setPhase("error");
          return;
        }
        const j = (await r.json()) as { lat?: unknown; lng?: unknown };
        if (tokenRef.current !== my) return;
        if (typeof j.lat !== "number" || typeof j.lng !== "number") {
          setPhase("error");
          return;
        }
        point = { lat: j.lat, lng: j.lng };
        lastRef.current = { tap, point };
      } catch {
        if (tokenRef.current === my) setPhase("error");
        return;
      }
    }
    const cur0 = getScenario();
    const found = await lookupCrossStreet(point, cur0.meta.confirmedRoad?.candidate ?? null);
    if (tokenRef.current !== my) return;
    if (found.kind !== "detected") {
      setPhase(found.kind);
      return;
    }
    const cur = getScenario();
    const record = intersectionRecord(point, found.candidate);
    // X7: the snapshot is the state before the first mark of a chain, so
    // Undo after a Move clears the crossing rather than stepping back one.
    const prior =
      snapRef.current !== null && sameRecord(cur.meta.intersection, snapRef.current.written)
        ? snapRef.current
        : null;
    const before = prior?.before ?? cur;
    const mem = prior?.memory ?? memory();
    const marked = { ...cur, meta: { ...cur.meta, intersection: record } } as Scenario;
    const next = applyCandidate(marked, found.candidate);
    snapRef.current = { before, memory: mem, written: record, after: JSON.stringify(next) };
    setPixel({ x: tap.x, y: tap.y, frameKey: tap.frameKey });
    setRing(null);
    setRearmed(false);
    setPhase("idle");
    setFoundCount((n) => n + 1);
    setRevealOwed(true);
    setScenario(next);
  };

  return {
    phase: stale ? "idle" : phase,
    rearmed: rearmed && markStands,
    pixel: markStands ? pixel : null,
    ring: stale ? null : ring,
    foundCount,
    revealOwed,
    clear,
    leaveForPicker: () => {
      if (phase === "resolving") cancel();
      setRevealOwed(false);
    },
    tap: (t) => void run(t, null),
    retry: () => {
      const last = lastRef.current;
      if (last) void run(last.tap, last.point);
    },
    move: () => {
      setRearmed(true);
      setRing(null);
      setRevealOwed(false);
      setPhase("idle");
    },
    cancel,
    undo: () => {
      tokenRef.current++;
      const cur = getScenario();
      const snap = snapRef.current;
      if (snap && sameRecord(cur.meta.intersection, snap.written)) {
        restoreMemory(snap.memory);
        setScenario(restoreBeforeMark(cur, snap));
      } else {
        // X7: no snapshot (a reload, a picker save since): what the
        // picker's Clear + Save writes.
        setScenario({ ...cur, meta: { ...cur.meta, intersection: null } } as Scenario);
      }
      snapRef.current = null;
      lastRef.current = null;
      setPixel(null);
      setRing(null);
      setRearmed(false);
      setRevealOwed(false);
      setPhase("idle");
    },
  };
}
