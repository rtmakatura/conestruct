// @vitest-environment happy-dom
//
// #301 piece 1 — the aerial on the WHERE band, mounted.  Asserted on what a
// person sees in each state (the checkpoint's (c), as ruled), and on the one
// request it sends: the backend's picture of THIS scenario, never a
// coordinate of its own (Rule 3) and never the previous picture (Rule 10).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import {
  BandAerial,
  AERIAL_ARMED_ALT,
  AERIAL_BIG_MAP,
  AERIAL_FAILED,
  AERIAL_KIND_OWED,
  AERIAL_TAP_BAR,
  AERIAL_WAIT,
  type AerialBar,
  type AerialTap,
} from "./BandAerial";
import { forgetAerials } from "@/lib/corridor-aerial";
import { SIDE_BLOCKER } from "@/lib/scenarios/rail";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { ShoulderScenario } from "@/lib/scenarios";
import type { CorridorGeometry, GeometryFetch, GeometryPart } from "@/lib/corridor-geometry";
import { TEST_PIN } from "../test-fixtures";

const SCENARIO: ShoulderScenario = {
  ...DEFAULT_SHOULDER,
  meta: { ...DEFAULT_SHOULDER.meta, ...TEST_PIN, pinModel: "work_start" },
};

const part = (extended = false): GeometryPart => ({
  points: [
    [39.7, -104.9],
    [39.71, -104.9],
  ],
  extended,
});

function answer(
  status: CorridorGeometry["status"],
  opts: { approaches?: number; extended?: boolean; message?: string } = {},
): GeometryFetch {
  const zones = (["downstream", "buffer", "transition", "advance_warning"] as const).map((zone) => ({
    zone,
    length_ft: 100,
    points: part().points,
    parts: [part(opts.extended && zone === "advance_warning")],
  }));
  const geometry: CorridorGeometry = {
    status,
    pin_model: "work_start",
    pin: [39.7, -104.9],
    travel_bearing_deg: status === "laid_out" ? 180 : null,
    work: status === "laid_out" ? { length_ft: 1000, points: part().points, parts: [part()] } : null,
    approaches:
      status === "laid_out"
        ? [
            { id: "primary" as const, travel_bearing_deg: 359.9, zones },
            ...(opts.approaches === 2
              ? [{ id: "opposing" as const, travel_bearing_deg: 180.3, zones }]
              : []),
          ]
        : [],
    coverage_ft: null,
    message: opts.message ?? null,
    side_options: [],
  };
  return { state: "ready", geometry };
}

const requests: { stage: string; width: number; height: number; scenario: unknown }[] = [];
let reply: () => Response;

