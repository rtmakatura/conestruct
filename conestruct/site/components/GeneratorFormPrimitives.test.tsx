import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { GenerateButton } from "./GeneratorFormPrimitives";

// UX audit finding UX-17: the sidebar's primary CTA — the only button
// that runs generation — was labeled "Download MHT package (.zip) ↓",
// a download verb on a generate action (and in workbench mode the
// button downloads nothing at all). These tests lock the generate-verb
// labels in for both button states.

describe("GenerateButton (UX-17 CTA labels)", () => {
  it("idle state reads 'Generate plan' with no download affordance", () => {
    const html = renderToStaticMarkup(
      <GenerateButton generating={false} onGenerate={() => {}} />,
    );
    expect(html).toContain("Generate plan");
    expect(html).not.toContain("Download");
    expect(html).not.toContain("MHT package");
    expect(html).not.toContain("↓");
    expect(html).not.toContain("disabled");
  });

  it("generating state reads 'Generating plan…' and is disabled", () => {
    const html = renderToStaticMarkup(
      <GenerateButton generating={true} onGenerate={() => {}} />,
    );
    expect(html).toContain("Generating plan…");
    expect(html).not.toContain("Building bundle");
    expect(html).toContain("disabled");
    expect(html).toContain("animate-spin");
  });
});

// PR 7 (UX audit finding UX-21): invalid inputs gate generation — the
// button disables and the reason renders adjacent (not hover-only).
// The reason literal is the BACKEND's floor message (validators.py
// phrasing) — since engine-removal PR D the frontend no longer words a
// floor message of its own.
describe("GenerateButton (UX-21 invalid-input gating)", () => {
  const REASON =
    "Work zone length (50 ft) is shorter than the required shoulder taper " +
    "(L/3) of 184 ft at 55 mph. Increase the work zone to at least 184 ft, " +
    "or reduce the speed limit.";

  it("disabled state renders the reason adjacent to the button", () => {
    const html = renderToStaticMarkup(
      <GenerateButton
        generating={false}
        onGenerate={() => {}}
        disabled={true}
        disabledReason={REASON}
      />,
    );
    expect(html).toContain("disabled");
    expect(html).toContain("Generate plan");
    expect(html).toContain("at least 184 ft");
    expect(html).toContain("role=\"alert\"");
  });

  it("valid input leaves the button enabled with no reason text", () => {
    const html = renderToStaticMarkup(
      <GenerateButton
        generating={false}
        onGenerate={() => {}}
        disabled={false}
      />,
    );
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("role=\"alert\"");
  });

  it("generating takes precedence — spinner shows, no reason line", () => {
    const html = renderToStaticMarkup(
      <GenerateButton
        generating={true}
        onGenerate={() => {}}
        disabled={true}
        disabledReason={REASON}
      />,
    );
    expect(html).toContain("Generating plan…");
    expect(html).not.toContain("at least 100 ft");
  });
});
