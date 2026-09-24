// #237 — the helper's own contract, runnable with `node --test`.  A fake
// page stands in for Playwright's (only `locator(sel).count()` is read), so
// the zero-match throw is proved without a browser.

const test = require("node:test");
const assert = require("node:assert");
const { one, some, hook, nonEmpty } = require("./live-check.cjs");

const fakePage = (counts) => ({
  locator: (sel) => ({ count: async () => counts[sel] ?? 0 }),
});

test("one: exactly one match passes", async () => {
  await one(fakePage({ "#x": 1 }), "#x");
});

test("one: zero matches THROWS — never a silent '0 checked' (#237)", async () => {
  await assert.rejects(one(fakePage({}), "#missing"), /matched 0 element\(s\), expected exactly 1/);
});

test("one: two matches throws — .first() is how #237 picked the rail's Generate", async () => {
  await assert.rejects(one(fakePage({ button: 2 }), "button", "Generate"), /Generate matched 2/);
});

test("some: one or more passes; zero throws", async () => {
  await some(fakePage({ ".row": 3 }), ".row");
  await assert.rejects(some(fakePage({}), ".row"), /zero matches fail loudly/);
});

test("hook: selects the declared data-testid and holds it to exactly one", async () => {
  await hook(fakePage({ '[data-testid="band-stack"]': 1 }), "band-stack");
  await assert.rejects(hook(fakePage({}), "band-stack"), /hook band-stack matched 0/);
});

test("nonEmpty: an empty in-page list throws", () => {
  assert.deepStrictEqual(nonEmpty([1], "rows"), [1]);
  assert.throws(() => nonEmpty([], "annotations"), /annotations came back empty/);
});
