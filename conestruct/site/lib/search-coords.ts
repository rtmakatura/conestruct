// #541 (Ryan's ruling 1, 2026-11-22, docs/prompts/
// cc-prompt-ux-coords-in-search.md): the map window's search box takes
// coordinates.  This reads the box's text BEFORE any geocoding call: a
// string that reads as coordinates, or that looks like coordinates and is
// wrong, never goes to /api/geocode.  Everything else is an address.
//
// Accepted (each one tested in search-coords.test.ts; the list with its
// sources is validation-artifacts/committed/missions/ux-coords-in-search/
// issue-541/rulings.md § Formats):
//   "39.7401, -104.9811"        comma and space
//   "39.7401 -104.9811"         space alone
//   "39.7401,-104.9811"         comma alone
//   "39.7401° N, 104.9811° W"   degree sign and a hemisphere letter
//   "39.7401 N 104.9811 W"      the letter without the sign
//   "N 39.7401, W 104.9811"     the letter in front
//   "104.9811° W, 39.7401° N"   letters name the axis, so either order
// The Unicode minus (U+2212), the en dash (U+2013) and NBSP are read as
// "-" and a space (#230).  The order is latitude then longitude unless a
// letter says otherwise.  Nothing is clamped or swapped silently (Rule 10).

export type SearchCoords =
  /** Not coordinates: the geocoder's business. */
  | { kind: "address" }
  /** A valid point. */
  | { kind: "point"; lat: number; lng: number }
  /** Two numbers, one outside its range.  `swap` is the same two numbers
   *  the other way round when that is a valid point (offered, never taken). */
  | { kind: "out-of-range"; axis: "lat" | "lng"; swap: { lat: number; lng: number } | null }
  /** Looks like coordinates but is not a decimal-degree pair (degrees and
   *  minutes, one number with a degree sign, two latitudes, a minus sign
   *  with a hemisphere letter). */
  | { kind: "unreadable" };

const NUM = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)`;
const DEG = String.raw`\s*[°º]?`;
// One half: the letter in front, or the number then an optional letter.
const PART = String.raw`(?:([NSEW])\s*(${NUM})${DEG}|(${NUM})${DEG}\s*([NSEW])?)`;
const PAIR = new RegExp(String.raw`^${PART}(\s*,\s*|\s+)${PART}$`, "i");

function validLat(n: number): boolean {
  return Number.isFinite(n) && n >= -90 && n <= 90;
}
function validLng(n: number): boolean {
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

type Half = { text: string; letter: string | null };

export function readSearchCoords(raw: string): SearchCoords {
  const text = raw
    .replace(/[−–]/g, "-")
    .replace(/[\s ]+/g, " ")
    .trim();
  const m = PAIR.exec(text);
  if (!m) {
    // A degree sign is never part of an address: "39°44'24\"N 104°59'W"
    // or a lone "39.7401°" is refused here, not geocoded.
    return /[°º]/.test(text) ? { kind: "unreadable" } : { kind: "address" };
  }
  const a: Half = { text: m[2] ?? m[3], letter: (m[1] ?? m[4] ?? null)?.toUpperCase() ?? null };
  const b: Half = { text: m[7] ?? m[8], letter: (m[6] ?? m[9] ?? null)?.toUpperCase() ?? null };
  const lettered = a.letter !== null || b.letter !== null;
  // Two bare whole numbers with only a space between ("1600 80202",
  // "500 N 200 W" grid addresses) stay an address.  CHOSEN: a comma, a
  // decimal point, a degree sign or a sign is what marks a pair as
  // coordinates.
  if (!m[5].includes(",") && !/[.°º+-]/.test(text)) return { kind: "address" };

  const signed = (h: Half) => /^[-+]/.test(h.text);
  if ((a.letter && signed(a)) || (b.letter && signed(b))) return { kind: "unreadable" };
  const axisOf = (h: Half) => (h.letter === null ? null : "NS".includes(h.letter) ? "lat" : "lng");
  const axA = axisOf(a);
  const axB = axisOf(b);
  if (axA !== null && axA === axB) return { kind: "unreadable" };
  const value = (h: Half) => {
    const n = Number(h.text);
    return h.letter === "S" || h.letter === "W" ? -n : n;
  };
  const aIsLat = axA !== null ? axA === "lat" : axB !== null ? axB === "lng" : true;
  const lat = value(aIsLat ? a : b);
  const lng = value(aIsLat ? b : a);
  if (validLat(lat) && validLng(lng)) return { kind: "point", lat, lng };
  return {
    kind: "out-of-range",
    axis: validLat(lat) ? "lng" : "lat",
    // Letters already said which number is which; only a bare pair can
    // have been typed the wrong way round.
    swap: !lettered && validLat(lng) && validLng(lat) ? { lat: lng, lng: lat } : null,
  };
}
