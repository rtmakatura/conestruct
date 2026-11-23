// #541 (Ryan's ruling 1, 2026-11-22, docs/prompts/
// cc-prompt-ux-coords-in-search.md): the map window's search box takes
// coordinates.  This reads the box's text BEFORE any geocoding call.
//
// #548 (Ryan, 2026-11-23, gate round 4; validation-artifacts/committed/
// missions/coords-wrong-pin/issue-548/rulings.md): "the coordinate parser
// places a pin ONLY for (a) two numbers that both contain a decimal point
// and are in lat/long range, optionally with brackets, degree signs or
// N/S/E/W letters, or (b) a full degrees-minutes(-seconds) pair with a
// hemisphere letter on both halves.  Everything else goes to the geocoder
// exactly as on main.  No new refusals; keep only #541's out-of-range and
// swapped-pair lines."
//
// (a) Two decimal numbers (each tested in search-coords.test.ts; #541's
// list is validation-artifacts/committed/missions/ux-coords-in-search/
// issue-541/rulings.md § Formats):
//   "39.7401, -104.9811"        comma and space
//   "39.7401 -104.9811"         space alone
//   "39.7401,-104.9811"         comma alone
//   "39.7401° N, 104.9811° W"   degree sign and a hemisphere letter
//   "39.7401 N 104.9811 W"      the letter without the sign
//   "N 39.7401, W 104.9811"     the letter in front
//   "104.9811° W, 39.7401° N"   letters name the axis, so either order
// (b) Degrees and minutes, with or without seconds:
//   "39° 44.406' N, 104° 58.866' W"
//   "39°44'24\"N 104°59'W"
// each half with its degree sign, a mark after its minutes and after its
// seconds, and its letter; whole degrees; minutes and seconds under 60.
// #544 (Ryan's ruling 3, 2026-11-22, docs/prompts/
// cc-prompt-ux-map-window-tidy.md): any of these inside one pair of
// brackets is read the same way, the brackets dropped:
//   "(39.7401, -104.9811)"      round brackets
//   "[39.7401, -104.9811]"      square brackets
// A pair of kind (a) or (b) with a number outside its range gets #541's
// range line, and a bare pair typed the wrong way round is offered back.
// Everything else is an address: "39° 44.4" (a pin at 39, 44.4 before
// #548), "39 N, 44.4", "105° W, 39.7401", "39, -105", a lone "39.7401°",
// two latitudes, "E-470", "E 470 N", "1437 N 14", "500 N 200 W 84103".
// The Unicode minus (U+2212), the en dash (U+2013) and NBSP are read as
// "-" and a space (#230).  The order is latitude then longitude unless a
// letter says otherwise.  Nothing is clamped or swapped silently (Rule 10).

export type SearchCoords =
  /** Not coordinates: the geocoder's business. */
  | { kind: "address" }
  /** A valid point. */
  | { kind: "point"; lat: number; lng: number }
  /** A pair with one number outside its range.  `swap` is the same two
   *  numbers the other way round when that is a valid point (offered,
   *  never taken). */
  | { kind: "out-of-range"; axis: "lat" | "lng"; swap: { lat: number; lng: number } | null };

// #548 (a): a number with a decimal point.  CHOSEN: a digit follows the
// point, so "39." is not one ("W 6." ends a sentence, not a number).
const DEC = String.raw`[-+]?(?:\d+\.\d+|\.\d+)`;
const DEG = String.raw`\s*[°º]?`;
// One half: the letter in front, or the number then an optional letter.
const PART = String.raw`(?:([NSEW])\s*(${DEC})${DEG}|(${DEC})${DEG}\s*([NSEW])?)`;
const SEP = String.raw`(?:\s*,\s*|\s+)`;
const PAIR = new RegExp(String.raw`^${PART}${SEP}${PART}$`, "i");
// #548 (b): whole degrees with the degree sign, minutes with their mark,
// seconds with theirs.  Three groups.
// #553: a digit follows the point here too ("44.'" is not minutes).
const UNSIGNED = String.raw`(?:\d+(?:\.\d+)?|\.\d+)`;
const DMS = String.raw`(\d+)\s*[°º]\s*(${UNSIGNED})['′’](?:\s*(${UNSIGNED})["″”])?`;
// One half, its letter in front or behind.  Eight groups: the front
// letter, its three numbers, the other three numbers, the back letter.
const DMS_PART = String.raw`(?:([NSEW])\s*${DMS}|${DMS}\s*([NSEW]))`;
const DMS_PAIR = new RegExp(String.raw`^${DMS_PART}${SEP}${DMS_PART}$`, "i");
// #544: one matching pair of brackets round the whole text, with no other
// bracket inside it.  CHOSEN: a mismatched pair, two pairs or a bracket
// round each number is left as typed (an address).
const WRAPPED = /^(?:\(([^()[\]]*)\)|\[([^()[\]]*)\])$/;
// #553, CHOSEN: longer text is never read as coordinates.  The longest
// form above, with seconds to six places and brackets, is under 50
// characters; the cap bounds the degrees-minutes pattern on a long digit
// run after a degree sign (7.6 s for 100,000 digits before).
export const MAX_COORDS_TEXT = 100;

