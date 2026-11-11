// @vitest-environment happy-dom
//
// #517 ruling 7 (S8) — the work dates: "a 44 px button: 'Pick start and end
// dates' (unset) or 'Mon Nov 16 to Fri Nov 20' (set).  It opens a styled
// date picker."  The writes go through `setWorkDates`, as the native
// inputs' did.

import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import { setWorkDates } from "@/lib/scenarios/what-writes";
import { DateRangePicker } from "./DateRangePicker";

afterEach(cleanup);

let latest: Scenario | null = null;
function Harness({ start = "", end = "" }: { start?: string; end?: string }) {
  const [s, setS] = useState<Scenario>(() =>
    start ? setWorkDates(DEFAULT_SHOULDER, { start, end }) : DEFAULT_SHOULDER,
  );
  latest = s;
  return (
    <DateRangePicker
      id="what-date"
      label="Work dates"
      start={s.schedule?.work_date ?? ""}
      end={s.schedule?.work_date_end ?? ""}
      onPick={(d) => setS((prev) => setWorkDates(prev, d))}
    />
  );
}

const btn = () => document.getElementById("what-date") as HTMLButtonElement;
const day = (d: string) => document.querySelector(`[data-date="${d}"]`) as HTMLButtonElement;
const click = (el: Element) =>
  act(() => {
    fireEvent.click(el);
  });

describe("#517 ruling 7: the date picker", () => {
  it("the button's words: unset, one day, a range", () => {
    render(<Harness />);
    expect(btn().textContent).toBe("Pick start and end dates");
    cleanup();
    render(<Harness start="2026-11-16" />);
    expect(btn().textContent).toBe("Mon Nov 16");
    cleanup();
    render(<Harness start="2026-11-16" end="2026-11-20" />);
    expect(btn().textContent).toBe("Mon Nov 16 to Fri Nov 20");
  });

  it("first pick is the start, the second the end; the picker is a labelled dialog", () => {
    render(<Harness start="2026-11-02" end="2026-11-03" />);
    click(btn());
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(document.getElementById(dialog.getAttribute("aria-labelledby") ?? "")?.textContent).toBe(
      "November 2026",
    );
    expect(day("2026-11-16").getAttribute("aria-label")).toBe("Monday, November 16, 2026");
    // A full range on show: the next pick starts over.
    click(day("2026-11-16"));
    expect(latest?.schedule?.work_date).toBe("2026-11-16");
    expect(latest?.schedule?.work_date_end).toBeUndefined();
    click(day("2026-11-20"));
    expect(latest?.schedule?.work_date_end).toBe("2026-11-20");
    expect(latest?.schedule?.date_mode).toBe("range");
    // The end closes the picker and returns focus.
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(btn());
    expect(btn().textContent).toBe("Mon Nov 16 to Fri Nov 20");
  });

  it("unset: the first pick is the start and the picker stays open for the end", () => {
    render(<Harness />);
    click(btn());
    const first = document.querySelector(".drp-day") as HTMLButtonElement;
    const picked = first.getAttribute("data-date");
    click(first);
    expect(latest?.schedule?.work_date).toBe(picked);
    expect(latest?.schedule?.date_mode).toBe("single");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("the same day again is one day; Esc closes and returns focus; Clear empties", () => {
    render(<Harness start="2026-11-18" />);
    click(btn());
    click(day("2026-11-18"));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(latest?.schedule?.date_mode).toBe("single");
    expect(latest?.schedule?.work_date_end).toBeUndefined();
    expect(btn().textContent).toBe("Wed Nov 18");
    click(btn());
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(btn());
    click(btn());
    click(document.querySelector(".drp-clear") as Element);
    expect(latest?.schedule?.date_mode).toBe("tbd");
    expect(btn().textContent).toBe("Pick start and end dates");
  });
});
