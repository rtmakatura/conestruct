"use client";

// #227 surface 7 — the detected-vs-applied reference block (closes
// #214).  Detection source, detected value, and applied value are three
// facts of the same kind, previously scattered as annotations; here they
// answer the inspector's question in one place, at the top of the Road
// step.
//
// Data is entirely client-side: ``meta.confirmedRoad`` carries the
// picked candidate (way, name, bearing, tags) and the classification
// synthesized at confirm time; applied values are the scenario fields
// the operator can still edit below.  No wire change.
//
// Rule 10 throughout: the block renders ONLY when a confirmed road
// exists at the CURRENT pin (the pinLat/pinLng staleness key — a stale
// road never speaks, the #149 failure class); a fact OSM never reported
// renders no row; the no-road/manual path keeps today's surfaces
// untouched (#214 acceptance: manual-path behavior byte-identical).
//
// The #214 close lives in the caveat line: with road geometry on file
// the drawing follows the geometry's own bearings and the typed value is
// consumed sign-only (centerline.ts ±90° test), so the block SAYS so —
// before the user types anything.
//
// ─── s2-arc30: the applied-forward ledger ───
//
// The two-column table is gone.  It satisfied every measured acceptance
// #273 round 2 set — ink-right delta 0 px, equal value tracks, constant
// row height — and still read as a wall of small text, because the one
// question the block exists to answer (do detected and applied agree?)
// had to be worked out by comparing two strings.
//
// A row now states the APPLIED value — what the plan used — on line 1,
// with a verdict glyph in a 16 px gutter and one generated provenance
// clause on line 2 that always names the detected value and its tokens.
// The glyph column is what makes agreement scannable: every glyph sits
// on one vertical axis, so a column of ✓ reads as a column and any ⚠
// breaks it.
//
// What the two columns landed is kept, in clause words rather than in
// cells: #274's method (measured / inferred), #275's overridden and
// withdrawn, and the applied cell's own provenance.  What retires with
// the old shape is its geometry — the fixed 132 px value tracks, the
// header hairline, the ink-right equality acceptance.  #273's OUTCOME
// survives: the applied values still share one right edge, obtained now
// because every row body spans the full width rather than because a
// track was pinned (measured spread 0.0 px across rows, both viewports).

import type { Scenario } from "@/lib/scenarios";
import type { RoadType } from "@/lib/scenarios";
import { snapSpeedToDomain } from "@/lib/scenarios";
import { clampLanesToDomain } from "@/lib/scenarios/validation";
import {
  type AppliedToken,
  type DetectedToken,
  appliedTokenFor,
  provenanceClause,
  valuesAgree,
} from "@/lib/road-detection/provenance";

const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  rural_undivided: "Rural — undivided",
  rural_divided: "Rural — divided",
  urban_arterial: "Urban arterial",
  freeway: "Freeway / interstate",
};

/**
 * A row's verdict.
 *
 * `match` / `differ` are the spec's two states.  `unset` is the third
 * the house vocabulary already had and the spec did not: the plan has
 * not taken a value for this fact yet, which is neither agreement nor
 * disagreement.  `◌` is the glyph for exactly that ("unevaluated / not
 * set / pending — never a verdict", DESIGN-SPACING) and Rule 10 says
 * the absence is rendered as an absence rather than dressed as one of
 * the two verdicts.
 */
type Verdict = "match" | "differ" | "unset";

const GLYPH: Record<Verdict, string> = {
  match: "✓",
  differ: "⚠",
  unset: "◌",
};

interface Row {
  label: string;
  /** Line 1 — what the plan used.  `null` when the plan has no value. */
  applied: string | null;
  /** The clause's detected value; `null` means the detection was withdrawn. */
  detected: string | null;
  detectedToken?: DetectedToken;
  appliedToken?: AppliedToken;
  verdict: Verdict;
}

/**
 * Does the clause wear amber?
 *
 * Spec 5.4's honesty rule, widened to every verdict: "the plan used what
 * was detected" and "what was detected was a guess" are two different
 * facts, so a matching row whose detection was inferred renders a GREEN
 * glyph above an AMBER clause.  That pairing looks wrong to anyone who
 * does not know why, which is exactly why it is written down: green
 * means the plan used what was detected.  It never means measured.
 *
 * Contrast measured on this block's own background (prod b2a325a):
 * --warn 8.82:1, --pass 8.1:1.  Both well over the 4.5 floor, so nobody
 * needs to "fix" the pairing by dimming one of them.
 */
function clauseIsAmber(r: Row): boolean {
  return (
    r.detected === null ||
    r.detectedToken === "inferred" ||
    r.detectedToken === "overridden"
  );
}

