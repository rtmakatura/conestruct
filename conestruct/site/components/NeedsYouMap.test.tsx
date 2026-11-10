// @vitest-environment jsdom
// #447: the map inside a NEEDS YOU question, mounted in the real card.
// Authority: validation-artifacts/committed/ux-site-map/rulings.md.

import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { buildQuestions } from "@/lib/needs-you-items";
import { conditionRows } from "@/lib/needs-you-conditions";
import { forgetNeedsYouMaps, streetLevelUrl } from "@/lib/needs-you-map";
import type { SiteAdjustmentRecord, SiteScanProvenance } from "@/lib/render-types";
import type { Scenario } from "@/lib/scenarios";
import type { StagedCorrection } from "@/lib/scenarios/types";
import { MAP_FAILED, MAP_IMAGERY_NOTE, MAP_KEY_WORK, MAP_LOADING, MAP_STREET_LEVEL } from "./NeedsYouMap";
import { QuestionFlow } from "./NeedsYouQuestion";

// #477 answer 4: the WHERE aerial the band last showed for a pin.  Seeded
// per test; null is "the band never showed one for this pin".
let whereAerial: string | null = null;
vi.mock("@/lib/corridor-aerial", async (orig) => ({
  ...(await orig<typeof import("@/lib/corridor-aerial")>()),
  shownAerialFor: (lat: number | null | undefined, lng: number | null | undefined) =>
    lat === 39.74 && lng === -104.97 ? whereAerial : null,
}));

const SCAN = {
  status: "ok",
  mode: "corridor",
  buckets: {
    intersections: { detected: true, count: 3, nearest_distance_ft: 49.9 },
    sidewalks: { detected: true, count: 57, nearest_distance_ft: 25.6 },
  },
  corrections: [],
} as unknown as SiteScanProvenance;
const ADJ: SiteAdjustmentRecord[] = [
  { flag: "pedestrian_facility", action: "add", rule: "r", citation: "MUTCD § 6C.02", devices_added: 4 },
];
const SCENARIO = { kind: "lane_closure", meta: { lat: 39.74, lng: -104.97 } } as unknown as Scenario;

type Answer = {
  ok: boolean;
  status?: number;
  subject?: string;
  point?: string;
  /** #484: the cross street's headers, as the backend sends them. */
  cross?: { name: string; tag: string };
};
let answer: Answer;
// #483: the soft image's own answer (the backend says "none" for it), and
// optional holds so a test can see each step.
let softAnswer: Answer;
let holdSoft: Promise<void> | null;
let holdFull: Promise<void> | null;
const FRAME = "39.740100,-104.970200,18.00";
let fetchMock: ReturnType<typeof vi.fn>;
const bodies = () => fetchMock.mock.calls.map((c) => JSON.parse(c[1].body as string));
const fullBodies = () => bodies().filter((b) => !b.soft);
function deferred() {
  let open!: () => void;
  const p = new Promise<void>((r) => (open = r));
  return { p, open };
}

