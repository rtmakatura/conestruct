// R96 A (declutter-three-surfaces) — a WHAT field's provenance line as one
// quiet marker: symbol + word (P9), with the full line one click away.
//
// Authority: validation-artifacts/committed/declutter-three-surfaces/
// rulings.md — R98 ("Rule 137 amended.  A field's provenance line may be
// a symbol-and-word marker with the full line one click away; that counts
// as the provenance line.  A field with neither is still a defect.") and
// R101 (build A as mocked up: mockups/what.html).
//
// The marker READS the line every cell already produces (provenance.ts's
// clause, or the cell's own fixed sentence); it decides nothing new and
// computes no value.  The vocabulary is the fixed one (P9): ✓ settled,
// ⚠ a guess to check, ◌ not set / pending, i about.  A line that needs the
// operator NOW — an error, or a "⚠ needs you" — returns null and stays a
// full line under the field (P3): hiding it behind a click would hide the
// next thing to do.
//
// The OSM clause (provenance.ts) is `OSM · value · method[ · applied]`;
// its last segment is the most recent word about the value, so it names
// the marker.

export interface ProvenanceMarker {
  glyph: "✓" | "⚠" | "◌" | "i";
  word: string;
  tone: "ok" | "guess" | "pending" | "info";
}

const OSM_WORDS: Record<string, { word: string; glyph: ProvenanceMarker["glyph"] }> = {
  measured: { word: "measured", glyph: "✓" },
  // R108 / WhatC5.dc.html: a value inferred off the road is a guess "from
  // the road", the words the street class's guess uses too.
  inferred: { word: "from the road", glyph: "⚠" },
  overridden: { word: "overridden", glyph: "✓" },
  "operator-set": { word: "yours", glyph: "✓" },
  "changed in plan": { word: "changed", glyph: "✓" },
  "no source tag": { word: "no tag", glyph: "◌" },
  withdrawn: { word: "withdrawn", glyph: "◌" },
};

const TONE: Record<ProvenanceMarker["glyph"], ProvenanceMarker["tone"]> = {
  "✓": "ok",
  "⚠": "guess",
  "◌": "pending",
  i: "info",
};

function mk(glyph: ProvenanceMarker["glyph"], word: string): ProvenanceMarker {
  return { glyph, word, tone: TONE[glyph] };
}

export function markerOf(
  line: string,
  opts: { amber?: boolean; error?: boolean } = {},
): ProvenanceMarker | null {
  if (opts.error || line.startsWith("⚠")) return null;
  if (line.startsWith("OSM · ")) {
    const last = line.split(" · ").pop() ?? "";
    const known = OSM_WORDS[last] ?? { word: last, glyph: "✓" as const };
    // Rule 138: amber is the clause's own verdict (clauseIsAmber), so it
    // wins over the token's default glyph.
    return mk(opts.amber ? "⚠" : known.glyph, known.word);
  }
  if (opts.amber) return mk("⚠", line.split(" · ").pop() ?? line);
  if (/^(your change|your answer|operator-set)\b/.test(line)) return mk("✓", "yours");
  // R110 Q7 / Q8: the value the plan started from, until changed.
  if (/^default\b/.test(line)) return mk("✓", "default");
  if (/^(not set|optional)\b/.test(line) || line === "MUTCD + Colorado Supplement only") {
    return mk("◌", "not set");
  }
  if (line.startsWith("evaluating")) return mk("◌", "evaluating");
  // R108: the pin's lookup in flight, for an empty jurisdiction.
  if (line.startsWith("checking")) return mk("◌", "checking");
  if (line.startsWith("evaluated")) return mk("✓", "evaluated");
  if (line.startsWith("detected")) return mk("✓", "detected");
  return mk("i", "about");
}
