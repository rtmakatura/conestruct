// @vitest-environment happy-dom
//
// #301 piece 1 — the aerial on the WHERE band, mounted.  Asserted on what a
// person sees in each state (the checkpoint's (c), as ruled), and on the one
// request it sends: the backend's picture of THIS scenario, never a
// coordinate of its own (Rule 3) and never the previous picture (Rule 10).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { BandAerial, AERIAL_FAILED, AERIAL_KIND_OWED, AERIAL_WAIT } from "./BandAerial";
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
  it("before the side: the pin alone, the ruled sentence, no legend", async () => {
    render(<BandAerial scenario={SCENARIO} geometry={answer("side_not_confirmed")} kindConfirmed />);
    expect(q("band-aerial-note")?.textContent).toBe(AERIAL_WAIT);
    await settle();
    expect(requests).toEqual([{ scenario: SCENARIO, stage: "pin", width: 600, height: 300 }]);
    expect(q("band-aerial-img")?.getAttribute("src")).toBe("blob:aerial-1");
    expect(q("band-aerial-note")?.textContent).toBe(SIDE_BLOCKER);
    expect(q("band-aerial-legend")).toBeNull();
    expect(q("band-aerial")?.getAttribute("data-stage")).toBe("pin");
  });

  it("the side chosen, the kind owed: the work only, and a legend line for the rest (ruling 4)", async () => {
    render(<BandAerial scenario={SCENARIO} geometry={answer("laid_out")} kindConfirmed={false} />);
    await settle();
    expect(requests.map((r) => r.stage)).toEqual(["work"]);
    const legend = q("band-aerial-legend")!;
    expect(Array.from(legend.querySelectorAll(".a-aerial-row")).map((r) => r.textContent)).toEqual([
      "Work zone",
    ]);
    expect(legend.textContent).toContain(AERIAL_KIND_OWED);
    expect(q("band-aerial-note")).toBeNull();
  });

  it("both answered: the whole corridor and the five channels, upstream first", async () => {
    render(<BandAerial scenario={SCENARIO} geometry={answer("laid_out")} kindConfirmed />);
    await settle();
    expect(requests.map((r) => r.stage)).toEqual(["laid_out"]);
    const rows = Array.from(q("band-aerial-legend")!.querySelectorAll(".a-aerial-row"));
    expect(rows.map((r) => r.textContent)).toEqual([
      "Advance warning",
      "Taper",
      "Buffer",
      "Work zone",
      "Downstream",
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
    const legend = q("band-aerial-legend")!.textContent;
    expect(legend).toContain("Two approaches: northbound (the work's side) and southbound");
    expect(legend).toContain("Faded: past the mapped road");
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
    expect(q("band-aerial-note")?.textContent).toBe("Can't lay the corridor out here — the road ends here");
    expect(q("band-aerial-img")).toBeNull();
  });

  it("while the geometry re-reads, the frame waits — the previous answer is never pictured", async () => {
    const { rerender } = render(
      <BandAerial scenario={SCENARIO} geometry={answer("laid_out")} kindConfirmed />,
    );
    await settle();
    expect(q("band-aerial-img")).not.toBeNull();
    const moved = { ...SCENARIO, meta: { ...SCENARIO.meta, lat: SCENARIO.meta.lat + 0.001 } };
    const reading: GeometryFetch = { state: "loading", geometry: answer("laid_out").geometry };
    rerender(<BandAerial scenario={moved} geometry={reading} kindConfirmed />);
    expect(q("band-aerial-img")).toBeNull();
    expect(q("band-aerial-note")?.textContent).toBe(AERIAL_WAIT);
    await settle();
    expect(requests).toHaveLength(1);
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