function LedgerRow({ row }: { row: Row }) {
  const amber = clauseIsAmber(row);
  // Family, not weight, marks an operator-set value.  `memory.md`
  // records "weight is not an axis" for the type roles and the PDF's own
  // axis list excludes it; the design asked for sans 600, and the family
  // switch alone already carries the fact — with the glyph and the
  // clause's own word saying it twice more.
  const operatorSet = row.appliedToken === "operator-set";
  return (
    <div className="dva-row">
      {/* The house glyph vocabulary, unchanged: ✓ --pass "confirmed",
          ⚠ --warn "changed / needs attention", ◌ --none "not set".  The
          design asked for ▲ in #f4c020, but ▲ is the delta glyph in
          --dim (#ff8a2e, orange) here, and the spec's own rule 0.12
          forbids orange in this block — so the spec's constraint rules
          out the spec's glyph.  ⚠ carries the meaning the design wanted
          and already owns the colour it asked for.  aria-hidden because
          the words beside it say the same thing (the house idiom —
          ScheduleField.tsx:256). */}
      <span className={`dva-glyph is-${row.verdict}`} aria-hidden>
        {GLYPH[row.verdict]}
      </span>
      <div className="dva-body">
        <div className="dva-line1">
          <span className="tr-field">{row.label}</span>
          {/* margin-left:auto, not space-between, holds the right edge:
              with space-between a value that wraps to its own line
              becomes the only item on that line and lands at flex-START
              — measured 72.8 to 122.4 px off the axis on the six
              label × value pairs that wrap at 380.  The auto margin puts
              every one of them back at 0.0 px. */}
          <span className={`dva-val${operatorSet ? " is-operator" : ""}`}>
            {row.applied ?? "—"}
          </span>
        </div>
        {/* The clause slot is RESERVED — one line at/above 520 px, two
            below — so a row's height is a property of the viewport and
            never of its own content.  The clause itself is one text
            node: the design asked for emphasised fragments inside it,
            which would split the string across spans and break both the
            direct-text-node test idiom and any grep for the sentence.
            Flagged for ruling; the fact is carried by the words. */}
        <div className="dva-clause">
          <span className={`tr-prov${amber ? " is-amber" : ""}`}>
            {provenanceClause({
              detectedValue: row.detected,
              detectedToken: row.detectedToken,
              appliedToken: row.appliedToken,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DetectedVsApplied({ scenario }: { scenario: Scenario }) {
  const meta = scenario.meta;
  const road = meta.confirmedRoad ?? null;
  const fresh =
    road && road.pinLat === meta.lat && road.pinLng === meta.lng ? road : null;
  if (!fresh) return null;

  const cand = fresh.candidate;
  const cls = fresh.classification;
  const geomDrives = (cand.geometry?.length ?? 0) > 1;

  /** One row, with the verdict derived rather than asserted. */
  const mkRow = (o: {
    label: string;
    appliedValue: number | string | boolean | undefined;
    appliedDisplay: string | null;
    detectedValue: number | string | boolean | undefined;
    detectedDisplay: string | null;
    detectedToken?: DetectedToken;
    /** True when the difference is exactly what auto-apply's domain
     *  snap would produce — the system's rounding, not an operator. */
    isDomainSnap?: boolean;
  }): Row => {
    // Rule 10: no applied value is "not set", never a verdict.
    if (o.appliedValue === undefined || o.appliedDisplay === null) {
      return {
        label: o.label,
        applied: null,
        detected: o.detectedDisplay,
        detectedToken: o.detectedToken,
        verdict: "unset",
      };
    }
    // Compared as MODEL values, never as the strings on screen: both
    // sides are raw here (numbers, enums, booleans), so the spec's own
    // "30" vs "30 mph" defect cannot arise (#273 conflict 7).
    const agrees = valuesAgree(o.detectedValue, o.appliedValue);
    return {
      label: o.label,
      applied: o.appliedDisplay,
      detected: o.detectedDisplay,
      detectedToken: o.detectedToken,
      appliedToken: appliedTokenFor({
        differs: !agrees,
        isDomainSnap: o.isDomainSnap ?? false,
      }),
      verdict: agrees ? "match" : "differ",
    };
  };

  const rows: Row[] = [];
  rows.push(
    mkRow({
      label: "Bearing",
      appliedValue: meta.bearingDeg,
      appliedDisplay:
        meta.bearingDeg !== undefined
          ? `${Math.round(meta.bearingDeg)}°`
          : null,
      detectedValue: cand.bearing,
      detectedDisplay: `${Math.round(cand.bearing)}°`,
    }),
  );

  if (cls.speedLimitMph !== undefined && "speed" in scenario) {
    const detected = cls.speedLimitMph;
    const applied = scenario.speed;
    rows.push(
      mkRow({
        label: "Speed limit",
        appliedValue: applied,
        appliedDisplay: `${applied} mph`,
        detectedValue: detected,
        detectedDisplay: `${detected} mph`,
        // auto-apply runs the detected speed through the kind's domain
        // (auto-apply.ts:381) before the plan ever sees it, so a plan
        // can differ from detection with nobody having touched
        // anything.  Blaming that on the operator is a Rule 10 defect.
        isDomainSnap: snapSpeedToDomain(scenario.kind, detected) === applied,
      }),
    );
  }

  if (cls.lanesPerDirection !== undefined && "lanes" in scenario) {
    // #275.  Note this cell reads `cls.lanesPerDirection` — the halved,
    // floored per-direction figure — while the backend gates read the
    // `detectedLanesTotal` RELAY, the raw `lanes` tag.  Two numbers, two
    // derivations (classify.ts:78-90): on a `lanes=4` two-way road the
    // relay is 4 and this row is 2.
    //
    // The relay is cleared when the operator takes ownership of the
    // count.  Detect that POSITIVELY — detection reported a total and
    // the scenario's copy is gone — never from the scenario's absence
    // alone: a way tagged `lanes:forward` with no `lanes` has no relay
    // and no edit, and must not read as withdrawn.
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
    // numbers, so the detection is a fact the operator OVERRODE: name
    // it, marked.  Undisputed → no relay, no marker, no audit item,
    // nothing anywhere: the detection is WITHDRAWN, and the clause says
    // so in the value's own position rather than printing a cleared
    // relay's number as though it still stood (ruled 2026-09-11 against
    // spec 4.5's example, which did exactly that).
    const withdrawn = relayCleared && !laneOverride;
    const detected = cls.lanesPerDirection;
    const applied = (scenario as { lanes: number }).lanes;
    rows.push(
      mkRow({
        label: "Lanes per direction",
        appliedValue: applied,
        appliedDisplay: String(applied),
        // A withdrawn detection has no value to compare, so it can
        // never read as agreement: `undefined` makes valuesAgree false
        // by construction.
        detectedValue: withdrawn ? undefined : detected,
        detectedDisplay: withdrawn ? null : String(detected),
        detectedToken: !withdrawn && relayCleared ? "overridden" : undefined,
        isDomainSnap: !withdrawn && clampLanesToDomain(detected) === applied,
      }),
    );
  }

  if ("roadType" in scenario) {
    const detected = cls.roadType;
    const applied = (scenario as { roadType: RoadType }).roadType;
    rows.push(
      mkRow({
        label: "Road type",
        appliedValue: applied,
        appliedDisplay: ROAD_TYPE_LABELS[applied],
        detectedValue: detected,
        detectedDisplay: ROAD_TYPE_LABELS[detected],
        detectedToken: cls.fields?.roadType.method,
        // Known residue: auto-apply keeps the scenario's own type when
        // the detected one is not in the kind's set (auto-apply.ts:515,
        // :524) — a narrowing, not an operator edit — but it exposes no
        // predicate to ask that with, so such a row still reads
        // operator-set.  Declared rather than guessed at.
      }),
    );
  }

  if ("divided" in scenario) {
    const detected = cls.divided;
    const applied = (scenario as { divided: boolean }).divided;
    rows.push(
      mkRow({
        label: "Divided",
        appliedValue: applied,
        appliedDisplay: applied ? "Divided" : "Undivided",
        detectedValue: detected,
        detectedDisplay: detected ? "Divided" : "Undivided",
        detectedToken: cls.fields?.divided.method,
      }),
    );
  }

  // Spec 6.6: zero rows renders NOTHING — not the header, not the
  // caveat.  Unreachable today (Bearing always renders beside a fresh
  // road), and written anyway so the rule is structural rather than
  // incidental on the day a kind carries none of these facts.
  if (rows.length === 0) return null;

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
      <div className="dva-list">
        {rows.map((r) => (
          <LedgerRow key={r.label} row={r} />
        ))}
      </div>
      {/* #214: the bearing field's actual role, disclosed before the
          user types.  Both sentences are facts of the current state —
          which input wins is never left unsaid.  Byte-identical across
          the rebuild. */}
      <div className="dva-caveat tr-prov">
        {geomDrives
          ? "road geometry governs the drawing — the typed bearing sets the travel-direction sign only"
          : "no road geometry on file — the typed bearing drives the drawing"}
      </div>
    </div>
  );
}
