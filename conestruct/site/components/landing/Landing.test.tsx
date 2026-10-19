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
// the desktop 3D scene and the phone's flat drawing, with their resting classes
const heroes = (c: HTMLElement) =>
  [...c.querySelectorAll("svg.hero-iso, svg.plan")].map((svg) => ({
    svg,
    rest: svg.classList.contains("hero-iso") ? "hero-iso" : "plan mB mC",
  }));
const lit = (c: HTMLElement) =>
  [...c.querySelectorAll('aside button[data-on="1"]')].map((b) => b.textContent);

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
      expect(heroes(c).map((h) => h.rest)).toEqual(["hero-iso", "plan mB mC"]);
      fireEvent.mouseEnter(button);
      for (const { svg } of heroes(c)) expect(svg.classList.contains(cls)).toBe(true);
      expect(lit(c)).toEqual([button.textContent]);
      fireEvent.mouseLeave(button);
      for (const { svg, rest } of heroes(c)) expect(svg.getAttribute("class")).toBe(rest);
      expect(lit(c)).toEqual([]);
      fireEvent.focus(button);
      for (const { svg } of heroes(c)) expect(svg.classList.contains(cls)).toBe(true);
      expect(lit(c)).toEqual([button.textContent]);
      fireEvent.blur(button);
      for (const { svg, rest } of heroes(c)) expect(svg.getAttribute("class")).toBe(rest);
      expect(lit(c)).toEqual([]);
    });
  }

  it("pointing at a scene zone sets its key and lights its card button; the next zone switches it; leaving clears", () => {
    const c = mount();
    const scene = c.querySelector("svg.hero-iso")!;
    const button = (text: string) =>
      [...c.querySelectorAll("aside button")].find((b) => b.textContent?.includes(text))!.textContent;
    const zones: [string, string][] = [
      ["taper", "50 ft"],
      ["buffer", "200 ft"],
      ["dev", "43"],
      ["int", "Adjacent at-grade intersection"],
      ["walk", "Pedestrian sidewalks"],
    ];
    // straight from zone to zone, no leave in between: each one takes over
    for (const [k, text] of zones) {
      fireEvent.pointerOver(scene.querySelector(`.hit[data-k="${k}"]`)!, { pointerType: "mouse" });
      expect(scene.getAttribute("class")).toBe(`hero-iso f-${k}`);
      expect(lit(c)).toEqual([button(text)]);
    }
    // bare scene clears
    fireEvent.pointerOver(scene.firstElementChild!, { pointerType: "mouse" });
    expect(scene.getAttribute("class")).toBe("hero-iso");
    expect(lit(c)).toEqual([]);
    // the intersection pin is a target too
    fireEvent.pointerOver(scene.querySelector('.fl[data-k="int"] rect')!, { pointerType: "mouse" });
    expect(scene.getAttribute("class")).toBe("hero-iso f-int");
    // leaving the svg clears
    fireEvent.pointerOut(scene.querySelector('.fl[data-k="int"] rect')!, {
      pointerType: "mouse",
      relatedTarget: document.body,
    });
    expect(scene.getAttribute("class")).toBe("hero-iso");
    expect(lit(c)).toEqual([]);
    // touch does not set it: the zones are mouse-only
    fireEvent.pointerOver(scene.querySelector('.hit[data-k="taper"]')!, { pointerType: "touch" });
    expect(scene.getAttribute("class")).toBe("hero-iso");
  });

  it("every scene key is a card key, and every card key has a hover zone", () => {
    const scene = mount().querySelector("svg.hero-iso")!;
    const keys = ["int", "walk", "dev", "taper", "buffer"];
    for (const e of scene.querySelectorAll("[data-k]")) expect(keys).toContain(e.getAttribute("data-k"));
    for (const k of keys) expect(scene.querySelector(`.hit[data-k="${k}"]`), k).not.toBeNull();
  });

  it("the drawings carry their keyed groups and no hex (every colour is a workbench token)", () => {
    const c = mount();
    for (const key of ["k-int", "k-walk", "k-taper", "k-buffer", "k-work"])
      for (const svg of ["svg.hero-iso", "svg.plan"])
        expect(c.querySelector(`${svg} .z.${key}`), `${svg} ${key}`).not.toBeNull();
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

  it("the sections run in the lean page's order, under the nav's three links", () => {
    const c = mount();
    expect(c.querySelector("h1")?.textContent).toBe("Mark the work.Get the plan.");
    expect([...c.querySelectorAll("h2")].map((h) => h.textContent)).toEqual([
      "A plan that comes back costs you twice.",
      "Three moves, and every number shows its work.",
      "One job in, four files out.",
      "Send us a job you've already permitted.",
    ]);
    const nav = [...c.querySelectorAll<HTMLAnchorElement>(".lv-nav-links a, .lv-nav-cta")];
    expect(nav.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["HOW IT WORKS", "#how"],
      ["WHAT YOU GET", "#files"],
      ["SEND US A PAST JOB", "#send"],
    ]);
    // the section numbers and the cut sections are gone
    expect(c.textContent).not.toMatch(/HOW IT GOES NOW|WHAT IT WON'T DO|WHO IT'S FOR|L = W × S²/);
  });

  it("the legal lines stay word for word", () => {
    const c = mount();
    expect(c.querySelector(".lv-footer")?.textContent).toContain(
      "OUTPUT REQUIRES TCS REVIEW · NOT A SUBSTITUTE FOR LICENSED JUDGMENT",
    );
    // Ryan's ruling 2026-10-19: restored from "What it won't do", word for word
    expect(c.querySelector(".lv-trust-review")?.textContent?.trim().endsWith(
      "It won't promise approval. That's the city's call.",
    )).toBe(true);
    expect([...c.querySelectorAll(".lv-footer a")].map((a) => a.getAttribute("href"))).toEqual(["/terms", "/privacy"]);
    expect(c.querySelector('form[aria-label="Send us a past job"]')?.textContent).toContain(
      "used only to draft your comparison",
    );
  });

  it("the three step pictures are inline, hidden from assistive tech, and carry their animation classes", () => {
    const steps = [...mount().querySelectorAll("#how .lv-step svg")];
    expect(steps).toHaveLength(3);
    for (const svg of steps) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.querySelector('[class^="a-"]')).not.toBeNull();
    }
  });

  it("the file tiles are plain cards until the sample is confirmed (#350): no link, no hover class", () => {
    const tiles = [...mount().querySelectorAll("#files .lv-ft")];
    expect(tiles.map((t) => t.querySelector(".lv-ft-title")?.textContent)).toEqual([
      "Plan sheet",
      "Device list",
      "Crew sheet",
      "Audit",
    ]);
    for (const t of tiles) {
      expect(t.tagName).toBe("DIV");
      expect(t.classList.contains("ft")).toBe(false);
    }
  });
});

