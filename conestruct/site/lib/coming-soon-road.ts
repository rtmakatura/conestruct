import type { CorridorZone } from "./corridor-zones";

// RED STUB (coming-soon-gate Arc 3): the milepost road's API, typed, with
// nothing behind it.  The build commit replaces this file.

export const ROAD_MIN_WIDTH = 0;
export const EASE = 0;

export type Stretch = { zone: CorridorZone; post: string; word: string; colour: string };
export const STRETCHES: readonly Stretch[] = [];

export type RoadLayout = {
  h: number;
  top: number;
  end: number;
  starts: readonly number[];
  signs: readonly number[];
  devices: readonly (readonly [number, number])[];
  work: readonly [number, number];
};

export const X = { edgeL: 0, lane: 0, edgeR: 0, bar: 0, word: 0, sign: 0, post: 0 } as const;

const notBuilt = (): never => {
  throw new Error("coming-soon-road: not built");
};

export function roadFront(_o: { scrollY: number; vh: number; docH: number; roadTop: number; h: number }): number {
  return notBuilt();
}
export function easeToward(_cur: number, _target: number): number {
  return notBuilt();
}
export function stretchAt(_front: number, _starts: readonly number[]): number {
  return notBuilt();
}
export function roadLayout(_tops: readonly number[], _h: number): RoadLayout {
  return notBuilt();
}
