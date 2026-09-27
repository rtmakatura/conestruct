// @vitest-environment happy-dom
//
// coming-soon-gate Arc 2 — the Plan Sheet at `/`, mounted.  What the
// rulings make testable without a browser: the words (A2-Q6), the mail
// link (A2-Q1), one primary (A2-Q10), the zone colours and words from
// the product's one source (R9), and the drawing's device placement
// matching the product's lane closure (A2-Q5).  Layout, targets and
// contrast are the browser leg (happy-dom lays nothing out).

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Page from "@/app/page";
import { ZONE_COLOR, ZONE_LABEL } from "@/lib/corridor-zones";
import { FOUNDERS, HOW, NOTIFY_HREF, SOURCES } from "@/lib/coming-soon-copy";
import { PUBLIC_LINE } from "@/lib/public-copy";

afterEach(cleanup);

const mount = () => render(<Page />).container;

describe("the Plan Sheet — words and links", () => {
  it("'Get notified' is a mail link to ryan@conestruct.com with the ruled subject, in nav, sheet and closing band (A2-Q1)", () => {
    expect(NOTIFY_HREF).toBe(
      "mailto:ryan@conestruct.com?subject=Conestruct%20%E2%80%94%20let%20me%20know%20when%20it%20opens",
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

  it("the h1 is the question; the notify line is the ruled one", () => {
    const c = mount();
    expect([...c.querySelectorAll("h1")].map((h) => h.textContent)).toEqual(["Want to know when it opens?"]);
    expect(c.textContent).toContain("Email us and we'll write back once, when Conestruct opens.");
  });

  it("the hero line is PUBLIC_LINE — the page and its metadata say one thing (P2)", () => {
    expect(mount().textContent).toContain(PUBLIC_LINE);
    expect(PUBLIC_LINE).toContain("every taper, buffer and spacing cited to MUTCD 2023 or CDOT");
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
      const fills = [...svg.querySelectorAll(":scope > rect.cs-fade")].map((r) => r.getAttribute("fill"));
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
        const r = svg.querySelectorAll(":scope > rect.cs-fade")[i];
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
    // The animated parts carry the classes the no-preference block names.
    expect(c.querySelectorAll(".cs-draw").length).toBe(2);
    expect(c.querySelectorAll(".cs-fade").length).toBeGreaterThan(0);
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

  it("is signed by the three founders under 'The founders'", () => {
    const c = mount();
    expect(c.querySelector(".cs-founders-head")?.textContent).toBe("The founders");
    expect(
      [...c.querySelectorAll(".cs-founder")].map((li) => [...li.children].map((e) => e.textContent)),
    ).toEqual([
      ["Ryan", "PRODUCT & ENGINEERING"],
      ["James", "GO-TO-MARKET & PRICING"],
      ["Zac", "SALES & CUSTOMERS"],
    ]);
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
      "colorado springs",
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
