// The coming-soon gate's bypass header for scripts (coming-soon-gate
// rulings.md R1.4, C-Q7).  Every reusable harness that loads the site
// goes through this module; archived evidence dirs are never edited (D4,
// C-Q7) — their helpers are copied forward into scripts/ and wired here.
//
// Browsers:   const ctx = await browser.newContext({ viewport });
//             await applyGate(ctx, SITE);        // or a Page
// fetch():    fetch(url, { headers: gateHeaders(url) })
//
// NOT Playwright's extraHTTPHeaders: that sends the header on EVERY
// request the page makes, third parties included (map tiles, Sentry,
// Overpass), which would hand the token to other people's access logs.
// applyGate adds it only to requests bound for the site itself.
// Playwright does not re-run a route handler on a redirect hop, so point
// SITE at the host that answers (www.conestruct.com, not the apex that
// 307s to it).
//
// The token comes from the GATE_BYPASS_TOKEN env var — never the repo,
// never printed.  Targeting production without it FAILS LOUDLY: behind
// the gate every page would 307 to the placeholder and every /api call
// would 401, and a harness measuring that would report on the wrong
// page.  Anywhere else (a local dev server) the header is sent when the
// token is set and omitted when it is not.

const GATE_HEADER = "x-conestruct-gate";

function isProduction(url) {
  const host = new URL(url).hostname.toLowerCase();
  return host === "conestruct.com" || host.endsWith(".conestruct.com");
}

function gateHeaders(url) {
  const token = process.env.GATE_BYPASS_TOKEN;
  if (token) return { [GATE_HEADER]: token };
  if (isProduction(url)) {
    throw new Error(
      `GATE_BYPASS_TOKEN is not set, and ${new URL(url).host} is behind the ` +
        "coming-soon gate: every page would redirect to / and every /api " +
        "call would 401.  Set GATE_BYPASS_TOKEN (the value in Vercel prod) " +
        "and re-run.",
    );
  }
  return {};
}

/** True for a request the gate header may ride on: the site's own origin. */
function isSiteRequest(requestUrl, site) {
  return new URL(requestUrl).origin === new URL(site).origin;
}

/** Add the header to `site`-bound requests of a Playwright BrowserContext or Page. */
async function applyGate(target, site) {
  const headers = gateHeaders(site);
  if (Object.keys(headers).length === 0) return;
  await target.route(
    (u) => isSiteRequest(u.href, site),
    (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }),
  );
}

exports.GATE_HEADER = GATE_HEADER;
exports.gateHeaders = gateHeaders;
exports.applyGate = applyGate;
exports.isProduction = isProduction;
exports.isSiteRequest = isSiteRequest;
