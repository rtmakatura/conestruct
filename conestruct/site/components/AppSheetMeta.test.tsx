import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AppSheetMeta } from "./AppSheetMeta";

// UX-20: the drafting-table chrome must not assert plan facts it can't
// back. These lock the three fixes: ISSUED reflects the current date (not
// a hardcoded stale one), the fictional SHT count is gone, and the BY
// field's false "TCS" authorship is replaced by an honest LOCATION label.

describe("AppSheetMeta (UX-20 honest title-block chrome)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T15:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const render = (props?: Partial<Parameters<typeof AppSheetMeta>[0]>) =>
    renderToStaticMarkup(
      <AppSheetMeta
        project="Sample Project"
        address="15030 Highway 94"
        cdotSheet="MHT-01"
        {...props}
      />,
    );

  it("binds ISSUED to today's date, not a hardcoded stale one", () => {
    const html = render();
    expect(html).toContain("2026-06-12");
    expect(html).not.toContain("2026-04-27");
  });

  it("drops the fictional sheet-count field", () => {
    const html = render();
    expect(html).not.toContain("SHT");
    expect(html).not.toContain("01 / 01");
  });

  it("replaces the false 'BY: TCS' authorship with an honest LOCATION label", () => {
    const html = render();
    expect(html).toContain("LOCATION");
    expect(html).toContain("15030 HIGHWAY 94");
    expect(html).not.toContain("BY:");
    expect(html).not.toContain("TCS");
  });

  it("shows an em-dash for LOCATION when no address is set (no 'NO LOCATION')", () => {
    const html = render({ address: "" });
    expect(html).toContain("LOCATION");
    expect(html).toContain("—");
    expect(html).not.toContain("NO LOCATION");
  });

  it("still renders the honest static fields (PROJECT, MHT, SCALE)", () => {
    const html = render();
    expect(html).toContain("SAMPLE PROJECT");
    expect(html).toContain("MHT-01");
    expect(html).toContain("AS NOTED");
  });
});
