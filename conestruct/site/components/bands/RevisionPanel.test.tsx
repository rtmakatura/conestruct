// @vitest-environment happy-dom
//
// #289 Phase 2, S7 — the before/after panel's own claims.
//
// Rules 90 / 95.4 / 95.5 / 95.6 / 95.14, and rulings 195, 201, 203, 204.
// The producers are proved in lib/scenarios/revision.test.ts; this is
// the surface: six rows in ALL FOUR SITUATIONS, the deferred pair never
// predicted, and one reserved live region that makes 7a → 7b → 7c move
// nothing below it.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { DeviceBreakdownData } from "../DeviceBreakdown";
import type { PreviewState } from "@/lib/scenarios/preview";
import { RevisionPanel, panelRows } from "./RevisionPanel";

afterEach(cleanup);

const SETTLED: DeviceBreakdownData = {
  devices: [],
  total_devices: 42,
  unique_types: 6,
  zone_geometry: {
    taper_l_ft: 183,
    buffer_b_ft: 495,
    device_spacing_ft: 55,
    work_len_ft: 500,
  },
};

const PREVIEWED: DeviceBreakdownData = {
  devices: [],
  total_devices: 31,
  unique_types: 5,
  zone_geometry: {
    taper_l_ft: 105,
    buffer_b_ft: 305,
    device_spacing_ft: 40,
    work_len_ft: 500,
  },
};

const STATES: Array<[string, PreviewState]> = [
  ["7a idle", { kind: "idle" }],
  ["7b loading", { kind: "loading" }],
  ["7c ready", { kind: "ready", data: PREVIEWED, forValue: "35 mph" }],
  ["7d error", { kind: "error" }],
];

function mount(state: PreviewState) {
  render(
    <RevisionPanel
      state={state}
      settled={SETTLED}
      stagedValue="35 mph"
      verdict="on screen"
      needsYou={3}
    />,
  );
}

describe("rule 90 — six rows, always, in all four situations", () => {
  for (const [name, state] of STATES) {
    it(`${name}: all six render`, () => {
      mount(state);
      for (const key of [
        "taper",
        "buffer",
        "spacing",
        "devices",
        "verdict",
        "needs-you",
      ]) {
        expect(
          screen.getByTestId(`panel-row-${key}`),
          `${key} in ${name}`,
        ).toBeTruthy();
      }
      cleanup();
    });
  }
});

describe("rule 95.6 — the deferred pair is never predicted (rulings 195, 204)", () => {
  for (const [name, state] of STATES) {
    it(`${name}: verdict and needs-you read "recomputes on apply"`, () => {
      mount(state);
      // Ruling 195: "verdict is for the plan on screen, not the staged
      // change."  So `was` carries the current value and `now` carries a
      // sentence — INCLUDING 7c, where a number is on hand for the four
      // rows above.
      expect(screen.getByTestId("panel-row-verdict").textContent).toContain(
        "on screen",
      );
      expect(screen.getByTestId("panel-row-verdict").textContent).toContain(
        "recomputes on apply",
      );
      expect(screen.getByTestId("panel-row-needs-you").textContent).toContain(
        "recomputes on apply",
      );
      cleanup();
    });
  }
});

describe("the previewed four", () => {
  it("7c: `now` carries the preview's numbers, `was` the plan's", () => {
    mount({ kind: "ready", data: PREVIEWED, forValue: "35 mph" });
    const taper = screen.getByTestId("panel-row-taper").textContent ?? "";
    expect(taper).toContain("183 ft"); // was
    expect(taper).toContain("105 ft"); // now
    expect(screen.getByTestId("panel-row-devices").textContent).toContain("31");
  });

  it("7a / 7b / 7d: `now` says what it does not know, and never a number", () => {
    for (const state of [
      { kind: "idle" } as const,
      { kind: "loading" } as const,
      { kind: "error" } as const,
    ]) {
      mount(state);
      const taper = screen.getByTestId("panel-row-taper").textContent ?? "";
      expect(taper).toContain("183 ft");
      expect(taper).toContain("recomputes on apply");
      expect(taper).not.toContain("105");
      cleanup();
    }
  });

  it("the row set is derivable without a DOM (rule 90 is a producer claim)", () => {
    const rows = panelRows({
      settled: SETTLED,
      preview: null,
      verdict: "on screen",
      needsYou: 3,
    });
    expect(rows).toHaveLength(6);
    expect(rows.filter((r) => r.now === null)).toHaveLength(6);
    const previewed = panelRows({
      settled: SETTLED,
      preview: PREVIEWED,
      verdict: "on screen",
      needsYou: 3,
    });
    // Four previewed, two deferred — in every situation.
    expect(previewed.filter((r) => r.now === null)).toHaveLength(2);
  });
});

