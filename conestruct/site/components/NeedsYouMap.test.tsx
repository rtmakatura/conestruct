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
import { MAP_FAILED, MAP_IMAGERY_NOTE, MAP_KEY_WORK, MAP_STREET_LEVEL } from "./NeedsYouMap";
import { QuestionFlow } from "./NeedsYouQuestion";

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

type Answer = { ok: boolean; status?: number; subject?: string; point?: string };
let answer: Answer;
let fetchMock: ReturnType<typeof vi.fn>;
const bodies = () => fetchMock.mock.calls.map((c) => JSON.parse(c[1].body as string));

beforeEach(() => {
  forgetNeedsYouMaps();
  answer = { ok: true, subject: "drawn", point: "39.740100,-104.970200" };
  fetchMock = vi.fn(async () => {
    const headers = new Headers();
    if (answer.subject) headers.set("x-map-subject", answer.subject);
    if (answer.point) headers.set("x-map-point", answer.point);
    return new Response(answer.ok ? new Blob(["img"]) : "{}", {
      status: answer.ok ? 200 : (answer.status ?? 502),
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
      "nyq-details",
    ]);
    expect(bodies()[0]).toMatchObject({ flag: "pedestrian_facility", width: 600, height: 300 });
    expect(bodies()[0].zoom).toBeUndefined();
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

  it("ruling 7: the frame and the key are there while loading", () => {
    const { container } = render(<Host />);
    expect(container.querySelector(".nyq-map-frame")!.getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByTestId("needs-you-map-img")).toBeNull();
    expect(screen.getByTestId("needs-you-map-key")).toBeTruthy();
  });

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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText(/Yes, they're there/));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    await waitFor(() => expect(bodies().at(-1).flag).toBe("adjacent_intersection"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await screen.findByTestId("needs-you-map-label")).textContent).toBe("Crossing on the map");
  });

  it("only the question on screen asks (the cost, checkpoint § 3)", async () => {
    render(<Host />);
    await img();
    expect(bodies().map((b) => b.flag)).toEqual(["pedestrian_facility"]);
  });

  it("without a scenario there is no map and no request", () => {
    render(<Host scenario={null} />);
    expect(screen.queryByTestId("needs-you-map")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("streetLevelUrl", () => {
  it("is the documented form, no key", () => {
    expect(streetLevelUrl("1.5,-2.5")).toBe(
      "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=1.5,-2.5",
    );
  });
});