beforeEach(() => {
  forgetAerials();
  requests.length = 0;
  reply = () => new Response(new Blob(["png"], { type: "image/png" }), { status: 200 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("/api/corridor-map");
      requests.push(JSON.parse(String(init.body)));
      return reply();
    }),
  );
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:aerial-${++n}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function settle(ms = 450) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe("the band's aerial, state by state", () => {
  // #440 X22 (Rule 5, stated): the side caption left the aerial; the
  // CONFIRM card's side question asks for the side.
  it("before the side: the pin alone, no caption, no legend", async () => {
    render(<BandAerial scenario={SCENARIO} geometry={answer("side_not_confirmed")} kindConfirmed />);
    expect(q("band-aerial-note")?.textContent).toBe(AERIAL_WAIT);
    await settle();
    expect(requests).toEqual([{ scenario: SCENARIO, stage: "pin", width: 600, height: 300 }]);
    expect(q("band-aerial-img")?.getAttribute("src")).toBe("blob:aerial-1");
    expect(q("band-aerial-note")).toBeNull();
    expect(document.body.textContent).not.toContain(SIDE_BLOCKER);
    expect(q("band-aerial-legend")).toBeNull();
    expect(q("band-aerial")?.getAttribute("data-stage")).toBe("pin");
  });

  // #440 ruling 7 (Rule 5, stated): the not-marked line leaves the aerial;
  // the CONFIRM card's cross-street question asks for the crossing.
  it("#317 (R129 Q2) / #440 ruling 7: no crossing marked — the pin, and no line on it", async () => {
    const line = "Mark the cross street on the map to lay out the sides.";
    render(
      <BandAerial
        scenario={SCENARIO}
        geometry={answer("intersection_not_marked", { message: line })}
        kindConfirmed
      />,
    );
    await settle();
    expect(requests).toEqual([{ scenario: SCENARIO, stage: "pin", width: 600, height: 300 }]);
    expect(q("band-aerial-img")?.getAttribute("src")).toBe("blob:aerial-1");
    expect(q("band-aerial-note")).toBeNull();
    expect(document.body.textContent).not.toContain(line);
  });

  it("the side chosen, the kind owed: the work only, and a legend line for the rest (ruling 4)", async () => {
    render(<BandAerial scenario={SCENARIO} geometry={answer("laid_out")} kindConfirmed={false} />);
    await settle();
    expect(requests.map((r) => r.stage)).toEqual(["work"]);
    const legend = q("band-aerial-legend")!;
    expect(Array.from(legend.querySelectorAll(".a-aerial-row")).map((r) => r.textContent)).toEqual([
      "Work zone",
    ]);
    // #439 W10: the sentence is not a channel; it sits under the aerial.
    expect(legend.textContent).not.toContain(AERIAL_KIND_OWED);
    expect(q("band-aerial")!.textContent).toContain(AERIAL_KIND_OWED);
    expect(q("band-aerial-note")).toBeNull();
  });

  it("both answered: the whole corridor and the five channels, upstream first", async () => {
    render(<BandAerial scenario={SCENARIO} geometry={answer("laid_out")} kindConfirmed />);
    await settle();
    expect(requests.map((r) => r.stage)).toEqual(["laid_out"]);
    const rows = Array.from(q("band-aerial-legend")!.querySelectorAll(".a-aerial-row"));
    expect(rows.map((r) => r.textContent)).toEqual([
      // #439 ruling 7: the key's plain labels.
      "Warning signs",
      "Taper",
      "Buffer",
      "Work zone",
      "After the work",
    ]);
    // Rule 111 / #131: the width rank rides every swatch, not colour alone.
    const heights = rows.map((r) => (r.querySelector(".a-aerial-swatch") as HTMLElement).style.height);
    expect(heights).toEqual(["6px", "5px", "4px", "3px", "2px"]);
    expect(q("band-aerial-img")?.getAttribute("alt")).toMatch(/laid-out corridor/);
  });

  it("a flagger names its two approaches, as page 2 does; footage past the road is named", async () => {
    render(
      <BandAerial
        scenario={SCENARIO}
        geometry={answer("laid_out", { approaches: 2, extended: true })}
        kindConfirmed
      />,
    );
    await settle();
    // #439 W10: the faded row is a channel (on the key); the approaches
    // sentence is not (under the aerial).
    const legend = q("band-aerial-legend")!.textContent;
    expect(legend).toContain("Faded: past the mapped road");
    expect(q("band-aerial")!.textContent).toContain(
      "Two approaches: northbound (the work's side) and southbound",
    );
  });

  it("a refused corridor is the backend's reason in words, and no picture is asked for", async () => {
    render(
      <BandAerial
        scenario={SCENARIO}
        geometry={answer("corridor_unbuildable", { message: "ValueError: the road ends here" })}
        kindConfirmed
      />,
    );
    await settle();
    expect(requests).toEqual([]);
    expect(q("band-aerial-note")?.textContent).toBe("Can't lay the corridor out here: the road ends here");
    expect(q("band-aerial-img")).toBeNull();
  });

  // #456 ruling 3 (Rule 5, stated; M9): the old picture stays until the
  // new one is ready, never a blank box, and says it is being redrawn.
  it("while the geometry re-reads, the old picture stays and says it is being redrawn", async () => {
    const { rerender } = render(
      <BandAerial scenario={SCENARIO} geometry={answer("laid_out")} kindConfirmed />,
    );
    await settle();
    expect(q("band-aerial-img")?.getAttribute("src")).toBe("blob:aerial-1");
    const moved = { ...SCENARIO, meta: { ...SCENARIO.meta, lat: SCENARIO.meta.lat + 0.001 } };
    const reading: GeometryFetch = { state: "loading", geometry: answer("laid_out").geometry };
    rerender(<BandAerial scenario={moved} geometry={reading} kindConfirmed />);
    expect(q("band-aerial-img")?.getAttribute("src")).toBe("blob:aerial-1");
    expect(q("band-aerial-note")).toBeNull();
    expect(q("band-aerial-held")?.textContent).toBe(AERIAL_WAIT);
    expect(q("band-aerial-frame")?.getAttribute("aria-busy")).toBe("true");
    await settle();
    expect(requests).toHaveLength(1);
    rerender(<BandAerial scenario={moved} geometry={answer("laid_out")} kindConfirmed />);
    await settle();
    expect(requests).toHaveLength(2);
    expect(q("band-aerial-img")?.getAttribute("src")).toBe("blob:aerial-2");
    expect(q("band-aerial-held")).toBeNull();
    expect(q("band-aerial-frame")?.hasAttribute("aria-busy")).toBe(false);
  });

  it("a failed image says so; the geometry failing says so", async () => {
    reply = () =>
      new Response(JSON.stringify({ status: "unavailable", message: "x" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    render(<BandAerial scenario={SCENARIO} geometry={answer("laid_out")} kindConfirmed />);
    await settle();
    expect(q("band-aerial-note")?.textContent).toBe(AERIAL_FAILED);
    cleanup();
    render(<BandAerial scenario={SCENARIO} geometry={{ state: "error", geometry: null }} kindConfirmed />);
    expect(q("band-aerial-note")?.textContent).toBe(AERIAL_FAILED);
  });

  it("a picture already drawn is shown again at once, without asking", async () => {
    const { unmount } = render(<BandAerial scenario={SCENARIO} geometry={answer("laid_out")} kindConfirmed />);
    await settle();
    unmount();
    render(<BandAerial scenario={SCENARIO} geometry={answer("laid_out")} kindConfirmed />);
    expect(q("band-aerial-img")?.getAttribute("src")).toBe("blob:aerial-1");
    await settle();
    expect(requests).toHaveLength(1);
  });

  it("is a read under the write lock (data-read)", () => {
    render(<BandAerial scenario={SCENARIO} geometry={answer("laid_out")} kindConfirmed />);
    expect(q("band-aerial")?.hasAttribute("data-read")).toBe(true);
  });
});

// Ryan's hand-check ruling on #301, 2026-09-26: "+ / − controls on the image
// (32 px, 44 at 380, data-read, never locked by the write lock) that
// re-request /render/corridor-map with a zoom step ... Show the previous
// image until the new one arrives (P16 — no blank, no spinner on the
// image).  A "reset" returns to the whole-corridor framing."
describe("the band's aerial zooms", () => {
  const btn = (label: string) =>
    document.querySelector<HTMLButtonElement>(`[data-testid="band-aerial-zoom"] [aria-label="${label}"]`);

  async function drawn() {
    render(<BandAerial scenario={SCENARIO} geometry={answer("laid_out")} kindConfirmed />);
    await settle();
    expect(q("band-aerial-img")?.getAttribute("src")).toBe("blob:aerial-1");
  }

  it("+ re-requests a step in; the previous picture stays, with no wait note, until it lands", async () => {
    await drawn();
    await act(async () => btn("Zoom in")!.click());
    // Held: the same corridor's picture, no blank, no note on the image.
    expect(q("band-aerial-img")?.getAttribute("src")).toBe("blob:aerial-1");
    expect(q("band-aerial-note")).toBeNull();
    await settle();
    expect(requests.map((r) => (r as { zoom?: number }).zoom ?? 0)).toEqual([0, 1]);
    expect(q("band-aerial-img")?.getAttribute("src")).toBe("blob:aerial-2");
    expect(q("band-aerial-zoom")?.getAttribute("data-step")).toBe("1");
  });

  it("one step out, three in — the bounds do nothing, and say so to assistive tech", async () => {
    await drawn();
    await act(async () => btn("Zoom out")!.click());
    await settle();
    expect(btn("Zoom out")!.getAttribute("aria-disabled")).toBe("true");
    await act(async () => btn("Zoom out")!.click());
    await settle();
    expect(q("band-aerial-zoom")?.getAttribute("data-step")).toBe("-1");
    for (let i = 0; i < 5; i++) {
      await act(async () => btn("Zoom in")!.click());
      await settle();
    }
    expect(q("band-aerial-zoom")?.getAttribute("data-step")).toBe("3");
    expect(btn("Zoom in")!.getAttribute("aria-disabled")).toBe("true");
    expect(requests.map((r) => (r as { zoom?: number }).zoom ?? 0)).toEqual([0, -1, 0, 1, 2, 3].filter(
      // the step back to 0 is the first picture, already drawn — not asked again
      (z, i) => !(z === 0 && i > 0),
    ));
  });

  it("Reset appears away from the whole corridor and returns to it — the first picture, not asked again", async () => {
    await drawn();
    expect(btn("Reset to the whole corridor")).toBeNull();
    await act(async () => btn("Zoom in")!.click());
    await settle();
    await act(async () => btn("Reset to the whole corridor")!.click());
    expect(q("band-aerial-img")?.getAttribute("src")).toBe("blob:aerial-1");
    expect(q("band-aerial-zoom")?.getAttribute("data-step")).toBe("0");
    expect(btn("Reset to the whole corridor")).toBeNull();
    await settle();
    expect(requests).toHaveLength(2);
  });

  // #456 M9 (Rule 5, stated): the old picture is held, marked as being
  // redrawn (Rule 10), until the new corridor's whole-corridor picture lands.
  it("a different corridor opens on the whole corridor; the old picture waits marked as redrawing", async () => {
    const { rerender } = render(
      <BandAerial scenario={SCENARIO} geometry={answer("laid_out")} kindConfirmed />,
    );
    await settle();
    await act(async () => btn("Zoom in")!.click());
    await settle();
    const moved = { ...SCENARIO, meta: { ...SCENARIO.meta, lat: SCENARIO.meta.lat + 0.001 } };
    rerender(<BandAerial scenario={moved} geometry={answer("laid_out")} kindConfirmed />);
    expect(q("band-aerial-img")?.getAttribute("src")).toBe("blob:aerial-2");
    expect(q("band-aerial-held")?.textContent).toBe(AERIAL_WAIT);
    expect(q("band-aerial-note")).toBeNull();
    await settle();
    expect((requests.at(-1) as { zoom?: number }).zoom).toBeUndefined();
    expect(q("band-aerial-zoom")?.getAttribute("data-step")).toBe("0");
  });

  it("the controls are reads: data-read, never disabled (the write lock leaves them live)", async () => {
    await drawn();
    for (const label of ["Zoom in", "Zoom out"]) {
      const b = btn(label)!;
      expect(b.hasAttribute("data-read")).toBe(true);
      expect(b.disabled).toBe(false);
    }
  });
});


// ── #440: the cross street on the aerial (rulings 3-5, X3, X5, X12) ──────

describe("#440: the aerial takes the cross-street tap", () => {
  const rect = (img: HTMLElement, w: number, h: number) => {
    img.getBoundingClientRect = () =>
      ({ left: 10, top: 20, width: w, height: h, right: 10 + w, bottom: 20 + h, x: 10, y: 20 }) as DOMRect;
  };

  it("X3: the cross-street question asks for the pin picture, even with the work laid out", async () => {
    render(<BandAerial scenario={SCENARIO} geometry={answer("laid_out")} kindConfirmed={false} pinFrame />);
    await settle();
    expect(requests).toEqual([{ scenario: SCENARIO, stage: "pin", width: 600, height: 300 }]);
    expect(q("band-aerial")?.getAttribute("data-stage")).toBe("pin");
    // No side sentence and no legend on the forced pin picture.
    expect(q("band-aerial-note")).toBeNull();
    expect(q("band-aerial-legend")).toBeNull();
  });

  it("#446 T25: an answer counted while the bar wasn't failed doesn't scroll later; a new one does", async () => {
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy;
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const top = this.getAttribute("data-testid") === "band-aerial-bar" ? -40 : 0;
      return { top, bottom: top + 65, left: 0, right: 0, width: 0, height: 65, x: 0, y: top } as DOMRect;
    });
    const aerial = (missCount: number, bar: AerialBar) => (
      <BandAerial
        scenario={SCENARIO}
        geometry={answer("intersection_not_marked")}
        kindConfirmed={false}
        pinFrame
        bar={bar}
        missCount={missCount}
      />
    );
    const failed: AerialBar = { kind: "failed", onRetry: () => {} };
    const view = render(aerial(0, { kind: "armed" }));
    await settle();
    // Answered with the question elsewhere, then shown: no scroll.
    view.rerender(aerial(1, { kind: "armed" }));
    await settle(0);
    view.rerender(aerial(1, failed));
    await settle(0);
    expect(scrollBy).not.toHaveBeenCalled();
    // A new answer while it's showing does.
    view.rerender(aerial(2, failed));
    await settle(0);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy.mock.calls[0][0].top).toBe(-40);
    rect.mockRestore();
  });

  it("ruling 3: armed — the bar, the outline class, the big-map button, the armed label; a tap sends its pixel", async () => {
    const taps: AerialTap[] = [];
    const bigMap = vi.fn();
    render(
      <BandAerial
        scenario={SCENARIO}
        geometry={answer("intersection_not_marked")}
        kindConfirmed={false}
        pinFrame
        armed
        onTap={(t) => taps.push(t)}
        onBigMap={bigMap}
      />,
    );
    await settle();
    expect(q("band-aerial-bar")?.textContent).toBe(AERIAL_TAP_BAR);
    expect(q("band-aerial-bar")?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(q("band-aerial-frame")?.className).toContain("is-armed");
    const img = q("band-aerial-img")!;
    expect(img.getAttribute("alt")).toBe(AERIAL_ARMED_ALT);
    expect(q("band-aerial-big-map")?.textContent).toBe(AERIAL_BIG_MAP);
    // The picture drawn at 600 x 300 is shown at 300 x 150: the pixel is
    // the frame's own (the size the backend drew), not the screen's.
    rect(img, 300, 150);
    await act(async () => {
      img.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 160, clientY: 95 }));
    });
    expect(taps).toHaveLength(1);
    expect(taps[0]).toMatchObject({ x: 300, y: 150, width: 600, height: 300, zoom: 0 });
    q("band-aerial-big-map")!.click();
    expect(bigMap).toHaveBeenCalledTimes(1);
  });

  it("ruling 3: unarmed, the picture is as #439 left it and takes no tap", async () => {
    const taps: AerialTap[] = [];
    render(
      <BandAerial
        scenario={SCENARIO}
        geometry={answer("intersection_not_marked")}
        kindConfirmed={false}
        pinFrame
        onTap={(t) => taps.push(t)}
        onBigMap={() => {}}
      />,
    );
    await settle();
    expect(q("band-aerial-bar")).toBeNull();
    expect(q("band-aerial-big-map")).toBeNull();
    expect(q("band-aerial-frame")?.className).not.toContain("is-armed");
    const img = q("band-aerial-img")!;
    rect(img, 600, 300);
    await act(async () => {
      img.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 100, clientY: 100 }));
    });
    expect(taps).toEqual([]);
  });

  it("X5: the box and label sit at the tap's pixel on that picture, and nowhere on another", async () => {
    let tapped: AerialTap | null = null;
    const props = {
      scenario: SCENARIO,
      geometry: answer("intersection_not_marked"),
      kindConfirmed: false,
      pinFrame: true,
    };
    const { rerender } = render(<BandAerial {...props} armed onTap={(t) => (tapped = t)} />);
    await settle();
    const img = q("band-aerial-img")!;
    rect(img, 600, 300);
    await act(async () => {
      img.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 110, clientY: 120 }));
    });
    const t = tapped as AerialTap | null;
    expect(t).not.toBeNull();
    const mark = { x: t!.x, y: t!.y, name: "Race Street", frameKey: t!.frameKey };
    // The mark's own write changes the scenario but not the pin picture.
    const marked = { ...SCENARIO, meta: { ...SCENARIO.meta, project: "after the mark" } };
    rerender(<BandAerial {...props} scenario={marked} mark={mark} />);
    await settle();
    expect(q("band-aerial-mark")?.style.left).toBe("86px");
    expect(q("band-aerial-mark")?.style.top).toBe("86px");
    expect(q("band-aerial-mark-label")?.textContent).toBe("Race Street");
    // A zoom step is another picture: no box, no guessed position (Rule 10).
    await act(async () => {
      q("band-aerial-zoom")!.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click();
    });
    await settle();
    expect(q("band-aerial-mark")).toBeNull();
    expect(q("band-aerial-mark-label")).toBeNull();
  });
});

