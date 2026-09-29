// @vitest-environment happy-dom
//
// coming-soon-gate Arc 2 — the Plan Sheet at `/`, mounted.  What the
// rulings make testable without a browser: the words (A2-Q6), the mail
// link (A2-Q1), one primary (A2-Q10), the zone colours and words from
// the product's one source (R9), and the drawing's device placement
// matching the product's lane closure (A2-Q5).  Layout, targets and
// contrast are the browser leg (happy-dom lays nothing out).

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Page from "@/app/page";
import { ZONE_COLOR, ZONE_LABEL } from "@/lib/corridor-zones";
import { FOUNDERS, HOW, NOTIFY_HREF, SOURCES } from "@/lib/coming-soon-copy";
import { PUBLIC_LINE } from "@/lib/public-copy";

afterEach(cleanup);

const mount = () => render(<Page />).container;

describe("the Plan Sheet — words and links", () => {
  it("'Get notified' is a mail link to ryan@conestruct.com with the ruled subject, in nav, sheet and closing band (A2-Q1)", () => {
    expect(NOTIFY_HREF).toBe(
      "mailto:ryan@conestruct.com?subject=Conestruct%3A%20let%20me%20know%20when%20it%20opens",
    );
    const c = mount();
    const mail = [...c.querySelectorAll("a")].filter((a) => a.getAttribute("href") === NOTIFY_HREF);
    expect(mail.map((a) => a.textContent)).toEqual(["Get notified", "Get notified", "Get notified"]);
  });

  it("has no form, no input, and nothing that reaches the gate's door or the generator (R1.5, A2-Q1)", () => {
    const c = mount();
    expect(c.querySelectorAll("form, input, textarea, button")).toHaveLength(0);
    const hrefs = [...c.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    for (const h of hrefs) expect(h, h).toMatch(/^(\/|\/terms|\/privacy|#how|#sources|mailto:.*)$/);
  });

  it("one primary on the screen (P18); the closing link is the outlined secondary (A2-Q10)", () => {
    const c = mount();
    expect(c.querySelectorAll(".pri")).toHaveLength(1);
    expect(c.querySelector(".pri")?.closest(".cs-sheet")).not.toBeNull();
    expect(c.querySelector(".cs-close a")?.classList.contains("dl-btn")).toBe(true);
  });

  it("the sheet reads head, then wordmark + title block, then the drawing (R25) — in the markup, not by CSS order", () => {
    const sheet = mount().querySelector("section.cs-sheet")!;
    const parts = [...sheet.children].filter((e) => !e.classList.contains("cs-crop")).map((e) => e.className);
    expect(parts).toEqual(["cs-sheet-head", "cs-lower", "cs-drawing"]);
  });

  it("the h1 is the question; the notify line is the ruled one", () => {
    const c = mount();
    expect([...c.querySelectorAll("h1")].map((h) => h.textContent)).toEqual(["Want to know when it opens?"]);
    expect(c.textContent).toContain("Email us and we'll tell you the day it opens.");
    // R41: the heading keeps the question; the line doesn't ask it again.
    expect(c.textContent).not.toContain("Want a heads-up?");
  });

  it("the hero line is PUBLIC_LINE — the page and its metadata say one thing (P2)", () => {
    expect(mount().textContent).toContain(PUBLIC_LINE);
    expect(PUBLIC_LINE).toContain("Every taper, buffer and spacing is cited to MUTCD 2023 or CDOT");
  });

  it("keeps only the four verified references (A2-Q6)", () => {
    const c = mount();
    const chips = [...c.querySelectorAll(".cs-chip")].map((li) => li.textContent);
    expect(chips).toEqual(["MUTCD 2023 · Table 6B-1", "§6B.06", "Table 6B-3", "CDOT S-630-1 · Sheet 10"]);
    expect(chips).toEqual([...SOURCES.chips]);
  });

  it("says none of the claims the checkpoint found false today (Rule 10/12, A2-Q6)", () => {
    const text = mount().textContent ?? "";
    for (const gone of [
      "6N.16",
      "6N.12",
      "6P-22",
      "nearest intersection",
      "210 ft",
      "W 38th",
      "300 ft",
      "at your rates",
      "MULTILANE",
      "instead of guessing",
      "Notify me",
      "Sign in",
    ]) {
      expect(text, gone).not.toContain(gone);
    }
  });
});

describe("the drawing — R9 colours and words, A2-Q5 placement", () => {
  it("each zone's swatch is ZONE_COLOR with its ZONE_LABEL word beside it, in traffic order (Rule 13)", () => {
    const c = mount();
    const items = [...c.querySelectorAll(".cs-legend-item")];
    expect(items.map((li) => li.textContent)).toEqual([
      ZONE_LABEL.advance_warning,
      ZONE_LABEL.transition,
      ZONE_LABEL.buffer,
      ZONE_LABEL.work_zone,
      ZONE_LABEL.downstream,
    ]);
    const swatches = items.map((li) => (li.querySelector(".cs-swatch") as HTMLElement).style.background);
    expect(swatches.map((s) => s.toLowerCase())).toEqual(
      [
        ZONE_COLOR.advance_warning,
        ZONE_COLOR.transition,
        ZONE_COLOR.buffer,
        ZONE_COLOR.work_zone,
        ZONE_COLOR.downstream,
      ].map((s) => s.toLowerCase()),
    );
  });

  it("both drawings' zone bands are ZONE_COLOR's five, in order", () => {
    const c = mount();
    const svgs = c.querySelectorAll(".cs-drawing-art > svg");
    expect(svgs, "the wide and the narrow drawing").toHaveLength(2);
    for (const svg of svgs) {
      const fills = [...svg.querySelectorAll(":scope > rect.cs-band")].map((r) => r.getAttribute("fill"));
      expect(fills).toEqual([
        ZONE_COLOR.advance_warning,
        ZONE_COLOR.transition,
        ZONE_COLOR.buffer,
        ZONE_COLOR.work_zone,
        ZONE_COLOR.downstream,
      ]);
    }
  });

  it("the buffer is empty and devices line the lane through the work area (A2-Q5, layout.py)", () => {
    const c = mount();
    const svgs = c.querySelectorAll(".cs-drawing-art > svg");
    expect(svgs, "the wide and the narrow drawing").toHaveLength(2);
    for (const svg of svgs) {
      const band = (i: number) => {
        const r = svg.querySelectorAll(":scope > rect.cs-band")[i];
        const x = parseFloat(r.getAttribute("x") ?? "");
        return [x, x + parseFloat(r.getAttribute("width") ?? "")] as const;
      };
      const [bufFrom, bufTo] = band(2);
      const [workFrom, workTo] = band(3);
      const devs = [...svg.querySelectorAll("rect.cs-dev")].map((r) => {
        const g = r.parentElement as Element;
        return [parseFloat(g.getAttribute("x") ?? ""), parseFloat(g.getAttribute("y") ?? "")] as const;
      });
      const inside = (x: number, a: number, b: number) => x > a + 0.01 && x < b - 0.01;
      expect(devs.filter(([x]) => inside(x, bufFrom, bufTo)), "devices in the buffer").toEqual([]);
      const laneY = Math.min(...devs.map(([, y]) => y));
      const alongWork = devs.filter(([x, y]) => y === laneY && x >= workFrom - 0.01 && x <= workTo + 0.01);
      expect(alongWork.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("the drawing's label names no kind the product has switched off (A2-Q6)", () => {
    const c = mount();
    const label = c.querySelector(".cs-drawing-head .tr-step")?.textContent;
    expect(label).toBe("ILLUSTRATION · RIGHT LANE CLOSED");
  });

  it("R10's reduced-motion path: nothing animates inline; the animation is the CSS classes alone", () => {
    const c = mount();
    for (const el of c.querySelectorAll("[style]")) {
      const s = (el as HTMLElement).style;
      expect(s.animationName, el.outerHTML.slice(0, 80)).toBe("");
      expect(s.animation, el.outerHTML.slice(0, 80)).toBe("");
    }
    // The animated parts carry the classes the no-preference block names:
    // per drawing, three road masks and five bands draw (R42).
    expect(c.querySelectorAll(".cs-draw").length).toBe(16);
    expect(c.querySelectorAll(".cs-fade").length).toBeGreaterThan(0);
    expect(c.querySelectorAll(".cs-stroke").length).toBeGreaterThan(0);
  });
});

describe("R42 — the sheet plots itself, then the stamp", () => {
  const delayMs = (el: Element) => parseInt((el as HTMLElement).style.animationDelay, 10);

  it("the devices drop one after another in traffic order, the last by about 2 s", () => {
    const c = mount();
    for (const svg of c.querySelectorAll(".cs-drawing-art > svg")) {
      const devs = [...svg.querySelectorAll("rect.cs-dev")];
      expect(devs.length).toBe(18);
      expect(devs.every((d) => d.classList.contains("cs-drop"))).toBe(true);
      const xs = devs.map((d) => parseFloat((d.parentElement as Element).getAttribute("x") ?? ""));
      const ds = devs.map(delayMs);
      for (let i = 1; i < devs.length; i++) {
        expect(xs[i], "traffic order").toBeGreaterThan(xs[i - 1]);
        expect(ds[i], "one after another").toBeGreaterThan(ds[i - 1]);
      }
      // 250 ms per drop (globals.css): the last lands by about 2 s.
      expect(ds[ds.length - 1] + 250).toBeLessThanOrEqual(2100);
    }
  });

  it("the drawing plots before the devices: road, arrows, signs, bands, the work box", () => {
    const c = mount();
    const svg = c.querySelector(".cs-drawing-art > svg") as Element;
    const firstDevice = delayMs(svg.querySelector("rect.cs-dev") as Element);
    for (const el of svg.querySelectorAll(".cs-draw, .cs-stroke")) {
      expect(delayMs(el), el.outerHTML.slice(0, 60)).toBeLessThan(firstDevice);
    }
  });

  it("the title block says sheet 1 of 1, and the stamp reads PRELIMINARY over it", () => {
    const c = mount();
    const rows = [...c.querySelectorAll(".cs-tb-row")].map((r) => [
      r.querySelector("dt")?.textContent,
      r.querySelector("dd")?.textContent,
    ]);
    expect(rows).toContainEqual(["SHEET", "1 of 1"]);
    const stamp = c.querySelector(".cs-tb-wrap > .cs-stamp");
    expect(stamp?.textContent).toBe("PRELIMINARY");
    expect(stamp?.classList.contains("tr-section")).toBe(true);
  });

  it("the revised date is the build's (next.config.mjs), and with none the row is left out (Rule 10)", () => {
    const rowsOf = () =>
      [...mount().querySelectorAll(".cs-tb-row")].map((r) => r.querySelector("dt")?.textContent);
    vi.stubEnv("NEXT_PUBLIC_SHEET_REVISED", "");
    expect(rowsOf()).not.toContain("REVISED");
    cleanup();
    vi.stubEnv("NEXT_PUBLIC_SHEET_REVISED", "2026-09-29");
    const c = mount();
    const row = [...c.querySelectorAll(".cs-tb-row")].find((r) => r.querySelector("dt")?.textContent === "REVISED");
    expect(row?.querySelector("dd")?.textContent).toBe("2026-09-29");
    vi.unstubAllEnvs();
  });
});

// ── Arc 3 — sections 01 → close as FullPage.dc.html draws them (R12–R18) ──
describe("Arc 3 — the sections beside the road", () => {
  it("five section headers, 01 to 05, each a dimension line (R16); five milepost sections for the road (R13)", () => {
    const c = mount();
    const heads = [...c.querySelectorAll(".cs-head")];
    expect(heads.map((h) => h.querySelector(".tr-step")?.textContent)).toEqual(["01", "02", "03", "04", "05"]);
    expect(
      [...c.querySelectorAll("[data-milepost]")].map((s) => [
        s.getAttribute("data-milepost"),
        s.querySelector(".cs-head .tr-step")?.textContent ?? "close",
      ]),
    ).toEqual([
      ["0", "01"],
      ["1", "02"],
      ["2", "03"],
      ["3", "04"],
      ["4", "close"],
    ]);
  });

  it("01 is the pin → job → plan strip: three stations, then the three step texts (R15)", () => {
    const c = mount();
    const strip = c.querySelector(".cs-strip3")!;
    expect(strip.querySelectorAll(".cs-station > svg")).toHaveLength(3);
    expect([...strip.querySelectorAll(".cs-station .tr-step")].map((t) => t.textContent)).toEqual([
      "STEP 1 · PIN",
      "STEP 2 · JOB",
      "STEP 3 · PLAN",
    ]);
    expect([...strip.querySelectorAll(".cs-step-text h3")].map((t) => t.textContent)).toEqual([
      "Mark the work",
      "Say what the job is",
      "Take the plan",
    ]);
    // The drawings are decorative; the strip's name is read once.
    for (const svg of strip.querySelectorAll(".cs-station > svg")) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
    expect(c.querySelector(".sr-only")?.textContent).toBe(HOW.strip);
  });

  it("02's four paper stacks fan while a mouse is over them, and never on touch (R15)", () => {
    const c = mount();
    const stacks = [...c.querySelectorAll(".cs-stack")];
    expect(stacks).toHaveLength(4);
    const s = stacks[1];
    expect(s.classList.contains("is-fanned")).toBe(false);
    fireEvent.pointerEnter(s, { pointerType: "mouse" });
    expect(s.classList.contains("is-fanned")).toBe(true);
    fireEvent.pointerLeave(s, { pointerType: "mouse" });
    expect(s.classList.contains("is-fanned")).toBe(false);
    fireEvent.pointerEnter(s, { pointerType: "touch" });
    expect(s.classList.contains("is-fanned")).toBe(false);
    // Each stack has its three sheets for the fan to move.
    for (const st of stacks) {
      expect(st.querySelectorAll(".cs-s1, .cs-s2, .cs-s3")).toHaveLength(3);
    }
  });

  it("03's detail: no figure, ONE note with three leaders, the buffer empty and devices on the lane through the work (R15, A2-Q5)", () => {
    const c = mount();
    const art = c.querySelector(".cs-detail-art")!;
    expect(art.textContent).not.toMatch(/\d/);
    expect([...art.querySelectorAll(".cs-dim-text")].map((t) => t.textContent)).toEqual([
      "taper",
      "buffer",
      "spacing",
    ]);
    expect(
      [...art.querySelectorAll("text")].filter((t) => t.textContent === "source cited in the audit"),
    ).toHaveLength(1);
    expect(art.querySelectorAll(".cs-leader")).toHaveLength(3);
    const devs = [...art.querySelectorAll("rect.cs-dev")].map(
      (r) => [parseFloat(r.getAttribute("x")!), parseFloat(r.getAttribute("y")!)] as const,
    );
    expect(devs.length).toBeGreaterThan(0);
    // The buffer's dimension runs from the taper's end tick to the work's
    // (x is written to two decimals, hence the 0.01 tolerance).
    const pct = (u: number) => (u / 856) * 100;
    expect(devs.filter(([x]) => x > pct(326) + 0.01 && x < pct(560) - 0.01)).toEqual([]);
    expect(devs.filter(([x, y]) => x >= pct(560) - 0.01 && y === 207).length).toBeGreaterThanOrEqual(4);
  });

  it("04: the two cards, 'same plan' between them (R15)", () => {
    const c = mount();
    expect(c.querySelectorAll(".cs-who-card")).toHaveLength(2);
    expect(c.querySelectorAll(".cs-who-card svg")).toHaveLength(2);
    expect(c.querySelector(".cs-same")?.textContent).toBe("same plan");
  });
});

describe("Arc 3 — the founders' note (R17, A3-Q1)", () => {
  it("is verbatim, with A3-Q1's third paragraph", () => {
    const c = mount();
    const note = c.querySelector(".cs-founders-note")!;
    expect(note.querySelector("h3")?.textContent).toBe("Ninety years of hard-won rules.");
    expect([...note.querySelectorAll("p")].map((p) => p.textContent)).toEqual([...FOUNDERS.paragraphs]);
    expect(FOUNDERS.paragraphs[0]).toMatch(
      /^The first national manual on traffic control devices came out in 1935\. /,
    );
    expect(FOUNDERS.paragraphs[2]).toBe(
      "We think the people who set the cones deserve tools as good as the rules they work under. So we're building one. It applies the manual to your road, shows the source for every taper, buffer and spacing, and leaves the calls that need experience to the people who have it.",
    );
    expect(c.textContent).not.toContain("every number");
    expect(c.textContent).toContain("a note from the founders");
  });

  it("is signed by the three founders under 'The founders': Ryan, James, Zac (R24)", () => {
    const c = mount();
    expect(c.querySelector(".cs-founders-head")?.textContent).toBe("The founders");
    expect(
      [...c.querySelectorAll(".cs-founder .cs-founder-text")].map((t) => [...t.children].map((e) => e.textContent)),
    ).toEqual([
      ["Ryan", "PRODUCT & ENGINEERING"],
      ["James", "GO-TO-MARKET & PRICING"],
      ["Zac", "SALES & CUSTOMERS"],
    ]);
  });

  it("R24: a 56 px square left of each name — Ryan's photo (alt 'Ryan'), James's and Zac's initials, hidden from the accessibility tree", () => {
    const rows = [...mount().querySelectorAll(".cs-founder")];
    // The square comes first in each row, the text second.
    for (const r of rows) {
      expect(r.children[0].classList.contains("cs-founder-photo")).toBe(true);
      expect(r.children[1].classList.contains("cs-founder-text")).toBe(true);
    }
    const img = rows[0].querySelector("img.cs-founder-photo")!;
    expect(img.getAttribute("src")).toBe("/founders/ryan.jpg");
    expect(img.getAttribute("alt")).toBe("Ryan");
    expect([img.getAttribute("width"), img.getAttribute("height")]).toEqual(["56", "56"]);
    for (const [r, initial] of [
      [rows[1], "J"],
      [rows[2], "Z"],
    ] as const) {
      const ph = r.querySelector(".cs-founder-initial")!;
      expect(ph.textContent).toBe(initial);
      expect(ph.getAttribute("aria-hidden")).toBe("true");
      expect(r.querySelector("img")).toBeNull();
    }
  });
});

describe("Arc 3 — the closing band (R18, A3-Q4)", () => {
  it("draws Colorado and names it a drawing, not a road map", () => {
    const c = mount();
    const map = c.querySelector(".cs-close .cs-map")!;
    expect(map.getAttribute("role")).toBe("img");
    expect(map.getAttribute("aria-label")).toMatch(/^Drawing of Colorado, not a road map/);
    const words = [...map.querySelectorAll("text")].map((t) => t.textContent);
    for (const w of [
      "fort collins",
      "coloradosprings",
      "pueblo",
      "grand junction",
      "durango",
      "denver",
      "I-25",
      "I-70",
      "COLORADO",
    ]) {
      expect(words, w).toContain(w);
    }
    expect(map.querySelectorAll(".cs-map-city")).toHaveLength(5);
    expect(c.querySelector(".cs-close .tr-section")?.textContent).toBe("Built in Colorado");
  });
});

// R22 — the polish round.
describe("R22 — the map, 01's words and the close band", () => {
  const num = (el: Element, a: string) => Number(el.getAttribute(a));
  // A point's distance to a polyline "M x y L x y …".
  const offRoute = (px: number, py: number, d: string) => {
    const p = [...d.matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0]));
    let best = Infinity;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const [ax, ay, bx, by] = [p[i], p[i + 1], p[i + 2], p[i + 3]];
      const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
      best = Math.min(best, Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay))));
    }
    return best;
  };

  it("Colorado Springs is set on two lines inside the box, right of its marker", () => {
    const map = mount().querySelector(".cs-map")!;
    const town = [...map.querySelectorAll(".cs-map-town")].find((g) => g.textContent === "coloradosprings")!;
    const marker = town.querySelector(".cs-map-city")!;
    expect([...town.querySelectorAll("tspan")].map((t) => t.textContent)).toEqual(["colorado", "springs"]);
    expect(num(town.querySelector("text")!, "x")).toBeGreaterThan(num(marker, "x") + 4);
  });

  it("the four route cities sit on their interstate, Durango off it; Denver is a ring on the junction; still 'not a road map'", () => {
    const map = mount().querySelector(".cs-map")!;
    const [i25, i70] = [...map.querySelectorAll("path.cs-map-road")].map((p) => p.getAttribute("d")!);
    const centre = (name: string) => {
      const g = [...map.querySelectorAll(".cs-map-town")].find((t) => t.textContent === name)!;
      const r = g.querySelector(".cs-map-city")!;
      return [num(r, "x") + 2, num(r, "y") + 2] as const;
    };
    for (const n of ["fort collins", "coloradosprings", "pueblo"]) expect(offRoute(...centre(n), i25), n).toBeLessThan(0.5);
    expect(offRoute(...centre("grand junction"), i70)).toBeLessThan(0.5);
    const durango = centre("durango");
    expect(Math.min(offRoute(...durango, i25), offRoute(...durango, i70))).toBeGreaterThan(20);
    const ring = map.querySelector(".cs-map-denver")!;
    expect(ring.tagName.toLowerCase()).toBe("circle");
    expect(offRoute(num(ring, "cx"), num(ring, "cy"), i25)).toBeLessThan(0.5);
    expect(offRoute(num(ring, "cx"), num(ring, "cy"), i70)).toBeLessThan(0.5);
    // No stem: nothing else in the pin's colour.
    expect(map.querySelectorAll(".cs-map-pin")).toHaveLength(1);
    const label = [...map.querySelectorAll("text")].find((t) => t.textContent === "denver")!;
    expect(num(label, "x")).toBeGreaterThan(num(ring, "cx"));
    expect(num(label, "y")).toBeLessThan(num(ring, "cy"));
    expect(map.getAttribute("aria-label")).toContain("not a road map");
  });

  it("01's three step texts are R22's, verbatim", () => {
    const c = mount();
    expect([...c.querySelectorAll(".cs-step-text p")].map((p) => p.textContent)).toEqual([
      "Type an address or two cross streets, or drop a pin. It's how an 811 ticket already describes a job. Conestruct finds the road, which way it runs, and whose road it is.",
      "Tell it the kind of work, how long, and which side. The road's own details come filled in for you to check. The kind of work is always your call.",
      "You get the drawing and the device count, with a contractor estimate one click away. Anything that needs a person shows up first. Everything that passed is there when you want it.",
    ]);
  });

  it("the close band is the map and ONE stack: the label, the sentence, then 'Get notified'", () => {
    const close = mount().querySelector(".cs-close")!;
    expect([...close.children].map((e) => e.getAttribute("class")?.split(" ")[0])).toEqual(["cs-map", "cs-close-stack"]);
    const stack = close.querySelector(".cs-close-stack")!;
    expect([...stack.children].map((e) => e.textContent)).toEqual([
      "Built in Colorado",
      "For the people who set the cones, and the people who price them.",
      "Get notified",
    ]);
  });
});

describe("R33 / R34 / R35 — the unslop pass", () => {
  it("R34: the callout is Ryan's two sentences; R35: 03's heading", () => {
    const c = mount();
    expect(c.textContent).toContain("You mark the work. The rest is laid out around it.");
    expect(c.querySelector("#cs-sources")?.textContent).toBe("Every number shows where it came from");
  });

  it("R33: no em dash on the page; R34: the captions no longer join two sentences with a middle dot", () => {
    const text = mount().textContent ?? "";
    expect(text).not.toContain("—");
    expect(text).toContain("Illustration. A real plan is drawn on the road you pick.");
    for (const joined of ["you mark the work ·", "illustration · a real plan"]) {
      expect(text.toLowerCase(), joined).not.toContain(joined);
    }
  });
});
