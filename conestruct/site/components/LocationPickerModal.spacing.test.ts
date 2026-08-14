// Modal spacing guard (issue #166, DESIGN-SPACING.md).  The modal was
// the last surface off the #165 scale; this static scan keeps it on.
// Every Tailwind margin/padding/gap token in the source must use a
// scale step {0, 1, 1.5, 2, 3, 4, 6} — arbitrary brackets and off-scale
// steps (0.5, 2.5, 3.5, 5, px…) regress the #166 alignment.  Paired
// positive assertion (arc12 vacuous-guard lesson): the scan must keep
// finding a three-digit count of tokens, so an extraction regex that
// rots to zero matches fails loudly instead of passing silently.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCALE = new Set(["0", "1", "1.5", "2", "3", "4", "6"]);
const TOKEN =
  /(?:^|[\s"'`{:])-?(?:m|mx|my|mt|mb|ml|mr|p|px|py|pt|pb|pl|pr|gap|gap-x|gap-y|space-x|space-y)-((?:\[[^\]]*\])|[\w.]+)/g;

describe("LocationPickerModal stays on the spacing scale (#166)", () => {
  const src = readFileSync(
    join(__dirname, "LocationPickerModal.tsx"),
    "utf-8",
  );
  const values = Array.from(src.matchAll(TOKEN), (m) => m[1]);

  it("keeps finding the modal's spacing tokens (guard is non-vacuous)", () => {
    expect(values.length).toBeGreaterThan(100);
  });

  it("every margin/padding/gap token is a scale step", () => {
    const offScale = values.filter((v) => !SCALE.has(v));
    expect(offScale).toEqual([]);
  });
});
