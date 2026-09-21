// issue-288 — the error tap, attached BEFORE navigation.
//
// #212's finding, restated: the hydration errors this arc must show as
// zero are bounded by the DEPLOY, not by the cache, and a listener
// attached after `page.goto` resolves has already missed them.  React
// throws them while hydrating the first paint; by the time `load` or
// `networkidle` fires they are in the past and unrecoverable.  Every
// earlier leg in this repo attached its listener correctly by habit
// (s2a30-ledger.js:210, s2a29-lc.js:192); this file makes the ordering a
// contract instead of a habit, because the ruling landed it first.
//
// Usage — the tap is attached to a PAGE THAT HAS NOT NAVIGATED:
//
//   const page = await ctx.newPage();
//   const tap = attachErrorTaps(page);      // before goto, always
//   await page.goto(url, { waitUntil: "networkidle" });
//   const late = attachErrorTaps(page);     // the control, see below
//   ...
//   tap.report()  ->  { pageerrors: [...], consoleErrors: [...], ... }
//
// `lateTap` is not defensive clutter.  A leg that reports "0 pageerror"
// proves nothing on its own: zero is also what a mis-ordered listener
// reports.  Running both and recording BOTH counts makes the ordering
// claim evidence rather than assertion — if the early tap sees an error
// the late tap misses, the artifact demonstrates why the order matters.
// If both are zero the page is genuinely clean and the leg says so.

function attachErrorTaps(page, label = "early") {
  const pageerrors = [];
  const consoleErrors = [];
  const requestFailures = [];
  const attachedAt = Date.now();

  page.on("pageerror", (e) => {
    pageerrors.push({
      at: Date.now() - attachedAt,
      message: String(e && e.message ? e.message : e).split("\n")[0].slice(0, 300),
    });
  });

  page.on("console", (m) => {
    if (m.type() !== "error") return;
    consoleErrors.push({
      at: Date.now() - attachedAt,
      text: m.text().split("\n")[0].slice(0, 300),
    });
  });

  page.on("requestfailed", (r) => {
    requestFailures.push({
      at: Date.now() - attachedAt,
      // Query string dropped, never truncated.  Leg 2's first push was
      // refused by GitHub's secret scanning: Mapbox's telemetry endpoint
      // carries the access token in its query, the tap recorded the whole
      // URL, and the committed artifact would have published it.  An
      // evidence file has no use for a credential, so it does not keep
      // one -- and truncating to N characters would only have hidden it
      // at some lengths.
      url: r.url().split("?")[0].slice(0, 200),
      failure: (r.failure() && r.failure().errorText) || "unknown",
    });
  });

  return {
    label,
    report: () => ({
      label,
      pageerrors: pageerrors.slice(),
      consoleErrors: consoleErrors.slice(),
      requestFailures: requestFailures.slice(),
      counts: {
        pageerror: pageerrors.length,
        consoleError: consoleErrors.length,
        requestFailed: requestFailures.length,
      },
    }),
  };
}

// A hydration mismatch surfaces under several React message shapes across
// versions and build modes.  Matching on the shapes rather than on one
// literal keeps the check from silently passing when React rewords it.
const HYDRATION_RE =
  /hydrat|did not match|Text content does not match|server-rendered HTML|server HTML/i;

function classify(report) {
  const all = [
    ...report.pageerrors.map((e) => e.message),
    ...report.consoleErrors.map((e) => e.text),
  ];
  return {
    total: all.length,
    hydration: all.filter((m) => HYDRATION_RE.test(m)),
    other: all.filter((m) => !HYDRATION_RE.test(m)),
  };
}

module.exports = { attachErrorTaps, classify, HYDRATION_RE };
