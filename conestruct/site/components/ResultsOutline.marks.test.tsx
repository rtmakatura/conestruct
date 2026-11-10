// @vitest-environment happy-dom
//
// #490 C13: the Generate outline's map placeholder shows the band picture
// (shownAerialFor, GeneratorShell), which is asked of Mapbox without its
// logo and attribution (C11) and cropped to cover here, so the placeholder
// draws Mapbox's marks on its foot.  The outline is aria-hidden, so they are
// the guide's text-only form and an unlinked logo: nothing focusable.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { OutlineNeedsYou } from "./ResultsOutline";
import { MAPBOX_ATTRIBUTION } from "./bands/MapboxMarks";

afterEach(cleanup);
const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe("#490 C13: the outline's map placeholder credits Mapbox", () => {
  it("draws the logo and the attribution under its label when it shows the band picture", () => {
    render(<OutlineNeedsYou aerialSrc="blob:aerial-1" slow="none" />);
    const map = document.querySelector(".ro-map")!;
    const foot = map.querySelector(".ro-map-foot")!;
    expect(foot.contains(q("ro-map-logo"))).toBe(true);
    expect(q("ro-map-logo")!.querySelector("a.mapboxgl-ctrl-logo")).not.toBeNull();
    expect(q("ro-map-attribution")!.textContent).toBe(MAPBOX_ATTRIBUTION.map((l) => l.text).join(" "));
    // Stacked: the label, then the marks, in one column.
    expect(foot.firstElementChild?.classList.contains("ro-label")).toBe(true);
    expect(foot.lastElementChild).toBe(q("ro-map-marks"));
    // aria-hidden outline: nothing in the marks is focusable.
    expect(map.closest("[aria-hidden=true]")).not.toBeNull();
    expect(q("ro-map-marks")!.querySelectorAll("a[href], button, [tabindex]").length).toBe(0);
  });

  it("draws none over the grey block (no picture, nothing of Mapbox's shown)", () => {
    render(<OutlineNeedsYou aerialSrc={null} slow="none" />);
    expect(q("ro-map-marks")).toBeNull();
    expect(document.querySelector(".ro-map .ro-label")).not.toBeNull();
  });
});
