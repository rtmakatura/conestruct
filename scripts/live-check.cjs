// #237 — the live-check helper, with the zero-match rule #289 sets:
// "zero-match fails loudly".
//
// #237's defect: the s2a7 browser live-check helper matched the rail's
// Generate entry (`getByRole("button", { name: /Generate/ }).first()`) and,
// when its real target was absent, its counting read returned null and the
// suite reported "0 checked" — a silent pass.  checkpoint.md §G.2 scoped the
// fix: "the helper gains a zero-match throw, once, in this phase's own
// evidence directory"; probes select on declared data-testid hooks, not on
// a class or an accessible name a restyle can move; the older legs stay as
// they are (committed evidence of finished runs).
//
// Every selection a probe of this phase makes goes through one of these.
// None returns an empty result: a selector that matches nothing THROWS, with
// the selector and the count in the message, so a moved hook fails the run
// instead of shrinking it.

/** Exactly one match, or throw.  The default for anything a probe clicks
 *  or reads — `.first()` is how #237 picked the wrong Generate. */
async function one(page, selector, label = selector) {
  const loc = page.locator(selector);
  const n = await loc.count();
  if (n !== 1) {
    throw new Error(`live-check: ${label} matched ${n} element(s), expected exactly 1 (${selector})`);
  }
  return loc;
}

/** One or more matches, or throw.  For lists a probe counts or iterates. */
async function some(page, selector, label = selector) {
  const loc = page.locator(selector);
  const n = await loc.count();
  if (n === 0) {
    throw new Error(`live-check: ${label} matched nothing — zero matches fail loudly (${selector})`);
  }
  return loc;
}

/** The declared-hook form: `[data-testid="…"]`, exactly one. */
function hook(page, testid) {
  return one(page, `[data-testid="${testid}"]`, `hook ${testid}`);
}

/** A list the probe built in-page (texts, rows, annotations): empty throws. */
function nonEmpty(list, label) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`live-check: ${label} came back empty — zero matches fail loudly`);
  }
  return list;
}

module.exports = { one, some, hook, nonEmpty };
// FORWARD COPY (coming-soon-gate C-Q7) of validation-artifacts/committed/
// issue-289-band-stack/live-check.cjs, unchanged but for this note: it is
// probe.cjs's selector helper and makes no network call.
