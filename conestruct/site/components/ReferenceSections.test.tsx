// @vitest-environment happy-dom
//
// #443: the sections and the search box, mounted (Rule 11).  The acceptance
// criteria on recorded fixtures: nothing opens twice, search reads closed
// rows with no backend call, clearing restores every open and closed state,
// and a failed audit opens the section holding Retry.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { loadFixture, mountFixture, openEverything, openRow, openSection, rowOf, rowsIn, sectionEl } from "./reference-test-utils";
import { zoneGeometryRows } from "./ResultsHero";
import type { DeviceBreakdownState } from "./DeviceBreakdown";

const fx = loadFixture("scanned-lakewood");
const BREAKDOWN: DeviceBreakdownState = {
  state: "ready",
  data: {
    devices: [
      { device: "Drum", code: "CH-1", function: "channelizing device", qty: 10 },
      { device: "Cone", code: "CH-2", function: "channelizing device", qty: 12 },
      { device: "Sidewalk closed sign", code: "R9-9", function: "sign", qty: 2 },
    ],
    total_devices: 24,
    unique_types: 3,
    zone_geometry: { taper_l_ft: 40, buffer_b_ft: 200, device_spacing_ft: 30, work_len_ft: 1000 },
  },
};

const box = () => screen.getByRole("searchbox") as HTMLInputElement;
const type = (q: string) => fireEvent.change(box(), { target: { value: q } });
const status = () => screen.getByRole("status").textContent;
const expanded = (el: Element | null | undefined) => el?.querySelector("button")?.getAttribute("aria-expanded");
const snapshot = () =>
  Array.from(document.querySelectorAll(".rs-head, .rr-head")).map(
    (h) => `${h.textContent}|${h.getAttribute("aria-expanded")}`,
  );

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ruling 2: two levels at most", () => {
  it("nothing inside an opened detail opens again", async () => {
    const user = userEvent.setup();
    mountFixture(fx, { breakdown: BREAKDOWN });
    await openEverything(user);
    const details = Array.from(document.querySelectorAll(".rr-detail"));
    expect(details.length).toBeGreaterThan(10);
    for (const d of details) {
      expect(d.querySelector("[aria-expanded], details, .refchip, .audit-item")).toBeNull();
    }
  });

  it("the row is glyph, title, result, Show/Hide; opening flips the word", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    await openSection(user, "checked");
    const row = rowOf("checked", "Taper length")!;
    expect(row.querySelector(".rr-glyph")?.textContent).toBe("✓");
    expect(row.querySelector(".rr-act")?.textContent).toBe("Show");
    await openRow(user, row);
    expect(row.querySelector(".rr-act")?.textContent).toBe("Hide");
    expect(row.textContent).toContain("Source: ");
  });
});

describe("rule 169: zone geometry reads the hero's one list", () => {
  it("every row and value, no second producer", async () => {
    const user = userEvent.setup();
    mountFixture(fx, { breakdown: BREAKDOWN });
    await openSection(user, "reference");
    const row = rowOf("reference", "Zone geometry")!;
    await openRow(user, row);
    for (const r of zoneGeometryRows((BREAKDOWN as Extract<DeviceBreakdownState, { state: "ready" }>).data.zone_geometry!)) {
      expect(within(row).getByText(r.label)).toBeTruthy();
      expect(within(row).getByText(r.value)).toBeTruthy();
    }
  });

  it("rule 83: no zone_geometry is one unavailable row, nothing computed", async () => {
    const user = userEvent.setup();
    const { zone_geometry: _omit, ...bare } = (BREAKDOWN as Extract<DeviceBreakdownState, { state: "ready" }>).data;
    void _omit;
    mountFixture(fx, { breakdown: { state: "ready", data: bare } as unknown as DeviceBreakdownState });
    await openSection(user, "reference");
    expect(rowOf("reference", "Zone geometry")!.textContent).toContain("unavailable");
  });
});

