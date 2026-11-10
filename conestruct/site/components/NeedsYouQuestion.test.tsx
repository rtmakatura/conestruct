// @vitest-environment happy-dom
//
// #437 (UX group 2, Option B) — NEEDS YOU, one question at a time.
// rulings.md rulings 3-7 with S1-S5.  The producer (ruling 4's order and
// ruling 5's lines) and the mounted flow (Rule 11: the staged payload the
// clicks build, not a pure function alone).

import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { conditionRows } from "@/lib/needs-you-conditions";
import { buildQuestions, openQuestionCount, type NeedsYouQuestion } from "@/lib/needs-you-items";
import type { SiteAdjustmentRecord, SiteScanProvenance } from "@/lib/render-types";
import type { StagedCorrection } from "@/lib/scenarios/types";
import { QuestionFlow } from "./NeedsYouQuestion";

afterEach(cleanup);

// The Denver Colfax shape: the intersection flags (0 devices), the
// sidewalks changed the plan (4 devices).  Bucket order puts the
// intersection first; ruling 4 must put the sidewalks first.
function colfax(over: Partial<SiteScanProvenance> = {}): SiteScanProvenance {
  return {
    status: "ok",
    mode: "corridor",
    measured_at: "2026-11-02T16:13:00+00:00",
    duration_ms: 3800,
    buckets: {
      intersections: { detected: true, count: 3, nearest_distance_ft: 49.9 },
      interchanges: { detected: false, count: 0 },
      sidewalks: { detected: true, count: 57, nearest_distance_ft: 25.6 },
      bike_facilities: { detected: false, count: 0 },
      schools: { detected: false, count: 0 },
    },
    corrections: [],
    ...over,
  } as SiteScanProvenance;
}
const ADJ: SiteAdjustmentRecord[] = [
  { flag: "pedestrian_facility", action: "add", rule: "r", citation: "MUTCD § 6C.02", devices_added: 4 },
  { flag: "adjacent_intersection", action: "flag", rule: "r", citation: "MUTCD § 6N.12", devices_added: 0 },
];
const qs = (scan: SiteScanProvenance, staged: StagedCorrection[] = [], adj = ADJ) =>
  buildQuestions(conditionRows(scan, staged, {}), adj, scan.corrections ?? []);