beforeEach(() => {
  forgetNeedsYouMaps();
  whereAerial = null;
  answer = { ok: true, subject: "drawn", point: "39.740100,-104.970200" };
  softAnswer = { ok: true, subject: "none", point: "39.740100,-104.970200" };
  holdSoft = null;
  holdFull = null;
  fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const soft = JSON.parse(init.body as string).soft === true;
    const hold = soft ? holdSoft : holdFull;
    if (hold) await hold;
    const a = soft ? softAnswer : answer;
    const headers = new Headers();
    if (a.subject) headers.set("x-map-subject", a.subject);
    if (a.point) headers.set("x-map-point", a.point);
    if (a.ok) headers.set("x-map-frame", FRAME);
    if (a.cross) {
      headers.set("x-map-cross-street", a.cross.name);
      headers.set("x-map-cross-tag", a.cross.tag);
    }
    return new Response(a.ok ? new Blob(["img"]) : "{}", {
      status: a.ok ? 200 : (a.status ?? 502),
      headers,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:map-${++n}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Host({ scenario = SCENARIO as Scenario | null }) {
  const [s, setS] = useState<StagedCorrection[]>([]);
  const questions = buildQuestions(conditionRows(SCAN, s, {}), ADJ, []);
  return (
    <div className="workbench">
      <QuestionFlow
        questions={questions}
        staged={s}
        setStaged={setS}
        onApply={() => {}}
        siteScan={SCAN}
        inFlight={false}
        ownsPrimary
        scenario={scenario}
      />
    </div>
  );
}

const img = () => screen.findByTestId("needs-you-map-img");

describe("the map in the card (rulings 1-7)", () => {
  it("sits between the explanation and the choices, and asks for this question's frame", async () => {
    const { container } = render(<Host />);
    await img();
    const card = container.querySelector(".nyq-card")!;
    expect([...card.children].map((c) => c.className.split(" ")[0])).toEqual([
      "nyq-text",
      "nyq-map",
      "nyq-answers",
      "nyq-foot",
    ]);
    // #483: the soft image of this frame first, then the full one.
    expect(bodies()[0]).toEqual({ ...bodies()[1], soft: true });
    expect(bodies()[1]).toMatchObject({ flag: "pedestrian_facility", width: 600, height: 300 });
    expect(bodies()[1].zoom).toBeUndefined();
    expect(bodies()[1].soft).toBeUndefined();
  });

  it("names both lines when the backend drew the subject, in the ruled words", async () => {
    render(<Host />);
    await img();
    expect(screen.getByTestId("needs-you-map-label").textContent).toBe("Sidewalk on the map");
    const key = screen.getByTestId("needs-you-map-key").textContent!;
    expect(key).toContain(MAP_KEY_WORK);
    expect(key).toContain("Sidewalk the map knows about");
    expect(key).toContain(MAP_IMAGERY_NOTE);
  });

  it("Rule 10: with no geometry no line is named and the question still asks", async () => {
    answer = { ok: true, subject: "none", point: "39.740000,-104.970000" };
    render(<Host />);
    await img();
    expect(screen.queryByTestId("needs-you-map-label")).toBeNull();
    const key = screen.getByTestId("needs-you-map-key").textContent!;
    expect(key).toContain(MAP_KEY_WORK);
    expect(key).not.toContain("knows about");
    expect(screen.getByLabelText(/Yes, they're there/)).toBeTruthy();
  });

  it("a header the backend didn't send is no line (Rule 10)", async () => {
    answer = { ok: true, point: "39.740000,-104.970000" };
    render(<Host />);
    await img();
    expect(screen.queryByTestId("needs-you-map-label")).toBeNull();
  });

  it("ruling 5: the documented URL at the backend's point, in a new tab", async () => {
    render(<Host />);
    await img();
    const link = screen.getByRole("link", { name: MAP_STREET_LEVEL }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(
      "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=39.740100,-104.970200",
    );
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
  });

  it("no point from the backend: no link, never a guessed one (Rule 3)", async () => {
    answer = { ok: true, subject: "none" };
    render(<Host />);
    await img();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("phone fix round: only the zoom is in the frame; the label and link sit outside it for the phone's CSS", async () => {
    const { container } = render(<Host />);
    await img();
    const frame = container.querySelector(".nyq-map-frame")!;
    expect(frame.contains(screen.getByTestId("needs-you-map-zoom"))).toBe(true);
    const under = container.querySelector(".nyq-map-under")!;
    expect(frame.contains(under)).toBe(false);
    expect(under.contains(screen.getByTestId("needs-you-map-label"))).toBe(true);
    expect(under.contains(screen.getByTestId("needs-you-map-street"))).toBe(true);
  });

  it("the space under the map stays in the layout while loading and when it fails (P1)", async () => {
    answer = { ok: false, status: 502 };
    softAnswer = { ok: false, status: 502 };
    const { container } = render(<Host />);
    expect(container.querySelector(".nyq-map-under")).toBeTruthy();
    await screen.findByTestId("needs-you-map-failed");
    expect(container.querySelector(".nyq-map-under")).toBeTruthy();
    expect(screen.queryByTestId("needs-you-map-label")).toBeNull();
    expect(screen.queryByTestId("needs-you-map-street")).toBeNull();
  });

  it("ruling 7, #483: the frame and the key's place are there while loading; the key waits for the full image", () => {
    const { container } = render(<Host />);
    expect(container.querySelector(".nyq-map-frame")!.getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByTestId("needs-you-map-img")).toBeNull();
    expect(screen.getByTestId("needs-you-map-key").hasAttribute("data-hidden")).toBe(true);
  });
});

// #483 ruling 1 (Ryan, 2026-11-09): each question's map loads soft, then
// sharpens, in the same frame.  rulings.md R145-1 to R145-10.
describe("#483: the map loads soft, then sharpens in place", () => {
  const frame = (c: HTMLElement) => c.querySelector<HTMLElement>(".nyq-map-frame")!;
  const loading = () => screen.queryByText(MAP_LOADING);

  it("before any image: the frame's own ground and the label, never the WHERE aerial at another frame", () => {
    whereAerial = "blob:where-aerial";
    holdSoft = new Promise(() => {});
    const { container } = render(<Host />);
    expect(frame(container).getAttribute("data-map")).toBe("waiting");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-testid=needs-you-map-standin]")).toBeNull();
    expect(loading()).not.toBeNull();
  });

  it("the soft image shows first, with the label; the full one is asked for only after it", async () => {
    const soft = deferred();
    holdSoft = soft.p;
    const { container } = render(<Host />);
    await waitFor(() => expect(bodies()).toHaveLength(1));
    expect(bodies()[0].soft).toBe(true);
    // Nothing asked for the full image while the soft one is out (R145-3).
    await new Promise((r) => setTimeout(r, 400));
    expect(bodies()).toHaveLength(1);
    holdFull = new Promise(() => {});
    soft.open();
    const s = await screen.findByTestId("needs-you-map-soft");
    expect(frame(container).getAttribute("data-map")).toBe("soft");
    expect(frame(container).contains(s)).toBe(true);
    // Decorative: the frame is busy and the label says so.
    expect(s.getAttribute("alt")).toBe("");
    expect(s.getAttribute("data-frame")).toBe(FRAME);
    expect(loading()).not.toBeNull();
    expect(screen.queryByTestId("needs-you-map-img")).toBeNull();
    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByTestId("needs-you-map-key").hasAttribute("data-hidden")).toBe(true);
    await waitFor(() => expect(fullBodies()).toHaveLength(1));
  });

  it("the full image replaces it in the same frame; the label goes and the key appears", async () => {
    const { container } = render(<Host />);
    const sharp = await img();
    expect(frame(container).getAttribute("data-map")).toBe("sharp");
    expect(frame(container).contains(sharp)).toBe(true);
    expect(sharp.getAttribute("data-frame")).toBe(FRAME);
    expect(sharp.className).toContain("nyq-map-sharp");
    expect(loading()).toBeNull();
    expect(frame(container).getAttribute("aria-busy")).toBe("false");
    expect(screen.getByTestId("needs-you-map-key").hasAttribute("data-hidden")).toBe(false);
  });

  it("a soft image that fails still gets the full one", async () => {
    softAnswer = { ok: false, status: 429 };
    render(<Host />);
    await img();
    expect(fullBodies()).toHaveLength(1);
    expect(screen.queryByTestId("needs-you-map-failed")).toBeNull();
  });

  it("a full image that fails says the ruled line, with no soft picture left behind", async () => {
    answer = { ok: false, status: 502 };
    render(<Host />);
    await screen.findByTestId("needs-you-map-failed");
    expect(screen.queryByTestId("needs-you-map-soft")).toBeNull();
    expect(loading()).toBeNull();
  });

  it("Rule 10: a full image that fails to decode reads as a failed map, never an invisible one under a live key", async () => {
    render(<Host />);
    fireEvent.error(await img());
    expect((await screen.findByTestId("needs-you-map-failed")).textContent).toBe(MAP_FAILED);
    expect(screen.queryByTestId("needs-you-map-img")).toBeNull();
    expect(screen.queryByTestId("needs-you-map-soft")).toBeNull();
    expect(screen.getByTestId("needs-you-map-key").hasAttribute("data-hidden")).toBe(true);
    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    // The answer still works without the map (ruling 7).
    fireEvent.click(screen.getByLabelText(/Yes, they're there/));
    expect((screen.getByRole("button", { name: "Next question" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("a zoom step asks no soft image and keeps the full picture meanwhile (P16)", async () => {
    render(<Host />);
    await img();
    expect(bodies().filter((b) => b.soft)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await waitFor(() => expect(bodies().at(-1).zoom).toBe(1));
    expect(bodies().filter((b) => b.soft)).toHaveLength(1);
    expect(loading()).toBeNull();
  });

});

describe("the map in the card, failed and zoomed (rulings 1-7)", () => {
  it("ruling 7: a failed image says the ruled line, holds the key's place, and the answer works", async () => {
    answer = { ok: false, status: 502 };
    render(<Host />);
    expect((await screen.findByTestId("needs-you-map-failed")).textContent).toBe(MAP_FAILED);
    expect(screen.getByTestId("needs-you-map-key").hasAttribute("data-hidden")).toBe(true);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    fireEvent.click(screen.getByLabelText(/Yes, they're there/));
    expect((screen.getByRole("button", { name: "Next question" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("zoom asks the backend for the step, holds the picture meanwhile, and stops at its bounds", async () => {
    render(<Host />);
    const first = await img();
    const src = first.getAttribute("src");
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    fireEvent.click(zoomIn);
    // P16: the previous picture stays while the step is drawn.
    expect(screen.getByTestId("needs-you-map-img").getAttribute("src")).toBe(src);
    await waitFor(() => expect(bodies().at(-1).zoom).toBe(1));
    fireEvent.click(zoomIn);
    fireEvent.click(zoomIn);
    expect(zoomIn.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(zoomIn);
    expect(screen.getByTestId("needs-you-map-zoom").getAttribute("data-step")).toBe("3");
  });

  it("answering doesn't ask again; the next question asks once for its own frame and words", async () => {
    render(<Host />);
    await img();
    // #483: the soft image and the full one.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByLabelText(/Yes, they're there/));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    await waitFor(() => expect(fullBodies().at(-1).flag).toBe("adjacent_intersection"));
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // #484 ruling 2: the intersection has no chip; its key is the ruling's line.
    await waitFor(() =>
      expect(screen.getByTestId("needs-you-map-key").textContent).toContain(
        "The cross street the map knows about",
      ),
    );
    expect(screen.queryByTestId("needs-you-map-label")).toBeNull();
  });

  it("only the question on screen asks (the cost, checkpoint § 3)", async () => {
    render(<Host />);
    await img();
    expect(bodies().map((b) => b.flag)).toEqual(["pedestrian_facility", "pedestrian_facility"]);
  });

  it("without a scenario there is no map and no request", () => {
    render(<Host scenario={null} />);
    expect(screen.queryByTestId("needs-you-map")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// #448 (Ryan's ruling, cc-queue-ux.md item 4): the explanation says what the
// picture shows.  `why()` is the sentence a reader gets: the paragraph's text
// without the sentences held hidden for its height (P1).
describe("#448: the explanation follows what the map drew (Rule 10)", () => {
  const why = (container: HTMLElement) => {
    const p = container.querySelector(".nyq-why")!.cloneNode(true) as HTMLElement;
    p.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    return p.textContent;
  };
  const SIDE_DRAWN =
    "The map shows sidewalks 25.6 ft from the work, so we added 4 devices to protect people walking. Your answer decides whether they stay.";
  const SIDE_SCAN =
    "The scan found sidewalks 25.6 ft from the work, so we added 4 devices to protect people walking. Your answer decides whether they stay.";
  const SIDE_NONE =
    "The scan found sidewalks 25.6 ft from the work, but the map couldn't draw them. Check them at street level. We added 4 devices to protect people walking. Your answer decides whether they stay.";

  it("drawn: the sentence stays as it is", async () => {
    const { container } = render(<Host />);
    await img();
    expect(why(container)).toBe(SIDE_DRAWN);
  });

  it("x-map-subject: none: never 'The map shows'; the scan's finding and street level", async () => {
    answer = { ok: true, subject: "none", point: "39.740000,-104.970000" };
    const { container } = render(<Host />);
    await img();
    expect(why(container)).not.toContain("The map shows");
    expect(why(container)).toBe(SIDE_NONE);
  });

  it("a header the backend didn't send reads as no line", async () => {
    answer = { ok: true, point: "39.740000,-104.970000" };
    const { container } = render(<Host />);
    await img();
    expect(why(container)).toBe(SIDE_NONE);
  });

  it("a failed image: no claim about the picture", async () => {
    answer = { ok: false, status: 502 };
    softAnswer = { ok: false, status: 502 };
    const { container } = render(<Host />);
    await screen.findByTestId("needs-you-map-failed");
    expect(why(container)).toBe(SIDE_SCAN);
  });

  it("while loading, and with no map at all: no claim about the picture", () => {
    const { container } = render(<Host />);
    expect(why(container)).toBe(SIDE_SCAN);
    cleanup();
    const again = render(<Host scenario={null} />);
    expect(why(again.container)).toBe(SIDE_SCAN);
  });

  it("the intersection question with no line (no adjustment record: no device words)", async () => {
    answer = { ok: true, subject: "none", point: "39.740000,-104.970000" };
    const { container } = render(<Host />);
    await img();
    fireEvent.click(screen.getByLabelText(/Yes, they're there/));
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    await waitFor(() => expect(fullBodies().at(-1).flag).toBe("adjacent_intersection"));
    await waitFor(() =>
      expect(why(container)).toBe(
        "The scan found an intersection 49.9 ft from the work, but the map couldn't draw it. Check it at street level.",
      ),
    );
  });

  it("P1: every sentence is held in the paragraph, one shown, so it never changes height", async () => {
    const { container } = render(<Host />);
    const spans = () => [...container.querySelectorAll(".nyq-why > span")];
    expect(spans().map((s) => s.textContent)).toEqual([SIDE_DRAWN, SIDE_NONE, SIDE_SCAN]);
    expect(spans().map((s) => s.getAttribute("aria-hidden"))).toEqual(["true", "true", null]);
    await img();
    expect(spans().map((s) => s.getAttribute("aria-hidden"))).toEqual([null, "true", "true"]);
  });
});

describe("streetLevelUrl", () => {
  it("is the documented form, no key", () => {
    expect(streetLevelUrl("1.5,-2.5")).toBe(
      "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=1.5,-2.5",
    );
  });
});

// #484 ruling 2 (Ryan, 2026-11-09, Crossing option B): the cross street is a
// dashed line the backend draws, named by a tag the backend places.
// Authority: validation-artifacts/committed/missions/ux-token-map-load-edit/
// issue-484/rulings.md.
describe("the intersection question's cross street (#484)", () => {
  async function toIntersection() {
    render(<Host />);
    await img();
    fireEvent.click(screen.getByLabelText(/Yes, they're there/));
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    await waitFor(() => expect(fullBodies().at(-1).flag).toBe("adjacent_intersection"));
    await waitFor(() =>
      expect(screen.getByTestId("needs-you-map-img").getAttribute("data-frame")).toBe(FRAME),
    );
    return screen.getByTestId("needs-you-map-img");
  }

  it("names the line with the backend's tag, where it placed it, once the full image decodes", async () => {
    answer = { ...answer, cross: { name: "Franklin%20Street", tag: "312,16" } };
    const full = await toIntersection();
    // R145-11: not before the full image has decoded.
    expect(screen.queryByTestId("needs-you-map-tag")).toBeNull();
    fireEvent.load(full);
    const tag = await screen.findByTestId("needs-you-map-tag");
    expect(tag.textContent).toBe("Franklin Street");
    expect(tag.style.left).toBe("312px");
    expect(tag.style.top).toBe("16px");
    expect(tag.className).toContain("nyq-map-tag");
    expect(screen.queryByTestId("needs-you-map-label")).toBeNull();
    expect(screen.getByTestId("needs-you-map-key").textContent).toContain(
      "The cross street the map knows about",
    );
  });

  it("no cross street geometry: no line in the key, no tag, #448's sentence (Rule 10)", async () => {
    answer = { ...answer, subject: "none" };
    const full = await toIntersection();
    fireEvent.load(full);
    expect(screen.queryByTestId("needs-you-map-tag")).toBeNull();
    expect(screen.getByTestId("needs-you-map-key").textContent).not.toContain("cross street");
    const on = document.querySelector(".nyq-text [data-on]");
    expect(on?.textContent).toMatch(/^The scan found an intersection 49.9 ft from the work, but the map couldn't draw it\. Check it at street level\./);
  });

  it("a line with no name, or a malformed tag, shows no tag", async () => {
    answer = { ...answer, cross: { name: "Franklin%20Street", tag: "left,top" } };
    fireEvent.load(await toIntersection());
    expect(screen.queryByTestId("needs-you-map-tag")).toBeNull();
    // The line is still in the key: the backend drew it.
    expect(screen.getByTestId("needs-you-map-key").textContent).toContain(
      "The cross street the map knows about",
    );
  });

  it("the soft image carries no tag", async () => {
    softAnswer = { ...softAnswer, cross: { name: "Franklin%20Street", tag: "312,16" } };
    answer = { ...answer, cross: { name: "Franklin%20Street", tag: "312,16" } };
    holdFull = deferred().p;
    render(<Host />);
    await screen.findByTestId("needs-you-map-soft");
    expect(screen.queryByTestId("needs-you-map-tag")).toBeNull();
  });
});
