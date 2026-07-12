// @vitest-environment happy-dom
//
// fix-spec-02 P1·05·03 — label association asserted on the MOUNTED
// forms (rule 11: test at the layer the bug lives).  Every select,
// slider, and text/number input in the two enabled scenario forms must
// be reachable by its visible label.  getByLabelText fails unless the
// <label htmlFor> ↔ id pair actually resolves in the DOM.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "@/lib/scenarios";
import { ShoulderForm } from "./ShoulderForm";
import { FlaggerForm } from "./FlaggerForm";

afterEach(cleanup);

// LabelRow renders the right-hand value ("65 mph") inside the label, so
// the accessible name is "Speed limit65 mph" — match on the label text.
const byLabel = (re: RegExp) => screen.getByLabelText(re) as HTMLElement;

describe("ShoulderForm controls carry their visible labels", () => {
  it("associates every select, slider, and input", () => {
    render(
      <ShoulderForm scenario={DEFAULT_SHOULDER} setScenario={() => {}} />,
    );
    expect(byLabel(/^Road type/).tagName).toBe("SELECT");
    expect(byLabel(/^Work type/).tagName).toBe("SELECT");
    expect((byLabel(/^Speed limit/) as HTMLInputElement).type).toBe("range");
    expect((byLabel(/^Lane width/) as HTMLInputElement).type).toBe("range");
    expect((byLabel(/^Work zone length/) as HTMLInputElement).type).toBe(
      "number",
    );
  });
});

describe("FlaggerForm controls carry their visible labels", () => {
  it("associates every select, slider, and input", () => {
    render(<FlaggerForm scenario={DEFAULT_FLAGGER} setScenario={() => {}} />);
    expect(byLabel(/^Road type/).tagName).toBe("SELECT");
    expect(byLabel(/^Work type/).tagName).toBe("SELECT");
    expect((byLabel(/^Speed limit/) as HTMLInputElement).type).toBe("range");
    expect((byLabel(/^Lane width/) as HTMLInputElement).type).toBe("range");
    expect((byLabel(/^Work zone length/) as HTMLInputElement).type).toBe(
      "number",
    );
  });
});
