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

function mount(siteScan: SiteScanProvenance | null, scenario: Scenario = DEFAULT_SCENARIO) {
  const setScenario = vi.fn();
  render(
    <SetupStrip scenario={scenario} setScenario={setScenario} onReopen={vi.fn()} siteScan={siteScan} />,
  );
  return setScenario;
}

const block = () => document.querySelector(".site-corrections") as HTMLElement | null;

describe("SetupStrip — Site conditions — scanned (#224 phase 4)", () => {
  it("an ok scan renders one row per bucket on the wire with the wire's words and one action each", () => {
    mount(ok());
    const b = block();
    expect(b).not.toBeNull();
    expect(within(b!).getByText("Site conditions — scanned")).toBeTruthy();
    const rows = b!.querySelectorAll(".site-correction-row");
    expect(rows).toHaveLength(5); // hospitals is keyless — no row
    const sidewalk = within(b!).getByText("Pedestrian sidewalks").closest(".site-correction-row")!;
    expect(sidewalk.textContent).toContain("detected · 18 found · nearest 46.6 ft from anchor");
    expect(within(sidewalk as HTMLElement).getByRole("button", { name: "Dismiss" })).toBeTruthy();
    const school = within(b!).getByText("School zone").closest(".site-correction-row")!;
    expect(school.textContent).toContain("none along the corridor");
    expect(within(school as HTMLElement).getByRole("button", { name: "Assert" })).toBeTruthy();
    expect(b!.textContent).toContain("measured 2026-09-04T12:00:00+00:00");
    expect(b!.textContent).toContain("a correction re-generates the plan");
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
    // #245: the reason is an in-DOM radio group, never a native select.
    const group = within(picker).getByRole("radiogroup", {
      name: "Reason for dismissing Pedestrian sidewalks",
    });
    await user.click(within(group).getByRole("radio", { name: "Other (say what)" }));
    expect((within(picker).getByRole("button", { name: "Confirm dismiss" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await user.type(within(picker).getByLabelText("Say what"), "construction fence");
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
    // The note input exists only for other.
    expect(within(picker).queryByLabelText("Say what")).toBeNull();
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
      disclosure: "Operator dismissed the scan's pedestrian sidewalks: fenced off. The plan is built to the correction.",
    };
    const asserted = {
      flag: "school_zone",
      action: "assert" as const,
      status: "applied" as const,
      scan_detected: false,
      disclosure: "Operator asserted school zone — the scan found none along the corridor.",
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
    const setScenario = mount(ok({ corrections: [dismissed, asserted] }), scenario);
    const b = block()!;
    const dRec = within(b).getByText(dismissed.disclosure).closest(".sys-event") as HTMLElement;
    expect(dRec.classList.contains("dismissed")).toBe(true);
    expect(dRec.querySelector(".sys-glyph")?.textContent).toBe("×");
    const aRec = within(b).getByText(asserted.disclosure).closest(".sys-event") as HTMLElement;
    expect(aRec.classList.contains("confirmed")).toBe(true);
    expect(aRec.querySelector(".sys-glyph")?.textContent).toBe("✓");
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
    const rec = within(block()!).getByText(moot.disclosure).closest(".sys-event") as HTMLElement;
    expect(rec.classList.contains("warn")).toBe(true); // moot: ⚠, disclosed, never dropped
    expect(rec.querySelector(".sys-glyph")?.textContent).toBe("⚠");
    await user.click(within(rec).getByRole("button", { name: "Undo" }));
    const next = setScenario.mock.calls[0][0] as Scenario;
    expect(JSON.stringify(next.meta)).toBe(JSON.stringify(DEFAULT_SCENARIO.meta));
  });

  it("a proceeded outage with an applied assert shows the record (undo-able) and no scan rows", () => {
    const asserted = {
      flag: "school_zone",
      action: "assert" as const,
      status: "applied" as const,
      scan_detected: null,
      disclosure: "Operator asserted school zone — the site scan did not complete.",
    };
    mount({
      status: "unavailable",
      error: "scan budget exceeded (20 s)",
      proceeded_anyway: true,
      disclosure: "SITE CONDITIONS NOT CHECKED — service unavailable at generation.",
      corrections: [asserted],
    });
    const b = block()!;
    expect(within(b).getByText(asserted.disclosure)).toBeTruthy();
    expect(b.querySelectorAll(".site-correction-row")).toHaveLength(0);
    expect(document.querySelector(".site-not-checked")).not.toBeNull();
  });
});