describe("buildQuestions (ruling 4's order, ruling 5's lines)", () => {
  it("changed-the-plan first, then flag-only; only detected scanned flags are questions (S5)", () => {
    const q = qs(colfax());
    expect(q.map((x) => x.flag)).toEqual(["pedestrian_facility", "adjacent_intersection"]);
    expect(q.map((x) => x.changesPlan)).toEqual([true, false]);
  });

  it("the sidewalk lines carry the record's own device count and no total (S4)", () => {
    const [side] = qs(colfax());
    expect(side.question).toBe("Are there sidewalks along the work zone?");
    expect(side.explanation).toBe(
      "The map shows sidewalks 25.6 ft from the work, so we added 4 devices to protect people walking. Your answer decides whether they stay.",
    );
    expect(side.yes).toEqual({ label: "Yes, they're there", consequence: "The 4 devices stay in the plan." });
    expect(side.no).toEqual({ label: "No, there aren't any", consequence: "The 4 devices come off the plan." });
    expect(side.citation).toBe("MUTCD § 6C.02");
  });

  it("the intersection lines are S3's, with TCS", () => {
    const [, ix] = qs(colfax());
    expect(ix.explanation).toBe(
      "The map shows an intersection 49.9 ft from the work. The plan adds no devices for it; the cross-street layout stays with your TCS.",
    );
    expect(ix.yes.consequence).toBe("Nothing changes. The TCS still lays out the cross street.");
    expect(ix.no.consequence).toBe(
      "No devices change. Your answer goes in the audit trail for the TCS to check.",
    );
    expect(ix.title).toBe("an intersection next to the work");
  });

  it("#448: every kind's three sentences (drawn, no line, scan only); drawn is today's", () => {
    const all = colfax({
      buckets: {
        intersections: { detected: true, count: 3, nearest_distance_ft: 73.2 },
        interchanges: { detected: true, count: 1, nearest_distance_ft: 410 },
        sidewalks: { detected: true, count: 57, nearest_distance_ft: 25.6 },
        bike_facilities: { detected: true, count: 2, nearest_distance_ft: 12.1 },
        schools: { detected: true, count: 1 },
      },
    } as Partial<SiteScanProvenance>);
    const adj: SiteAdjustmentRecord[] = [
      ...ADJ,
      { flag: "adjacent_interchange", action: "flag", rule: "r", citation: "c", devices_added: 0 },
      { flag: "bicycle_facility", action: "add", rule: "r", citation: "c", devices_added: 1 },
    ];
    const by = Object.fromEntries(
      qs(all, [], adj).map((q) => [q.flag, [q.explanation, q.explanationNoLine, q.explanationScan]]),
    );
    expect(by).toEqual({
      pedestrian_facility: [
        "The map shows sidewalks 25.6 ft from the work, so we added 4 devices to protect people walking. Your answer decides whether they stay.",
        "The scan found sidewalks 25.6 ft from the work, but the map couldn't draw them. Check them at street level. We added 4 devices to protect people walking. Your answer decides whether they stay.",
        "The scan found sidewalks 25.6 ft from the work, so we added 4 devices to protect people walking. Your answer decides whether they stay.",
      ],
      bicycle_facility: [
        "The map shows a bike lane 12.1 ft from the work, so we added 1 device for people on bikes. Your answer decides whether they stay.",
        "The scan found a bike lane 12.1 ft from the work, but the map couldn't draw it. Check it at street level. We added 1 device for people on bikes. Your answer decides whether they stay.",
        "The scan found a bike lane 12.1 ft from the work, so we added 1 device for people on bikes. Your answer decides whether they stay.",
      ],
      adjacent_intersection: [
        "The map shows an intersection 73.2 ft from the work. The plan adds no devices for it; the cross-street layout stays with your TCS.",
        "The scan found an intersection 73.2 ft from the work, but the map couldn't draw it. Check it at street level. The plan adds no devices for it; the cross-street layout stays with your TCS.",
        "The scan found an intersection 73.2 ft from the work. The plan adds no devices for it; the cross-street layout stays with your TCS.",
      ],
      adjacent_interchange: [
        "The map shows a highway interchange 410 ft from the work. The plan adds no devices for it; the ramp layout stays with your TCS.",
        "The scan found a highway interchange 410 ft from the work, but the map couldn't draw it. Check it at street level. The plan adds no devices for it; the ramp layout stays with your TCS.",
        "The scan found a highway interchange 410 ft from the work. The plan adds no devices for it; the ramp layout stays with your TCS.",
      ],
      school_zone: [
        "The map shows a school zone near the work.",
        "The scan found a school zone near the work, but the map couldn't draw it. Check it at street level.",
        "The scan found a school zone near the work.",
      ],
    });
  });

  it("Rule 10: with no adjustment record, no device count is stated", () => {
    // No record: nothing changed the plan, so the scan order holds.
    const side = qs(colfax(), [], []).find((x) => x.flag === "pedestrian_facility")!;
    expect(side.explanation).toBe("The map shows sidewalks 25.6 ft from the work.");
    expect(side.yes.consequence).not.toMatch(/\d/);
    expect(side.no.consequence).not.toMatch(/\d/);
    expect(side.citation).toBeNull();
  });

  it("answers: staged first, then the applied record; a moot record is no answer; a staged Undo reopens", () => {
    const applied = colfax({
      corrections: [
        { flag: "pedestrian_facility", action: "confirm", status: "confirmed", disclosure: "d" } as never,
        { flag: "adjacent_intersection", action: "dismiss", reason: "not_there", status: "applied", disclosure: "d" } as never,
      ],
    });
    let q = qs(applied);
    expect(q.map((x) => [x.answer, x.answerSource])).toEqual([["yes", "applied"], ["no", "applied"]]);
    expect(openQuestionCount(q)).toBe(0);
    q = qs(applied, [{ flag: "pedestrian_facility", marker: null }]);
    expect(q[0].answer).toBeNull();
    expect(q[0].answerSource).toBeNull();
    expect(openQuestionCount(q)).toBe(1);
    const moot = colfax({
      corrections: [{ flag: "pedestrian_facility", action: "confirm", status: "moot", disclosure: "d" } as never],
    });
    expect(qs(moot)[0].answer).toBeNull();
  });
});

