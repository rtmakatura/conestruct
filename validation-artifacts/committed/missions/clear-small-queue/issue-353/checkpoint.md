# #353 checkpoint (R145, no stop)

Base 857c3f8, branch issue-353-redirects-flake.

- Likely cause (code-level, not reproduced): `lib/redirects.test.ts` dynamic-imports `next.config.mjs` inside its first test; that config imports `@sentry/nextjs` (about 530 ms alone in plain node). The import counts against the first test's 5 s default vitest timeout. Under load it can overrun, and only the first test fails, because the second gets the cached module. That matches "1 failure, always this file".
- Fix: load the redirect table once in `beforeAll` with an explicit 30 s hook timeout (CHOSEN); both tests become synchronous lookups.
- Red proof: base file, `--testTimeout=500`: first test "Test timed out in 500ms", second passes. Fixed file, `--testTimeout=500 --hookTimeout=500`: 2 passed.
- Churn prediction (Rule 5): one test file only, `conestruct/site/lib/redirects.test.ts`, ~20 lines; same 2 test IDs, same assertions; no product code; no other test changes.
- Acceptance: three full local runs pass the file.
