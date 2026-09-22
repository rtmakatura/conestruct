"use client";

// #289 Phase 2 — the picker → form handoff notes, moved out of the setup
// panel and into the WHERE band.
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

function HandoffNote({
  event,
  kind,
}: {
  event: HandoffEvent;
  kind: Scenario["kind"];
}) {
  return (
    <div className="flex items-baseline gap-2">
      {/* #227 reconciled vocabulary: the "changed" mark is ⚠ (the
          PDF's ! maps to ⚠); the sentence beside it is the second
          channel (rule 13). */}
      <span className="sys-glyph font-mono" aria-hidden>
        ⚠
      </span>
      <span className="text-[12px] text-[color:var(--ink-on-dark)] leading-snug">
        {handoffNoteText(event, kind)}
      </span>
    </div>
  );
}

/**
 * The container, unchanged from the sidebar's: the #227 system-event
 * shape — amber rule, border, ⚠ glyph, provenance on line 2 — because a
 * value the user did not set is a system event, not a field annotation.
 *
 * Renders nothing when no note still describes the current scenario (a
 * manual speed edit after the handoff hides its now-stale clamp note), so
 * a clean high-confidence handoff grows no empty block.
 */
export function HandoffNotes({
  scenario,
  handoff,
}: {
  scenario: Scenario;
  handoff: HandoffEvent[];
}) {
  const notes = handoff.filter((e) => handoffEventIsCurrent(e, scenario));
  if (notes.length === 0) return null;
  return (
    <div className="sys-event warn">
      <div className="tr-section mb-1.5">Applied from picker</div>
      <div className="flex flex-col gap-1.5">
        {notes.map((e, i) => (
          <HandoffNote key={i} event={e} kind={scenario.kind} />
        ))}
      </div>
      <div className="tr-prov mt-1.5">picker → form handoff</div>
    </div>
  );
}
