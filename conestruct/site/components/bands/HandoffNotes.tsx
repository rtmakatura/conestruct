"use client";

// #289 Phase 2 — the picker → form handoff notes.
//
// #289 hand-check, 2026-09-23, correction 3: "'Applied from picker' is
// not a box — its two ⚠ lines become provenance under the fields they
// describe in WHAT."  The container is deleted with this commit (#262
// closes by deletion); what is left is the SENTENCES and the mapping
// that says which field each one is about.  A note that a value was
// clamped, snapped or not applied is a fact about that value, and rule
// 137 already gives every value a line to say such things on.
//
// Authority: validation-artifacts/committed/issue-289-band-stack/rulings.md
// · #281 Part 1 §8.16 (the setup panel dissolves into the band stack).
//
// #198 BYTE-IDENTITY.  Every sentence below is `GeneratorSidebar.tsx`'s,
// copied character for character, and each still renders as ONE text node
// inside the `.sys-event.warn` container — which is the whole contract:
// "the sentences are the #198 byte-identity strings, kept as single text
// nodes."  The container moved; the strings did not.  A diff of this file
// against the sidebar's :982-1056 should show only the export keywords and
// the import block.
//
// What moved WITH them and is not re-derived here: `handoffEventIsCurrent`
// (lib/scenarios/handoff-summary.ts) still decides which notes still
// describe the current scenario, and `scenarioNoun` / `scenarioTa` still
// supply the shared cap phrasing.

import type { Scenario } from "@/lib/scenarios";
import type { RoadType } from "@/lib/scenarios";
import { MAX_LANES_PER_DIRECTION } from "@/lib/scenarios/validation";
import {
  type HandoffEvent,
  handoffEventIsCurrent,
  scenarioNoun,
  scenarioTa,
} from "@/lib/scenarios/handoff-summary";

const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  rural_undivided: "Rural — undivided",
  rural_divided: "Rural — divided",
  urban_arterial: "Urban arterial",
  freeway: "Freeway / interstate",
};

export function handoffNoteText(
  event: HandoffEvent,
  kind: Scenario["kind"],
): string {
  // Discriminated on field first: "applied" and "clamped" are shared
  // across fields since #198 extended the union.
  switch (event.field) {
    case "speed":
      switch (event.kind) {
        case "clamped": {
          const srcLabel = event.source === "osm" ? "OSM detection" : "manual entry";
          return `Speed ${event.toMph} mph (clamped from ${event.fromMph} mph ${srcLabel} — ${scenarioNoun(kind)} plans cap at ${event.toMph} mph per ${scenarioTa(kind)}).`;
        }
        case "snapped": {
          const srcLabel = event.source === "osm" ? "OSM detection" : "manual entry";
          return `Speed ${event.toMph} mph (snapped from ${event.fromMph} mph ${srcLabel} to the 5-mph grid).`;
        }
        case "accepted_low_confidence":
          return `Speed ${event.valueMph} mph — accepted low-confidence fallback (${event.sourceLabel}).`;
        case "skipped_low_confidence":
          return `Speed fallback ${event.detectedMph} mph not applied — plan uses ${event.inEffectMph} mph (${event.sourceLabel}). Accept it in the picker to use it.`;
      }
      break;
    case "roadType": {
      if (event.kind === "applied") {
        const srcLabel = event.source === "osm" ? "OSM detection" : "manual entry";
        return `Road type set to ${ROAD_TYPE_LABELS[event.to]} (from detected ${ROAD_TYPE_LABELS[event.from]}, ${srcLabel}).`;
      }
      return `Detected ${ROAD_TYPE_LABELS[event.detected]} not valid for ${scenarioNoun(kind)} plans — kept ${ROAD_TYPE_LABELS[event.inEffect]}. Switch scenario kind to use it.`;
    }
    // #198 families 1-3: lanes / divided / laneWidth cross the seam.
    case "lanes": {
      if (event.kind === "clamped") {
        const srcLabel = event.source === "osm" ? "OSM detection" : "manual entry";
        return `Lanes ${event.to}/direction (clamped from ${event.from} ${srcLabel} — plans draw at most ${MAX_LANES_PER_DIRECTION} lanes per direction).`;
      }
      if (event.kind === "applied") {
        const srcLabel = event.source === "osm" ? "OSM detection" : "manual entry";
        return `Lanes set to ${event.to}/direction (${srcLabel} — was ${event.from}).`;
      }
      return `Lanes setting ${event.value}/direction from the picker not applied — ${scenarioNoun(kind)} plans don't take a lane count.`;
    }
    case "divided": {
      if (event.kind === "applied") {
        const srcLabel = event.source === "osm" ? "OSM detection" : "manual entry";
        return `Road set to ${event.to ? "divided" : "undivided"} (${srcLabel} — was ${event.from ? "divided" : "undivided"}).`;
      }
      return `Divided setting from the picker not applied — ${scenarioNoun(kind)} plans don't take a divided toggle.`;
    }
    case "laneWidth":
      return `Lane width set to ${event.toFt} ft (OSM detection — was ${event.fromFt} ft).`;
    // #198 family 4: the reduction cleared by a lowered posted speed.
    case "workZoneSpeed":
      return `Work-zone speed reduction removed (was ${event.wasMph} mph — the posted speed is now ${event.postedMph} mph, at or below it).`;
  }
  // Exhaustive above; TS needs the terminator for the nested switch.
  return "";
}

/** The WHAT cell each handoff note is about — the cell's own `testid`,
 *  so the mapping and the grid cannot drift apart silently.
 *
 *  `divided` and `workZoneSpeed` have no cell of their own in the 3 × 2
 *  grid: divided is a consequence of road type everywhere but
 *  urban_arterial (#85, single-sourced), and the work-zone reduction is
 *  a consequence of the posted speed (#198 family 4 — the note exists
 *  because a lowered posted speed dragged the reduction with it).  Each
 *  note therefore lands on the cell whose value CAUSED it, which is the
 *  cell the operator would change to undo it. */
const NOTE_CELL: Record<HandoffEvent["field"], string> = {
  speed: "speed",
  workZoneSpeed: "speed",
  roadType: "road-type",
  divided: "road-type",
  lanes: "lanes",
  laneWidth: "lane-width",
};

/**
 * The notes that still describe the current scenario, grouped by the
 * cell they belong under.
 *
 * `handoffEventIsCurrent` is unchanged and still the filter: a manual
 * speed edit after the handoff hides its now-stale clamp note, so a cell
 * never carries a line about a value it no longer holds (rule 10).
 */
export function handoffNotesByCell(
  scenario: Scenario,
  handoff: HandoffEvent[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of handoff) {
    if (!handoffEventIsCurrent(e, scenario)) continue;
    const cell = NOTE_CELL[e.field];
    (out[cell] ??= []).push(handoffNoteText(e, scenario.kind));
  }
  return out;
}
