// #507 ruling 4 (F1): the four ways the operator can say a road runs when
// the road lookup failed or found none, each with its line icon.  The
// words are Ryan's ruling 4, verbatim; the backend's side options read
// the value (render_api._AXIS_HEADINGS).

import type { RoadAxis } from "@/lib/scenarios/types";

export const ROAD_AXES: ReadonlyArray<{ value: RoadAxis; label: string; path: string }> = [
  { value: "east_west", label: "East–west", path: "M3 12h18" },
  { value: "north_south", label: "North–south", path: "M12 3v18" },
  { value: "northeast_southwest", label: "Northeast–southwest", path: "M5 19L19 5" },
  { value: "northwest_southeast", label: "Northwest–southeast", path: "M5 5l14 14" },
];

/** Ruling 5 (F2): "You said the road runs <direction>, so these are its
 *  two sides." with the direction in lower case. */
export function axisLine(axis: RoadAxis): string {
  const words = ROAD_AXES.find((a) => a.value === axis)?.label ?? "";
  return `You said the road runs ${words.toLowerCase()}, so these are its two sides.`;
}
