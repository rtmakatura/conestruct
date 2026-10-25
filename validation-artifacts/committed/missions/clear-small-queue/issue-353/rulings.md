# #353 rulings

1. R145 self-ruled: fix inside the test file only (move the config load into `beforeAll`), not a global `testTimeout` raise in vitest.config.ts. A global raise would hide slow tests everywhere; the cost is local to this file's import of `@sentry/nextjs` (next.config.mjs:1).
2. R145 self-ruled, CHOSEN (Rule 12, non-safety): `CONFIG_LOAD_TIMEOUT_MS = 30_000`. Reason: the slowest measured full-run load is 1.37 s (run 1), so 30 s gives about 20x headroom, and a truly hung import still fails inside a minute. The vitest default hook timeout (10 s) would also work, but it is implicit; an explicit value carries its reason.
3. R145 self-ruled: no-reproduction is recorded honestly. 3 full runs on base passed, so the fix rests on the code-level mechanism plus the scaled red proof, not on an observed full-run failure.