describe("landing v2 — the lean form", () => {
  it("Kind of work shows the plain name only", () => {
    const c = mount();
    const chips = [...c.querySelectorAll(".lv-opt")].map((l) => l.textContent);
    expect(chips).toEqual(["Shoulder work", "Flagger lane closure", "Lane closure near an intersection", "Something else"]);
    expect(c.querySelector("form")?.textContent).not.toMatch(/TA-\d|S-630|THE APPROVED PLAN/);
    expect(c.textContent).toContain("We'll email a confirmation. Reply to it with the approved plan.");
  });

  it("phone and the note sit behind one aria-expanded button, and still submit", async () => {
    const calls: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(JSON.parse(init.body as string));
        return new Response("{}", { status: 200 });
      }),
    );
    const c = mount();
    const more = c.querySelector<HTMLDivElement>("#c-more")!;
    const button = c.querySelector<HTMLButtonElement>('button[aria-controls="c-more"]')!;
    expect(button.type).toBe("button");
    expect(button.textContent).toBe("+ Add a phone number or a note");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(more.hidden).toBe(true);
    expect(more.querySelector("#c-phone")).not.toBeNull();
    expect(more.querySelector("#c-notes")).not.toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(more.hidden).toBe(false);
    for (const [id, v] of [
      ["c-name", "Dana Ortiz"],
      ["c-company", "Front Range Traffic"],
      ["c-email", "dana@frtraffic.com"],
      ["c-phone", "303-555-0100"],
      ["c-where", "E Colfax Ave & N Race St"],
      ["c-city", "Denver"],
      ["c-side", "South side"],
      ["c-length", "1,000"],
      ["c-notes", "Approved in May"],
    ])
      fireEvent.change(c.querySelector(`#${id}`)!, { target: { value: v } });
    fireEvent.click(c.querySelector('input[name="kind"][value="Flagger lane closure"]')!);
    fireEvent.click(c.querySelector('input[name="hours"][value="Daytime"]')!);
    // collapsed again, the values still go
    fireEvent.click(button);
    expect(more.hidden).toBe(true);
    fireEvent.submit(c.querySelector('form[aria-label="Send us a past job"]')!);
    await findByText(c, "Got it. Check your inbox for a confirmation.");
    expect(calls[0]).toMatchObject({ phone: "303-555-0100", notes: "Approved in May", kind: "Flagger lane closure" });
    vi.unstubAllGlobals();
  });
});

describe("landing v2 — the scroll-in (LeanMotion)", () => {
  type Cb = (entries: { target: Element; isIntersecting: boolean }[]) => void;
  let cb: Cb;
  let observed: Element[];
  let reduce: boolean;
  beforeEach(() => {
    observed = [];
    reduce = false;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        // next/link observes too; LeanMotion's is the one at 0.25
        mine: boolean;
        constructor(fn: Cb, opts?: { threshold?: number }) {
          this.mine = opts?.threshold === 0.25;
          if (this.mine) cb = fn;
        }
        observe(el: Element) {
          if (this.mine) observed.push(el);
        }
        unobserve(el: Element) {
          if (this.mine) observed = observed.filter((e) => e !== el);
        }
        disconnect() {}
      },
    );
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduce && q.includes("reduce") }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("each animated section gets `go` once, on its first scroll-in, and the start state hides only after JS ran", () => {
    const c = mount();
    const sections = [...c.querySelectorAll(".an")];
    expect(sections.map((s) => s.id)).toEqual(["", "how", "files"]);
    expect(c.querySelector(".lv-outer")?.classList.contains("js-anim")).toBe(true);
    // happy-dom lays nothing out, so none is on screen at load: all observed
    expect(observed).toEqual(sections);
    cb([{ target: sections[1], isIntersecting: true }]);
    expect(sections[1].classList.contains("go")).toBe(true);
    expect(observed).not.toContain(sections[1]);
    expect(sections[0].classList.contains("go")).toBe(false);
    // the hero and the form never animate
    expect(c.querySelector(".lv-hero")?.closest(".an")).toBeNull();
    expect(c.querySelector("#send")?.classList.contains("an")).toBe(false);
  });

  it("reduced motion: no `go`, no hidden start state, nothing observed", () => {
    reduce = true;
    const c = mount();
    expect(c.querySelector(".lv-outer")?.classList.contains("js-anim")).toBe(false);
    expect(c.querySelectorAll(".go")).toHaveLength(0);
    expect(observed).toEqual([]);
  });
});
