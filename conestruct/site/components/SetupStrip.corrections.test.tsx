// @vitest-environment happy-dom
//
// #224 phase 4 (s2-arc18, ruling a) — the strip's "Site conditions —
// scanned" block: five read-only rows from the SERVED scan, Dismiss (with
// a reason) on a detected row, Assert on an absent row, the #227 resolved
// record with Undo once the backend has applied the correction.  Every
// click writes meta.siteConditionOverrides through setScenario (an
// explicit operator action); nothing else writes it.  The stamped view:
// null provenance renders nothing.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import type { SiteScanProvenance } from "@/lib/render-types";
import { SetupStrip } from "./SetupStrip";

afterEach(cleanup);

function ok(over: Partial<SiteScanProvenance> = {}): SiteScanProvenance {
  return {
    status: "ok",
    mode: "corridor",
    measured_at: "2026-09-04T12:00:00+00:00",
    buckets: {
      intersections: { detected: true, count: 26, nearest_distance_ft: 34.1, details: ["W Alameda Ave"] },
      interchanges: { detected: false, count: 0 },
      sidewalks: { detected: true, count: 18, nearest_distance_ft: 46.6 },
      bike_facilities: { detected: false, count: 0 },
      schools: { detected: false, count: 0 },
      hospitals: { detected: true, count: 1 },
    },
    flags: { adjacent_intersection: true, pedestrian_facility: true },
    corrections: [],
    ...over,
  };
}

function mount(
  siteScan: SiteScanProvenance | null,
  scenario: Scenario = DEFAULT_SCENARIO,
  held: { inFlight: boolean; scan: SiteScanProvenance | null } = { inFlight: false, scan: null },
) {
  const setScenario = vi.fn();
  render(
    <SetupStrip
      scenario={scenario}
      setScenario={setScenario}
      onReopen={vi.fn()}
      siteScan={siteScan}
      siteScanInFlight={held.inFlight}
      siteScanHeld={held.scan}
    />,
  );
  return setScenario;
}

const block = () => document.querySelector(".site-corrections") as HTMLElement | null;
// #255: the backend's advisory (src/api/site_scan.py _VERIFY.strip()) —
// on the provenance once, never per record.
const ADVISORY = "The plan is built to the correction — verify it in the field or on imagery before deploying.";

