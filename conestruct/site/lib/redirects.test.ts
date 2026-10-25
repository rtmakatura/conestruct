import { beforeAll, describe, it, expect } from "vitest";

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

type Redirect = { source: string; destination: string; permanent: boolean };

// #353: the first import of next.config.mjs loads @sentry/nextjs (about
// 0.5 s in plain node, about 1 s with vitest running this file alone,
// 1.2-1.4 s in a full local run).  Inside the first test that load counted
// against the test's 5 s default budget.  The likely cause of #353's
// full-run failure (never reproduced; see validation-artifacts/committed/
// missions/clear-small-queue/issue-353/evidence.md) is that load running
// past 5 s under heavy parallel load.  The load happens once here, in a
// hook with its own timeout, so neither test pays for it.
// CHOSEN: 30 s, about 20x the slowest measured full-run load (1.37 s);
// a hung import still fails within a minute.
const CONFIG_LOAD_TIMEOUT_MS = 30_000;
let table: Redirect[] = [];

beforeAll(async () => {
  table = await redirects();
}, CONFIG_LOAD_TIMEOUT_MS);

describe("next.config redirects", () => {
  it("/landing redirects to / as a 307 (C-Q5)", () => {
    const entry = table.find((r) => r.source === "/landing");
    expect(entry).toEqual({
      source: "/landing",
      destination: "/",
      permanent: false,
    });
  });

  it("/try redirects to / as a 307 (C-Q5)", () => {
    const entry = table.find((r) => r.source === "/try");
    expect(entry).toEqual({ source: "/try", destination: "/", permanent: false });
  });
});
