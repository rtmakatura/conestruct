// #481: a stand-in for `playwright`, preloaded with `node -r` so the real
// scripts/verify-generate-cls.mjs runs its real gate.cjs route against it.
// No browser starts and nothing leaves the machine.  The page's first load
// sends one site request through the context's gate route and leaves it in
// flight; the load then fails with an error whose call log lists the request
// headers (Playwright's shape), and closing the browser rejects the request
// still in flight with "Request context disposed", its headers listed too.
// That is the #478 crash: a harness that prints either error whole prints
// the gate token.
const Module = require("node:module");

function playwrightError(first, headers) {
  const lines = Object.entries(headers ?? {}).map(([k, v]) => `    - ${k}: ${v}`);
  return new Error([first, "Call log:", "  - → GET https://www.conestruct.com/api/needs-you-map", ...lines].join("\n"));
}

function fakeBrowser() {
  const inFlight = [];
  const ctxRoutes = [];
  const page = {
    route: async () => {},
    goto: async (url) => {
      const sent = {};
      const route = {
        request: () => ({ url: () => url, method: () => "GET", headers: () => ({ accept: "*/*" }) }),
        fetch: (o) => new Promise((_, reject) => {
          Object.assign(sent, o?.headers ?? {});
          inFlight.push(() => reject(playwrightError("apiRequestContext.fetch: Request context disposed.", o?.headers)));
        }),
        fulfill: async () => {},
        abort: async () => {},
      };
      // Playwright calls a route handler and does not await it.
      for (const handle of ctxRoutes) handle(route);
      await new Promise((r) => setTimeout(r, 10));
      throw playwrightError("page.goto: net::ERR_ABORTED", sent);
    },
  };
  const ctx = {
    route: async (_match, handle) => void ctxRoutes.push(handle),
    addInitScript: async () => {},
    newPage: async () => page,
  };
  return {
    newContext: async () => ctx,
    close: async () => { for (const reject of inFlight.splice(0)) reject(); },
  };
}

const fake = { chromium: { launch: async () => fakeBrowser() } };
const load = Module._load;
Module._load = function (request, ...rest) {
  if (request === "playwright") return fake;
  return load.call(this, request, ...rest);
};
