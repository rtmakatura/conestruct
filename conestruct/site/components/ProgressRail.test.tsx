// @vitest-environment happy-dom
//
// ProgressRail (issue #221) — component-level: glyph+text pairing
// (rule 13), one ⚠ per unresolved blocker (rule 10), the blocker
// string on its owning entry, the Generate-slot fallback for a
// section-less refusal, and jump focus (#193: a rail click is a
// user-initiated armed action — it scrolls AND moves focus to the
// section header).

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgressRail } from "./ProgressRail";
import type { Rail } from "@/lib/scenarios/rail";

afterEach(cleanup);

function entry(over: Partial<Rail["entries"][number]>): Rail["entries"][number] {
  return {
    id: "road",
    label: "Road",
    anchorId: "rail-step-road",
    state: "done",
    issues: [],
    ...over,
  };
}

describe("rail entries", () => {
  it("renders glyph + label + text state word — never hue/glyph alone", () => {
    const rail: Rail = {
      entries: [
        entry({ id: "location", label: "Location", anchorId: "rail-step-location" }),
        entry({ id: "schedule", label: "Schedule", anchorId: "rail-step-schedule", state: "notset" }),
        entry({ id: "work", label: "Work", anchorId: "rail-step-work", state: "pending" }),
      ],
      blocker: null,
    };
    render(<ProgressRail rail={rail} generateAnchorId="rail-step-generate" />);
    const sched = screen.getByRole("button", { name: /Schedule — not set/ });
    expect(sched.textContent).toContain("not set");
    const work = screen.getByRole("button", { name: /Work — pending/ });
    expect(work.textContent).toContain("pending");
    // The ready Generate slot always closes the line.
    screen.getByRole("button", { name: "Generate — ready" });
  });

  it("one ⚠ per unresolved blocker on an entry — two issues, two glyphs", () => {
    const rail: Rail = {
      entries: [
        entry({
          id: "extra",
          label: "Cross street",
          anchorId: "rail-step-extra",
          state: "attention",
          issues: [{ text: "hold text" }, { text: "pointer text" }],
        }),
      ],
      blocker: { message: "elsewhere", entryId: null },
    };
    render(<ProgressRail rail={rail} generateAnchorId="rail-step-generate" />);
    const btn = screen.getByRole("button", { name: /Cross street — needs attention/ });
    expect(btn.querySelectorAll(".rail-glyph").length).toBe(2);
    // Both issue texts ride the accessible name — nothing queues silently.
    expect(btn.getAttribute("aria-label")).toContain("hold text");
    expect(btn.getAttribute("aria-label")).toContain("pointer text");
    // A non-owning ⚠ entry still says so in visible text (rule 13).
    expect(btn.textContent).toContain("needs attention");
  });

  it("the owning entry renders the blocker string verbatim", () => {
    const rail: Rail = {
      entries: [
        entry({
          id: "extra",
          label: "Cross street",
          anchorId: "rail-step-extra",
          state: "attention",
          issues: [{ text: "Confirm it." }],
        }),
      ],
      blocker: { message: "Confirm it.", entryId: "extra" },
    };
    render(<ProgressRail rail={rail} generateAnchorId="rail-step-generate" />);
    const btn = screen.getByRole("button", { name: /Cross street/ });
    expect(btn.querySelector(".rail-blocker")?.textContent).toBe("Confirm it.");
  });

  it("a section-less blocker (refusal with no affordance) lands on the Generate slot", () => {
    const rail: Rail = {
      entries: [entry({})],
      blocker: {
        message: "Generation declined — see the notice below.",
        entryId: null,
      },
    };
    render(<ProgressRail rail={rail} generateAnchorId="rail-step-generate" />);
    const gen = screen.getByRole("button", { name: /Generate — blocked:/ });
    expect(gen.querySelector(".rail-blocker")?.textContent).toBe(
      "Generation declined — see the notice below.",
    );
  });
});

describe("jump semantics (#193 focus policy)", () => {
  it("a rail click scrolls to and focuses the section header", async () => {
    const scrolled: string[] = [];
    // happy-dom has no scrollIntoView layout — stub it and record.
    Element.prototype.scrollIntoView = function () {
      scrolled.push((this as HTMLElement).id);
    };
    const rail: Rail = {
      entries: [entry({ id: "road", label: "Road", anchorId: "rail-step-road" })],
      blocker: null,
    };
    render(
      <>
        <ProgressRail rail={rail} generateAnchorId="rail-step-generate" />
        <div id="rail-step-road" tabIndex={-1}>
          Road — STEP 3
        </div>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Road — done/ }));
    expect(scrolled).toEqual(["rail-step-road"]);
    expect(document.activeElement?.id).toBe("rail-step-road");
  });

  it("a jump to a missing anchor is a no-op, never a throw", async () => {
    const rail: Rail = {
      entries: [entry({ anchorId: "rail-step-road" })],
      blocker: null,
    };
    render(<ProgressRail rail={rail} generateAnchorId="rail-step-generate" />);
    await userEvent.click(screen.getByRole("button", { name: /Road — done/ }));
  });
});
