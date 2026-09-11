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
   * #274 — how detection came by the DETECTED value, for the only rows
   * that can present a guess as a fact.  `classify.ts` hands back plain
   * applied scalars at the top level plus a parallel `fields.*` bag that
   * carries this discriminant; top-level `speedLimitMph` and
   * `lanesPerDirection` are measured BY CONSTRUCTION (the class fallback
   * never reaches the top level — it lives only in `fields.speed.value` /
   * `fields.lanes.value`), so when those rows render they rendered from a
   * real OSM tag and want no marker.  `roadType` and `divided` always
   * have a value and may be pure inference, so they carry theirs in both
   * states.  Bearing comes off the candidate geometry, not the
   * classifier, and has no method at all.
   */
  method?: "measured" | "inferred";
  /**
   * #275 — a provenance word for the DETECTED cell that is not a method:
   * "overridden" when the operator superseded a disputed detection (the
   * marker rides the wire and the audit reprints the numbers), or the
   * reason the cell has withdrawn its value.  Rendered in the same
   * provenance role as `method`; the two never both apply to one row.
   */
  note?: string;
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
      note: withdrawn
        ? "operator set the count"
        : relayCleared
          ? "overridden"
          : undefined,
    });
  }
  if ("roadType" in scenario) {
    rows.push({
      label: "Road type",
      detected: ROAD_TYPE_LABELS[cls.roadType],
      applied: ROAD_TYPE_LABELS[(scenario as { roadType: RoadType }).roadType],
      method: cls.fields?.roadType.method,
    });
  }
  if ("divided" in scenario) {
    rows.push({
      label: "Divided",
      detected: cls.divided ? "Divided" : "Undivided",
      applied: (scenario as { divided: boolean }).divided
        ? "Divided"
        : "Undivided",
      method: cls.fields?.divided.method,
    });
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
            <span className="dva-val is-detected">
              {r.detected}
              {/* #274: the picker's own producer and words, so one string
                  describes this fact on both surfaces.  The WORD is the
                  channel (Rule 13 / P9); the amber tone only reinforces
                  it, and it is the picker's existing --warn. */}
              {r.method && (
                <span
                  className={`tr-prov${r.method === "inferred" ? " is-inferred" : ""}`}
                  title={
                    r.method === "inferred"
                      ? "Derived from the road class — OSM did not record this attribute"
                      : "Read from a real OSM tag for this attribute"
                  }
                >
                  OSM · {r.method}
                </span>
              )}
              {/* #275: the same provenance role carries why this cell is
                  marked or has withdrawn its value. */}
              {r.note && (
                <span
                  className="tr-prov"
                  title={
                    r.note === "overridden"
                      ? "Detection reported this and the operator superseded it — the audit reprints both"
                      : "The operator took ownership of this count; detection no longer informs any decision"
                  }
                >
                  {r.note}
                </span>
              )}
            </span>
            <span className="dva-val is-applied">{r.applied}</span>
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
