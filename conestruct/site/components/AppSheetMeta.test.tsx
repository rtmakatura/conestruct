import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AppSheetMeta } from "./AppSheetMeta";

// UX-20: the drafting-table chrome must not assert plan facts it can't
// back. These lock the fixes: the fictional SHT count is gone, and the BY
// field's false "TCS" authorship is replaced by an honest LOCATION label.
//
// #288 / #281 Part 1 s8.32 removed ISSUED. The replacement test is not
// "the string is absent" but the invariant that was actually broken: the
// markup must be IDENTICAL either side of a UTC-midnight boundary, because
// the SSR HTML is baked at deploy and the client renders later (#212). A
// test that only greps for a date would pass against a differently-shaped
// render-time clock; comparing two renders catches any of them.

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

  it("renders no date at all — no ISSUED field, no stale literal", () => {
    const html = render();
    expect(html).not.toContain("ISSUED");
    expect(html).not.toContain("2026-06-12");
    expect(html).not.toContain("2026-04-27");
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("renders identically across a UTC-midnight boundary (no hydration drift)", () => {
    vi.setSystemTime(new Date("2026-06-12T23:59:59Z"));
    const before = render();
    vi.setSystemTime(new Date("2026-06-13T00:00:01Z"));
    const after = render();
    expect(after).toBe(before);
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
