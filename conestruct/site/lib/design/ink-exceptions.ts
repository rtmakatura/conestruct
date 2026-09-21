// #263 P11 — the ink-literal declaration (Rule 5: declare, then enforce).
//
// "A new hex without a role is a defect."  Every 6-digit hex literal in
// the frontend sources — app/globals.css outside the :root / .workbench
// token blocks, and code (comments stripped) in components/, lib/ and
// app/ — is one of:
//
//   decorative     illustration or chrome colour with no state meaning
//                  (P9: "decorative colour is exempt and must be
//                  labelled decorative") — the two landing SVGs, the
//                  caution stripe, the ledger's leader dots, Mapbox
//                  label paint (style JSON: var() is impossible there)
//   token mirror   a literal that MUST equal a token — pinned by value
//                  in ink-literals.test.ts, so the token cannot move
//                  without the literal following
//   palette source the ZONE_COLOR table: the zones' one home, consumed
//                  by the live map and the Static Images URL (no CSS
//                  in either); the CSS side reads the same hexes
//   owner swap     a `#fff` inside another bucket's globals.css range,
//                  waiting for that bucket to swap it to --ink-bright
//                  (GO 2026-09-09 cross-bucket ruling 3).  The owner
//                  DELETES the row in the same commit as the swap; a
//                  row that outlives its literal fails the test.
//
// ink-literals.test.ts reads the sources and asserts the observed set
// equals this declaration in both directions.

export interface CssLiteral {
  readonly selector: string;
  readonly hex: string;
  readonly reason: string;
}

export interface OwnerSwap {
  readonly selector: string;
  readonly hex: string;
  readonly owner: string;
}

export interface FileLiterals {
  readonly file: string;
  /** Distinct literals (case as written) and the total occurrence count. */
  readonly hexes: readonly string[];
  readonly count: number;
  readonly disposition: "decorative" | "token mirror" | "palette source" | "third-party theme";
  readonly reason: string;
  /** The marker the file's header comment must carry (decorative files). */
  readonly headerMarker?: string;
}

/** globals.css hexes outside the two token blocks — the declared
 *  decorative set (issue #263 acceptance: "grep … outside :root /
 *  .workbench = the declared decorative set"). */
export const CSS_DECORATIVE: readonly CssLiteral[] = [
  {
    selector: ".workbench .status-bar.caution .indicator",
    hex: "#1a1200",
    reason:
      "the caution stripe's dark band in a repeating-linear-gradient — chrome, no state meaning (the word CAUTION carries the state)",
  },
];

/** `#fff` literals inside other buckets' globals.css ranges.  Not D's
 *  to edit; each owner swaps to var(--ink-bright) and deletes its row. */
export const CSS_OWNER_SWAPS: readonly OwnerSwap[] = [
  // B's `.workbench .zone-title` row: swapped to var(--ink-bright) in #253 commit 7.
  // A's three (#254/#255) swapped to var(--ink-bright) in s2-arc27 (Refs #263): the list is empty.
];