describe("rule 95.4 / 95.14 — the reserved status row", () => {
  for (const [name, state] of STATES) {
    it(`${name}: mounted, and the panel's only live region`, () => {
      mount(state);
      const row = screen.getByTestId("panel-status");
      expect(row).toBeTruthy();
      expect(row.getAttribute("aria-live")).toBe("polite");
      // ONE live region in the panel — the row itself.
      const live = document.querySelectorAll(
        '[data-testid="revision-panel"] [aria-live]',
      );
      expect(live.length, `one live region in ${name}`).toBe(1);
      cleanup();
    });
  }

  it("7c's line is ruling 201's, naming the value and the scope", () => {
    mount({ kind: "ready", data: PREVIEWED, forValue: "35 mph" });
    expect(screen.getByTestId("panel-status-line").textContent).toBe(
      "computed for 35 mph · taper, buffer, spacing and counts only",
    );
  });

  it("7a is quiet — nothing is wrong in it (ruling 203)", () => {
    mount({ kind: "idle" });
    const line = screen.getByTestId("panel-status-line").textContent ?? "";
    expect(line).not.toMatch(/fail|error|unavailable/i);
  });

  it("7d says the plan on screen is unchanged, which is the honest half", () => {
    mount({ kind: "error" });
    expect(screen.getByTestId("panel-status-line").textContent).toContain(
      "the plan on screen is unchanged",
    );
  });
});

// #289 fidelity F7 — the panel at Part 2's figures (audit rows 159–165
// and the F7 plan row).  The DOM order and the per-state glyph are read
// off the render; the figures off the sheet.
describe("#289 fidelity F7 — rules 90–95.4 and 121", () => {
  const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");
  const rule = (selector: string): string => {
    const i = css.indexOf(selector + " {");
    expect(i, `rule not found: ${selector}`).toBeGreaterThan(-1);
    return css.slice(i + selector.length + 2, css.indexOf("}", i));
  };

  it("rule 90's order: six rows, THEN the status row, then the footer", () => {
    render(
      <RevisionPanel
        state={{ kind: "idle" }}
        settled={SETTLED}
        stagedValue="35 mph"
        verdict="on screen"
        needsYou={3}
        footer={<div data-testid="foot" />}
      />,
    );
    const panel = screen.getByTestId("revision-panel");
    const kids = Array.from(panel.children);
    const at = (el: Element) => kids.indexOf(el);
    const rows = panel.querySelector(".a-panel-rows")!;
    expect(at(rows)).toBeLessThan(at(screen.getByTestId("panel-status")));
    expect(at(screen.getByTestId("panel-status"))).toBeLessThan(at(screen.getByTestId("foot")));
  });

  it("rule 92's four tracks: label · was · → · now", () => {
    mount({ kind: "ready", data: PREVIEWED, forValue: "35 mph" });
    const row = screen.getByTestId("panel-row-taper");
    expect(row.children).toHaveLength(4);
    expect(row.children[1].textContent).toBe("183 ft");
    expect(row.children[2].textContent?.trim()).toBe("→");
    expect(row.children[3].textContent).toBe("105 ft");
  });

  for (const [name, state, glyph, cls] of [
    ["7a", { kind: "idle" }, "◌", "sym-none"],
    ["7b", { kind: "loading" }, "◌", "sym-none"],
    ["7c", { kind: "ready", data: PREVIEWED, forValue: "35 mph" }, "✓", "sym-pass"],
    ["7d", { kind: "error" }, "⚠", "sym-warn"],
  ] as Array<[string, PreviewState, string, string]>) {
    it(`rule 95.4: ${name}'s status row leads with ${glyph} in rule 18's hue`, () => {
      mount(state);
      const g = screen.getByTestId("panel-status").querySelector(".status-glyph")!;
      expect(g.textContent).toBe(glyph);
      expect(g.classList.contains(cls)).toBe(true);
      cleanup();
    });
  }

  it("the figures: shell, rows, status row, footer, S7's body grid", () => {
    expect(rule(".workbench .a-panel")).toMatch(/border:\s*1px solid var\(--act\)/);
    expect(rule(".workbench .a-panel")).toMatch(/background:\s*var\(--panel-ground\)/);
    expect(css).toMatch(/--panel-ground:\s*#0f1c29;/);
    expect(rule(".workbench .a-panel-row")).toMatch(
      /grid-template-columns:\s*minmax\(0, 1fr\) 92px 22px 92px/,
    );
    expect(rule(".workbench .a-panel-row")).toMatch(/padding:\s*10px 16px/);
    const status = rule(".workbench .a-panel-status");
    expect(status).toMatch(/padding:\s*11px 16px/);
    expect(status).toMatch(/min-height:\s*44px/);
    expect(status).toMatch(/font-size:\s*10\.5px/);
    const apply = rule(".workbench .a-panel-foot .a-apply");
    expect(apply).toMatch(/width:\s*200px/);
    expect(apply).toMatch(/height:\s*44px/);
    const body = rule(".workbench .a-open.is-revising .a-body");
    expect(body).toMatch(/grid-template-columns:\s*240px minmax\(0, 1fr\)/);
    expect(body).toMatch(/column-gap:\s*26px/);
    expect(rule(".workbench .a-open.is-revising")).toMatch(/border-color:\s*var\(--act\)/);
  });
});

describe("rule 91 + R3 — the header note", () => {
  for (const [name, state] of STATES) {
    it(`${name}: says which value AND which computation`, () => {
      mount(state);
      expect(screen.getByTestId("panel-note").textContent).toBe(
        "for 35 mph · before site conditions",
      );
      cleanup();
    });
  }
});
