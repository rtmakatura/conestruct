import { ZONE_COLOR, ZONE_LABEL, type CorridorZone } from "./corridor-zones";
import { ROAD } from "./coming-soon-copy";

// The milepost road (coming-soon-gate R13) and its marker (R14) — the
// arithmetic, kept pure so it is tested without a browser.  The drawing
// and the scroll listener are components/coming-soon/MilepostRoad.tsx.
//
// The road runs down the left margin beside sections 01 → close.  Its
// five stretches are a lane closure in traffic order, one per section:
// 01 advance warning, 02 taper, 03 buffer, 04 (and 05) work zone, the
// closing band downstream.  Words and colours are ZONE_LABEL /
// ZONE_COLOR (R9: one source, labelled decoration).

/** R13 / R14: the road and the marker exist at this width and up. */
export const ROAD_MIN_WIDTH = 980;

/** Each frame closes this fraction of the gap to the target: eased, no stepping (R13). */
export const EASE = 0.16;

/** The highlight starts when the road's top reaches this far down the window. */
const START_AT = 0.6;

export type Stretch = {
  zone: CorridorZone;
  post: string;
  word: string;
  colour: string;
};

const ORDER: readonly CorridorZone[] = [
  "advance_warning",
  "transition",
  "buffer",
  "work_zone",
  "downstream",
];

export const STRETCHES: readonly Stretch[] = ORDER.map((zone, i) => ({
  zone,
  post: ROAD.posts[i],
  word: ZONE_LABEL[zone].toLowerCase(),
  colour: ZONE_COLOR[zone],
}));

/**
 * Where the highlight should be, in the road's own pixels (0 at its top,
 * `h` at its end), for a scroll position.  0 until the road's top is
 * START_AT down the window; exactly `h` when the page is scrolled to the
 * bottom (R13: "reaching the end of the road exactly at the bottom of
 * the page").
 */
export function roadFront(o: {
  scrollY: number;
  vh: number;
  docH: number;
  roadTop: number;
  h: number;
}): number {
  const s0 = o.roadTop - o.vh * START_AT;
  const s1 = Math.max(s0 + 1, o.docH - o.vh);
  const p = Math.min(1, Math.max(0, (o.scrollY - s0) / (s1 - s0)));
  return p === 1 ? o.h : p * o.h;
}

/** One eased frame toward the target; lands exactly on it when within half a pixel. */
export function easeToward(cur: number, target: number): number {
  const d = target - cur;
  return Math.abs(d) < 0.5 ? target : cur + d * EASE;
}

/** The stretch the highlight has reached: -1 before 01, then 0..4. */
export function stretchAt(front: number, starts: readonly number[]): number {
  if (!(front >= starts[0])) return -1;
  let i = 0;
  while (i < STRETCHES.length - 1 && front >= starts[i + 1]) i++;
  return i;
}

export type RoadLayout = {
  h: number;
  top: number;
  end: number;
  /** Five stretch starts (the mileposts) and the downstream end. */
  starts: readonly number[];
  signs: readonly number[];
  /** [x, y] device centres, x in the road's own 200 px column. */
  devices: readonly (readonly [number, number])[];
  work: readonly [number, number];
};

// The column's x positions (design/FullPage.dc.html, the 200 px road).
export const X = {
  edgeL: 70,
  lane: 100,
  edgeR: 130,
  bar: 62,
  word: 52,
  sign: 20,
  post: 162,
} as const;

/**
 * The road's geometry from the measured tops of the five milepost
 * sections (01, 02, 03, 04, close) and the column's height.  Each
 * milepost sits 6 px above its section's header; the downstream stretch
 * ends 20 px short of the road's end, as drawn.
 *
 * What it lays out is the product's lane closure (A2-Q5, layout.py):
 * three advance signs, a merging taper from the edge to the lane line,
 * the buffer EMPTY, devices along the lane line through the work, and a
 * short downstream taper back to the edge.
 */
export function roadLayout(tops: readonly number[], h: number): RoadLayout {
  const starts = [...tops.map((t) => Math.round(t - 6)), h - 20];
  const top = Math.max(0, starts[0] - 40);
  const [adv, tap, buf, work, down, end] = starts;
  const signs = [0.259, 0.534, 0.793].map((f) => Math.round(adv + f * (tap - adv)));
  const devices: [number, number][] = [];
  // Taper: seven devices, edge (x 68) to the lane line (x 97).
  for (let k = 0; k < 7; k++) {
    devices.push([68 + (k * 29) / 6 + 3, tap + 40 + (k * (buf - tap - 60)) / 6 + 3]);
  }
  // Nothing in the buffer.  Along the lane line through the work, every 80 px.
  for (let y = work + 10; y <= down - 10; y += 80) devices.push([X.lane, y + 3]);
  // Downstream: back to the edge.
  for (const [x, f] of [
    [90, 40 / 280],
    [82, 100 / 280],
    [74, 160 / 280],
  ] as const) {
    devices.push([x + 3, down + f * (end - down) + 3]);
  }
  return { h, top, end, starts, signs, devices, work: [work + 50, down - 50] };
}
