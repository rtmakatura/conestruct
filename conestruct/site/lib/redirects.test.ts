import { describe, it, expect } from "vitest";

// Route-level pin for the permanent redirects declared in next.config.mjs.
// The archived marketing page at app/(archived)/landing/page.tsx stays on
// disk (the /landing rewrite item is parked) but must be unreachable: it
// carries pre-verification copy ("~90 sec", "100% MUTCD-cited") and a
// Sign in link that the flag-off public surface does not offer.  The
// redirect is config-level — the same mechanism that already sends
// /try to /sandbox — so it is served before any render.
async function redirects(): Promise<
  Array<{ source: string; destination: string; permanent: boolean }>
> {
  // next.config.mjs ships no declaration file; the cast below is the
  // whole contract this test relies on.
  // @ts-expect-error TS7016 — untyped .mjs config module
  const cfg = (await import("../next.config.mjs")).default as {
    redirects: () => Promise<
      Array<{ source: string; destination: string; permanent: boolean }>
    >;
  };
  return cfg.redirects();
}

describe("next.config redirects", () => {
  it("/landing permanently redirects to /sandbox", async () => {
    const entry = (await redirects()).find((r) => r.source === "/landing");
    expect(entry).toEqual({
      source: "/landing",
      destination: "/sandbox",
      permanent: true,
    });
  });

  it("/try → /sandbox is still declared (pre-existing)", async () => {
    const entry = (await redirects()).find((r) => r.source === "/try");
    expect(entry).toEqual({ source: "/try", destination: "/sandbox", permanent: true });
  });
});