function validLat(n: number): boolean {
  return Number.isFinite(n) && n >= -90 && n <= 90;
}
function validLng(n: number): boolean {
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

/** One half: its size in degrees as typed (a sign included), and its
 *  letter in upper case. */
type Half = { size: number; letter: string | null };

/** #548 (b): the half whose eight groups start at `i` in a DMS_PAIR match,
 *  or null when it can't be read honestly: 60 or more minutes or seconds,
 *  or a fraction in the minutes with seconds after it (a fraction in two
 *  places can disagree).  One division, no rounding. */
function dmsHalf(m: RegExpExecArray, i: number): Half | null {
  const front = m[i] !== undefined;
  const at = front ? i + 1 : i + 4;
  const min = Number(m[at + 1]);
  const sec = m[at + 2] === undefined ? 0 : Number(m[at + 2]);
  if (m[at + 2] !== undefined && !/^\d+$/.test(m[at + 1])) return null;
  if (min >= 60 || sec >= 60) return null;
  return {
    size: (Number(m[at]) * 3600 + min * 60 + sec) / 3600,
    letter: (front ? m[i] : m[i + 7]).toUpperCase(),
  };
}

/** The two halves as a point, or the range refusal.  Two letters on one
 *  axis ("39.7401 N, 40.1 N") are not a pair: an address. */
function place(a: Half, b: Half): SearchCoords {
  const axisOf = (h: Half) => (h.letter === null ? null : "NS".includes(h.letter) ? "lat" : "lng");
  const axA = axisOf(a);
  const axB = axisOf(b);
  if (axA !== null && axA === axB) return { kind: "address" };
  const value = (h: Half) => (h.letter === "S" || h.letter === "W" ? -h.size : h.size);
  const aIsLat = axA !== null ? axA === "lat" : axB !== null ? axB === "lng" : true;
  const lat = value(aIsLat ? a : b);
  const lng = value(aIsLat ? b : a);
  if (validLat(lat) && validLng(lng)) return { kind: "point", lat, lng };
  const lettered = a.letter !== null || b.letter !== null;
  return {
    kind: "out-of-range",
    axis: validLat(lat) ? "lng" : "lat",
    // Letters already said which number is which; only a bare pair can
    // have been typed the wrong way round.
    swap: !lettered && validLat(lng) && validLng(lat) ? { lat: lng, lng: lat } : null,
  };
}

export function readSearchCoords(raw: string): SearchCoords {
  const typed = raw
    .replace(/[−–]/g, "-")
    .replace(/[\s ]+/g, " ")
    // #548: two minutes marks together are a seconds mark.
    .replace(/(['′’])\1/g, '"')
    .trim();
  if (typed.length > MAX_COORDS_TEXT) return { kind: "address" };
  const wrapped = WRAPPED.exec(typed);
  const text = wrapped ? (wrapped[1] ?? wrapped[2]).trim() : typed;
  const m = PAIR.exec(text);
  if (m) {
    const a: Half = { size: Number(m[2] ?? m[3]), letter: (m[1] ?? m[4] ?? null)?.toUpperCase() ?? null };
    const b: Half = { size: Number(m[6] ?? m[7]), letter: (m[5] ?? m[8] ?? null)?.toUpperCase() ?? null };
    // A minus sign and a letter can disagree ("-39.7401 S"): not a pair.
    const signed = (i: number) => /^[-+]/.test(m[i] ?? m[i + 1]);
    if ((a.letter && signed(2)) || (b.letter && signed(6))) return { kind: "address" };
    return place(a, b);
  }
  const d = DMS_PAIR.exec(text);
  if (d) {
    const a = dmsHalf(d, 1);
    const b = dmsHalf(d, 9);
    if (a !== null && b !== null) return place(a, b);
  }
  return { kind: "address" };
}
