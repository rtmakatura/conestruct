// @vitest-environment happy-dom
// #435 (UX group 1, Option C, ruled 2026-11-02) — the tool page's
// spacing and text rules, read where the bug lives (Rule 11): the mounted
// landing for the copy and the type role each sentence carries, and the
// served stylesheet for the three gaps.  The browser leg measures the
// rendered px; happy-dom lays nothing out, so here the claim is the rule
// each surface reads.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");

function rule(selector: string): string {
  const i = css.indexOf(selector + " {");
  expect(i, `rule not found: ${selector}`).toBeGreaterThan(-1);
  return css.slice(i + selector.length + 2, css.indexOf("}", i));
}

const fetchMock = vi.fn(() =>
  Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as unknown as Response),
);

async function landing() {
  render(<GeneratorShell mode="sandbox" />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("#435 ruling 7 — the landing's copy", () => {
  it("the strip reads NO SITE CHOSEN YET", async () => {
    await landing();
    expect(document.querySelector(".status-bar")?.textContent).toBe("◌NO SITE CHOSEN YET");
  });

  it("WHERE: the helper is the ruled sentence in .tr-help, and the header has no hint", async () => {
    await landing();
    const where = screen.getByTestId("band-where");
    const help = where.querySelector(".a-question-prov") as HTMLElement;
    expect(help.textContent).toBe(
      "Type an address or two cross streets, the way an 811 ticket describes it. Or drop a pin on the map.",
    );
    expect(help.classList.contains("tr-help")).toBe(true);
    expect(help.classList.contains("tr-prov")).toBe(false);
    expect(where.querySelector(".a-head .a-prov")).toBeNull();
    expect(where.textContent).not.toContain("the work, not the first sign");
  });

  it("WHAT, collapsed: the right side reads 'Opens after you find the work' in .tr-note", async () => {
    await landing();
    const prov = screen.getByTestId("fact-what").querySelector(".a-fact-prov") as HTMLElement;
    expect(prov.textContent).toBe("Opens after you find the work");
    expect(prov.classList.contains("tr-note")).toBe(true);
  });

  it("GENERATE: one line, the ruled reason in .tr-help; the TCS caption is gone", async () => {
    await landing();
    const frame = screen.getByTestId("generate-frame");
    const reason = frame.querySelector('[data-testid="cta-reason"]') as HTMLElement;
    expect(reason.textContent).toBe("Type an address or pick on map first, then Generate turns on.");
    expect(reason.classList.contains("tr-help")).toBe(true);
    expect(frame.querySelector('[data-testid="generate-caption"]')).toBeNull();
    expect(frame.textContent).not.toContain("Output requires TCS review");
    expect(frame.className).not.toMatch(/\bmt-4\b/);
  });

  it("the footer line is Ryan's checkpoint wording in .tr-note", async () => {
    await landing();
    const draft = screen.getByTestId("draft-notice");
    expect(draft.classList.contains("tr-note")).toBe(true);
    expect(draft.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Draft, not a sealed plan. This is engineering reference, with every dimension cited to MUTCD or CDOT. A licensed PE must review and seal it before field use.",
    );
  });
});

describe("#435 ruling 2 — the two sentence roles", () => {
  it(".tr-help is Inter 13.5 --ink-on-dark; .tr-note is Inter 12.5 --ink-faint", () => {
    const help = rule(".workbench .tr-help");
    expect(help).toMatch(/font-family:\s*var\(--font-sans\)/);
    expect(help).toMatch(/font-size:\s*var\(--fs-body-value\)/);
    expect(help).toMatch(/color:\s*var\(--ink-on-dark\)/);
    const note = rule(".workbench .tr-note");
    expect(note).toMatch(/font-family:\s*var\(--font-sans\)/);
    expect(note).toMatch(/font-size:\s*var\(--fs-field-label\)/);
    expect(note).toMatch(/color:\s*var\(--ink-faint\)/);
    expect(css).toMatch(/--fs-body-value:\s*13\.5px;/);
    expect(css).toMatch(/--fs-field-label:\s*12\.5px;/);
  });
});

describe("#435 ruling 1 — three vertical gaps", () => {
  it("the tokens are 8 / 16 / 24", () => {
    expect(css).toMatch(/--space-tight:\s*8px;/);
    expect(css).toMatch(/--space-block:\s*16px;/);
    expect(css).toMatch(/--space-section:\s*24px;/);
  });

  it("24 between bands, from the strip to the first band, and from the last band to the footer line", () => {
    expect(rule(".workbench .band-stack")).toMatch(/gap:\s*var\(--space-section\)/);
    expect(rule(".workbench .status-slot")).toMatch(/margin-bottom:\s*var\(--space-section\)/);
    // The footer line's 24 is owned by what sits above it (a margin of its
    // own stacked to 48 at landing, measured): the setup zone's 24, or the
    // disclosure group's after a Generate; the results zone gives up its own.
    expect(rule(".workbench .draft-notice")).toMatch(/margin-top:\s*0;/);
    expect(rule(".workbench .zone.results")).toMatch(/margin-bottom:\s*0;/);
    expect(rule(".workbench .results-disc")).toMatch(/margin-bottom:\s*var\(--space-section\)/);
  });

  it("header rows are 12 / 16: the band head, the collapsed band, the strip, the disclosure head", () => {
    expect(rule(".workbench .a-open .a-head")).toMatch(/padding:\s*12px 16px/);
    expect(rule(".workbench .a-fact")).toMatch(/padding:\s*12px 16px/);
    expect(rule(".workbench .status-bar")).toMatch(/padding:\s*12px 16px/);
    expect(rule(".workbench .disc-head")).toMatch(/padding:\s*12px 16px/);
  });

  it("16 inside a band: the body, the generate frame, an opened disclosure; 8 between a question and its line and between a disclosure's paragraphs", () => {
    expect(rule(".workbench .a-open .a-body")).toMatch(/padding:\s*var\(--space-block\)/);
    expect(rule(".workbench .a-genframe")).toMatch(/padding:\s*var\(--space-block\)/);
    expect(rule(".workbench .disc-panel")).toMatch(/padding:\s*var\(--space-block\)/);
    expect(rule(".workbench .a-open .a-question")).toMatch(/margin:\s*0 0 var\(--space-tight\)/);
    expect(rule(".workbench .disc-panel > * + *")).toMatch(/margin-top:\s*var\(--space-tight\)/);
  });
});
