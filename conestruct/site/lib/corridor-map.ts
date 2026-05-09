// Mapbox Static Images URL builder for corridor previews.
//
// The Static Images API can render any number of `path-{stroke}+{color}-{opacity}({polyline})`
// overlays on top of a tile style.  We render five colored segments along
// the corridor (advance warning → transition → buffer → work zone →
// downstream) plus an anchor pin.
//
// The polyline parameter uses Google's polyline-encoding format (precision
// 5).  Mapbox URL-encodes a leading `(` then the encoded geometry; we
// build that string explicitly so that a single overlay never grows past
// the per-overlay byte budget.
//
// MAPBOX_TOKEN must come from the server (`process.env.MAPBOX_TOKEN`);
// the public API for this module is consumed by the route handler at
// `app/api/corridor-map/route.ts`, which never returns the token to the
// browser.

import { destinationPoint, M_PER_FT } from "./geodesy";

export interface CorridorSpec {
  anchorLat: number;
  anchorLng: number;
  bearingDeg: number;
  advanceWarningFt: number;
  taperFt: number;
  bufferFt: number;
  workZoneFt: number;
  downstreamTaperFt: number;
}

export interface CorridorMapOptions {
  width?: number;
  height?: number;
  style?: string;
  retina?: boolean;
  // Anchor pin colour, hex without leading `#`.  Default cyan to match
  // the rest of the conestruct palette.
  pinColor?: string;
  // Path stroke widths in pixels.  Default 5.
  strokeWidth?: number;
}

const DEFAULTS: Required<Omit<CorridorMapOptions, "pinColor">> & { pinColor: string } = {
  width: 600,
  height: 300,
  style: "satellite-streets-v12",
  retina: true,
  pinColor: "44d3ff",
  strokeWidth: 5,
};

// Zone colours (no leading `#`).  Brighter at the upstream end so the
// motorist's first encounter (advance warning) reads loudest in the
// preview, dimmer at the downstream taper.
const ZONE_COLORS = {
  advance_warning: "ffd166", // amber
  transition: "f3722c", // orange
  buffer: "ff7a00", // deeper orange (deceleration)
  work_zone: "1ec8a5", // teal
  downstream: "8a8a8a", // muted gray
} as const;

// Sample density for path overlays: more samples = smoother curve in
// theory, but our segments are straight lines on a great-circle so 2
// points is enough for the math.  We render 4 to give the renderer a
// midpoint anchor in case it ever wants to split the line for label
// avoidance.
const SAMPLES_PER_SEGMENT = 4;

interface SegmentSpec {
  zone: keyof typeof ZONE_COLORS;
  startStationFt: number;
  endStationFt: number;
}

function segmentsFromCorridor(c: CorridorSpec): SegmentSpec[] {
  // Stations are measured from the anchor (downstream end) along
  // ``bearingDeg`` toward the upstream end — same convention as the
  // Python WorkCorridor.  Walking from station 0:
  //
  //   0 → downstream taper → work zone → buffer → transition →
  //   advance warning → total length.
  //
  // Render each segment as its own overlay so each gets its own colour.
  let cursor = 0;
  const out: SegmentSpec[] = [];
  for (const [zone, length] of [
    ["downstream", c.downstreamTaperFt],
    ["work_zone", c.workZoneFt],
    ["buffer", c.bufferFt],
    ["transition", c.taperFt],
    ["advance_warning", c.advanceWarningFt],
  ] as const) {
    if (length <= 0) {
      cursor += length;
      continue;
    }
    out.push({
      zone,
      startStationFt: cursor,
      endStationFt: cursor + length,
    });
    cursor += length;
  }
  return out;
}

function samplePoints(c: CorridorSpec, seg: SegmentSpec): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= SAMPLES_PER_SEGMENT; i++) {
    const station =
      seg.startStationFt + ((seg.endStationFt - seg.startStationFt) * i) / SAMPLES_PER_SEGMENT;
    const distM = station * M_PER_FT;
    const [lat, lng] = destinationPoint(c.anchorLat, c.anchorLng, c.bearingDeg, distM);
    pts.push([lat, lng]);
  }
  return pts;
}

// Google polyline encoder, precision 5.  Returns the raw encoded string
// (caller is responsible for URL-encoding).
export function encodePolyline(points: Array<[number, number]>): string {
  let prevLat = 0;
  let prevLng = 0;
  let out = "";
  for (const [lat, lng] of points) {
    const eLat = Math.round(lat * 1e5);
    const eLng = Math.round(lng * 1e5);
    out += encodeSignedNumber(eLat - prevLat);
    out += encodeSignedNumber(eLng - prevLng);
    prevLat = eLat;
    prevLng = eLng;
  }
  return out;
}

function encodeSignedNumber(num: number): string {
  // Google polyline: shift left 1, invert if negative, then chunk into
  // 5-bit groups, OR with 0x20 for continuation, ASCII-shift +63.
  let sgn = num << 1;
  if (num < 0) sgn = ~sgn;
  let out = "";
  while (sgn >= 0x20) {
    out += String.fromCharCode((0x20 | (sgn & 0x1f)) + 63);
    sgn >>>= 5;
  }
  out += String.fromCharCode(sgn + 63);
  return out;
}

function pathOverlay(
  color: string,
  strokeWidth: number,
  encoded: string,
): string {
  // The Static Images API path syntax:
  //   path-{strokeWidth}+{color}-{opacity}({encodedPolyline})
  // Opacity defaults to 1 when omitted.  We URL-encode the polyline
  // body because polyline encoding can include `?`, `\\`, and other
  // characters the Mapbox parser would mis-tokenize.
  return `path-${strokeWidth}+${color}(${encodeURIComponent(encoded)})`;
}

function pinOverlay(lat: number, lng: number, color: string): string {
  // ``pin-l-{label}+{color}({lng},{lat})`` — large pin, no label letter.
  return `pin-l+${color}(${lng.toFixed(6)},${lat.toFixed(6)})`;
}

export function corridorMapUrl(
  corridor: CorridorSpec,
  mapboxToken: string,
  options: CorridorMapOptions = {},
): string {
  const opts = { ...DEFAULTS, ...options };

  const segments = segmentsFromCorridor(corridor);
  const overlays: string[] = [];

  for (const seg of segments) {
    const pts = samplePoints(corridor, seg);
    const encoded = encodePolyline(pts);
    overlays.push(pathOverlay(ZONE_COLORS[seg.zone], opts.strokeWidth, encoded));
  }

  // Anchor pin last so it draws on top of the path overlays.
  overlays.push(pinOverlay(corridor.anchorLat, corridor.anchorLng, opts.pinColor));

  const overlayPart = overlays.join(",");
  const sizePart = `${opts.width}x${opts.height}${opts.retina ? "@2x" : ""}`;
  const auto = "auto"; // Mapbox auto-fits the bbox to all overlays.

  return (
    `https://api.mapbox.com/styles/v1/mapbox/${opts.style}/static/` +
    `${overlayPart}/${auto}/${sizePart}` +
    `?access_token=${encodeURIComponent(mapboxToken)}`
  );
}

// Public-facing helper for pure preview overlays without rendering — used
// by the API route to sanity-check the URL length before returning.
export function buildOverlayList(corridor: CorridorSpec): string[] {
  return segmentsFromCorridor(corridor).map((seg) => `${seg.zone}@${seg.endStationFt.toFixed(0)}ft`);
}
