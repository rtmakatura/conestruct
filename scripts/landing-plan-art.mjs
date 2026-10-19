// Landing v2: turns the drawn Colfax plans in design/landing-v2/
// into conestruct/site/components/landing/plan-art.ts.  From the repo root:
//   node scripts/landing-plan-art.mjs
//
// The drawings stay the designer's (illus.py made them); this only
//   - drops the C2PA <metadata> block and its xmlns,
//   - swaps every hex for the workbench token that holds it (the ink gate,
//     #263, keeps hexes in the .workbench block), and
//   - swaps the mono font stack for next/font's --font-mono.
// An unmapped hex stops the script rather than slipping through.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DESIGN = join(import.meta.dirname, "..", "design", "landing-v2");
const OUT = join(import.meta.dirname, "..", "conestruct", "site", "components", "landing", "plan-art.ts");

const TOKEN = {
  "#101c29": "--da-ground",
  "#2c3e53": "--rule",
  "#223345": "--da-hair",
  "#3a4d66": "--paper-line",
  "#93a0b0": "--ink-faint",
  "#c8d1dd": "--ink-on-dark",
  "#eaf0f7": "--ink",
  "#f4c020": "--warn",
  "#ff8a2e": "--dim",
  "#172636": "--lv-grid",
  "#132131": "--lv-block",
  "#1a2a3c": "--lv-bldg",
  "#1d2d3f": "--lv-road",
  "#8c7a2a": "--lv-center",
  "#18283a": "--lv-walk",
  "#e0a63c": "--lv-adv",
  "#3fd3a8": "--lv-work",
};

// The 3D hero's own palette (design/landing-v2/hero-3d/iso_hero.py): its
// ground, buildings, trees, devices, truck and arrow-board trailer.  Each
// hex has one --iso-* token in the .workbench block; the eight shared with
// the flat drawings keep their tokens above.
const ISO = {
  "#132232": "--iso-sky-top",
  "#0c1722": "--iso-sky-foot",
  "#1f3550": "--iso-pool",
  "#1a2b3e": "--iso-slab-top",
  "#0e1925": "--iso-slab-foot",
  "#0b1520": "--iso-slab-west",
  "#162636": "--iso-ground",
  "#1e2f42": "--iso-road",
  "#3a4f68": "--iso-edge",
  "#050b12": "--iso-shadow",
  "#0c1622": "--iso-outline",
  "#4b5f7a": "--iso-shoulder-line",
  "#9aa8b8": "--iso-crosswalk",
  "#25384d": "--iso-walk-top",
  "#2f4560": "--iso-walk-south",
  "#1c2c3e": "--iso-walk-west",
  "#22354a": "--iso-bldg-1-top",
  "#132233": "--iso-bldg-1-west",
  "#283c52": "--iso-bldg-2-top",
  "#1f3246": "--iso-bldg-2-south",
  "#162739": "--iso-bldg-2-west",
  "#1f3044": "--iso-bldg-3-top",
  "#182838": "--iso-bldg-3-south",
  "#111e2d": "--iso-bldg-3-west",
  "#2c4560": "--iso-window",
  "#3c5f72": "--iso-awning",
  "#33495f": "--iso-roof-unit-top",
  "#2a3e53": "--iso-roof-unit-south",
  "#1f3043": "--iso-roof-unit-west",
  "#3b3326": "--iso-trunk",
  "#4b6b5f": "--iso-leaf-lit",
  "#2b4540": "--iso-leaf",
  "#1d322f": "--iso-leaf-shade",
  "#1b2c3e": "--iso-planter-top",
  "#15243a": "--iso-planter-south",
  "#0f1c2c": "--iso-planter-west",
  "#b4551a": "--iso-cone-base-top",
  "#8a3f12": "--iso-cone-base-south",
  "#6f330f": "--iso-cone-base-west",
  "#ffa45a": "--iso-cone-lit",
  "#c35a16": "--iso-cone-shade",
  "#f4f1ea": "--iso-reflective",
  "#f1ede4": "--iso-rail",
  "#4a5666": "--iso-panel-back",
  "#111820": "--iso-legend",
  "#8c99a8": "--iso-post",
  "#7b8796": "--iso-sign-back",
  "#dfe3ea": "--iso-cab-top",
  "#b9c1cc": "--iso-cab-south",
  "#c9d0d9": "--iso-cab-west",
  "#1d2a38": "--iso-glass",
  "#eef1f5": "--iso-box-top",
  "#c3cad4": "--iso-box-south",
  "#d6dbe2": "--iso-box-west",
  "#22344a": "--iso-trailer-south",
  "#1a293b": "--iso-trailer-west",
  "#7d8a9a": "--iso-mast",
  "#0a131c": "--iso-board",
  // v2: the invisible hover zones (fill-opacity 0); the fill is there only
  // so they take the pointer
  "#000": "--iso-hit",
};

function convert(file, extra = {}) {
  let svg = readFileSync(join(DESIGN, file), "utf-8").trim();
  svg = svg.replace(/<metadata>[\s\S]*?<\/metadata>/, "").replace(/ xmlns:c2pa="[^"]*"/, "");
  const open = /^<svg([^>]*)>/.exec(svg);
  if (!open) throw new Error(`${file}: no <svg>`);
  const attr = (name) => new RegExp(` ${name}="([^"]*)"`).exec(open[1])?.[1];
  let inner = svg.slice(open[0].length, svg.lastIndexOf("</svg>"));
  inner = inner.replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, (hex) => {
    const t = extra[hex.toLowerCase()] ?? TOKEN[hex.toLowerCase()];
    if (!t) throw new Error(`${file}: unmapped ${hex}`);
    return `var(${t})`;
  });
  inner = inner.replaceAll("font-family=\"'JetBrains Mono', ui-monospace, monospace\"", 'font-family="var(--font-mono)"');
  if (/#[0-9a-fA-F]{3}\b/.test(inner)) throw new Error(`${file}: short hex left`);
  return { viewBox: attr("viewBox"), label: attr("aria-label"), inner };
}

const art = {
  // The desktop hero: the 3D scene from hero-3d/iso_hero.py.  Its groups
  // carry data-k so pointing at the scene lights the card (Hero.tsx).
  HERO_ISO: convert("hero-3d/hero-iso.svg", ISO),
  // Phones keep the flat drawing until the platform-wide mobile pass
  // (Ryan's ruling, 2026-10-19).
  HERO_NARROW: convert("hero-plan-narrow.svg"),
  STEP1: convert("step1-plan.svg"),
  // #349: step 3's drawing.  step1-plan.svg uncropped (viewBox 0 0 1200
  // 430) with its pattern ids renamed step1 -> step3, so both can sit on
  // one page.  It replaces colfax-plan-dark.jpg, whose median the road
  // doesn't have.
  STEP3: convert("step3-plan.svg"),
  // #349 ruling: the phone crop, from design/landing-v2/step3-narrow.py.
  STEP3_NARROW: convert("step3-plan-narrow.svg"),
};

let out =
  "// GENERATED by scripts/landing-plan-art.mjs (repo root) from design/landing-v2/*.svg.\n" +
  "// Do not edit by hand: change the design file and re-run the script.\n\n" +
  "export interface PlanArt {\n  viewBox: string;\n  label: string;\n  inner: string;\n}\n";
for (const [name, a] of Object.entries(art)) {
  out += `\nexport const ${name}: PlanArt = ${JSON.stringify(a, null, 2)};\n`;
}
writeFileSync(OUT, out);
console.log(Object.entries(art).map(([n, a]) => `${n} ${a.viewBox} ${a.inner.length}`).join("\n"));
