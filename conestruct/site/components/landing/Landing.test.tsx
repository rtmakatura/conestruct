// @vitest-environment happy-dom
//
// Landing v2 at `/`, mounted (Rule 11).  What happy-dom can check: the
// spotlight's class hand-off on hover and focus, the form's native
// controls, the held items, and that every in-page link lands somewhere.
// Layout, contrast, targets and motion are the browser leg.

import { cleanup, findByRole, findByText, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("both submits are live and read the reference's labels; neither form has an action", () => {
    const c = mount();
    const submits = [...c.querySelectorAll<HTMLButtonElement>('button[type="submit"]')];
    expect(submits.map((b) => [b.textContent, b.disabled])).toEqual([
      ["Send us the job", false],
      ["Join the waitlist", false],
    ]);
    expect(c.textContent).not.toContain("Opening soon");
    for (const f of c.querySelectorAll("form")) expect(f.getAttribute("action")).toBeNull();
  });

  it("each form carries a honeypot hidden from people and from the tab order", () => {
    const pots = [...mount().querySelectorAll<HTMLInputElement>('input[name="website"]')];
    expect(pots).toHaveLength(2);
    for (const p of pots) {
      expect(p.tabIndex).toBe(-1);
      expect(p.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(p.value).toBe("");
    }
  });
});

