// @vitest-environment happy-dom
//
// #288 Phase 1 clause 1 — the corrections block's suite, MOVED with the
// block.  This file is SetupStrip.corrections.test.tsx transferred: same
// `it` titles, same fixtures, same behavioural claims, so the transfer is
// traceable line by line and nothing quietly stopped being asserted.
//
// WHAT IS BYTE-IDENTICAL: every claim about BEHAVIOUR — the staging
// round-trip, Apply's single write, the dismiss picker's reason/note
// rules, the #227 record and its Undo, the byte-identical-meta undo, the
// bucket-missing rule, the footer's sliced stamp / duration / memoised /
// advisory, details[0] staying out, the spec-46 guard, the in-flight
// disable.  Those assertions are copied character for character.
//
// WHAT CHANGED, and why (Rule 5 — the churn predicted, not explained
// after):
//   · the block is `.needs-you`, not `.site-corrections`, and its header
//     is NEEDS YOU's — so the "Site conditions — scanned" header
//     assertion is gone with the header it read;
//   · rows are rule 74 item rows (`.ny-item`: 20 px glyph / body / auto
//     action), so `.sc-row` → `.ny-item`, `.sc-glyph` → `.ny-glyph`,
//     `.sc-lead`/`.sc-leader`/`.sc-right` are gone and the structural
//     assertions that named them are rewritten against the new tracks.
//     `.sc-name`, `.sc-result`, `.sc-evidence`, `.sc-disclosure`,
//     `.sc-apply`, `.sc-foot`, `.sc-foot-advisory`, `.sys-event` and
//     `.site-correction*` are kept deliberately, so the assertions that
//     read them did not have to move;
//   · Apply and Confirm wear rule 133's `.act`, not `.confirm`;
//   · the Apply row's zero-state sentence gained rule 78's second clause
//     ("staging costs nothing, Apply re-generates once"), which the strip
//     never printed — so the assertions that read it are LONGER, not
//     looser: still exact matches, on the whole sentence;
//   · `aria-busy` / `.sc-inflight` moved to the NEEDS YOU section itself,
//     so their assertions live in GeneratorShell.needs-you.test.tsx where
//     that section is mounted.
//
// NEW HERE: Part 1 §8.25's two manual keys, which the strip never had.

import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import type { StagedCorrection } from "@/lib/scenarios/types";
import type { SiteScanProvenance } from "@/lib/render-types";
import { SiteConditionRows, hasConditionRows } from "./NeedsYouConditions";

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

// #254: the staged set lives in the SHELL (one owner); this host stands
// in for it so the block's staging round-trips through real state.  The
// <ul> is NEEDS YOU's list — the rows are its item rows now.
function Host(props: {
  siteScan: SiteScanProvenance | null;
  scenario: Scenario;
  inFlight: boolean;
  setScenario: (next: Scenario) => void;
}) {
  const [staged, setStaged] = useState<StagedCorrection[]>([]);
  return (
    <ul className="needs-you">
      {props.siteScan && (
        <SiteConditionRows
          scenario={props.scenario}
          setScenario={props.setScenario}
          siteScan={props.siteScan}
          inFlight={props.inFlight}
          staged={staged}
          setStaged={setStaged}
        />
      )}
    </ul>
  );
}
function mount(
  siteScan: SiteScanProvenance | null,
  scenario: Scenario = DEFAULT_SCENARIO,
  inFlight = false,
) {
  const setScenario = vi.fn();
  render(
    <Host siteScan={siteScan} scenario={scenario} inFlight={inFlight} setScenario={setScenario} />,
  );
  return setScenario;
}
const applyBtn = (name: string | RegExp = /^Apply \d+ corrections?$/) =>
  within(block()!).getByRole("button", { name }) as HTMLButtonElement;

/** The block's body: null when the rows rendered nothing at all. */
const block = () => {
  const ul = document.querySelector(".needs-you") as HTMLElement | null;
  return ul && ul.querySelector(".ny-item") ? ul : null;
};
// #255: the backend's advisory (src/api/site_scan.py _VERIFY.strip()) —
// on the provenance once, never per record.
const ADVISORY = "The plan is built to the correction — verify it in the field or on imagery before deploying.";
// Rule 78's standing sentence at zero, in FULL.  #288 clause 1 appended
// the second clause the strip never printed, so these assertions read a
// longer string — by exact match, as they always did.
const ZERO_STANDING = "no corrections staged · staging costs nothing, Apply re-generates once";
/** Condition rows only — not the Apply row, the footer or the picker. */
const condRows = () =>
  block()!.querySelectorAll(
    // `.ny-subhead` joins the exclusions with fix 4: it is a LABEL for
    // the condition rows, not one of them, so it has no glyph, no
    // provenance and no action track to assert.
    ".ny-item:not(.ny-apply):not(.ny-foot):not(.ny-sub):not(.ny-subhead)",
  );

