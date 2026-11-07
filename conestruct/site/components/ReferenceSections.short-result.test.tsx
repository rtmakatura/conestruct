// @vitest-environment happy-dom
//
// #450 ruling 2: a rule-check row in "Checked and passed" reads its title
// and the backend's short result; the full sentence leads the opened detail
// as written, and search still finds it in a closed row.  Ruling 3: the
// search placeholder at 480 and below.  Rule 11: the rendered rows.  Rule 10:
// a wire with no short result renders the sentence, as before.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SITE_ADJUSTMENT_DETAIL } from "./AuditTrail";
import { PLACEHOLDER_NARROW, PLACEHOLDER_WIDE } from "./ReferenceSections";
import { loadFixture, mountFixture, openRow, openSection, rowOf, sectionEl, type Recorded } from "./reference-test-utils";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

interface Check {
  pass: boolean;
  label: string;
  detail: string;
  citation: string;
  short_result?: string;
}

const colorado = (fx: Recorded) =>
  fx.audit.sections.colorado as { checks: Check[]; info_items: Check[] };

/** adv-ni-denver with the short results the backend now sends (the recorded
 *  wire predates the field; tests/fixtures stay byte-identical, X10). */
function withShortResults(): Recorded {
  const fx = structuredClone(loadFixture("adv-ni-denver"));
  const co = colorado(fx);
  co.checks.forEach((c, i) => (c.short_result = `short ${i}`));
  co.info_items.forEach((c, i) => (c.short_result = `info short ${i}`));
  for (const r of fx.audit.sections.site_adjustments as { flag: string; short_result?: string }[]) {
    // The backend's values (src/rules/site_adjustments.py).
    if (r.flag === "adjacent_intersection") r.short_result = "No devices added · cross-street layout not generated";
    if (r.flag === "adjacent_interchange") r.short_result = "No devices added · ramp layout not generated";
  }
  return fx;
}

const result = (row: HTMLElement) => row.querySelector(".rr-result")?.textContent?.trim() ?? "";
const helps = (row: HTMLElement) => Array.from(row.querySelectorAll(".rr-detail .tr-help")).map((p) => p.textContent);

describe("a rule check with a short result", () => {
  it("reads title and short result; the opened detail leads with the sentence and keeps the source", async () => {
    const user = userEvent.setup();
    const fx = withShortResults();
    const both = colorado(fx).checks[0];
    mountFixture(fx);
    await openSection(user, "checked");
    const row = rowOf("checked", both.label)!;
    expect(row).not.toBeNull();
    expect(result(row)).toBe("short 0");
    expect(row.querySelector(".rr-title-line")?.textContent).toBe(`${both.label}: short 0`);
    expect(row.textContent).not.toContain(both.detail);
    await openRow(user, row);
    expect(helps(row)[0]).toBe(both.detail);
    expect(row.querySelector(".rr-detail")?.textContent).toContain(`Source: ${both.citation}`);
  });

  it("every passed Colorado check and info row shows its short result", async () => {
    const user = userEvent.setup();
    const fx = withShortResults();
    mountFixture(fx);
    await openSection(user, "checked");
    colorado(fx).checks.forEach((c, i) => expect(result(rowOf("checked", c.label)!)).toBe(`short ${i}`));
    colorado(fx).info_items.forEach((c, i) => expect(result(rowOf("checked", c.label)!)).toBe(`info short ${i}`));
  });

  it("a passed site row reads the record's short result; its action leads the detail", async () => {
    const user = userEvent.setup();
    mountFixture(withShortResults());
    await openSection(user, "checked");
    const words = SITE_ADJUSTMENT_DETAIL.adjacent_intersection;
    const row = rowOf("checked", words.label)!;
    expect(result(row)).toBe("No devices added · cross-street layout not generated");
    await openRow(user, row);
    expect(helps(row)[0]).toBe(words.action);
    expect(words.action).toMatch(/See Not checked yet\.$/);
  });

  it("search finds a word only the detail holds, and opens the row on it", async () => {
    const user = userEvent.setup();
    const fx = withShortResults();
    const both = colorado(fx).checks[0];
    mountFixture(fx);
    const word = "Signs placed";
    expect(both.detail).toContain(word);
    await user.type(screen.getByRole("searchbox"), word);
    const row = rowOf("checked", both.label)!;
    expect(row).not.toBeNull();
    expect(row.textContent).toContain("Opened because the match is inside.");
    expect(row.querySelector(".rr-detail mark")?.textContent).toBe(word);
  });

  it("X6: a failing check in section 3 keeps its sentence as the result", async () => {
    const user = userEvent.setup();
    const fx = withShortResults();
    const failing = colorado(fx).checks[3];
    failing.pass = false;
    mountFixture(fx);
    await openSection(user, "reference");
    const row = rowOf("reference", failing.label)!;
    expect(row).not.toBeNull();
    expect(result(row)).toBe(failing.detail);
  });
});

describe("Rule 10: no short result on the wire", () => {
  it("the row's result is the sentence and the detail adds nothing", async () => {
    const user = userEvent.setup();
    const fx = loadFixture("adv-ni-denver");
    const both = colorado(fx).checks[0];
    expect(both.short_result).toBeUndefined();
    mountFixture(fx);
    await openSection(user, "checked");
    const row = rowOf("checked", both.label)!;
    expect(result(row)).toBe(both.detail);
    await openRow(user, row);
    expect(helps(row)).toEqual([]);
    const site = rowOf("checked", SITE_ADJUSTMENT_DETAIL.adjacent_intersection.label)!;
    expect(result(site)).toBe(SITE_ADJUSTMENT_DETAIL.adjacent_intersection.action);
  });
});

describe("ruling 3: the search placeholder", () => {
  const stubWidth = (narrow: boolean) =>
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: narrow && q === "(max-width: 480px)",
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

  it("at 480 and below it reads the short wording", () => {
    stubWidth(true);
    mountFixture(loadFixture("adv-ni-denver"));
    expect((screen.getByRole("searchbox") as HTMLInputElement).placeholder).toBe("Search: taper, 6B, sidewalk");
    expect(PLACEHOLDER_NARROW).toBe("Search: taper, 6B, sidewalk");
  });

  it("above 480 it keeps #443's wording", () => {
    stubWidth(false);
    mountFixture(loadFixture("adv-ni-denver"));
    expect((screen.getByRole("searchbox") as HTMLInputElement).placeholder).toBe(PLACEHOLDER_WIDE);
    expect(PLACEHOLDER_WIDE).toBe("A number, a rule or a word: taper, 6B, sidewalk, $500");
  });
});

// The section's own name stays the page's one name for it (ruling 1).
it("the section is named Not checked yet", () => {
  mountFixture(loadFixture("adv-ni-denver"));
  expect(sectionEl("pending").getAttribute("aria-label")).toBe("Not checked yet");
});
