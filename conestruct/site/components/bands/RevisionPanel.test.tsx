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

  // #289 fidelity follow-up — rule 95.5's treatments replace the old
  // "the four read `recomputes on apply` outside 7c".  That phrase is the
  // DEFERRED pair's (rule 95.6); the previewed four always carry a
  // server's figure or an em dash, and say which by treatment.
  const now = (key: string) =>
    screen.getByTestId(`panel-row-${key}`).querySelector(".a-now")!;

  it("7a: the value on file's own figures, NOT dimmed and NOT changed (rule 95.7)", () => {
    mount({ kind: "idle" });
    expect(now("taper").textContent).toBe("183 ft");
    expect(now("taper").getAttribute("data-treatment")).toBe("unchanged");
    expect(screen.getByTestId("panel-row-taper").textContent).not.toContain("recomputes");
  });

  it("7b: the last computed set, in flight — never blanked (rule 95.9)", () => {
    mount({ kind: "loading", last: PREVIEWED });
    expect(now("taper").textContent).toBe("105 ft");
    expect(now("taper").getAttribute("data-treatment")).toBe("inflight");
    cleanup();
    // No earlier preview: the value on file's figures, in flight.
    mount({ kind: "loading" });
    expect(now("taper").textContent).toBe("183 ft");
    expect(now("taper").getAttribute("data-treatment")).toBe("inflight");
  });

  it("7c: changed where the preview differs from `was`, unchanged where it does not (rule 95.10)", () => {
    const same: DeviceBreakdownData = {
      ...PREVIEWED,
      zone_geometry: { ...PREVIEWED.zone_geometry!, buffer_b_ft: 495 },
    };
    mount({ kind: "ready", data: same, forValue: "35 mph" });
    expect(now("taper").getAttribute("data-treatment")).toBe("changed");
    expect(now("taper").classList.contains("is-changed")).toBe(true);
    expect(now("buffer").textContent).toBe("495 ft");
    expect(now("buffer").getAttribute("data-treatment")).toBe("unchanged");
  });

  it("7d: every previewed cell is an em dash — old numbers are never left in place (rule 95.11)", () => {
    mount({ kind: "error" });
    for (const key of ["taper", "buffer", "spacing", "devices"]) {
      expect(now(key).textContent, key).toBe("—");
      expect(now(key).getAttribute("data-treatment"), key).toBe("absent");
    }
  });

  it("the row set is derivable without a DOM (rule 90 is a producer claim)", () => {
    for (const [, state] of STATES) {
      const rows = panelRows({ settled: SETTLED, state, verdict: "on screen", needsYou: 3 });
      expect(rows).toHaveLength(6);
      // Four previewed, two deferred — in every situation.
      expect(rows.filter((r) => r.now === null)).toHaveLength(2);
      expect(rows.filter((r) => r.treatment === "deferred")).toHaveLength(2);
    }
  });
});

describe("rule 95.4 7d — RETRY PREVIEW", () => {
  it("renders only in 7d, as a rule 133 ghost, and re-asks", () => {
    let asked = 0;
    const panel = (state: PreviewState) => (
      <RevisionPanel
        state={state}
        settled={SETTLED}
        stagedValue="35 mph"
        verdict="on screen"
        needsYou={3}
        onRetry={() => {
          asked += 1;
        }}
      />
    );
    const { rerender } = render(panel({ kind: "idle" }));
    expect(screen.queryByTestId("panel-retry")).toBeNull();
    rerender(panel({ kind: "error" }));
    const retry = screen.getByTestId("panel-retry");
    expect(retry.classList.contains("act-btn")).toBe(true);
    // Inside the status row, after the sentence.
    expect(retry.closest('[data-testid="panel-status"]')).not.toBeNull();
    retry.click();
    expect(asked).toBe(1);
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

  // #289 fidelity follow-up — rules 91, 95.4 (7d) and 95.5, off the sheet.
  it("rule 95.5: changed is --dim 500; absent --none; in flight dimmed — at an AA-clearing .6, measured", () => {
    expect(rule(".workbench .a-panel-row .a-now.is-changed")).toMatch(/color:\s*var\(--dim\)/);
    expect(rule(".workbench .a-panel-row .a-now.is-changed")).toMatch(/font-weight:\s*500/);
    expect(rule(".workbench .a-panel-row .a-now.is-absent")).toMatch(
      /color:\s*var\(--ink-on-dark-faint\)/,
    );
    const op = Number(rule(".workbench .a-panel-row .a-now.is-inflight").match(/opacity:\s*([\d.]+)/)![1]);
    // The measured claim: #c8d1dd at this opacity over the panel ground
    // clears 4.5:1 (rule 95.5's .42 measures 3.04 — the stated departure).
    const hex = (name: string) => css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))![1];
    const lum = (h: string) => {
      const [r, g, b] = [1, 3, 5]
        .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const mix = (fg: string, a: number, bg: string) =>
      "#" +
      [1, 3, 5]
        .map((i) =>
          Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
    const ground = hex("--panel-ground");
    const ink = hex("--ink-on-dark");
    const composite = mix(ink, op, ground);
    const ratio = (lum(composite) + 0.05) / (lum(ground) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(4.84, 1);
  });

  it("rule 91: the note is --act-bright in 7b and --warn in 7d; rule 95.4's 7d row takes the flag line and #1b1a12", () => {
    expect(
      rule('.workbench .a-panel[data-preview="loading"] .a-panel-note,\n.workbench .a-panel[data-preview="loading"] .a-panel-status'),
    ).toMatch(/color:\s*var\(--act-bright\)/);
    expect(rule('.workbench .a-panel[data-preview="error"] .a-panel-note')).toMatch(/color:\s*var\(--warn\)/);
    const failed = rule('.workbench .a-panel[data-preview="error"] .a-panel-status');
    expect(failed).toMatch(/border-top:\s*1px solid var\(--vd-flag-line\)/);
    expect(failed).toMatch(/background:\s*var\(--panel-fail-ground\)/);
    expect(css).toMatch(/--panel-fail-ground:\s*#1b1a12;/);
    expect(rule(".workbench .a-panel-status .a-retry")).toMatch(/margin-left:\s*auto/);
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