describe("SetupStrip — Site conditions — scanned (#224 phase 4)", () => {
  it("an ok scan renders one row per bucket on the wire with the wire's words and one action each", () => {
    mount(ok());
    const b = block();
    expect(b).not.toBeNull();
    expect(within(b!).getByText("Site conditions — scanned")).toBeTruthy();
    const rows = b!.querySelectorAll(".site-correction-row");
    expect(rows).toHaveLength(5); // hospitals is keyless — no row
    // #248: Result = glyph + word, Evidence = count + nearest (the wire's
    // numbers; details[0] stays in section 03 and the PDF).
    const sidewalk = within(b!).getByText("Pedestrian sidewalks").closest(".site-correction-row")!;
    expect(within(sidewalk as HTMLElement).getByText("detected")).toBeTruthy();
    expect(sidewalk.querySelector(".sc-evidence")?.textContent).toBe("18 found · nearest 46.6 ft");
    expect(within(sidewalk as HTMLElement).getByRole("button", { name: "Dismiss" })).toBeTruthy();
    const school = within(b!).getByText("School zone").closest(".site-correction-row")!;
    expect(within(school as HTMLElement).getByText("none along the corridor")).toBeTruthy();
    expect(school.querySelector(".sc-evidence")?.textContent).toBe("");
    expect(within(school as HTMLElement).getByRole("button", { name: "Assert" })).toBeTruthy();
    // #249 footer (GO ruling b + e/a′): the scan mode from the wire, the
    // stamp sliced from the ISO, the full ISO on the <time>; no radius.
    // #251 (ruling d): no duration on the wire → no duration segment,
    // memo_hit absent → no "memoised".
    const foot = b!.querySelector(".sc-foot") as HTMLElement;
    expect(foot.textContent).toContain("corridor scan · 4 sep · 12:00 utc · a correction re-generates the plan");
    expect(foot.textContent).not.toMatch(/ s ·|memoised/);
    const time = foot.querySelector("time") as HTMLTimeElement;
    expect(time.getAttribute("title")).toBe("2026-09-04T12:00:00+00:00");
    expect(time.getAttribute("datetime")).toBe("2026-09-04T12:00:00+00:00");
    expect(time.textContent).toBe("4 sep · 12:00 utc");
    expect(b!.textContent).not.toMatch(/within \d+ ft|in scan|ft corridor/);
  });

  it("#251: the footer prints the scan's duration (ms → s, one decimal) and 'memoised' from the wire", () => {
    mount(ok({ duration_ms: 2739, memo_hit: true }));
    const foot = block()!.querySelector(".sc-foot") as HTMLElement;
    expect(foot.textContent).toContain(
      "corridor scan · 4 sep · 12:00 utc · 2.7 s · memoised · a correction re-generates the plan",
    );
    cleanup();
    // A fresh fetch: the duration, no "memoised".  A null duration: neither.
    mount(ok({ duration_ms: 20299, memo_hit: false }));
    expect(block()!.querySelector(".sc-foot")!.textContent).toContain("12:00 utc · 20.3 s · a correction");
    cleanup();
    mount(ok({ duration_ms: null, memo_hit: true }));
    expect(block()!.querySelector(".sc-foot")!.textContent).toContain("12:00 utc · memoised · a correction");
  });

  it("#249: a measured_at that is not a UTC ISO stamp prints verbatim — never converted (rule 10)", () => {
    mount(ok({ measured_at: "2026-09-04T12:00:00-06:00" }));
    const time = block()!.querySelector(".sc-foot time") as HTMLTimeElement;
    expect(time.textContent).toBe("2026-09-04T12:00:00-06:00");
    expect(time.getAttribute("title")).toBe("2026-09-04T12:00:00-06:00");
    cleanup();
    mount(ok({ measured_at: null, mode: null }));
    const foot = block()!.querySelector(".sc-foot") as HTMLElement;
    expect(foot.querySelector("time")).toBeNull();
    expect(foot.textContent).toContain("site scan · a correction re-generates the plan");
  });

  it("a bucket missing from the wire renders no row (absence of signal is not absence of a feature)", () => {
    mount(ok({ buckets: { schools: { detected: false, count: 0 } } }));
    expect(block()!.querySelectorAll(".site-correction-row")).toHaveLength(1);
  });

  it("null provenance (mid-refetch), not_run, and a refusal render nothing", () => {
    for (const scan of [
      null,
      { status: "not_run", reason: "not_requested" } as SiteScanProvenance,
      { status: "unavailable", proceeded_anyway: false } as SiteScanProvenance,
    ]) {
      cleanup();
      mount(scan);
      expect(block()).toBeNull();
    }
  });

  it("Assert on an absent row writes exactly one assert marker to meta.siteConditionOverrides", async () => {
    const user = userEvent.setup();
    const setScenario = mount(ok());
    const school = within(block()!).getByText("School zone").closest(".site-correction-row")!;
    await user.click(within(school as HTMLElement).getByRole("button", { name: "Assert" }));
    expect(setScenario).toHaveBeenCalledTimes(1);
    const next = setScenario.mock.calls[0][0] as Scenario;
    expect(next.meta.siteConditionOverrides).toHaveLength(1);
    expect(next.meta.siteConditionOverrides![0]).toMatchObject({ flag: "school_zone", action: "assert" });
    expect(next.meta.siteConditionOverrides![0]).not.toHaveProperty("reason");
    // Nothing else on the scenario moved (the corrections never become manual flags).
    expect({ ...next.meta, siteConditionOverrides: undefined }).toEqual({
      ...DEFAULT_SCENARIO.meta,
      siteConditionOverrides: undefined,
    });
  });

  it("Dismiss needs a reason: the confirm stays disabled until one is chosen, a note only for other", async () => {
    const user = userEvent.setup();
    const setScenario = mount(ok());
    const sidewalk = within(block()!).getByText("Pedestrian sidewalks").closest(".site-correction-row")!;
    await user.click(within(sidewalk as HTMLElement).getByRole("button", { name: "Dismiss" }));
    const picker = block()!.querySelector(".site-correction-picker") as HTMLElement;
    expect(picker).not.toBeNull();
    const confirm = within(picker).getByRole("button", { name: "Confirm dismiss" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(confirm.getAttribute("title")).toBe("choose a reason"); // #255: the disable says why
    // #245: the reason is an in-DOM radio group, never a native select.
    const group = within(picker).getByRole("radiogroup", {
      name: "Reason for dismissing Pedestrian sidewalks",
    });
    await user.click(within(group).getByRole("radio", { name: "Other (say what)" }));
    // #255: a chosen reason ENABLES Confirm; the note is validated on the
    // click — focus lands on it, aria-invalid, the placeholder says
    // required — so Confirm never moves and a click always answers.
    const confirmAfter = within(picker).getByRole("button", { name: "Confirm dismiss" }) as HTMLButtonElement;
    expect(confirmAfter.disabled).toBe(false);
    expect(confirmAfter.getAttribute("title")).toBeNull();
    await user.click(confirmAfter);
    expect(setScenario).not.toHaveBeenCalled();
    const noteEl = within(picker).getByLabelText("Say what") as HTMLInputElement;
    expect(noteEl.getAttribute("aria-invalid")).toBe("true");
    expect(noteEl.placeholder).toBe("say what — required");
    expect(document.activeElement).toBe(noteEl);
    await user.type(noteEl, "construction fence");
    expect(noteEl.getAttribute("aria-invalid")).toBeNull();
    expect(noteEl.placeholder).toBe("say what");
    await user.click(within(picker).getByRole("button", { name: "Confirm dismiss" }));
    expect(setScenario).toHaveBeenCalledTimes(1);
    const next = setScenario.mock.calls[0][0] as Scenario;
    expect(next.meta.siteConditionOverrides).toEqual([
      expect.objectContaining({
        flag: "pedestrian_facility",
        action: "dismiss",
        reason: "other",
        note: "construction fence",
      }),
    ]);
  });

  it("#245: the four reasons render in the DOM as radios (measurable), the chosen one carries the ✓ glyph", async () => {
    const user = userEvent.setup();
    mount(ok());
    const sidewalk = within(block()!).getByText("Pedestrian sidewalks").closest(".site-correction-row")!;
    await user.click(within(sidewalk as HTMLElement).getByRole("button", { name: "Dismiss" }));
    const picker = block()!.querySelector(".site-correction-picker") as HTMLElement;
    expect(picker.querySelector("select")).toBeNull();
    const group = within(picker).getByRole("radiogroup", {
      name: "Reason for dismissing Pedestrian sidewalks",
    });
    const radios = within(group).getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((r) => r.value)).toEqual(["fenced", "removed", "not_in_work_zone", "other"]);
    // Each chip's label is one direct text node (getByText reads it).
    for (const l of ["Fenced off", "Removed", "Not in the work zone", "Other (say what)"]) {
      expect(within(group).getByText(l)).toBeTruthy();
    }
    expect(radios.every((r) => !r.checked)).toBe(true);
    expect(group.querySelectorAll(".reason-chip.chosen")).toHaveLength(0);
    await user.click(within(group).getByRole("radio", { name: "Removed" }));
    const chosen = group.querySelectorAll(".reason-chip.chosen");
    expect(chosen).toHaveLength(1);
    expect(chosen[0].querySelector(".reason-glyph")?.textContent).toBe("✓");
    expect(chosen[0].querySelector(".reason-text")?.textContent).toBe("Removed");
    expect((within(group).getByRole("radio", { name: "Removed" }) as HTMLInputElement).checked).toBe(true);
    // #255 (P1): the note slot is ALWAYS mounted — void until Other:
    // disabled, out of the tree and the Tab order, so choosing Other
    // never moves Confirm.
    const voidNote = picker.querySelector(".site-correction-note") as HTMLInputElement;
    expect(voidNote).not.toBeNull();
    expect(voidNote.classList.contains("is-void")).toBe(true);
    expect(voidNote.disabled).toBe(true);
    expect(voidNote.getAttribute("aria-hidden")).toBe("true");
    expect(voidNote.tabIndex).toBe(-1);
    expect(
      (within(picker).getByRole("button", { name: "Confirm dismiss" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("Cancel closes the picker without writing", async () => {
    const user = userEvent.setup();
    const setScenario = mount(ok());
    const sidewalk = within(block()!).getByText("Pedestrian sidewalks").closest(".site-correction-row")!;
    await user.click(within(sidewalk as HTMLElement).getByRole("button", { name: "Dismiss" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(block()!.querySelector(".site-correction-picker")).toBeNull();
    expect(setScenario).not.toHaveBeenCalled();
  });

  it("an applied correction re-renders its row as the resolved record (× / ✓ + the backend sentence + Undo)", async () => {
    const user = userEvent.setup();
    const dismissed = {
      flag: "pedestrian_facility",
      action: "dismiss" as const,
      reason: "fenced",
      status: "applied" as const,
      scan_detected: true,
      disclosure: "Operator dismissed the scan's pedestrian sidewalks: fenced off. " + ADVISORY,
      record_clause: "Operator dismissed the scan's pedestrian sidewalks: fenced off.",
    };
    const asserted = {
      flag: "school_zone",
      action: "assert" as const,
      status: "applied" as const,
      scan_detected: false,
      disclosure: "Operator asserted school zone — the scan found none along the corridor. " + ADVISORY,
      record_clause: "Operator asserted school zone — the scan found none along the corridor.",
    };
    const scenario: Scenario = {
      ...DEFAULT_SCENARIO,
      meta: {
        ...DEFAULT_SCENARIO.meta,
        siteConditionOverrides: [
          { flag: "pedestrian_facility", action: "dismiss", reason: "fenced", recorded_at: "2026-09-04T12:00:00+00:00" },
          { flag: "school_zone", action: "assert", recorded_at: "2026-09-04T12:00:00+00:00" },
        ],
      },
    };
    const setScenario = mount(ok({ corrections: [dismissed, asserted], corrections_advisory: ADVISORY }), scenario);
    const b = block()!;
    // #255: the row prints record_clause (one text node); the advisory is
    // the footer's second line, ONCE for two records — never per row.
    const dRec = within(b).getByText(dismissed.record_clause).closest(".sys-event") as HTMLElement;
    expect(b.textContent!.split(ADVISORY).length - 1).toBe(1);
    expect(b.querySelector(".sc-foot .sc-foot-advisory")?.textContent).toBe(ADVISORY);
    expect(within(b).queryByText(dismissed.disclosure)).toBeNull();
    expect(dRec.classList.contains("dismissed")).toBe(true);
    expect(dRec.querySelector(".sys-glyph")?.textContent).toBe("×");
    const aRec = within(b).getByText(asserted.record_clause).closest(".sys-event") as HTMLElement;
    expect(aRec.classList.contains("confirmed")).toBe(true);
    expect(aRec.querySelector(".sys-glyph")?.textContent).toBe("✓");
    // #249 spec 25/50: a record row carries no result word, leader, or
    // evidence — the sentence is the whole readout.
    for (const rec of [dRec, aRec]) {
      expect(rec.querySelector(".sc-result")).toBeNull();
      expect(rec.querySelector(".sc-leader")).toBeNull();
      expect(rec.querySelector(".sc-evidence")).toBeNull();
    }
    // The three uncorrected rows keep their actions.
    expect(b.querySelectorAll(".site-correction-row")).toHaveLength(3);
    // Undo the dismiss: the marker for that flag goes, the other stays.
    await user.click(within(dRec).getByRole("button", { name: "Undo" }));
    expect(setScenario).toHaveBeenCalledTimes(1);
    const next = setScenario.mock.calls[0][0] as Scenario;
    expect(next.meta.siteConditionOverrides).toEqual([scenario.meta.siteConditionOverrides![1]]);
  });

  it("undo of the last correction drops the key: meta is byte-identical to before the correction", async () => {
    const user = userEvent.setup();
    const moot = {
      flag: "school_zone",
      action: "dismiss" as const,
      reason: "removed",
      status: "moot" as const,
      scan_detected: false,
      disclosure: "Operator dismissal of school zone is moot — the scan found none along the corridor; nothing to dismiss.",
      record_clause: "Operator dismissal of school zone is moot — the scan found none along the corridor; nothing to dismiss.",
    };
    const scenario: Scenario = {
      ...DEFAULT_SCENARIO,
      meta: {
        ...DEFAULT_SCENARIO.meta,
        siteConditionOverrides: [
          { flag: "school_zone", action: "dismiss", reason: "removed", recorded_at: "2026-09-04T12:00:00+00:00" },
        ],
      },
    };
    const setScenario = mount(ok({ corrections: [moot] }), scenario);
    const rec = within(block()!).getByText(moot.record_clause).closest(".sys-event") as HTMLElement;
    expect(rec.classList.contains("warn")).toBe(true); // moot: ⚠, disclosed, never dropped
    // A moot record built nothing: the wire carries no advisory and the
    // footer prints none (rule 10 — absence renders as absence).
    expect(block()!.querySelector(".sc-foot-advisory")).toBeNull();
    expect(block()!.textContent).not.toContain(ADVISORY);
    expect(rec.querySelector(".sys-glyph")?.textContent).toBe("⚠");
    await user.click(within(rec).getByRole("button", { name: "Undo" }));
    const next = setScenario.mock.calls[0][0] as Scenario;
    expect(JSON.stringify(next.meta)).toBe(JSON.stringify(DEFAULT_SCENARIO.meta));
  });

  // #249 — structure the ledger must keep (happy-dom has no stylesheet,
  // so these pin the DOM the CSS grid lays out; rects are the browser
  // leg).  Row = ledger line (symbol · name · leader · right group) +
  // action cell; exactly one button per row, in the action cell.
  it("#249: every row is a ledger line plus one action cell holding exactly one button", () => {
    mount(ok());
    const rows = block()!.querySelectorAll(".sc-row");
    expect(rows).toHaveLength(5);
    for (const row of Array.from(rows)) {
      expect(row.querySelectorAll(":scope > .sc-lead")).toHaveLength(1);
      expect(row.querySelectorAll(":scope > .sc-action")).toHaveLength(1);
      expect(row.querySelectorAll("button")).toHaveLength(1);
      expect(row.querySelector(".sc-action button")).not.toBeNull();
      // Ledger order: symbol → name → leader → right group (spec K77).
      const kids = Array.from(row.querySelector(":scope > .sc-lead")!.children).map((k) => k.className.split(" ")[0]);
      expect(kids).toEqual(["sc-glyph", "sc-name", "sc-leader", "sc-right"]);
      // The right group is the result word then the evidence (rule 13:
      // the symbol always rides beside a word).
      const right = row.querySelector(".sc-right")!;
      expect(Array.from(right.children).map((k) => k.className.split(" ")[0])).toEqual(["sc-result", "sc-evidence"]);
      expect(row.querySelector(".sc-glyph")?.textContent).toMatch(/^[▲✓]$/);
      expect(row.querySelector(".sc-glyph")?.getAttribute("aria-hidden")).toBe("true");
      expect(row.querySelector(".sc-result")!.textContent!.trim().length).toBeGreaterThan(0);
    }
    // No column heads on a ledger (arc-20 ruling e superseded).
    expect(block()!.querySelector(".sc-head")).toBeNull();
    // Rule 12: no literal count of conditions in the block's copy.
    expect(block()!.textContent).not.toMatch(/of (five|5) checked/i);
  });

  it("#248: details[0] is not printed in the block; the glyphs follow the tiers (▲ detected, ✓ none)", () => {
    mount(ok());
    const b = block()!;
    expect(b.textContent).not.toContain("W Alameda Ave");
    expect(b.textContent).not.toContain("from anchor");
    const intersection = within(b).getByText("Adjacent at-grade intersection").closest(".sc-row")!;
    expect(intersection.querySelector(".sc-glyph")?.textContent).toBe("▲");
    expect(intersection.querySelector(".sc-glyph")?.classList.contains("sc-detected")).toBe(true);
    const school = within(b).getByText("School zone").closest(".sc-row")!;
    expect(school.querySelector(".sc-glyph")?.textContent).toBe("✓");
    expect(school.querySelector(".sc-glyph")?.classList.contains("sc-absent")).toBe(true);
  });

  it("#249: the open picker is exactly one extra row — Confirm last in its flex line, Cancel in the condition row's action cell", async () => {
    const user = userEvent.setup();
    mount(ok());
    const before = block()!.querySelectorAll(".sc-row").length;
    const sidewalk = within(block()!).getByText("Pedestrian sidewalks").closest(".site-correction-row") as HTMLElement;
    await user.click(within(sidewalk).getByRole("button", { name: "Dismiss" }));
    const rows = block()!.querySelectorAll(".sc-row");
    expect(rows).toHaveLength(before + 1);
    const picker = sidewalk.nextElementSibling as HTMLElement;
    expect(picker.classList.contains("site-correction-picker")).toBe(true);
    expect(picker.classList.contains("sc-sub")).toBe(true);
    // Spec 38/42: legend + chips, (note), Confirm — one flex line, no
    // action cell on the sub-row (supersedes arc-20 ruling f).
    expect(picker.querySelector(".sc-action")).toBeNull();
    expect(picker.querySelectorAll("button")).toHaveLength(1);
    const line = picker.querySelector(".sc-picker") as HTMLElement;
    expect(line.lastElementChild?.tagName).toBe("BUTTON");
    expect(line.lastElementChild?.textContent).toBe("Confirm dismiss");
    expect(line.firstElementChild?.classList.contains("site-correction-reasons")).toBe(true);
    expect(within(sidewalk).getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(within(sidewalk).queryByRole("button", { name: "Dismiss" })).toBeNull();
    expect(sidewalk.querySelector(".sc-action button")?.textContent).toBe("Cancel");
    // The record row keeps the sentence as ONE text node after the inline
    // symbol (#198 / spec 48–49); Undo alone in the action cell.
    cleanup();
    const disclosure = "Operator asserted school zone — the scan found none along the corridor.";
    mount(
      ok({
        corrections: [
          { flag: "school_zone", action: "assert", status: "applied", scan_detected: false, disclosure, record_clause: disclosure },
        ],
      }),
    );
    const cell = within(block()!).getByText(disclosure);
    expect(cell.classList.contains("sc-disclosure")).toBe(true);
    expect(cell.childNodes).toHaveLength(1);
    const lead = cell.parentElement as HTMLElement;
    expect(lead.classList.contains("sc-lead")).toBe(true);
    expect(Array.from(lead.children).map((k) => k.className)).toEqual(["sys-glyph", "sc-disclosure"]);
    expect(cell.closest(".sc-row")!.querySelector(".sc-action button")?.textContent).toBe("Undo");
    expect(cell.closest(".sc-row")!.querySelector(".sc-result")).toBeNull();
  });

  it("a proceeded outage with an applied assert shows the record (undo-able) and no scan rows", () => {
    const asserted = {
      flag: "school_zone",
      action: "assert" as const,
      status: "applied" as const,
      scan_detected: null,
      disclosure: "Operator asserted school zone — the site scan did not complete. " + ADVISORY,
      record_clause: "Operator asserted school zone — the site scan did not complete.",
    };
    mount({
      status: "unavailable",
      error: "scan budget exceeded (20 s)",
      proceeded_anyway: true,
      disclosure: "SITE CONDITIONS NOT CHECKED — service unavailable at generation.",
      corrections: [asserted],
      corrections_advisory: ADVISORY,
    });
    const b = block()!;
    expect(within(b).getByText(asserted.record_clause)).toBeTruthy();
    expect(b.querySelectorAll(".sc-foot-advisory")).toHaveLength(1);
    expect(b.querySelectorAll(".site-correction-row")).toHaveLength(0);
    expect(document.querySelector(".site-not-checked")).not.toBeNull();
  });

  // Spec 34 (#249) — in flight: the block stays mounted on the HELD scan
  // with every button disabled; nothing writes.  Without a held scan
  // (first generate) it still renders nothing.
  it("#249 spec 34: in flight, the held scan renders with every button disabled and aria-busy; a click writes nothing", async () => {
    const user = userEvent.setup();
    const asserted = {
      flag: "school_zone",
      action: "assert" as const,
      status: "applied" as const,
      scan_detected: false,
      disclosure: "Operator asserted school zone — the scan found none along the corridor.",
    };
    const setScenario = mount(null, DEFAULT_SCENARIO, { inFlight: true, scan: ok({ corrections: [asserted] }) });
    const b = block();
    expect(b, "block mounted on the held scan").not.toBeNull();
    expect(b!.getAttribute("aria-busy")).toBe("true");
    expect(b!.classList.contains("sc-inflight")).toBe(true);
    const buttons = Array.from(b!.querySelectorAll("button")) as HTMLButtonElement[];
    expect(buttons.map((x) => x.textContent)).toEqual(["Dismiss", "Assert", "Dismiss", "Assert", "Undo"]);
    expect(buttons.every((x) => x.disabled)).toBe(true);
    await user.click(within(b!).getAllByRole("button", { name: "Assert" })[0]);
    await user.click(within(b!).getByRole("button", { name: "Undo" }));
    expect(setScenario).not.toHaveBeenCalled();
    // The NOT-CHECKED container reads only the stamped view: a held
    // outage never re-announces as current.
    cleanup();
    mount(null, DEFAULT_SCENARIO, {
      inFlight: true,
      scan: { status: "unavailable", proceeded_anyway: true, disclosure: "SITE CONDITIONS NOT CHECKED — x", corrections: [asserted] },
    });
    expect(document.querySelector(".site-not-checked")).toBeNull();
    expect(block()).not.toBeNull();
    cleanup();
    // No held scan (first generate): nothing.
    mount(null, DEFAULT_SCENARIO, { inFlight: true, scan: null });
    expect(block()).toBeNull();
    // Settled (not in flight): the held scan is ignored, the stamped view rules.
    cleanup();
    mount(null, DEFAULT_SCENARIO, { inFlight: false, scan: ok() });
    expect(block()).toBeNull();
  });
});
