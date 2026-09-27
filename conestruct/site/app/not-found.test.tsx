// @vitest-environment happy-dom
//
// coming-soon-gate R19 — the 404, "Road closed", mounted.  That /404 is
// public and every other unknown path still goes to `/` is the
// middleware route table's (middleware.test.ts, A3-Q2); this is what the
// page says and where it leads.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import NotFound, { metadata } from "./not-found";

afterEach(cleanup);

describe("R19 — the Road closed page", () => {
  it("says the road is closed and leads home with the page's one primary", () => {
    const c = render(<NotFound />).container;
    expect([...c.querySelectorAll("h1")].map((h) => h.textContent)).toEqual(["This road is closed."]);
    expect(c.textContent).toContain("The page you were looking for isn't here. The detour takes you home.");
    const pri = c.querySelectorAll(".pri");
    expect(pri).toHaveLength(1);
    expect(pri[0].getAttribute("href")).toBe("/");
    expect(pri[0].textContent).toBe("Back to conestruct.com");
    expect(metadata.title).toBe("Road closed — Conestruct");
  });

  it("draws the closure: barricade, ROAD CLOSED sign, the detour home — one named drawing", () => {
    const c = render(<NotFound />).container;
    const art = c.querySelector(".cs-nf-art")!;
    expect(art.getAttribute("role")).toBe("img");
    expect(art.getAttribute("aria-label")).toMatch(/^A road closed with a barricade and a Road Closed sign\./);
    const words = [...art.querySelectorAll("text")].map((t) => t.textContent);
    expect(words).toEqual(
      expect.arrayContaining(["barricade", "ROAD", "CLOSED", "DETOUR", "to conestruct.com"]),
    );
    expect(art.querySelector(".cs-nf-barricade")?.getAttribute("fill")).toBe("url(#cs-nf-hatch)");
    expect(art.querySelectorAll(".cs-detour").length).toBeGreaterThanOrEqual(3);
    expect(c.querySelector(".cs-sheet-head .tr-section")?.textContent).toBe("404 · PAGE NOT FOUND");
  });

  it("is public chrome: the wordmark home, Terms and Privacy — no in-page anchors, no sign-in, no form", () => {
    const c = render(<NotFound />).container;
    const hrefs = [...c.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(new Set(hrefs)).toEqual(new Set(["/", "/terms", "/privacy"]));
    expect(c.querySelectorAll("form, input, button")).toHaveLength(0);
  });
});
