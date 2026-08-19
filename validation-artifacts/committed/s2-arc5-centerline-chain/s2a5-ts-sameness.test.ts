// Scratch sameness harness (evidence only): the REAL TS stitcher vs the
// production-served chains recorded during the pre-code check.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stitchChainDetailed, trimChain, truncateAtReversal, type StitchWay } from "@/lib/road-detection/stitch";

const SCRATCH = "C:/Users/rtmak/AppData/Local/Temp/claude/C--Users-rtmak-Documents-traffic-control-tool/4f255911-1a5e-4b2f-9c19-68f03918e4ca/scratchpad";

const CASES = [
  { name: "northglenn", pin: [39.886, -104.9811] },
  { name: "lakewood", pin: [39.7113, -105.0815] },
  { name: "colfax", pin: [39.73997, -104.96632] },
];

describe("TS stitcher sameness at clean reference pins", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const pool = JSON.parse(readFileSync(`${SCRATCH}/pools/sameness-${c.name}.json`, "utf-8"));
      const served = JSON.parse(readFileSync(`${SCRATCH}/served-${c.name}.json`, "utf-8"));
      const cand = served.candidates[served.primary_index ?? 0];
      const ways: StitchWay[] = pool.elements.filter(
        (e: { type: string; geometry?: unknown[] }) => e.type === "way" && (e.geometry?.length ?? 0) >= 2,
      );
      const own = ways.find((w) => String(w.id) === cand.way_id) as StitchWay;
      const r = stitchChainDetailed(own, ways);
      const out = trimChain(
        truncateAtReversal(r.chain, cand.snapped_lat, cand.snapped_lng),
        cand.snapped_lat,
        cand.snapped_lng,
      ).map(([a, b]) => [Number(a.toFixed(7)), Number(b.toFixed(7))]);
      const servedGeom = cand.geometry.map(([a, b]: [number, number]) => [
        Number(a.toFixed(7)),
        Number(b.toFixed(7)),
      ]);
      expect(r.bridges).toEqual([]);
      expect(out).toEqual(servedGeom);
    });
  }
});