// ── #456 repair 2: a held load keeps the controls, the bar and focus ─────

describe("#456: while the next picture loads, the controls and the bar stay", () => {
  const zoomIn = () =>
    document.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]');
  let release: () => void = () => {};
  const slow = () => {
    const png = () => new Response(new Blob(["png"], { type: "image/png" }), { status: 200 });
    reply = (() =>
      new Promise<Response>((res) => {
        release = () => res(png());
      })) as unknown as () => Response;
  };

  it("a zoom step keeps the old picture, the zoom buttons and focus until the new one lands", async () => {
    render(<BandAerial scenario={SCENARIO} geometry={answer("laid_out")} kindConfirmed />);
    await settle();
    const before = q("band-aerial-img")?.getAttribute("src");
    slow();
    zoomIn()!.focus();
    await act(async () => zoomIn()!.click());
    await settle();
    expect(q("band-aerial-img")?.getAttribute("src")).toBe(before);
    expect(zoomIn()).not.toBeNull();
    expect(document.activeElement).toBe(zoomIn());
    expect(q("band-aerial-held")).toBeNull(); // P16: the same corridor, no line
    await act(async () => release());
    await settle(50);
    expect(q("band-aerial-img")?.getAttribute("src")).not.toBe(before);
    expect(document.activeElement).toBe(zoomIn());
  });

  it("on the tap question, the bar and its live region stay through a zoom step's load", async () => {
    render(
      <BandAerial
        scenario={SCENARIO}
        geometry={answer("side_not_confirmed")}
        kindConfirmed
        pinFrame
        armed
        onTap={() => {}}
        bar={{ kind: "armed" }}
      />,
    );
    await settle();
    const bar = q("band-aerial-bar");
    expect(bar?.getAttribute("role")).toBe("status");
    slow();
    await act(async () => zoomIn()!.click());
    await settle();
    // The same element: its live region was never unmounted.
    expect(q("band-aerial-bar")).toBe(bar);
    // #465: the bar says the wait, never the tap it can't take yet.
    expect(q("band-aerial-bar")?.textContent).toBe(AERIAL_WAIT);
    expect(q("band-aerial-bar")?.textContent).not.toContain(AERIAL_TAP_BAR);
    expect(q("band-aerial-frame")?.getAttribute("data-bar")).toBe("waiting");
    // A tap waits for the new picture (no tap on a held picture).
    expect(q("band-aerial-frame")?.classList.contains("is-armed")).toBe(false);
    await act(async () => release());
    await settle(50);
    expect(q("band-aerial-bar")).toBe(bar);
    expect(q("band-aerial-bar")?.textContent).toContain(AERIAL_TAP_BAR);
    expect(q("band-aerial-frame")?.getAttribute("data-bar")).toBe("armed");
    expect(q("band-aerial-frame")?.classList.contains("is-armed")).toBe(true);
  });

  it("#465: a tap during the held load is not read; the next tap on the new picture is", async () => {
    const taps: AerialTap[] = [];
    render(
      <BandAerial
        scenario={SCENARIO}
        geometry={answer("side_not_confirmed")}
        kindConfirmed
        pinFrame
        armed
        onTap={(t) => taps.push(t)}
        bar={{ kind: "armed" }}
      />,
    );
    await settle();
    slow();
    zoomIn()!.focus();
    await act(async () => zoomIn()!.click());
    await settle();
    await act(async () => {
      q("band-aerial-img")!.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 }));
    });
    expect(taps).toHaveLength(0);
    expect(q("band-aerial-bar")?.textContent).toBe(AERIAL_WAIT);
    // One live region says it: no corner line on a zoom step (P16).
    expect(q("band-aerial-held")).toBeNull();
    expect(document.activeElement).toBe(zoomIn());
    await act(async () => release());
    await settle(50);
    expect(document.activeElement).toBe(zoomIn());
    await act(async () => {
      q("band-aerial-img")!.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 }));
    });
    expect(taps).toHaveLength(1);
    expect(taps[0].zoom).toBe(1);
  });

  it("#465: the armed fallback (no bar prop) stays mounted as the wait through a held load", async () => {
    render(
      <BandAerial
        scenario={SCENARIO}
        geometry={answer("side_not_confirmed")}
        kindConfirmed
        pinFrame
        armed
        onTap={() => {}}
      />,
    );
    await settle();
    const bar = q("band-aerial-bar");
    expect(bar?.textContent).toContain(AERIAL_TAP_BAR);
    slow();
    await act(async () => zoomIn()!.click());
    await settle();
    expect(q("band-aerial-bar")).toBe(bar);
    expect(bar?.textContent).toBe(AERIAL_WAIT);
    await act(async () => release());
    await settle(50);
    expect(q("band-aerial-bar")?.textContent).toContain(AERIAL_TAP_BAR);
  });
});
