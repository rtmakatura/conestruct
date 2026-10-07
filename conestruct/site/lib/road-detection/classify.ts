import type { RoadType } from "../scenarios";
import {
  carriagewayApplies,
  carriagewayVerdict,
  TWIN_RADIUS_M,
  type CarriagewayFacts,
  type TwinEvidence,
} from "./carriageway";
import type { StreetClass } from "../jurisdiction";
import type {
  Confidence,
  DetectedField,
  RoadCandidate,
  RoadClassification,
} from "./types";

// Highway-class → fallback posted speed (mph).  Used only when OSM
// has no `maxspeed` tag; the result is always reported as low
// confidence so the operator sees the warning and verifies.  Ported
// verbatim from the previous lib/road-classify.ts so the values seen
// on sparsely-tagged OSM ways stay identical to today.
const SPEED_BY_CLASS: Record<string, number> = {
  motorway: 65,
  motorway_link: 45,
  trunk: 55,
  trunk_link: 45,
  primary: 45,
  primary_link: 35,
  secondary: 40,
  secondary_link: 30,
  tertiary: 35,
  tertiary_link: 30,
  unclassified: 30,
  residential: 25,
};

const LANES_BY_CLASS: Record<string, number> = {
  motorway: 2,
  motorway_link: 1,
  trunk: 2,
  trunk_link: 1,
  primary: 2,
  primary_link: 1,
  secondary: 1,
  secondary_link: 1,
  tertiary: 1,
  tertiary_link: 1,
  unclassified: 1,
  residential: 1,
};

// Parse OSM `maxspeed` tag to mph.  Bare number = mph (US convention,
// even though OSM's global default is km/h — overwhelmingly the case
// for US tags).  Explicit `km/h`/`kmh`/`kph` suffix converts.  Sentinel
// values OSM uses for "no limit" or "varies" return null.
export function parseMaxspeedToMph(raw: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "none" || trimmed === "signals" || trimmed === "variable") {
    return null;
  }
  const m = trimmed.match(/^(\d+(?:\.\d+)?)\s*(mph|kmh|km\/h|kph)?$/);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = m[2];
  if (unit === "kmh" || unit === "km/h" || unit === "kph") {
    return Math.round(value * 0.621371);
  }
  return Math.round(value);
}

