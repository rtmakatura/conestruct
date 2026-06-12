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
describe("GenerateButton (UX-21 invalid-input gating)", () => {
  const REASON = "Work zone must be at least 100 ft — the required " +
    "one-lane two-way taper at 45 mph (MUTCD § 6C.08).";

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
    expect(html).toContain("at least 100 ft");
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
