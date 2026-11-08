// #457 (Ryan, 2026-11-05; Option A): every Undo on the tool page is a plain
// text link through one shared style.  happy-dom applies no stylesheet, so
// this pins the rules the browser walk measured
// (validation-artifacts/committed/ux-undo-links/); the mounted tests of each
// place (QuestionSteps' callers, the condition rows, the acknowledgement row,
// the cross street's row, the near-intersection note) assert that each Undo
// is a `button.undo-link` reading "Undo".
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");

/** Every declaration block whose selector list is exactly `selector`. */
function blocks(selector: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();
    if (sel === selector) out.push(m[2]);
  }
  return out;
}

function decls(selector: string): Record<string, string> {
  const found = blocks(selector);
  expect(found.length, `a rule for ${selector}`).toBeGreaterThan(0);
  const out: Record<string, string> = {};
  for (const b of found) {
    for (const d of b.replace(/\/\*[\s\S]*?\*\//g, "").split(";")) {
      const i = d.indexOf(":");
      if (i > 0) out[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
  }
  return out;
}

describe("#457 rulings 1, 2, 4: the Undo link's one style", () => {
  it("ruling 1: Inter 13.5 / 600 in --act, through the row actions' own rule (Move, Edit, Details)", () => {
    const font = decls(".workbench .wq-link, .workbench .undo-link");
    expect(font["font-family"]).toBe("var(--font-sans)");
    expect(font["font-size"]).toBe("var(--fs-body-value)");
    expect(font["font-weight"]).toBe("600");
    expect(font.color).toBe("var(--act)");
    // U2: underlined, as Move, Edit and Details are.
    expect(font["text-decoration"]).toBe("underline");
  });

  it("ruling 1: no border, no box, no mono caps; hover --act-bright", () => {
    const d = decls(".workbench .undo-link");
    expect(d.border).toBe("0");
    expect(d.background).toBe("none");
    expect(d["text-transform"]).toBe("none");
    expect(d["letter-spacing"]).toBe("0");
    // The type is the shared rule's alone: nothing here restates it.
    for (const k of ["font-family", "font-size", "font-weight", "color"]) expect(d[k]).toBeUndefined();
    expect(decls(".workbench .undo-link:not(:disabled):hover").color).toBe("var(--act-bright)");
  });

  it("ruling 2: 44 px tall with 8 px side padding, its own width on a phone (U5)", () => {
    const d = decls(".workbench .undo-link");
    expect(d["min-height"]).toBe("44px");
    expect(d.padding).toBe("0 8px");
    expect(d.flex).toBe("none");
    // Declared after rule 167's stretch, at the same specificity, so it wins.
    expect(css.lastIndexOf(".workbench .undo-link {")).toBeGreaterThan(
      css.indexOf(".workbench .ny-acts > * {"),
    );
  });

  it("ruling 2: the answered rows are 48 px; the cross street's row has 16 px on the right", () => {
    expect(decls(".workbench .nyq-row.nyq-answered")["min-height"]).toBe("48px");
    expect(decls(".workbench .wq-cross-row").padding).toBe("8px 16px 8px 12px");
  });

  it("ruling 4: the focus ring stays, inside the hit area (U6); disabled is rule 133's (U7)", () => {
    const f = decls(".workbench .undo-link:focus-visible");
    expect(f.outline).toBe("2px solid var(--act)");
    expect(f["outline-offset"]).toBe("-2px");
    const off = decls(".workbench .undo-link:disabled");
    expect(off.opacity).toBe("0.45");
    expect(off.cursor).toBe("not-allowed");
  });

  it("ruling 3: the old per-place Undo classes are gone from the sheet", () => {
    expect(css).not.toMatch(/\.nyq-undo\b/);
    expect(css).not.toMatch(/\.wq-undo\b/);
  });
});
