// @vitest-environment happy-dom
//
// coming-soon-gate R13 / R14 / A3-Q3 — the milepost road and its marker,
// mounted.  happy-dom lays nothing out, so the page's geometry is given:
// the road's column starts 1100 px down and is 3000 px tall, its five
// milepost sections sit at the tops below, the page is 4400 px tall in a
// 900 px window.  requestAnimationFrame is a queue the test drains.

import { Profiler } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZONE_COLOR } from "@/lib/corridor-zones";
import { MilepostRoad } from "./MilepostRoad";

const WRAP_TOP = 1100;
const WRAP_H = 3000;
const TOPS = [120, 700, 1240, 1760, 2700];
const VH = 900;
const DOC_H = 4400;
const MAX = DOC_H - VH;
// The scroll that puts the (unanimated) front at `f` px down the road.
const scrollFor = (f: number) => WRAP_TOP - VH * 0.6 + (f / WRAP_H) * (MAX - (WRAP_TOP - VH * 0.6));

let frames: FrameRequestCallback[] = [];
let media = { reduce: false, wide: true };

function drain(limit = 500) {
  let n = 0;
  while (frames.length && n++ < limit) {
    const cb = frames.shift()!;
    act(() => cb(performance.now()));
  }
  return n;
}

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true, writable: true });
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