/** Code literals per file (comments stripped, tests excluded). */
export const CODE_LITERALS: readonly FileLiterals[] = [
  {
    file: "components/TaperViz.tsx",
    hexes: [
      "#1B2838",
      "#9A8E7A",
      "#C44A6E",
      "#C45F08",
      "#CFC8BD",
      "#D9D3CA",
      "#E8710A",
      "#F2C9D6",
      "#FAF6F0",
    ],
    count: 18,
    disposition: "decorative",
    reason:
      "the landing page's taper illustration (MathSection.tsx) on the landing paper palette — an SVG picture, not a workbench surface; not the print sheet (that is src/rendering/plan_sheet.py)",
    headerMarker: "DECORATIVE — landing illustration",
  },
  {
    file: "components/PlanSheet.tsx",
    hexes: [
      "#1B2838",
      "#27AE60",
      "#8A95A4",
      "#9A8E7A",
      "#C44A6E",
      "#C45F08",
      "#CFC8BD",
      "#D9D3CA",
      "#E5B83A",
      "#E8710A",
      "#ECE4D9",
      "#F2C94C",
      "#F2C9D6",
      "#FAF6F0",
    ],
    count: 36,
    disposition: "decorative",
    reason:
      "the landing hero's animated plan-sheet illustration (Hero.tsx) on the landing paper palette — an SVG picture, not the print sheet",
    headerMarker: "DECORATIVE — landing illustration",
  },
  {
    file: "components/LocationPickerModal.tsx",
    hexes: ["#000000", "#1EC8A5", "#E8710A", "#ffffff"],
    count: 4,
    disposition: "token mirror",
    reason:
      "PIN_COLOR #E8710A === --dim-deep and CROSS_PIN_COLOR #1EC8A5 === ZONE_COLOR.work_zone (both pinned by value); #ffffff / #000000 are Mapbox zone-label paint inside a style-JSON expression, where var() is impossible — decorative",
  },
  {
    file: "components/GeneratorFormPrimitives.tsx",
    hexes: ["#06222F"],
    count: 2,
    disposition: "token mirror",
    reason:
      "the Generate button's spinner ring: border-[#06222F]/40 + border-t-[#06222F] — Tailwind's /40 alpha needs literal channels; #06222F === --on-act, pinned by value",
  },
  {
    file: "lib/corridor-zones.ts",
    hexes: ["#1EC8A5", "#8A8A8A", "#F3722C", "#FF7A00", "#FFD166"],
    count: 5,
    disposition: "palette source",
    reason:
      "ZONE_COLOR — the corridor zones' one colour home, consumed by the live map (mapbox-gl expressions) and the Static Images URL builder; neither reads CSS",
  },
  {
    file: "app/layout.tsx",
    hexes: ["#0F1620", "#2D9CDB", "#E6EDF5"],
    count: 3,
    disposition: "third-party theme",
    reason:
      "Clerk <ClerkProvider appearance.variables> — a JS theme object for the auth widgets (landing palette), not a workbench surface",
  },
];

/** #283 / #281 ruling 181 — hexes RULED ADMISSIBLE but not yet written.
 *
 *  The buckets above declare literals that EXIST; the test asserts observed
 *  == declared in both directions, so a row for a hex nobody has written is
 *  a stale row and fails.  Direction A rules two off-palette hexes in
 *  (#281 ruling 181: "approved as decorative-and-labelled ... Nowhere
 *  else"), and the surface that paints them — the corridor overlay's zone
 *  channels — is a later phase.  Declaring them here as RESERVED records
 *  the ruling in the one place the ink gate reads, without claiming a site
 *  that does not exist.
 *
 *  A reserved row asserts ABSENCE: ink-literals.test.ts fails if one of
 *  these appears in any scanned source while it is still listed here.  So
 *  the row cannot go stale, and the day a surface paints one, the gate
 *  forces it out of RESERVED and into a real bucket with its site — the
 *  same ratchet the debt rows use.
 *
 *  These are NOT a licence to use the hex: they are the record that when it
 *  is used, it is ruled, decorative, and word-labelled.  Rule 13 still
 *  applies — no meaning by hue alone. */
export interface InkReserved {
  readonly hex: string;
  readonly name: string;
  readonly ruling: string;
  readonly owner: string;
}

export const INK_RESERVED: readonly InkReserved[] = [
  {
    hex: "#3fd3a8",
    name: "corridor overlay — work-zone channel",
    ruling:
      "#281 ruling 181 — approved as decorative-and-labelled; Part 2 rule 12 names it with rule 74's overlay. Nowhere else.",
    owner:
      "the phase that draws the corridor overlay; today ZONE_COLOR (lib/corridor-zones.ts) paints the work zone #1EC8A5 and MUST NOT change here — #283 renders nothing differently",
  },
  {
    hex: "#e0a63c",
    name: "corridor overlay — buffer channel",
    ruling:
      "#281 ruling 181 — approved as decorative-and-labelled; Part 2 rule 12 names it with rule 74's overlay. Nowhere else.",
    owner:
      "the phase that draws the corridor overlay; SetupStrip.tsx:276 currently records in a comment that this hex is off-palette, and the grid-tokens test asserts it is NOT used — both stay true while it is reserved",
  },
];