describe("ruling 4 / X3: the split", () => {
  it("every calculation, then 2 rule checks, then 'Show N more checks', with N computed from the rows", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    await user.click(sectionEl("checked").querySelector("button.rs-head")!);
    const shown = rowsIn("checked").length;
    const more = screen.getByRole("button", { name: /^Show \d+ more check/ });
    const n = Number(more.textContent!.match(/\d+/)![0]);
    await user.click(more);
    expect(rowsIn("checked")).toHaveLength(shown + n);
    expect(screen.queryByRole("button", { name: /^Show \d+ more check/ })).toBeNull();
  });
});

describe("the walk's fixes (X28-X32)", () => {
  const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");

  it("X28: a dimmed section keeps its text at full opacity, so 'No matches' holds AA", () => {
    expect(css).not.toMatch(/\.rs\.is-dim\s*\{[^}]*opacity/);
  });

  it("X29: a code draws whole, and a match inside it is still marked", () => {
    mountFixture(fx, { breakdown: BREAKDOWN });
    type("R9");
    const row = rowOf("reference", "Device schedule")!;
    const code = Array.from(row.querySelectorAll(".rr-code")).find((c) => c.textContent === "R9-9");
    expect(code?.querySelector("mark")?.textContent).toBe("R9");
    expect(css).toMatch(/\.rr-code\s*\{\s*white-space:\s*nowrap/);
  });

  it("X29: with no search a code draws whole with no mark and the same text", async () => {
    const user = userEvent.setup();
    mountFixture(fx, { breakdown: BREAKDOWN });
    await openSection(user, "reference");
    const row = rowOf("reference", "Device schedule")!;
    await openRow(user, row);
    const sub = Array.from(row.querySelectorAll(".rr-line-sub")).find((s) => s.textContent!.includes("R9-9"))!;
    expect(sub.querySelector(".rr-code")?.textContent).toBe("R9-9");
    expect(sub.querySelector("mark")).toBeNull();
  });

  it("X29: a match across a code's edge marks both sides and keeps the text", () => {
    mountFixture(fx, { breakdown: BREAKDOWN });
    type("R9-9 ·");
    const row = rowOf("reference", "Device schedule")!;
    const sub = Array.from(row.querySelectorAll(".rr-line-sub")).find((s) => s.textContent!.includes("R9-9"))!;
    expect(sub.querySelector(".rr-code mark")?.textContent).toBe("R9-9");
    expect(Array.from(sub.querySelectorAll("mark")).map((k) => k.textContent).join("")).toBe("R9-9 ·");
    expect(sub.textContent).toMatch(/^R9-9 · /);
  });

  it("the walk's Retry measure: a text link is at least 44 px wide", () => {
    expect(css).toMatch(/\.rr-link\s*\{[^}]*min-width:\s*44px/);
  });

  it("X30: a label-less pair reads left; a labelled pair keeps its value on the label's line", () => {
    expect(css).toMatch(/\.rr-pair dd:only-child\s*\{[^}]*text-align:\s*left/);
    expect(css).not.toMatch(/\.rr-pair\s*\{[^}]*flex-wrap/);
  });

  it("X31: with no match the status is for screen readers only; the card says it on the page", () => {
    mountFixture(fx);
    type("zzqx");
    const s = screen.getByRole("status");
    expect(s.textContent).toBe('No matches for "zzqx".');
    expect(s.className).toContain("sr-only");
    type("taper");
    expect(screen.getByRole("status").className).not.toContain("sr-only");
  });
});

describe("rulings 6-7: search", () => {
  it("finds text inside closed sections and rows, with no backend call and no write", async () => {
    mountFixture(fx, { breakdown: BREAKDOWN });
    expect(rowsIn("reference")).toHaveLength(0);
    type("R9-9");
    const row = rowOf("reference", "Device schedule")!;
    expect(row.querySelector(".rr-head")?.getAttribute("aria-expanded")).toBe("true");
    expect(row.textContent).toContain("Opened because the match is inside.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.querySelector("[data-section=reference] mark")?.textContent).toBe("R9-9");
  });

  it("'sidewalk': sections with matches show only those rows and say N of M; others dim", () => {
    mountFixture(fx);
    type("sidewalk");
    const ref = sectionEl("reference");
    expect(ref.querySelector(".rs-summary")?.textContent).toMatch(/^\d+ of \d+ lines match$/);
    for (const r of rowsIn("reference")) expect(r.textContent!.toLowerCase()).toMatch(/sidewalk|channeli|r9-9|site/);
    expect(status()).toMatch(/matching line/);
    const dim = Array.from(document.querySelectorAll(".rs.is-dim"));
    for (const d of dim) expect(d.querySelector(".rs-summary")?.textContent).toBe("No matches");
  });

  it("'6B': a match only in a source shows the source line, row closed (X20)", () => {
    mountFixture(fx);
    type("6B");
    const sources = Array.from(document.querySelectorAll(".rr-source"));
    expect(sources.length).toBeGreaterThan(0);
    const row = sources[0].closest(".rr")!;
    expect(row.querySelector(".rr-head")?.getAttribute("aria-expanded")).toBe("false");
    expect(sources[0].textContent).toMatch(/^Source: /);
    expect(sources[0].querySelector("mark")).not.toBeNull();
  });

  it("'cone' finds channelizing devices through the nickname, and a long list narrows", async () => {
    const user = userEvent.setup();
    mountFixture(fx, { breakdown: BREAKDOWN });
    type("cone");
    const row = rowOf("reference", "Device schedule")!;
    expect(row.textContent).toMatch(/2 of 3 device types shown/);
    expect(row.querySelectorAll(".rr-lines li")).toHaveLength(2);
    await user.click(within(row).getByRole("button", { name: "Show all 3 types" }));
    expect(row.querySelectorAll(".rr-lines li")).toHaveLength(3);
  });

  it("the mark is the token, and the search box is labelled for a screen reader", () => {
    mountFixture(fx);
    expect(screen.getByLabelText("SEARCH THE DETAILS")).toBe(box());
    expect(box().placeholder).toBe("A number, a rule or a word: taper, 6B, sidewalk, $500");
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });
});

describe("ruling 8: nothing found", () => {
  it("says so, offers this plan's own words, and every chip finds something", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    type("zebra");
    expect(screen.getByText(/Nothing in this plan's details mentions "zebra"/)).toBeTruthy();
    expect(screen.getByText(/It doesn't search the whole MUTCD\./)).toBeTruthy();
    const chips = Array.from(document.querySelectorAll<HTMLButtonElement>(".rs-chip"));
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.length).toBeLessThanOrEqual(5);
    await user.click(chips[0]);
    expect(box().value).toBe(chips[0].textContent);
    expect(status()).toMatch(/matching line/);
  });

  it("X24: 'flagger' on a shoulder plan finds the real check that names it; search can't hide wire text", () => {
    mountFixture(fx);
    type("flagger");
    expect(document.querySelector(".rs-none")).toBeNull();
    expect(rowOf("checked", "Flagger station lighting 500W @ 8 ft")).not.toBeNull();
  });

  it("'Clear search and show everything' clears", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    type("zebra");
    await user.click(screen.getByRole("button", { name: "Clear search and show everything" }));
    expect(box().value).toBe("");
    expect(document.querySelector(".rs-none")).toBeNull();
  });
});

describe("ruling 9 / P15: clearing restores every state", () => {
  async function arranged() {
    const user = userEvent.setup();
    mountFixture(fx);
    // Open one section and one of its rows; leave the rest closed.
    await openSection(user, "checked");
    await openRow(user, rowOf("checked", "Buffer space")!);
    return { user, before: snapshot() };
  }

  it("× restores it and returns focus to the box", async () => {
    const { user, before } = await arranged();
    await user.type(box(), "sidewalk");
    expect(snapshot()).not.toEqual(before);
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(snapshot()).toEqual(before);
    expect(document.activeElement).toBe(box());
  });

  it("Escape restores it", async () => {
    const { user, before } = await arranged();
    await user.type(box(), "sidewalk");
    await user.keyboard("{Escape}");
    expect(box().value).toBe("");
    expect(snapshot()).toEqual(before);
  });

  it("an emptied box restores it, and a row toggled during the search leaves no trace", async () => {
    const { user, before } = await arranged();
    type("sidewalk");
    await user.click(rowsIn("reference")[0].querySelector(".rr-head")!);
    type("");
    expect(snapshot()).toEqual(before);
  });
});

describe("Rule 10: a failed audit", () => {
  it("opens the section holding Retry, and Retry calls back", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    mountFixture(fx, {
      audit: { state: "error", message: "boom", httpStatus: 500, lastReady: null },
      checkedCount: null,
      pendingCount: null,
      cited: false,
      referenceDefaultOpen: true,
      onRetry,
    });
    expect(expanded(sectionEl("reference").querySelector(".rs-head")?.parentElement)).toBe("true");
    expect(screen.getByRole("alert").textContent).toContain("Audit trail failed: boom");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
    // The counted sections need a settled audit: absent, not a zero.
    expect(sectionEl("checked")).toBeNull();
    expect(sectionEl("pending")).toBeNull();
  });

  describe("the device schedule's failures (#182, #184, #306)", () => {
    const failed = async (b: Record<string, unknown>) => {
      const user = userEvent.setup();
      mountFixture(fx, { breakdown: { state: "error", ...b } as unknown as DeviceBreakdownState });
      await openSection(user, "reference");
      return rowOf("reference", "Device schedule")!;
    };
    const retry = (row: HTMLElement) => within(row).queryByRole("button", { name: "Retry" });

    it("#184: a 400 draws the declined line, no Retry, and doesn't quote the refusal", async () => {
      const row = await failed({ message: "REFUSAL-TEXT", httpStatus: 400 });
      expect(row.textContent).toContain("unavailable: generation declined");
      expect(row.textContent).toContain("Device schedule unavailable while generation is declined.");
      expect(row.textContent).not.toContain("REFUSAL-TEXT");
      expect(retry(row)).toBeNull();
    });

    it("#182: a 429 reads paused and keeps Retry; it never says failed", async () => {
      const row = await failed({ message: "slow down", httpStatus: 429 });
      expect(row.textContent).toContain("paused: retry inside");
      expect(row.textContent).toContain("too many updates");
      expect(row.textContent).not.toMatch(/failed/i);
      expect(retry(row)).not.toBeNull();
    });

    it("a network error with no status keeps Retry", async () => {
      const row = await failed({ message: "network down" });
      expect(row.textContent).toContain("Device breakdown failed: network down");
      expect(retry(row)).not.toBeNull();
    });

    it("#306: a failure from the audit points at its Retry, adds no second one, and doesn't double a full stop", async () => {
      const row = await failed({ message: "It broke.", fromAudit: true });
      expect(row.textContent).toContain("Device breakdown failed: It broke. Retry from the audit trail.");
      expect(row.textContent).not.toContain("..");
      expect(retry(row)).toBeNull();
    });
  });

  it("a failed device schedule starts open with its reason (X2)", async () => {
    const user = userEvent.setup();
    mountFixture(fx, { breakdown: { state: "error", message: "boom", httpStatus: 500 } as DeviceBreakdownState });
    await openSection(user, "reference");
    const row = rowOf("reference", "Device schedule")!;
    expect(row.querySelector(".rr-head")?.getAttribute("aria-expanded")).toBe("true");
    expect(row.querySelector(".rr-glyph")?.textContent).toBe("⚠");
    expect(row.textContent).toContain("Device breakdown failed: boom");
    expect(within(row).getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
