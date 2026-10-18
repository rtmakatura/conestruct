// @vitest-environment happy-dom
//
// Landing v2 at `/`, mounted (Rule 11).  What happy-dom can check: the
// spotlight's class hand-off on hover and focus, the form's native
// controls, the held items, and that every in-page link lands somewhere.
// Layout, contrast, targets and motion are the browser leg.

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Page from "@/app/page";

afterEach(cleanup);

const mount = () => render(<Page />).container;
const plans = (c: HTMLElement) => [...c.querySelectorAll("svg.plan")];

describe("landing v2 — the spotlight (C)", () => {
  const cases: [string, string][] = [
    ["Adjacent at-grade intersection", "f-int"],
    ["Pedestrian sidewalks", "f-walk"],
    ["43", "f-dev"],
    ["50 ft", "f-taper"],
    ["200 ft", "f-buffer"],
  ];

  it("five buttons in the NEEDS YOU card, each naming one key", () => {
    const card = mount().querySelector('aside[aria-label="Site conditions found near the work"]')!;
    const buttons = [...card.querySelectorAll("button")];
    expect(buttons).toHaveLength(5);
    expect(buttons.every((b) => b.type === "button")).toBe(true);
  });

  for (const [text, cls] of cases) {
    it(`${text}: hover and focus set ${cls} on both hero drawings; leaving and blurring clear it`, () => {
      const c = mount();
      const button = [...c.querySelectorAll("aside button")].find((b) => b.textContent?.includes(text))!;
      expect(plans(c)).toHaveLength(2);
      fireEvent.mouseEnter(button);
      for (const svg of plans(c)) expect(svg.classList.contains(cls)).toBe(true);
      fireEvent.mouseLeave(button);
      for (const svg of plans(c)) expect(svg.getAttribute("class")).toBe("plan mB mC");
      fireEvent.focus(button);
      for (const svg of plans(c)) expect(svg.classList.contains(cls)).toBe(true);
      fireEvent.blur(button);
      for (const svg of plans(c)) expect(svg.getAttribute("class")).toBe("plan mB mC");
    });
  }

  it("the drawings carry their keyed groups and no hex (every colour is a workbench token)", () => {
    const c = mount();
    for (const key of ["k-int", "k-walk", "k-taper", "k-buffer", "k-work"])
      expect(c.querySelector(`svg.plan .z.${key}`), key).not.toBeNull();
    for (const svg of c.querySelectorAll("svg")) expect(svg.outerHTML).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});

describe("landing v2 — the form", () => {
  it("Kind of work and Hours are native radios in a fieldset with a legend", () => {
    const c = mount();
    const legends = [...c.querySelectorAll("fieldset > legend")].map((l) => l.textContent?.trim());
    expect(legends).toContain("Kind of work");
    expect(legends).toContain("Hours");
    const kinds = [...c.querySelectorAll<HTMLInputElement>('input[type="radio"][name="kind"]')].map((i) => i.value);
    expect(kinds).toEqual(["Shoulder work", "Flagger lane closure", "Lane closure near an intersection", "Something else"]);
    const hours = [...c.querySelectorAll<HTMLInputElement>('input[type="radio"][name="hours"]')].map((i) => i.value);
    expect(hours).toEqual(["Daytime", "Night"]);
    for (const r of c.querySelectorAll('input[type="radio"]')) expect(r.closest("label")).not.toBeNull();
  });

  it("every text field has a real label", () => {
    const c = mount();
    for (const input of c.querySelectorAll("input:not([type=radio]), textarea")) {
      expect(c.querySelector(`label[for="${input.id}"]`), input.id).not.toBeNull();
    }
  });

  it("nothing submits yet: both buttons are disabled and read 'Opening soon'", () => {
    const c = mount();
    const submits = [...c.querySelectorAll<HTMLButtonElement>('button[type="submit"]')];
    expect(submits).toHaveLength(2);
    for (const b of submits) {
      expect(b.disabled).toBe(true);
      expect(b.textContent).toBe("Opening soon");
    }
    for (const f of c.querySelectorAll("form")) expect(f.getAttribute("action")).toBeNull();
  });
});

describe("landing v2 — links and held items", () => {
  it("every in-page link lands on an element that exists", () => {
    const c = mount();
    const hashes = [...c.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')].map((a) => a.getAttribute("href")!);
    expect(hashes.length).toBeGreaterThan(0);
    for (const h of hashes) expect(c.querySelector(h), h).not.toBeNull();
  });

  it("no sample download until the Colfax sheet is confirmed, and no door to sign-in or the generator", () => {
    const c = mount();
    expect(c.textContent).not.toContain("Download the sample plan");
    const hrefs = [...c.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.filter((h) => /sign-in|sign-up|sandbox/.test(h))).toEqual([]);
  });

  it("the sections run in the reference's order", () => {
    const c = mount();
    const labels = [...c.querySelectorAll(".lv-label .lv-head-ink")].map((e) => e.textContent);
    expect(labels).toEqual([
      "02HOW IT GOES NOW",
      "03HOW A PLAN IS MADE",
      "04WHAT YOU HAND OVER",
      "05EVERY NUMBER SHOWS WHERE IT CAME FROM",
      "06WHO IT'S FOR, AND WHO'S BUILDING IT",
      "07BUILT IN COLORADO",
    ]);
    expect(c.querySelector("h1")?.textContent).toBe("Mark the work.Get the plan.");
  });
});