let staged: StagedCorrection[] = [];
function Host({
  scan = colfax(),
  inFlight = false,
  onApply = () => {},
}: {
  scan?: SiteScanProvenance;
  inFlight?: boolean;
  onApply?: () => void;
}) {
  const [s, setS] = useState<StagedCorrection[]>([]);
  staged = s;
  const questions: NeedsYouQuestion[] = qs(scan, s);
  return (
    <div className="workbench">
      <section className="needs-you owns-primary">
        <QuestionFlow
          questions={questions}
          staged={s}
          setStaged={setS}
          onApply={onApply}
          siteScan={scan}
          inFlight={inFlight}
          ownsPrimary
        />
      </section>
    </div>
  );
}
const markerOf = (flag: string) =>
  (staged.find((x) => "flag" in x && x.flag === flag) as { marker: Record<string, unknown> | null } | undefined)
    ?.marker;

describe("QuestionFlow (rulings 3, 5, 6, 7)", () => {
  it("opens on question 1 of 2 with one segment per question and the remaining row", () => {
    const { container } = render(<Host />);
    expect(screen.getByText("Question 1 of 2")).toBeTruthy();
    // #438 item 5: NEEDS YOU is h2, so the question title is h3.
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      "Are there sidewalks along the work zone?",
    );
    const segs = container.querySelectorAll(".nyq-seg");
    expect(segs.length).toBe(2);
    expect(segs[0].className).toContain("is-current");
    expect(segs[1].className).not.toMatch(/is-current|is-done/);
    expect(screen.getByText("Next: an intersection next to the work")).toBeTruthy();
    expect(screen.getByText(/Source: MUTCD § 6C.02 · map data from OpenStreetMap/)).toBeTruthy();
  });

  it("Next is disabled until an answer; Yes stages a confirm (S1), Next moves on and collapses it", () => {
    const { container } = render(<Host />);
    const next = screen.getByRole("button", { name: "Next question" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/Yes, they're there/));
    expect(markerOf("pedestrian_facility")).toMatchObject({ flag: "pedestrian_facility", action: "confirm" });
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    expect(screen.getByText("Question 2 of 2")).toBeTruthy();
    expect(
      // #438 item 2: the topic and the answer, not the whole question.
      screen.getByText("Sidewalks: yes, they're there · not applied yet"),
    ).toBeTruthy();
    expect(container.querySelectorAll(".nyq-seg.is-done").length).toBe(1);
    expect(screen.getByRole("button", { name: "Apply answers" })).toBeTruthy();
  });

  it("No stages a dismiss with reason not_there and no note (S2); the last button is Apply", () => {
    const onApply = vi.fn();
    render(<Host onApply={onApply} />);
    fireEvent.click(screen.getByLabelText(/No, there aren't any/));
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    const apply = screen.getByRole("button", { name: "Apply answers" }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/No, there isn't one/));
    expect(markerOf("pedestrian_facility")).toMatchObject({ action: "dismiss", reason: "not_there" });
    expect(markerOf("pedestrian_facility")?.note ?? "").toBe("");
    expect(markerOf("adjacent_intersection")).toMatchObject({ action: "dismiss", reason: "not_there" });
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("Undo on a staged answer un-stages it and reopens the question; a collapsed row reopens on click", () => {
    render(<Host />);
    fireEvent.click(screen.getByLabelText(/Yes, they're there/));
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    // #457 rulings 1, 3: the NEEDS YOU answered row's Undo is the shared link.
    expect(screen.getByRole("button", { name: "Undo" }).className).toBe("undo-link");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(staged).toEqual([]);
    expect(screen.getByText("Question 1 of 2")).toBeTruthy();
    // Answer the second, then reopen it from its row.
    fireEvent.click(screen.getByText("Next: an intersection next to the work"));
    expect(screen.getByText("Question 2 of 2")).toBeTruthy();
  });

  it("Undo on an APPLIED answer stages a null marker (#224's byte-identical round trip)", () => {
    const scan = colfax({
      corrections: [
        { flag: "pedestrian_facility", action: "confirm", status: "confirmed", disclosure: "d" } as never,
      ],
    });
    render(<Host scan={scan} />);
    // The applied yes is a record; the card opens on the intersection.
    expect(screen.getByText("Question 2 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(staged).toEqual([{ flag: "pedestrian_facility", marker: null }]);
    expect(screen.getByText("Question 1 of 2")).toBeTruthy();
    // Answering it the applied way again un-stages rather than re-writing.
    fireEvent.click(screen.getByLabelText(/Yes, they're there/));
    expect(staged).toEqual([]);
  });

  it("Details (ruling 7) is one click: count, distance, citation, OpenStreetMap, time and duration", () => {
    const { container } = render(<Host />);
    const btn = screen.getByRole("button", { name: "Details" });
    const panel = container.querySelector(".nyq-details") as HTMLElement;
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hidden).toBe(true);
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toBe(
      "57 found · nearest 25.6 ft · MUTCD § 6C.02 · OpenStreetMap · corridor scan · 2 nov · 16:13 utc · 3.8 s",
    );
  });

  // #479 (Ryan 2026-11-10): NEEDS YOU's Details is the same floating panel
  // as the WHERE kind question's (#469: QuestionSteps `detailsTip`, step 2's
  // popover), so opening it changes nothing in the card's flow (P1).
  it("#479 Details floats as #469's does: the panel is in the foot, Esc and a click outside close it", () => {
    const { container } = render(<Host />);
    const card = container.querySelector(".nyq-card")!;
    const toggle = screen.getByRole("button", { name: "Details" });
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(panel.classList.contains("a-info") && panel.classList.contains("a-pop"), panel.className).toBe(true);
    expect(panel.tagName).toBe("SPAN");
    expect(panel.parentElement!.classList.contains("nyq-tip-box")).toBe(true);
    expect(panel.parentElement!.contains(toggle)).toBe(true);
    expect(panel.closest(".nyq-foot")).not.toBeNull();
    // No block element in the panel: it sits in the foot's <p>.
    expect(panel.querySelector("div, p, ul, ol, section")).toBeNull();
    // One item in the panel's grid (.a-info), so the text reads as one line.
    expect(panel.children.length).toBe(1);
    expect(card.querySelector(".nyq-card > .nyq-details")).toBeNull();
    expect(panel.hidden).toBe(true);
    fireEvent.click(toggle);
    expect(panel.hidden).toBe(false);
    // Esc closes it, focus back on the toggle (R101).
    fireEvent.keyDown(document, { key: "Escape" });
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle);
    // A click outside closes it too.
    fireEvent.click(toggle);
    expect(panel.hidden).toBe(false);
    fireEvent.pointerDown(card.querySelector(".nyq-q")!);
    expect(panel.hidden).toBe(true);
  });

  it("in flight, every write is disabled and the reads stay live", () => {
    render(<Host inFlight />);
    for (const r of screen.getAllByRole("radio")) expect((r as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Next question" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Details" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

// #449: the scan keeps one point per way, so it can't tell a bike lane that
// crosses the end of the work from one that runs beside it.  The question
// claims neither (Rule 10); 1550 E Colfax's lane crosses on Franklin St.
describe("#449 the bike lane question doesn't say along", () => {
  const bikeOnly = (sidewalks = false) =>
    colfax({
      buckets: {
        intersections: { detected: false, count: 0 },
        interchanges: { detected: false, count: 0 },
        sidewalks: sidewalks
          ? { detected: true, count: 57, nearest_distance_ft: 25.6 }
          : { detected: false, count: 0 },
        bike_facilities: { detected: true, count: 2, nearest_distance_ft: 12.1 },
        schools: { detected: false, count: 0 },
      },
    } as Partial<SiteScanProvenance>);

  it("the producer's question and title", () => {
    const [bike] = qs(bikeOnly());
    expect(bike.flag).toBe("bicycle_facility");
    expect(bike.question).toBe("Is there a bike lane at or near the work zone?");
    expect(bike.title).toBe("a bike lane at or near the work zone");
  });

  it("the mounted heading and the Next line", () => {
    render(<Host scan={bikeOnly()} />);
    const h = screen.getByRole("heading", { level: 3 }).textContent ?? "";
    expect(h).toBe("Is there a bike lane at or near the work zone?");
    cleanup();
    const { container } = render(<Host scan={bikeOnly(true)} />);
    expect(screen.getByText("Next: a bike lane at or near the work zone")).toBeTruthy();
    expect(container.textContent ?? "").not.toMatch(/bike lane along/);
  });
});
