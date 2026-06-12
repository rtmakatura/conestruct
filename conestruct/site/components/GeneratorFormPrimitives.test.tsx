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