export function parseLaneNumber(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

// Derive lanes-per-direction from OSM tags.  `lanes:forward` wins when
// explicitly set.  Otherwise `lanes` is the total and we halve unless
// the road is one-way (each carriageway of a divided road is its own
// one-way way already tagged `lanes` = lanes-per-direction).  Floor on
// the halving handles the rare 3-lane (centre turn lane) case more
// conservatively than ceil.
export function lanesPerDirectionFromTags(tags: {
  lanes: string | null;
  lanes_forward: string | null;
  oneway: string | null;
}): number | undefined {
  const fwd = parseLaneNumber(tags.lanes_forward);
  if (fwd !== null) return fwd;
  const total = parseLaneNumber(tags.lanes);
  if (total === null) return undefined;
  const isOneway = tags.oneway === "yes" || tags.oneway === "-1";
  if (isOneway) return total;
  return Math.max(1, Math.floor(total / 2));
}

// Tag → roadType + divided + confidence.  This is the rule table that
// previously lived inside `classify()` in lib/road-classify.ts; it now
// operates on OSM tags directly instead of Mapbox `class`+`oneway`+
// `place_label` (the inputs are equivalent — Mapbox streets-v8 uses
// OSM's highway-class vocabulary).
function roadTypeAndDivided(
  highwayClass: string,
  oneway: boolean,
  isUrban: boolean,
): {
  roadType: RoadType;
  divided: boolean;
  topLevelConf: Confidence;
  // #123: true ONLY on the branch where the oneway tag itself drove
  // divided — since #308, a one-way primary_link (a ramp or slip lane,
  // outside the twin rule).  The rationale string keys on this instead of
  // re-deriving the branch: a trunk's divided: true comes from its class
  // regardless of oneway, and a street-class one-way is decided by the
  // twin rule (lib/road-detection/carriageway.ts), not by this table.
  dividedFromOneway: boolean;
} {
  const cls = highwayClass;
  if (cls === "motorway" || cls === "motorway_link") {
    return {
      roadType: "freeway",
      divided: true,
      topLevelConf: "high",
      dividedFromOneway: false,
    };
  }
  if (cls === "trunk" || cls === "trunk_link") {
    return {
      roadType: isUrban ? "urban_arterial" : "rural_divided",
      divided: true,
      topLevelConf: "medium",
      dividedFromOneway: false,
    };
  }
  if (cls === "primary" || cls === "primary_link") {
    // #308: only the link keeps the oneway → divided reading (a ramp is
    // not a one-way street; Note 8 names multi-lane ramps on their own).
    // A one-way primary street is decided by the twin rule in
    // classifyFromOsmTags, from the two-way row below.
    if (oneway && cls === "primary_link") {
      return {
        roadType: isUrban ? "urban_arterial" : "rural_divided",
        divided: true,
        topLevelConf: "medium",
        dividedFromOneway: true,
      };
    }
    return {
      roadType: isUrban ? "urban_arterial" : "rural_undivided",
      divided: false,
      topLevelConf: "medium",
      dividedFromOneway: false,
    };
  }
  if (cls === "secondary" || cls === "secondary_link") {
    return {
      roadType: isUrban ? "urban_arterial" : "rural_undivided",
      divided: false,
      topLevelConf: "medium",
      dividedFromOneway: false,
    };
  }
  if (
    cls === "tertiary" ||
    cls === "tertiary_link" ||
    cls === "unclassified"
  ) {
    return {
      roadType: isUrban ? "urban_arterial" : "rural_undivided",
      divided: false,
      topLevelConf: "low",
      dividedFromOneway: false,
    };
  }
  return {
    roadType: isUrban ? "urban_arterial" : "rural_undivided",
    divided: false,
    topLevelConf: "low",
    dividedFromOneway: false,
  };
}

export interface ClassifyInput {
  highwayClass: string;
  name: string | null;
  ref: string | null;
  tags: {
    oneway: string | null;
    maxspeed: string | null;
    lanes: string | null;
    lanes_forward: string | null;
    lanes_backward: string | null;
    lanes_both_ways: string | null;
  };
  /** Meters to the nearest detected traffic-signal node (issue #173);
   *  undefined when the route reported none. */
  signalDistanceM?: number;
  /** #308 — the candidate's twin evidence (one-way candidates only);
   *  undefined = no evidence, which a street-class one-way reads as an
   *  undecided carriageway. */
  twin?: TwinEvidence;
}

// Pure: tags + place context → full RoadClassification.  Used both by
// the unified detection at candidate-pick time and by the route handler
// for the auto-picked single-candidate case.  Output shape is identical
// to what the previous Mapbox-tilequery path produced, so downstream
// consumers (applyClassification, DetectedRows) work unchanged.
export function classifyFromOsmTags(
  input: ClassifyInput,
  isUrban: boolean,
  placeName: string | null,
): RoadClassification {
  const { highwayClass, name, ref, tags } = input;
  const oneway = tags.oneway === "yes" || tags.oneway === "-1";

  const classRow = roadTypeAndDivided(highwayClass, oneway, isUrban);
  const { topLevelConf, dividedFromOneway } = classRow;
  let { roadType, divided } = classRow;

  // #308: a street-class one-way is a one-way street or one side of a
  // divided road, decided by its same-name twin (the mirror of the
  // backend's predicate; R83).  The raw facts ride the scenario so the
  // backend decides for itself.
  const carriageway: CarriagewayFacts | undefined = carriagewayApplies(tags.oneway, highwayClass)
    ? {
        oneway: tags.oneway,
        highwayClass,
        twinDistanceM: input.twin?.distanceM ?? null,
        twinSearched: input.twin?.searched ?? false,
      }
    : undefined;
  const verdict = carriagewayVerdict(carriageway);
  if (carriageway) {
    divided = verdict === "divided";
    if (!isUrban) roadType = divided ? "rural_divided" : "rural_undivided";
  }

  const speedFromOsm = parseMaxspeedToMph(tags.maxspeed);
  const lanesFromOsm = lanesPerDirectionFromTags(tags);
  const speedFallback = SPEED_BY_CLASS[highwayClass] ?? null;
  const lanesFallback = LANES_BY_CLASS[highwayClass] ?? null;

  const fieldRoadTypeConf: Confidence =
    highwayClass === "motorway" || highwayClass === "motorway_link"
      ? "high"
      : highwayClass === "trunk" ||
          highwayClass === "trunk_link" ||
          highwayClass.startsWith("primary")
        ? "medium"
        : "low";

  const fieldDividedConf: Confidence =
    highwayClass === "motorway" || highwayClass === "motorway_link"
      ? "high"
      : highwayClass === "trunk" ||
          highwayClass === "trunk_link" ||
          (highwayClass === "primary_link" && oneway) ||
          verdict === "divided" ||
          verdict === "one_way_street"
        ? "medium"
        : "low";

  let speed: DetectedField<number | null>;
  if (tags.maxspeed !== null && speedFromOsm !== null) {
    speed = {
      value: speedFromOsm,
      confidence: "high",
      source: "OSM maxspeed tag",
      // The value is the posted speed read straight off the tag.
      method: "measured",
      rawData: `maxspeed=${tags.maxspeed}`,
    };
  } else if (tags.maxspeed !== null) {
    speed = {
      value: speedFallback,
      confidence: "medium",
      source: "OSM maxspeed tag (un-parseable)",
      // A tag exists but couldn't be read — the value shown is the
      // class fallback, so it is inferred, not measured.
      method: "inferred",
      rawData: `maxspeed=${tags.maxspeed}`,
    };
  } else {
    speed = {
      value: speedFallback,
      confidence: "low",
      source:
        speedFallback !== null
          ? `highway-class fallback ("${highwayClass}")`
          : "no fallback for this class",
      method: "inferred",
      rawData: speedFallback !== null ? `class=${highwayClass}` : undefined,
    };
  }

  let lanes: DetectedField<number | null>;
  // The evidence for the lanes field is either tag; raw.osmLanesTag is
  // the `lanes` tag ONLY (issue #178 — printing a lanes:forward value
  // under a `lanes=` label misread the directional tag as a total).
  const lanesEvidenceTag = tags.lanes ?? tags.lanes_forward ?? null;
  if (lanesEvidenceTag !== null && lanesFromOsm !== undefined) {
    const splitExplicit =
      tags.lanes_forward !== null ||
      lanesEvidenceTag !== String(lanesFromOsm * 2);
    lanes = {
      value: lanesFromOsm,
      confidence: splitExplicit ? "high" : "medium",
      source: splitExplicit
        ? "OSM lanes:forward tag"
        : "OSM lanes tag (no directional split)",
      // Read from a real lanes tag (halved for two-way roads, but still
      // the tagged count) — measured even at medium confidence.
      method: "measured",
      rawData:
        tags.lanes !== null
          ? `lanes=${tags.lanes}`
          : `lanes:forward=${tags.lanes_forward}`,
    };
  } else {
    lanes = {
      value: lanesFallback,
      confidence: "low",
      source:
        lanesFallback !== null
          ? `highway-class fallback ("${highwayClass}")`
          : "no fallback for this class",
      method: "inferred",
      rawData: lanesFallback !== null ? `class=${highwayClass}` : undefined,
    };
  }

  return {
    roadType,
    divided,
    laneWidthFt: 12,
    lanesPerDirection: lanesFromOsm,
    // Raw OSM `lanes` total (issue #136), relayed unchanged for the
    // backend single-lane eligibility gate.  On an undivided road this is
    // the physical lane count for both directions (1 = genuinely
    // single-lane); on a divided carriageway it is per-carriageway and the
    // backend ignores it.  Undefined when OSM carried no `lanes` tag, so a
    // sparsely-tagged way never triggers a false block.
    detectedLanesTotal: parseLaneNumber(tags.lanes) ?? undefined,
    // Raw OSM `oneway` tag (issue #158), relayed unchanged for the backend
    // flagger directionality gate.  Undefined when OSM carried no `oneway`
    // tag, so a sparsely-tagged way never triggers a false block.
    detectedOneway: tags.oneway ?? undefined,
    // Per-direction lane tags (issue #120), relayed unchanged for the
    // backend lane-count consistency check: low confidence only when
    // total, forward, and backward all exist and
    // total != forward + backward + (both_ways or 0).  Any absent tag
    // leaves the check indeterminate — it never fires.
    detectedLanesForward: parseLaneNumber(tags.lanes_forward) ?? undefined,
    detectedLanesBackward: parseLaneNumber(tags.lanes_backward) ?? undefined,
    detectedLanesBothWays: parseLaneNumber(tags.lanes_both_ways) ?? undefined,
    // Meters to the nearest detected traffic-signal node (issue #173),
    // relayed unchanged for the backend's signal-proximity branch of the
    // lane-confidence gate.  Undefined when the route reported no signal,
    // so a signal-free site never trips a false block.
    signalDistanceM: input.signalDistanceM,
    // #308: the raw carriageway facts, street-class one-ways only — the
    // backend decides one-way street vs divided from them.
    ...(carriageway ? { carriageway } : {}),
    speedLimitMph: speedFromOsm ?? undefined,
    confidence: topLevelConf,
    source: "osm-tags",
    raw: {
      class: highwayClass,
      oneway,
      roadName: name,
      roadRef: ref,
      placeName,
      osmLanesTag: tags.lanes,
      osmMaxspeedTag: tags.maxspeed,
      // Issue #178 — the raw evidence behind the #120/#158 relays.
      osmLanesForwardTag: tags.lanes_forward,
      osmLanesBackwardTag: tags.lanes_backward,
      osmLanesBothWaysTag: tags.lanes_both_ways,
      osmOnewayTag: tags.oneway,
    },
    fields: {
      speed,
      lanes,
      roadType: {
        value: roadType,
        confidence: fieldRoadTypeConf,
        source:
          fieldRoadTypeConf === "high"
            ? `OSM class=${highwayClass} (motorway → freeway)`
            : `OSM class=${highwayClass} + ${isUrban ? "urban" : "rural"} (inferred)`,
        // Only the unambiguous motorway → freeway read counts as
        // measured; every other class → type mapping folds in an
        // urban/rural inference.
        method: fieldRoadTypeConf === "high" ? "measured" : "inferred",
        rawData: `class=${highwayClass}, place=${isUrban ? "urban" : "rural"}, oneway=${oneway}`,
      },
      divided: {
        value: divided,
        confidence: fieldDividedConf,
        // #123: the rationale must describe the value that was returned,
        // never a decision that wasn't made.  #308: a street-class
        // one-way names the twin evidence that decided it; only a
        // one-way primary_link still reads divided from the tag.
        source:
          fieldDividedConf === "high"
            ? `OSM class=${highwayClass} (always divided)`
            : verdict === "divided"
              ? `OSM oneway=yes; same-name carriageway ${carriageway?.twinDistanceM} m away → divided`
              : verdict === "one_way_street"
                ? `OSM oneway=yes; no same-name carriageway within ${TWIN_RADIUS_M} m → one-way street`
                : verdict === "undecided"
                  ? `OSM oneway=yes; the same-name search didn't run → confirm one-way street or divided`
                  : dividedFromOneway
                    ? `OSM oneway=yes on a ${highwayClass} (a ramp or slip lane) → divided`
                    : `inferred from class=${highwayClass}`,
        // A motorway is definitively divided; the twin reading or a class
        // guess is an inference.
        method: fieldDividedConf === "high" ? "measured" : "inferred",
        rawData: `class=${highwayClass}, oneway=${oneway}`,
      },
    },
  };
}

// #152 C → R108 / R110 Q1: OSM highway tier → the street class the road
// GUESSES, for the jurisdiction layer (hours verdicts, class-scoped
// deltas).  MIRROR of `src/rules/street_class.py`, which owns it: the
// backend re-derives every guessed class from the relayed tag and refuses
// a stale one, and tests/test_street_class_mirror.py holds the two tables
// equal.  This copy only prefills the field before Generate
// (lib/scenarios/guesses.ts), marked "⚠ from the road"; jurisdictions
// classify streets by their own adopted maps, so the map caveat rides the
// field's details and the audit says the operator did not confirm it.
const STREET_CLASS_BY_HIGHWAY: Record<string, StreetClass> = {
  motorway: "arterial",
  motorway_link: "arterial",
  trunk: "arterial",
  trunk_link: "arterial",
  primary: "arterial",
  primary_link: "arterial",
  secondary: "arterial",
  secondary_link: "arterial",
  tertiary: "collector",
  tertiary_link: "collector",
  unclassified: "local",
  residential: "local",
  living_street: "local",
  service: "local",
};

export function suggestStreetClass(
  highwayClass: string,
): StreetClass | null {
  return STREET_CLASS_BY_HIGHWAY[highwayClass] ?? null;
}

// Convenience: derive a full RoadClassification from a picked
// RoadCandidate.  Used by the modal at candidate-pick time.
export function classifyFromCandidate(
  candidate: RoadCandidate,
  isUrban: boolean,
  placeName: string | null,
): RoadClassification {
  return classifyFromOsmTags(
    {
      highwayClass: candidate.highway_class,
      name: candidate.name,
      ref: candidate.ref,
      tags: candidate.tags,
      signalDistanceM: candidate.signal_distance_m ?? undefined,
      // #308: the route's twin evidence, when it measured one.
      twin:
        candidate.twin_searched === undefined
          ? undefined
          : { distanceM: candidate.twin_distance_m ?? null, searched: candidate.twin_searched },
    },
    isUrban,
    placeName,
  );
}
