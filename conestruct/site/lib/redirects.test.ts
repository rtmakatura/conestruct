import { describe, it, expect } from "vitest";

// Route-level pin for the redirects declared in next.config.mjs.
// The archived marketing page at app/(archived)/landing/page.tsx was
// deleted in #239 (its copy predated verification: "~90 sec", "100%
// MUTCD-cited").  The redirect stays so an old /landing link still lands
// on the public page.  It is config-level, served before any render.
//
// coming-soon-gate C-Q5: both now go to / (the public placeholder) as
// 307s — /sandbox is gated (R1.1, R1.2), and a 308's hard browser cache
// would pin a destination that has already moved once.
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
  it("/landing redirects to / as a 307 (C-Q5)", async () => {
    const entry = (await redirects()).find((r) => r.source === "/landing");
    expect(entry).toEqual({
      source: "/landing",
      destination: "/",
      permanent: false,
    });
  });

  it("/try redirects to / as a 307 (C-Q5)", async () => {
    const entry = (await redirects()).find((r) => r.source === "/try");
    expect(entry).toEqual({ source: "/try", destination: "/", permanent: false });
  });
});
