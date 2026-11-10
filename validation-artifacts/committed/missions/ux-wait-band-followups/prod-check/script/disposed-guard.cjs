// Preload for the production runs (node --require <this> scripts/verify-generate-cls.mjs).
// On production a gated request (scripts/gate.cjs fetchGated, route.fetch) can
// still be in flight when the walk closes its browser; Playwright then rejects
// with "Request context disposed" and no one awaits it, so Node exits on an
// unhandled rejection before the width's result line prints (seen twice on
// 85e339a: once at 1440 with HOLD_MS=0, once at 390 with HOLD_MS=4000).
// Playwright's error message carries a call log WITH the request's headers,
// the gate header included, so this prints only the message's first line.
// Any other unhandled rejection still fails the run (first line only, exit 1).
process.on("unhandledRejection", (err) => {
  const first = String(err?.message ?? err).split("\n")[0];
  if (/Request context disposed|Target page, context or browser has been closed/.test(first)) {
    console.log(`   (guard) ignored a request still in flight at browser close: ${first}`);
    return;
  }
  console.log(`   (guard) unhandled rejection: ${first}`);
  process.exit(1);
});