beforeEach(() => {
  frames = [];
  media = { reduce: false, wide: true };
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("reduce") ? media.reduce : q.includes("min-width") ? media.wide : false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
  Object.defineProperty(window, "innerHeight", { value: VH, configurable: true, writable: true });
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
  Object.defineProperty(document.documentElement, "scrollHeight", { value: DOC_H, configurable: true });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const el = this as HTMLElement;
    const wrap = el.classList.contains("cs-road-wrap");
    const post = el.dataset?.milepost;
    const docTop = wrap ? WRAP_TOP : post !== undefined ? WRAP_TOP + TOPS[Number(post)] : 0;
    const top = docTop - window.scrollY;
    const height = wrap ? WRAP_H : 0;
    return { top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON() {} } as DOMRect;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

let commits = 0;
function mount() {
  commits = 0;
  const r = render(
    <Profiler id="road" onRender={() => commits++}>
      <MilepostRoad>
        {TOPS.map((_, i) => (
          <section key={i} data-milepost={i} />
        ))}
      </MilepostRoad>
    </Profiler>,
  );
  const c = r.container;
  return {
    c,
    reveal: () => Number(c.querySelector(".cs-road-reveal")!.getAttribute("height")),
    fadeY1: () => Number(c.querySelector("#cs-road-fade")!.getAttribute("y1")),
    marker: () => c.querySelector(".cs-mp") as HTMLElement,
  };
}

describe("R13 — the road is drawn from the measured sections", () => {
  it("its stretches are ZONE_COLOR's five, starting 6 px above each milepost section", () => {
    const { c } = mount();
    const lit = c.querySelector(".cs-road-lit")!;
    const bars = [...lit.querySelectorAll(".cs-road-bar")];
    expect(bars.map((b) => b.getAttribute("fill"))).toEqual([
      ZONE_COLOR.advance_warning,
      ZONE_COLOR.transition,
      ZONE_COLOR.buffer,
      ZONE_COLOR.work_zone,
      ZONE_COLOR.downstream,
    ]);
    expect(bars.map((b) => Number(b.getAttribute("y")))).toEqual(TOPS.map((t) => t - 6));
    expect([...lit.querySelectorAll(".cs-road-word")].map((t) => t.textContent)).toEqual([
      "advance warning",
      "taper",
      "buffer",
      "work zone",
      "downstream",
    ]);
    expect([...lit.querySelectorAll(".cs-road-stretch text.tr-step")].map((t) => t.textContent)).toEqual([
      "01",
      "02",
      "03",
      "04",
      "CO",
    ]);
  });

  it("one passive scroll listener", () => {
    const add = vi.spyOn(window, "addEventListener");
    mount();
    const scroll = add.mock.calls.filter(([type]) => type === "scroll");
    expect(scroll).toHaveLength(1);
    expect(scroll[0][2]).toEqual({ passive: true });
  });
});

describe("R13 — scrolling, no preference", () => {
  it("at the top of the page nothing is highlighted and the marker is hidden", () => {
    const { reveal, marker } = mount();
    expect(reveal()).toBe(0);
    expect(marker().hidden).toBe(true);
  });

  it("the highlight eases toward the scroll (no stepping) and ends exactly at the road's end at max scroll", () => {
    const { reveal, fadeY1 } = mount();
    scrollTo(MAX);
    const seen: number[] = [];
    while (frames.length) {
      drain(1);
      seen.push(reveal());
    }
    expect(seen[0]).toBeGreaterThan(0);
    expect(seen[0]).toBeLessThan(WRAP_H);
    for (let k = 1; k < seen.length; k++) expect(seen[k]).toBeGreaterThan(seen[k - 1]);
    expect(seen.at(-1)).toBe(WRAP_H);
    // At the end the fade is gone: the whole road is lit.
    expect(fadeY1()).toBeGreaterThan(WRAP_H);
  });

  it("below the highlight the road fades, and the fade recedes with the scroll", () => {
    const { reveal, fadeY1 } = mount();
    scrollTo(scrollFor(900));
    drain();
    expect(reveal()).toBe(900);
    expect(fadeY1()).toBe(900 + 300);
    scrollTo(scrollFor(1500));
    drain();
    expect(fadeY1()).toBe(1500 + 300);
  });

  it("the marker names the stretch the highlight is in, with its colour (R14)", () => {
    const { marker } = mount();
    const cases = [
      [400, "01", "advance warning", ZONE_COLOR.advance_warning],
      [900, "02", "taper", ZONE_COLOR.transition],
      [1500, "03", "buffer", ZONE_COLOR.buffer],
      [2200, "04", "work zone", ZONE_COLOR.work_zone],
      [2850, "CO", "downstream", ZONE_COLOR.downstream],
    ] as const;
    for (const [f, post, word, colour] of cases) {
      scrollTo(scrollFor(f));
      drain();
      const m = marker();
      expect(m.hidden, post).toBe(false);
      expect(m.textContent).toBe(`MILEPOST${post}${word}`);
      expect((m.querySelector(".cs-swatch") as HTMLElement).style.background.toLowerCase()).toBe(
        colour.toLowerCase(),
      );
    }
  });

  it("React renders only when the stretch changes, not per frame", () => {
    const { reveal } = mount();
    scrollTo(scrollFor(1300));
    drain();
    const before = commits;
    // Many frames within the buffer stretch.
    scrollTo(scrollFor(1600));
    const n = drain();
    expect(n).toBeGreaterThan(5);
    expect(reveal()).toBe(1600);
    expect(commits).toBe(before);
  });
});

describe("R13 / A3-Q3 — prefers-reduced-motion: reduce", () => {
  it("the road is fully drawn at once, with no fade and no animation frame", () => {
    media.reduce = true;
    const { reveal, fadeY1 } = mount();
    expect(reveal()).toBe(WRAP_H);
    expect(fadeY1()).toBeGreaterThan(WRAP_H);
    expect(frames).toHaveLength(0);
    scrollTo(scrollFor(1500));
    expect(frames).toHaveLength(0);
    expect(reveal()).toBe(WRAP_H);
  });

  it("the marker still follows the scroll, stretch by stretch, with no frame between", () => {
    media.reduce = true;
    const { marker } = mount();
    expect(marker().hidden).toBe(true);
    scrollTo(scrollFor(1500));
    expect(frames).toHaveLength(0);
    expect(marker().hidden).toBe(false);
    expect(marker().textContent).toBe("MILEPOST03buffer");
    scrollTo(scrollFor(2200));
    expect(marker().textContent).toBe("MILEPOST04work zone");
  });
});

describe("R14 — the marker never covers the nav", () => {
  it("in a window tall enough to start the highlight at the top, it waits until the nav has scrolled away", () => {
    Object.defineProperty(window, "innerHeight", { value: 3000, configurable: true, writable: true });
    const nav = document.createElement("nav");
    document.body.prepend(nav);
    const real = Element.prototype.getBoundingClientRect as unknown as { getMockImplementation(): (this: Element) => DOMRect };
    const inner = real.getMockImplementation();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (this.tagName === "NAV") {
        const top = -window.scrollY;
        return { top, bottom: top + 52, height: 52, left: 0, right: 0, width: 0, x: 0, y: top, toJSON() {} } as DOMRect;
      }
      return inner.call(this);
    });
    const { marker, reveal } = mount();
    expect(reveal()).toBeGreaterThan(0);
    expect(marker().hidden).toBe(true);
    scrollTo(30);
    drain();
    expect(marker().hidden).toBe(true);
    scrollTo(60);
    drain();
    expect(marker().hidden).toBe(false);
    nav.remove();
  });
});

describe("R13 / R14 — below 980 px", () => {
  it("the marker never shows", () => {
    media.wide = false;
    const { marker } = mount();
    scrollTo(scrollFor(1500));
    drain();
    expect(marker().hidden).toBe(true);
  });
});
