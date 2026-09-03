// #224 phase 2 (s2-arc16, ruling 2) — while a request that carries the
// site scan is in flight, the strip names the scan.  The #122 "waking the
// verification server" claim must never show during a scan: it would be
// false (the server is up; it is scanning OpenStreetMap, up to 20 s).

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBar } from "./StatusBar";

const LOADING = { state: "loading" as const, lastReady: null };

describe("StatusBar scan copy (#224 phase 2)", () => {
  it("COMPUTING names the scan when the generate carries it", () => {
    const html = renderToStaticMarkup(
      <StatusBar status="generating" inputError={null} audit={LOADING} scanning />,
    );
    expect(html).toContain("COMPUTING · scanning site conditions (up to 20 s)");
    expect(html).toContain("sign placement");
  });

  it("COMPUTING is byte-identical without the flag", () => {
    const html = renderToStaticMarkup(
      <StatusBar status="generating" inputError={null} audit={LOADING} />,
    );
    expect(html).toContain("COMPUTING · taper · buffer · spacing · sign placement");
    expect(html).not.toContain("scanning");
  });

  it("the slow variant says scanning, never waking, when the request carries the scan", () => {
    const html = renderToStaticMarkup(
      <StatusBar status="done" inputError={null} audit={LOADING} verifySlow scanning />,
    );
    expect(html).toContain("VERIFYING · scanning site conditions along the corridor");
    expect(html).toContain("up to 20 s");
    expect(html).not.toContain("waking");
  });

  it("the slow variant without the scan is the unchanged #122 copy", () => {
    const html = renderToStaticMarkup(
      <StatusBar status="done" inputError={null} audit={LOADING} verifySlow />,
    );
    expect(html).toContain("waking the verification server");
    expect(html).not.toContain("scanning");
  });
});
