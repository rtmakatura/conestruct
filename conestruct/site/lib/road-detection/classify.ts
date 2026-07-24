import type { RoadType } from "../scenarios";
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

function parseLaneNumber(raw: string | null): number | null {
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
): { roadType: RoadType; divided: boolean; topLevelConf: Confidence } {
  const cls = highwayClass;
  if (cls === "motorway" || cls === "motorway_link") {
    return { roadType: "freeway", divided: true, topLevelConf: "high" };
  }
  if (cls === "trunk" || cls === "trunk_link") {
    return {
      roadType: isUrban ? "urban_arterial" : "rural_divided",
      divided: true,
      topLevelConf: "medium",
    };
  }
  if (cls === "primary" || cls === "primary_link") {
    if (oneway) {
      return {
        roadType: isUrban ? "urban_arterial" : "rural_divided",
        divided: true,
        topLevelConf: "medium",
      };
    }
    return {
      roadType: isUrban ? "urban_arterial" : "rural_undivided",
      divided: false,
      topLevelConf: "medium",
    };
  }
  if (cls === "secondary" || cls === "secondary_link") {
    return {
      roadType: isUrban ? "urban_arterial" : "rural_undivided",
      divided: false,
      topLevelConf: "medium",
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
    };
  }
  return {
    roadType: isUrban ? "urban_arterial" : "rural_undivided",
    divided: false,
    topLevelConf: "low",
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
  };
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

  const { roadType, divided, topLevelConf } = roadTypeAndDivided(
    highwayClass,
    oneway,
    isUrban,
  );

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
          (highwayClass.startsWith("primary") && oneway)
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
  const osmLanesTag = tags.lanes ?? tags.lanes_forward ?? null;
  if (osmLanesTag !== null && lanesFromOsm !== undefined) {
    const splitExplicit =
      tags.lanes_forward !== null ||
      osmLanesTag !== String(lanesFromOsm * 2);
    lanes = {
      value: lanesFromOsm,
      confidence: splitExplicit ? "high" : "medium",
      source: splitExplicit
        ? "OSM lanes:forward tag"
        : "OSM lanes tag (no directional split)",
      // Read from a real lanes tag (halved for two-way roads, but still
      // the tagged count) — measured even at medium confidence.
      method: "measured",
      rawData: `lanes=${osmLanesTag}`,
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
    speedLimitMph: speedFromOsm ?? undefined,
    confidence: topLevelConf,
    source: "osm-tags",
    raw: {
      class: highwayClass,
      oneway,
      roadName: name,
      roadRef: ref,
      placeName,
      osmLanesTag,
      osmMaxspeedTag: tags.maxspeed,
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
        source:
          fieldDividedConf === "high"
            ? `OSM class=${highwayClass} (always divided)`
            : oneway
              ? `OSM oneway=yes (couplet → divided)`
              : `inferred from class=${highwayClass}`,
        // A motorway is definitively divided; a couplet or class guess
        // is an inference.
        method: fieldDividedConf === "high" ? "measured" : "inferred",
        rawData: `class=${highwayClass}, oneway=${oneway}`,
      },
    },
  };
}

// #152 C: OSM highway tier → suggested street class for the
// jurisdiction layer (hours verdicts, class-scoped deltas).  The
// mapping follows the FHWA functional-class convention OSM's own wiki
// documents: primary/secondary ≈ arterials, tertiary ≈ collector,
// residential/unclassified ≈ local.  A SUGGESTION only — jurisdictions
// classify streets by their own adopted maps, so this value never
// auto-applies; the UI renders it confirm-only with the
// verify-against-the-map caveat where a classification map exists.
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
    },
    isUrban,
    placeName,
  );
}
