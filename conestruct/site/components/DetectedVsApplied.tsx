"use client";

// #227 surface 7 — the detected-vs-applied reference block (closes
// #214).  Detection source, detected value, and applied value are
// three facts of the same kind, previously scattered as annotations;
// here they answer the inspector's question in one place, at the top
// of the Road step.
//
// Data is entirely client-side: ``meta.confirmedRoad`` carries the
// picked candidate (way, name, bearing, tags) and the classification
// synthesized at confirm time; applied values are the scenario fields
// the operator can still edit below.  No wire change.
//
// Rule 10 throughout: the block renders ONLY when a confirmed road
// exists at the CURRENT pin (the pinLat/pinLng staleness key — a stale
// road never speaks, the #149 failure class); a fact OSM never
// reported renders no row; the no-road/manual path keeps today's
// surfaces untouched (#214 acceptance: manual-path behavior
// byte-identical).
//
// The #214 close lives in the bearing row's provenance line: with road
// geometry on file the drawing follows the geometry's own bearings and
// the typed value is consumed sign-only (centerline.ts ±90° test), so
// the block SAYS so — before the user types anything.

import type { Scenario } from "@/lib/scenarios";
import type { RoadType } from "@/lib/scenarios";

const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  rural_undivided: "Rural — undivided",
  rural_divided: "Rural — divided",
  urban_arterial: "Urban arterial",
  freeway: "Freeway / interstate",
};

interface Row {
  label: string;
  detected: string;
  applied: string;
  /**
   * The DETECTED cell's provenance token.  Either #274's method (`OSM ·
   * measured` / `OSM · inferred`) or #275's `overridden` — never both,
   * and that is structural rather than lucky: only `roadType` and
   * `divided` carry a method, because `classify.ts` hands back plain
   * applied scalars at the top level plus a parallel `fields.*` bag, and
   * top-level `speedLimitMph` / `lanesPerDirection` are measured BY
   * CONSTRUCTION (the class fallback lives only in `fields.speed.value` /
   * `fields.lanes.value` and never reaches the top level).  #275's note
   * belongs to the lanes row, which therefore has no method; bearing
   * comes off the candidate geometry, not the classifier, and has
   * neither.  Undefined means the slot is reserved but silent.
   */
  detectedNote?: string;
  /**
   * The APPLIED cell's own provenance.  Filled centrally below: the
   * applied value inherits the detected token for as long as it IS the
   * detected value, and says `operator-set` the moment it differs.  The
   * comparison is the signal — no new state, and `operator-set` is the
   * picker's existing third token (LocationPickerModal.tsx:2547).
   */
  appliedNote?: string;
}

/**
 * One reserved provenance line, under a value.  It is rendered for EVERY
 * value cell whether or not it has something to say, so a row's height
 * never depends on its content (P1/P6): the token used to appear only when
 * it existed, which made Road type and Divided 34.6 px tall against
 * Bearing and Lanes at 19.2 px.  The slot IS the provenance role, so it
 * declares no size of its own.
 */
function Slot({ note }: { note?: string }) {
  const inferred = note === "OSM · inferred";
  return (
    <span className={`dva-slot tr-prov${inferred ? " is-inferred" : ""}`}>
      {note ?? ""}
    </span>
  );
}

