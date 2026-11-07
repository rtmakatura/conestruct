// The coming-soon gate's bypass header for scripts (coming-soon-gate
// rulings.md R1.4, C-Q7).  Every reusable harness that loads the site
// goes through this module; archived evidence dirs are never edited (D4,
// C-Q7) — their helpers are copied forward into scripts/ and wired here.
//
// Walks:      const ctx = await newGatedContext(browser, SITE, { viewport });
// Browsers:   const ctx = await browser.newContext({ viewport });
//             await applyGate(ctx, SITE);        // or a Page
// fetch():    fetch(url, { headers: gateHeaders(url) })
//
// #450 (walk-script rule, Ryan 2026-11-06): every walk builds its contexts
// with newGatedContext.  #443's walks copied a walk.mjs forward that put the
// header in extraHTTPHeaders, which sent it to Clerk and Sentry too ("Failed
// to load Clerk" on two production runs) and to other companies' servers.
// newGatedContext refuses that option, so a copied walk can't do it here.
//
// NOT Playwright's extraHTTPHeaders: that sends the header on EVERY
// request the page makes, third parties included (map tiles, Sentry,
// Overpass), which would hand the token to other people's access logs.
// applyGate adds it only to requests bound for the site itself.
// Point SITE at the host that answers (www.conestruct.com, not the apex
// that 307s to it).  The route follows a redirect chain itself
// (fetchGated, #450): one fetch per hop, the header only on the site's own
// hops, and the browser gets the final answer.
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

/** True for a request the gate header may ride on: the site's own host
 *  (host name and port) over the site's own scheme.  Nothing else: not the
 *  apex that redirects, not Clerk, Sentry, Mapbox or Overpass. */
function isSiteRequest(requestUrl, site) {
  const req = new URL(requestUrl);
  const own = new URL(site);
  return req.host === own.host && req.protocol === own.protocol;
}

/** Add the header to `site`-bound requests of a Playwright BrowserContext or Page. */
async function applyGate(target, site) {
  const headers = gateHeaders(site);
  if (Object.keys(headers).length === 0) return;
  await target.route(
    (u) => isSiteRequest(u.href, site),
    // #450: the route follows the redirects itself, one hop at a time, and
    // adds the header on a hop only when that hop's host is the site's.  A
    // route.continue'd request keeps the added header on every hop, and the
    // route never sees the hops: the site's 307 to Clerk's handshake carried
    // the token to Clerk (#450's first local walk).  A fulfilled 3xx doesn't
    // come back through the route either, so the hop back to the site would
    // arrive without it.  Cookies set on the way land in the context's jar
    // (route.fetch shares it).
    (route) => fetchGated(route, site, headers),
  );
}

const MAX_HOPS = 10;

async function fetchGated(route, site, gate) {
  const req = route.request();
  const own = req.headers();
  let url = req.url();
  let method = req.method();
  // Unset: route.fetch sends the original request's body (the first hop, a
  // 307/308).  An empty buffer after a redirect that turns into a GET.
  let postData;
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const response = await route.fetch({
      url,
      method,
      headers: isSiteRequest(url, site) ? { ...own, ...gate } : own,
      maxRedirects: 0,
      ...(postData === undefined ? {} : { postData }),
    });
    const status = response.status();
    const location = response.headers()["location"];
    if (status < 300 || status >= 400 || !location) {
      await route.fulfill({ response });
      return;
    }
    // 307/308 keep the method and body; the others become a GET with no
    // body, as a browser does.
    if (status !== 307 && status !== 308) {
      method = "GET";
      postData = Buffer.alloc(0);
    }
    url = new URL(location, url).href;
  }
  throw new Error(`more than ${MAX_HOPS} redirects from ${new URL(req.url()).pathname}`);
}

/** A Playwright BrowserContext whose gate header goes to `site` only.
 *  `options` are newContext's; a gate header in `extraHTTPHeaders` is refused
 *  (it would ride every origin). */
async function newGatedContext(browser, site, options = {}) {
  const extra = options.extraHTTPHeaders ?? {};
  if (Object.keys(extra).some((k) => k.toLowerCase() === GATE_HEADER)) {
    throw new Error(
      `${GATE_HEADER} in extraHTTPHeaders would go to every origin (Clerk, Sentry, ` +
        "map tiles).  Drop it: newGatedContext sends it to the site only.",
    );
  }
  const ctx = await browser.newContext(options);
  await applyGate(ctx, site);
  return ctx;
}

exports.GATE_HEADER = GATE_HEADER;
exports.newGatedContext = newGatedContext;
exports.gateHeaders = gateHeaders;
exports.applyGate = applyGate;
exports.isProduction = isProduction;
exports.isSiteRequest = isSiteRequest;
