// @vitest-environment happy-dom
//
// #224 phase 2 (s2-arc16, commit 5) — the panel surface of the
// NOT-CHECKED disclosure.  A proceed-anyway plan's audit carries
// ``sections.site_scan`` with status unavailable + proceeded_anyway +
// the backend-authored disclosure string; the post-generate Setup panel
// prints it as a #227 system event (.sys-event warn — the container
// reused, not forked): ⚠ + the sentence as ONE text node + provenance
// line 2.  Every other scan state prints nothing (Rule 10 both ways:
// loud when it applies, never a phantom when it doesn't).

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DEFAULT_SCENARIO } from "@/lib/scenarios";
import type { SiteScanProvenance } from "@/lib/render-types";
import { SetupStrip } from "./SetupStrip";

afterEach(cleanup);

const DISCLOSURE = "SITE CONDITIONS NOT CHECKED — service unavailable at generation.";

function mount(siteScan: SiteScanProvenance | null) {
  render(
    <SetupStrip
      scenario={DEFAULT_SCENARIO}
      setScenario={vi.fn()}
      onReopen={vi.fn()}
      siteScan={siteScan}
    />,
  );
}

function proceeded(): SiteScanProvenance {
  return {
    status: "unavailable",
    error: "scan budget exceeded (20 s)",
    mode: "corridor",
    measured_at: "2026-09-03T15:29:51+00:00",
    proceeded_anyway: true,
    disclosure: DISCLOSURE,
  };
}

describe("SetupStrip NOT-CHECKED disclosure (#224 phase 2)", () => {
  it("a proceed-anyway plan renders the disclosure as a .sys-event warn: glyph, one text node, provenance", () => {
    mount(proceeded());
    const sentence = screen.getByText(DISCLOSURE);
    const container = sentence.closest(".sys-event");
    expect(container).not.toBeNull();
    expect(container!.classList.contains("warn")).toBe(true);
    expect(container!.querySelector(".sys-glyph")?.textContent).toBe("⚠");
    expect(container!.textContent).toContain("scan budget exceeded (20 s)");
    expect(container!.textContent).toContain("attempted 2026-09-03T15:29:51+00:00");
    expect(container!.textContent).toContain("re-generate to retry");
    // Once, verbatim, on the surface.
    expect((document.body.textContent ?? "").split(DISCLOSURE).length - 1).toBe(1);
  });

  it("an ok scan, a not_run scan, and no provenance render nothing", () => {
    for (const scan of [
      { status: "ok", flags: { school_zone: true } } as SiteScanProvenance,
      { status: "not_run", reason: "not_requested" } as SiteScanProvenance,
      null,
    ]) {
      cleanup();
      mount(scan);
      expect(document.querySelector(".site-not-checked")).toBeNull();
      expect(document.body.textContent).not.toContain("NOT CHECKED");
    }
  });

  it("a refusal that was NOT proceeded past renders nothing (it never reaches a plan)", () => {
    mount({ ...proceeded(), proceeded_anyway: false, disclosure: null });
    expect(document.querySelector(".site-not-checked")).toBeNull();
  });
});