// #346: the forms post to /api/contact (mounted flow, Rule 11).  `fetch`
// is the stand-in; the route's own behaviour is app/api/contact/route.test.ts.
describe("landing v2 — the forms send (#346)", () => {
  type Call = { url: string; body: Record<string, unknown> };
  let calls: Call[];
  let answer: () => Promise<Response>;
  beforeEach(() => {
    calls = [];
    answer = async () => new Response("{}", { status: 200 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(init.body as string) });
        return answer();
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  const jobForm = (c: HTMLElement) => c.querySelector<HTMLFormElement>('form[aria-label="Send us a past job"]')!;
  const joinForm = (c: HTMLElement) => c.querySelector<HTMLFormElement>("form#join")!;
  const type = (c: HTMLElement, id: string, v: string) =>
    fireEvent.change(c.querySelector<HTMLInputElement>(`#${id}`)!, { target: { value: v } });
  const pick = (c: HTMLElement, name: string, v: string) =>
    fireEvent.click(c.querySelector<HTMLInputElement>(`input[name="${name}"][value="${v}"]`)!);

  function fillJob(c: HTMLElement) {
    type(c, "c-name", "Dana Ortiz");
    type(c, "c-company", "Front Range Traffic");
    type(c, "c-email", "dana@frtraffic.com");
    type(c, "c-where", "E Colfax Ave & N Race St");
    type(c, "c-city", "Denver");
    pick(c, "kind", "Shoulder work");
    type(c, "c-side", "South side");
    type(c, "c-length", "1,000");
    pick(c, "hours", "Night");
  }

  it("the job form posts exactly the route's keys, then is replaced by its confirmation", async () => {
    const c = mount();
    fillJob(c);
    fireEvent.submit(jobForm(c));
    const done = await findByText(c, "Got it. Check your inbox for a confirmation.");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/contact");
    const { elapsed_ms, ...rest } = calls[0].body;
    expect(typeof elapsed_ms).toBe("number");
    expect(rest).toEqual({
      type: "job",
      website: "",
      name: "Dana Ortiz",
      company: "Front Range Traffic",
      email: "dana@frtraffic.com",
      phone: "",
      where: "E Colfax Ave & N Race St",
      city: "Denver",
      kind: "Shoulder work",
      side: "South side",
      length_ft: "1,000",
      hours: "Night",
      notes: "",
    });
    expect(jobForm(c)).toBeNull();
    expect(document.activeElement).toBe(done.closest("[tabindex]"));
  });

  for (const [label, make] of [
    ["a 502", async () => new Response("{}", { status: 502 })],
    ["a 429", async () => new Response("{}", { status: 429 })],
    ["a 503", async () => new Response("{}", { status: 503 })],
    ["no answer", async () => Promise.reject(new TypeError("offline"))],
  ] as [string, () => Promise<Response>][]) {
    it(`${label}: the honest inline error, the form and its values kept`, async () => {
      answer = make;
      const c = mount();
      fillJob(c);
      fireEvent.submit(jobForm(c));
      const alert = await findByRole(jobForm(c), "alert");
      expect(alert.textContent).toBe("⚠ That didn't send. Try again, or email ryan@conestruct.com.");
      expect(alert.querySelector("a")?.getAttribute("href")).toBe("mailto:ryan@conestruct.com");
      expect(c.querySelector<HTMLInputElement>("#c-name")!.value).toBe("Dana Ortiz");
      expect(c.textContent).not.toContain("Got it.");
    });
  }

  it("while sending, the button reads 'Sending…' and is disabled", async () => {
    let release!: (r: Response) => void;
    answer = () => new Promise((r) => (release = r));
    const c = mount();
    fillJob(c);
    fireEvent.submit(jobForm(c));
    const button = jobForm(c).querySelector<HTMLButtonElement>('button[type="submit"]')!;
    await waitFor(() => expect(button.textContent).toBe("Sending…"));
    expect(button.disabled).toBe(true);
    release(new Response("{}", { status: 200 }));
    await findByText(c, "Got it. Check your inbox for a confirmation.");
  });

  it("the waitlist posts type=waitlist with one email and is replaced by \"You're on the list.\"", async () => {
    const c = mount();
    type(c, "w-email", "pat@example.com");
    fireEvent.submit(joinForm(c));
    await findByText(c, "You're on the list.");
    const { elapsed_ms, ...rest } = calls[0].body;
    expect(typeof elapsed_ms).toBe("number");
    expect(rest).toEqual({ type: "waitlist", website: "", email: "pat@example.com" });
    expect(joinForm(c)).toBeNull();
    // the job form is untouched
    expect(jobForm(c)).not.toBeNull();
  });

  it("the waitlist refused: the same inline error", async () => {
    answer = async () => new Response("{}", { status: 429 });
    const c = mount();
    type(c, "w-email", "pat@example.com");
    fireEvent.submit(joinForm(c));
    expect((await findByRole(joinForm(c), "alert")).textContent).toBe(
      "⚠ That didn't send. Try again, or email ryan@conestruct.com.",
    );
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

  it("#349: step 3 draws the undivided Colfax plan, not the median sheet", () => {
    const c = mount();
    const sheet = c.querySelector(".lv-step3 .lv-sheet")!;
    expect(sheet.querySelector("img")).toBeNull();
    const svg = sheet.querySelector("svg.lv-sheet-img")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 1200 430");
    expect(svg.getAttribute("aria-label")).toMatch(/^Illustration of the Colfax shoulder closure/);
    expect(svg.textContent).not.toMatch(/MEDIAN|DIVIDED/i);
    expect(svg.innerHTML).toContain("E COLFAX AVE");
    // the phone crop (ruling: labels >= 11 px at 390): every text is set
    // at 26 units, 11.6 px across the ~338 px panel's 760-unit viewBox
    const narrow = sheet.querySelector(".lv-illus-narrow svg.lv-sheet-img")!;
    expect(narrow.getAttribute("viewBox")).toBe("340 -62 760 342");
    expect(narrow.textContent).not.toMatch(/MEDIAN|DIVIDED/i);
    const sizes = [...narrow.querySelectorAll("text")].map((t) => Number(t.getAttribute("font-size")));
    expect(sizes.filter((n) => n < 26)).toEqual([]);
    expect(narrow.textContent).toContain("L/3 50 FT");
    expect(narrow.textContent).toContain("BUFFER 200 FT");
    expect(narrow.textContent).toContain("WORK ZONE 1,000 FT");
    // the step 1 drawing's pattern ids stay unique on the page
    const ids = [...c.querySelectorAll("svg [id]")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
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
