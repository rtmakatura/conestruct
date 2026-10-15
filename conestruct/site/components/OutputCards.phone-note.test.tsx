// @vitest-environment happy-dom
//
// #318 (R149): the Plan sheet card's phone line.  Verbatim, on the Plan
// sheet card only, shown only at ≤480 px by CSS (happy-dom lays out
// nothing, so the CSS half is pinned on the rules themselves; the browser
// leg measures it at 360, 320 and 1440).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { OutputCards } from "./OutputCards";

afterEach(cleanup);

const LINE = "This is an 11×17 drawing. Open it on a bigger screen or print it.";
const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");

describe("#318: the Plan sheet card says how to read it on a phone", () => {
  it("the line is on the Plan sheet card only, verbatim, before its button", () => {
    render(
      <OutputCards
        summary={{ ta: "TA-3", cdot_sheet: "S-630-1", step_count: 14 } as never}
        generated={true}
        mode={{ kind: "public", scenario: { meta: { project: "T" } } } as never}
        breakdown={{ state: "ready", data: { devices: [], total_devices: 35, unique_types: 11 } } as never}
        auditChecked={13}
      />,
    );
    const notes = Array.from(document.querySelectorAll('[data-testid="dl-phone-note"]'));
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toBe(LINE);
    const card = notes[0].closest(".dl-card")!;
    expect(card.querySelector("h3")?.textContent).toBe("Plan sheet");
    const actions = card.querySelector(".dl-actions")!;
    expect(notes[0].compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("hidden off the phone, shown at ≤480 px", () => {
    expect(css).toMatch(/\n\.workbench \.dl-card \.dl-phone-note \{\n  display: none;/);
    const phone = css.indexOf(".workbench .dls .dl-card .dl-phone-note {");
    expect(phone).toBeGreaterThan(-1);
    const media = css.lastIndexOf("@media (max-width: 480px) {", phone);
    const close = css.indexOf("\n}\n", media);
    expect(phone).toBeLessThan(close);
    expect(css.slice(phone, css.indexOf("}", phone))).toMatch(/display: block;/);
  });
});
