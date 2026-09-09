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
  {
    selector: ".workbench .site-corrections",
    hex: "#4a6280",
    reason:
      "--sc-leader, the ledger's dotted leader line — DECORATION by GO ruling a (s2-arc21), pinned in SetupStrip.grid-tokens.test.tsx",
  },
];

/** `#fff` literals inside other buckets' globals.css ranges.  Not D's
 *  to edit; each owner swaps to var(--ink-bright) and deletes its row. */
export const CSS_OWNER_SWAPS: readonly OwnerSwap[] = [
  { selector: ".workbench .zone-title", hex: "#fff", owner: "B (#260)" },
  {
    selector: ".workbench .jbar-suggest .site-correction-note",
    hex: "#fff",
    owner: "A (#255)",
  },
  {
    selector: ".workbench .setup-strip .sv.structural .val",
    hex: "#fff",
    owner: "A (#254)",
  },
  {
    selector:
      ".workbench .setup-strip .sv-editor input, .workbench .setup-strip .sv-editor select",
    hex: "#fff",
    owner: "A (#254)",
  },
  { selector: ".workbench .dl-card h4", hex: "#fff", owner: "C (#261)" },
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