export function DetectedVsApplied({ scenario }: { scenario: Scenario }) {
  const meta = scenario.meta;
  const road = meta.confirmedRoad ?? null;
  const fresh =
    road && road.pinLat === meta.lat && road.pinLng === meta.lng
      ? road
      : null;
  if (!fresh) return null;

  const cand = fresh.candidate;
  const cls = fresh.classification;
  const geomDrives = (cand.geometry?.length ?? 0) > 1;

  const rows: Row[] = [];
  rows.push({
    label: "Bearing",
    detected: `${Math.round(cand.bearing)}°`,
    applied:
      meta.bearingDeg !== undefined ? `${Math.round(meta.bearingDeg)}°` : "—",
  });
  if (cls.speedLimitMph !== undefined && "speed" in scenario) {
    rows.push({
      label: "Speed limit",
      detected: `${cls.speedLimitMph} mph`,
      applied: `${scenario.speed} mph`,
    });
  }
  if (cls.lanesPerDirection !== undefined && "lanes" in scenario) {
    // #275.  Note this cell reads `cls.lanesPerDirection` — the halved,
    // floored per-direction figure — while the backend gates read the
    // `detectedLanesTotal` RELAY, the raw `lanes` tag.  Two numbers, two
    // derivations (classify.ts:78-90): on a `lanes=4` two-way road the
    // relay is 4 and this cell is 2.
    //
    // The relay is cleared when the operator takes ownership of the count.
    // Detect that POSITIVELY — detection reported a total and the
    // scenario's copy is gone — never from the scenario's absence alone: a
    // way tagged `lanes:forward` with no `lanes` has no relay and no edit,
    // and must not read as withdrawn.
    const relayCleared =
      cls.detectedLanesTotal !== undefined &&
      (scenario as { detectedLanesTotal?: number }).detectedLanesTotal ===
        undefined;
    // Disputed erasures record a marker carrying the lane relays (#177);
    // ordinary ones record nothing (#112).  Only a marker that actually
    // carries a LANE relay speaks for this row — a one-way confirm's
    // marker is about a different fact.
    const laneOverride = (scenario.detectionOverrides ?? []).some(
      (o) =>
        o.detectedLanesTotal !== undefined ||
        o.detectedLanesForward !== undefined ||
        o.detectedLanesBackward !== undefined ||
        o.detectedLanesBothWays !== undefined,
    );
    // Disputed → the marker rides the wire and the audit reprints the
    // numbers, so the detection is a fact the operator OVERRODE: show it,
    // marked.  Undisputed → no relay, no marker, no audit item, nothing
    // anywhere: the detection is WITHDRAWN and the cell says so rather
    // than presenting a cleared relay's value as current (Rule 10).  Never
    // a blank either way.
    const withdrawn = relayCleared && !laneOverride;
    rows.push({
      label: "Lanes per direction",
      detected: withdrawn ? "withdrawn" : String(cls.lanesPerDirection),
      applied: String((scenario as { lanes: number }).lanes),
      // Withdrawn puts the word in the VALUE, so the slot stays silent —
      // the applied cell's `operator-set` already says who set the count.
      detectedNote: !withdrawn && relayCleared ? "overridden" : undefined,
    });
  }
  if ("roadType" in scenario) {
    rows.push({
      label: "Road type",
      detected: ROAD_TYPE_LABELS[cls.roadType],
      applied: ROAD_TYPE_LABELS[(scenario as { roadType: RoadType }).roadType],
      detectedNote: cls.fields?.roadType.method
        ? `OSM · ${cls.fields.roadType.method}`
        : undefined,
    });
  }
  if ("divided" in scenario) {
    rows.push({
      label: "Divided",
      detected: cls.divided ? "Divided" : "Undivided",
      applied: (scenario as { divided: boolean }).divided
        ? "Divided"
        : "Undivided",
      detectedNote: cls.fields?.divided.method
        ? `OSM · ${cls.fields.divided.method}`
        : undefined,
    });
  }

  // The applied cell states where ITS OWN value came from.  While it still
  // shows the detected value it IS the detection's value, so it inherits
  // the detection's provenance — an inferred road type auto-applied to the
  // plan is just as inferred in the column that matters.  The moment it
  // differs, the operator (or a clamp) set it, and it says so with the
  // picker's own third token.  The comparison is the whole signal: no new
  // state, and a value equal to detection is detection's value however it
  // got there.
  for (const r of rows) {
    r.appliedNote = r.detected === r.applied ? r.detectedNote : "operator-set";
  }

  const roadName = cand.name ?? cand.ref ?? `way ${cand.way_id}`;

  return (
    <div className="dva">
      <div className="tr-section mb-1">Detected vs applied</div>
      <div className="tr-prov mb-1.5">
        OSM detection · {roadName} · way {cand.way_id} ·{" "}
        {fresh.method === "auto_single"
          ? "sole match auto-adopted"
          : "operator pick"}
      </div>
      <div className="dva-grid">
        {/* #273: the headers live in a row wrapper like every value row, so
            they re-flow with them when the block stacks (the corner cell is
            addressable because it is hidden in the stacked layout). */}
        <div className="contents dva-head">
          <span className="dva-corner" />
          <span className="tr-step">Detected</span>
          <span className="tr-step">Applied</span>
        </div>
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <span className="tr-field">{r.label}</span>
            {/* #273: one declared value register for both columns; the ink
                is the only axis between them, so the emphasis says "this is
                what the plan used" and nothing else. */}
            {/* One reserved slot per value cell — #274's method, #275's
                `overridden`, and the applied cell's `operator-set` are one
                mechanism and wear one treatment. */}
            <span className="dva-val is-detected">
              {r.detected}
              <Slot note={r.detectedNote} />
            </span>
            <span className="dva-val is-applied">
              {r.applied}
              <Slot note={r.appliedNote} />
            </span>
          </div>
        ))}
      </div>
      {/* #214: the bearing field's actual role, disclosed before the
          user types.  Both sentences are facts of the current state —
          which input wins is never left unsaid. */}
      <div className="tr-prov mt-1.5">
        {geomDrives
          ? "road geometry governs the drawing — the typed bearing sets the travel-direction sign only"
          : "no road geometry on file — the typed bearing drives the drawing"}
      </div>
    </div>
  );
}