describe("NEEDS YOU — site conditions (#224 phase 4, moved by #288 clause 1)", () => {
  it("an ok scan renders one row per bucket on the wire with the wire's words and one action each", () => {
    mount(ok());
    const b = block();
    expect(b).not.toBeNull();
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
    expect(foot.textContent).toContain("corridor scan · 4 sep · 12:00 utc · apply re-generates the plan");
    expect(foot.textContent).not.toMatch(/ s ·|memoised/);
    const time = foot.querySelector("time") as HTMLTimeElement;
    expect(time.getAttribute("title")).toBe("2026-09-04T12:00:00+00:00");
    expect(time.getAttribute("datetime")).toBe("2026-09-04T12:00:00+00:00");
    expect(time.textContent).toBe("4 sep · 12:00 utc");
    expect(b!.textContent).not.toMatch(/within \d+ ft|in scan|ft corridor/);
    // Rule 78 / #254 (P1): the Apply row is ALWAYS present post-scan — at
    // zero it says so, with the standing sentence, and the button is
    // disabled with the reason on its title.
    const applyRow = b!.querySelector(".ny-item.ny-apply") as HTMLElement;
    expect(applyRow).not.toBeNull();
    expect(within(applyRow).getByText(ZERO_STANDING)).toBeTruthy();
    const apply = within(applyRow).getByRole("button", { name: "Apply 0 corrections" }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    expect(apply.getAttribute("title")).toBe("stage a correction first");
    expect(apply.getAttribute("data-write")).toBe("");
    // Rule 133: the block's controls are .act, one treatment.
    expect(apply.classList.contains("act")).toBe(true);
  });

  it("#251: the footer prints the scan's duration (ms → s, one decimal) and 'memoised' from the wire", () => {
    mount(ok({ duration_ms: 2739, memo_hit: true }));
    const foot = block()!.querySelector(".sc-foot") as HTMLElement;
    expect(foot.textContent).toContain(
      "corridor scan · 4 sep · 12:00 utc · 2.7 s · memoised · apply re-generates the plan",
    );
    cleanup();
    // A fresh fetch: the duration, no "memoised".  A null duration: neither.
    mount(ok({ duration_ms: 20299, memo_hit: false }));
    expect(block()!.querySelector(".sc-foot")!.textContent).toContain("12:00 utc · 20.3 s · apply");
    cleanup();
    mount(ok({ duration_ms: null, memo_hit: true }));
    expect(block()!.querySelector(".sc-foot")!.textContent).toContain("12:00 utc · memoised · apply");
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
    expect(foot.textContent).toContain("site scan · apply re-generates the plan");
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
      // The same predicate, exported so NEEDS YOU can ask before it
      // renders a header over nothing.
      expect(hasConditionRows(scan)).toBe(false);
    }
  });

  it("Assert on an absent row writes exactly one assert marker to meta.siteConditionOverrides", async () => {
    const user = userEvent.setup();
    const setScenario = mount(ok());
    const school = within(block()!).getByText("School zone").closest(".site-correction-row")!;
    await user.click(within(school as HTMLElement).getByRole("button", { name: "Assert" }));
    // #254: STAGED, not written — the row becomes the staged row (◌ +
    // the word + the intent + Undo) and nothing is requested.
    expect(setScenario).not.toHaveBeenCalled();
    const stagedRow = within(block()!).getByText("School zone").closest(".ny-item") as HTMLElement;
    expect(stagedRow.classList.contains("sc-staged")).toBe(true);
    expect(stagedRow.querySelector(".ny-glyph")?.textContent).toBe("◌");
    expect(within(stagedRow).getByText("staged — not yet applied")).toBeTruthy();
    expect(stagedRow.querySelector(".sc-evidence")?.textContent).toBe("assert");
    expect(within(stagedRow).getByRole("button", { name: "Undo" })).toBeTruthy();
    expect(within(block()!).getByText("1 correction staged · not yet applied")).toBeTruthy();
    const apply = applyBtn("Apply 1 correction");
    expect(apply.disabled).toBe(false);
    expect(apply.getAttribute("title")).toBeNull();
    // Apply: ONE write carrying the staged set; the set empties.
    await user.click(apply);
    expect(setScenario).toHaveBeenCalledTimes(1);
    const next = setScenario.mock.calls[0][0] as Scenario;
    expect(next.meta.siteConditionOverrides).toHaveLength(1);
    expect(next.meta.siteConditionOverrides![0]).toMatchObject({ flag: "school_zone", action: "assert" });
    expect(within(block()!).getByText(ZERO_STANDING)).toBeTruthy();
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
    // #254: Confirm stages (the picker closes, the row is the staged row
    // naming the intent); Apply writes.
    expect(setScenario).not.toHaveBeenCalled();
    expect(block()!.querySelector(".site-correction-picker")).toBeNull();
    const stagedRow = within(block()!).getByText("Pedestrian sidewalks").closest(".ny-item") as HTMLElement;
    expect(stagedRow.classList.contains("sc-staged")).toBe(true);
    expect(stagedRow.querySelector(".sc-evidence")?.textContent).toBe("dismiss · other — construction fence");
    await user.click(applyBtn("Apply 1 correction"));
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
    // #249 spec 25/50: a record row carries no result word or evidence —
    // the sentence is the whole readout.
    for (const rec of [dRec, aRec]) {
      expect(rec.querySelector(".sc-result")).toBeNull();
      expect(rec.querySelector(".sc-evidence")).toBeNull();
    }
    // The three uncorrected rows keep their actions.
    expect(b.querySelectorAll(".site-correction-row")).toHaveLength(3);
    // Undo the dismiss: STAGED as an undo intent (the record row becomes
    // the staged row, "undo"); Apply removes that flag's marker, the
    // other stays.
    await user.click(within(dRec).getByRole("button", { name: "Undo" }));
    expect(setScenario).not.toHaveBeenCalled();
    const stagedRow = within(b).getByText("Pedestrian sidewalks").closest(".ny-item") as HTMLElement;
    expect(stagedRow.classList.contains("sc-staged")).toBe(true);
    expect(stagedRow.querySelector(".sc-evidence")?.textContent).toBe("undo");
    expect(within(b).queryByText(dismissed.record_clause)).toBeNull();
    // Undo on the staged row un-stages it: the record is back, still no write.
    await user.click(within(stagedRow).getByRole("button", { name: "Undo" }));
    expect(setScenario).not.toHaveBeenCalled();
    expect(within(b).getByText(dismissed.record_clause)).toBeTruthy();
    await user.click(
      within(within(b).getByText(dismissed.record_clause).closest(".sys-event") as HTMLElement).getByRole(
        "button",
        { name: "Undo" },
      ),
    );
    await user.click(applyBtn("Apply 1 correction"));
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
    await user.click(applyBtn("Apply 1 correction"));
    const next = setScenario.mock.calls[0][0] as Scenario;
    expect(JSON.stringify(next.meta)).toBe(JSON.stringify(DEFAULT_SCENARIO.meta));
  });

  // Rules 74–77 — the structure the item row must keep (happy-dom has no
  // stylesheet, so these pin the DOM the CSS grid lays out; rects are the
  // browser leg).  This is the assertion set the move REWROTE: the #249
  // ledger line (symbol · name · leader · right group) became rule 74's
  // three tracks, so the claim is now about the tracks.
  it("rules 74–77: every row is glyph / body+provenance / citation+action, one button in the action track", () => {
    mount(ok());
    const rows = Array.from(condRows());
    // Five scanned conditions + Part 1 §8.25's two manual keys.
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      const tracks = Array.from(row.children).map((k) => k.className.split(" ")[0]);
      expect(tracks).toEqual(["ny-glyph", "ny-mid", "ny-right"]);
      expect(row.querySelectorAll("button")).toHaveLength(1);
      expect(row.querySelector(".ny-right .ny-acts button")).not.toBeNull();
      // Rule 76: the citation sits above the action, in the same track.
      const right = Array.from(row.querySelector(".ny-right")!.children).map(
        (k) => k.className.split(" ")[0],
      );
      expect(right).toEqual(["ny-cite", "ny-acts"]);
      // Rule 75: the body line, then the provenance — the result word
      // (rule 13: the symbol always rides beside a word) and the
      // evidence the wire carried.
      const mid = Array.from(row.querySelector(".ny-mid")!.children).map(
        (k) => k.className.split(" ")[0],
      );
      expect(mid).toEqual(["ny-body", "ny-prov"]);
      expect(row.querySelector(".ny-glyph")?.textContent).toMatch(/^[▲✓◌]$/);
      expect(row.querySelector(".ny-glyph")?.getAttribute("aria-hidden")).toBe("true");
      expect(row.querySelector(".sc-result")!.textContent!.trim().length).toBeGreaterThan(0);
    }
    // Fix 4: the group is introduced by its own sub-header, which names
    // the rows the block's count is NOT about (§8.5's own words).
    const head = block()!.querySelector(".ny-subhead");
    expect(head, "the condition rows are grouped under a name").not.toBeNull();
    expect(head!.textContent).toContain("Site conditions — scanned");
    expect(head!.querySelector("button"), "a label is not a control").toBeNull();
    // The Apply row is the LAST data line (rule 78), after every
    // condition row and before the scan's provenance.
    const all = Array.from(block()!.querySelectorAll(".ny-item"));
    expect(all[all.length - 2].classList.contains("ny-apply")).toBe(true);
    expect(all[all.length - 1].classList.contains("ny-foot")).toBe(true);
    // Rule 12: no literal count of conditions in the block's copy.
    expect(block()!.textContent).not.toMatch(/of (five|5) checked/i);
  });

  it("#248: details[0] is not printed in the block; the glyphs follow the tiers (▲ detected, ✓ none)", () => {
    mount(ok());
    const b = block()!;
    expect(b.textContent).not.toContain("W Alameda Ave");
    expect(b.textContent).not.toContain("from anchor");
    const intersection = within(b).getByText("Adjacent at-grade intersection").closest(".ny-item")!;
    expect(intersection.querySelector(".ny-glyph")?.textContent).toBe("▲");
    expect(intersection.querySelector(".ny-glyph")?.classList.contains("sc-detected")).toBe(true);
    const school = within(b).getByText("School zone").closest(".ny-item")!;
    expect(school.querySelector(".ny-glyph")?.textContent).toBe("✓");
    expect(school.querySelector(".ny-glyph")?.classList.contains("sc-absent")).toBe(true);
  });

  it("#249 + #270: the open picker is exactly one extra row — Confirm in the row's ACTION track; Cancel in the condition row's", async () => {
    const user = userEvent.setup();
    mount(ok());
    const before = block()!.querySelectorAll(".ny-item").length;
    const sidewalk = within(block()!).getByText("Pedestrian sidewalks").closest(".site-correction-row") as HTMLElement;
    await user.click(within(sidewalk).getByRole("button", { name: "Dismiss" }));
    expect(block()!.querySelectorAll(".ny-item")).toHaveLength(before + 1);
    const picker = sidewalk.nextElementSibling as HTMLElement;
    expect(picker.classList.contains("site-correction-picker")).toBe(true);
    expect(picker.classList.contains("ny-sub")).toBe(true);
    // #270: Confirm sits in the sub-row's ACTION track — the right edge
    // every Dismiss / Assert / Undo / Apply shares — never in the
    // wrapping flex line, so its position and the row's height no longer
    // depend on the legend's length (P4 / P11 / P1).
    expect(picker.querySelectorAll("button")).toHaveLength(1);
    const action = picker.querySelector(":scope > .ny-right") as HTMLElement;
    expect(action).not.toBeNull();
    expect(action.querySelector("button")?.textContent).toBe("Confirm dismiss");
    const line = picker.querySelector(".sc-picker") as HTMLElement;
    expect(line.querySelector("button")).toBeNull();
    expect(line.firstElementChild?.classList.contains("site-correction-reasons")).toBe(true);
    expect(line.lastElementChild?.classList.contains("site-correction-note")).toBe(true);
    expect(within(sidewalk).getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(within(sidewalk).queryByRole("button", { name: "Dismiss" })).toBeNull();
    expect(sidewalk.querySelector(".ny-acts button")?.textContent).toBe("Cancel");
    // The record row keeps the sentence as ONE text node after the inline
    // symbol (#198 / spec 48–49); Undo alone in the action track.
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
    expect(cell.closest(".ny-item")!.querySelector(".ny-acts button")?.textContent).toBe("Undo");
    expect(cell.closest(".ny-item")!.querySelector(".sc-result")).toBeNull();
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
    // #254: the Apply row is present on a records-only block too.
    expect(applyBtn("Apply 0 corrections").disabled).toBe(true);
    expect(b.querySelectorAll(".site-correction-row")).toHaveLength(0);
    // §8.25's two keys do NOT depend on the scan — no scan can see them —
    // so they render here too.  That is the point of the pair: an outage
    // takes the scanned rows, not the operator's own assertions.
    expect(b.querySelectorAll(".site-condition-manual")).toHaveLength(2);
  });

  // Spec 34 (#249) — in flight: the block stays mounted with every button
  // disabled; nothing writes.  (The held-scan CHOICE and aria-busy moved
  // to the shell, which owns both; see GeneratorShell.needs-you.test.tsx.)
  it("#249 spec 34: in flight, every button is disabled and a click writes nothing", async () => {
    const user = userEvent.setup();
    const asserted = {
      flag: "school_zone",
      action: "assert" as const,
      status: "applied" as const,
      scan_detected: false,
      disclosure: "Operator asserted school zone — the scan found none along the corridor.",
    };
    const setScenario = mount(ok({ corrections: [asserted] }), DEFAULT_SCENARIO, true);
    const b = block();
    expect(b, "block mounted on the held scan").not.toBeNull();
    const buttons = Array.from(b!.querySelectorAll("button")) as HTMLButtonElement[];
    expect(buttons.map((x) => x.textContent)).toEqual([
      "Dismiss",
      "Assert",
      "Dismiss",
      "Assert",
      "Undo",
      "Assert",
      "Assert",
      "Apply 0 corrections",
    ]);
    expect(buttons.every((x) => x.disabled)).toBe(true);
    await user.click(within(b!).getAllByRole("button", { name: "Assert" })[0]);
    await user.click(within(b!).getByRole("button", { name: "Undo" }));
    expect(setScenario).not.toHaveBeenCalled();
  });

  // ── Part 1 §8.25 — the two manual keys, NEW in this block ──
  it("§8.25: the two manual keys render as rows with an ASSERT action, and they stage like every other row", async () => {
    const user = userEvent.setup();
    const setScenario = mount(ok());
    const b = block()!;
    const manual = b.querySelectorAll(".site-condition-manual");
    expect(manual).toHaveLength(2);
    const sight = within(b).getByText("Limited sight distance").closest(".ny-item") as HTMLElement;
    // Not asserted: ◌ + the word, and the retired checkbox's own
    // description as the provenance — the words are not rewritten.
    expect(sight.querySelector(".ny-glyph")?.textContent).toBe("◌");
    expect(within(sight).getByText("not asserted")).toBeTruthy();
    expect(sight.querySelector(".sc-evidence")?.textContent).toBe(
      "Curve, hill crest — moves advance signs 50% farther upstream.",
    );
    expect(sight.querySelector(".ny-cite")?.textContent).toBe("OPERATOR");
    // Rule 78: it stages — nothing writes until Apply.
    await user.click(within(sight).getByRole("button", { name: "Assert" }));
    expect(setScenario).not.toHaveBeenCalled();
    await user.click(applyBtn("Apply 1 correction"));
    const next = setScenario.mock.calls[0][0] as Scenario;
    expect(next.meta.siteConditions).toEqual({ limited_sight_distance: true });
    // No correction marker was invented for a key the scan never saw.
    expect(next.meta.siteConditionOverrides).toBeUndefined();
  });

  it("§8.25: an asserted key reads ✓ and its Undo drops the key — meta byte-identical to before", async () => {
    const user = userEvent.setup();
    const scenario: Scenario = {
      ...DEFAULT_SCENARIO,
      meta: { ...DEFAULT_SCENARIO.meta, siteConditions: { driveways_present: true } },
    };
    const setScenario = mount(ok(), scenario);
    const drive = within(block()!).getByText("Driveways present").closest(".ny-item") as HTMLElement;
    expect(drive.querySelector(".ny-glyph")?.textContent).toBe("✓");
    expect(within(drive).getByText("asserted by you")).toBeTruthy();
    await user.click(within(drive).getByRole("button", { name: "Undo" }));
    await user.click(applyBtn("Apply 1 correction"));
    const next = setScenario.mock.calls[0][0] as Scenario;
    expect(next.meta.siteConditions).toEqual({});
    expect(JSON.stringify({ ...next.meta, siteConditions: undefined })).toBe(
      JSON.stringify({ ...DEFAULT_SCENARIO.meta, siteConditions: undefined }),
    );
  });
});
