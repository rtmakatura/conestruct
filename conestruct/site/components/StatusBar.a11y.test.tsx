import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBar } from "./StatusBar";
import type { AuditResponse } from "@/lib/render-types";

// fix-spec-02 P1·02/P1·05 — the strip is a polite live region, and the
// two engine-removal states carry their additive style modifiers
// (``verifying`` spinner / ``unavail`` chromaless dot) WITHOUT touching
// the pinned ``status-bar idle`` base class or any copy (those stay
// pinned by StatusBar.test.tsx).

// Minimal ready-shaped response with no plan_flags — the deploy-window
// case the strip renders as VERIFICATION UNAVAILABLE.
const noVerdict = { summary: {}, sections: {} } as unknown as AuditResponse;

describe("StatusBar aria-live region", () => {
  it("wraps every state in aria-live=polite", () => {
    const states = [
      renderToStaticMarkup(
        <StatusBar
          status="idle"
          inputError={null}
          audit={{ state: "loading", lastReady: null }}
        />,
      ),
      renderToStaticMarkup(
        <StatusBar status="generating" inputError={null} audit={{ state: "loading", lastReady: null }} />,
      ),
      renderToStaticMarkup(
        <StatusBar
          status="idle"
          inputError="speed out of range"
          audit={{ state: "loading", lastReady: null }}
        />,
      ),
    ];
    for (const html of states) {
      expect(html).toContain('aria-live="polite"');
    }
  });
});

describe("verifying / unavail style modifiers", () => {
  it("in-flight verification renders idle + verifying", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="idle"
        inputError={null}
        audit={{ state: "loading", lastReady: null }}
      />,
    );
    expect(html).toContain("status-bar idle verifying");
    expect(html).toContain("VERIFYING");
  });

  it("audit fetch error renders idle + unavail", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="idle"
        inputError={null}
        audit={{ state: "error", message: "Network error", lastReady: null }}
      />,
    );
    expect(html).toContain("status-bar idle unavail");
    expect(html).toContain("VERIFICATION UNAVAILABLE");
  });

  it("a response with no plan verdict renders idle + unavail", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="idle"
        inputError={null}
        audit={{ state: "ready", data: noVerdict }}
      />,
    );
    expect(html).toContain("status-bar idle unavail");
    expect(html).toContain("no plan verdict");
  });
});
