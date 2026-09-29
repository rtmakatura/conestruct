import { ZONE_COLOR, ZONE_LABEL, type CorridorZone } from "@/lib/corridor-zones";
import { DRAWING } from "@/lib/coming-soon-copy";

// The Plan Sheet's drawing (coming-soon-gate R5a, design/PlanSheet*.dc.html
// — reference, not source).  An illustration, not a plan: "not to scale",
// no dimension on it.
//
// What it shows is how the product lays out a right-lane closure (A2-Q5,
// checkpoint-arc2.md §4, src/generation/layout.py): three advance signs,
// a merging taper from the edge to the lane line, the buffer EMPTY
// (layout.py "intentionally empty"), devices along the lane line through
// the work area, and a downstream taper back to the edge.  The design had
// those two the other way round; the product is the authority.
//
// R9: the zone bands and swatches read ZONE_COLOR and ZONE_LABEL — one
// source, imported, never re-typed.  The page is their second consumer.
//
// Geometry: x positions are PERCENTAGES of the drawing's width and y are
// pixels, so the SVG stretches sideways without scaling its text.  Every
// <text> carries a type role (tr-section / tr-prov) — its size is the
// role's, the same at 1440 and at 1024 (the census cannot read SVG
// font-size attributes, so there are none).  A small glyph (sign, device,
// arrow) sits in a nested <svg> at its percentage with a pixel-sized
// shape inside.
//
// R10, R42: the drawing plots itself once on load, like a pen plotter, in
// about 2 s: the three road lines one after another, the travel arrows,
// the signs stroke by stroke, the zone bands left to right, the work
// box, then the devices drop into the taper one after another in traffic
// order, and the callout last.  CSS only (globals.css .cs-draw /
// .cs-stroke / .cs-drop / .cs-fade, each element's own delay inline as
// an animation-delay), and only under prefers-reduced-motion:
// no-preference; otherwise it is static in its end state.  The road
// lines draw through a growing mask, so the dashed lane line keeps its
// dashes; the other strokes carry pathLength="1" so one dash offset
// draws them.  Every end state is the drawing as it stood before R42.

type Geometry = {
  id: string;
  h: number;
  top: number;
  lane: number;
  bot: number;
  bandY: number;
  bandH: number;
  signY: number;
  sign: number;
  post: number;
  dev: number;
  boxY: number;
  boxH: number;
  leaderTop: number;
  arrow: number;
  calloutText: boolean;
};

const WIDE: Geometry = {
  id: "cs-plan-wide",
  h: 240,
  top: 50,
  lane: 110,
  bot: 170,
  bandY: 174,
  bandH: 6,
  signY: 204,
  sign: 12,
  post: 14,
  dev: 6,
  boxY: 116,
  boxH: 50,
  leaderTop: 22,
  arrow: 44,
  calloutText: true,
};

const NARROW: Geometry = {
  id: "cs-plan-narrow",
  h: 170,
  top: 40,
  lane: 80,
  bot: 120,
  bandY: 123,
  bandH: 4,
  signY: 144,
  sign: 9,
  post: 0,
  dev: 5,
  boxY: 84,
  boxH: 32,
  leaderTop: 16,
  arrow: 24,
  calloutText: false,
};

// Traffic order, upstream first (the product's legend order,
// components/bands/BandAerial.tsx LEGEND_ORDER).
const ZONES: readonly (readonly [CorridorZone, number, number])[] = [
  ["advance_warning", 7.82, 40.69],
  ["transition", 40.69, 57.9],
  ["buffer", 57.9, 67.29],
  ["work_zone", 67.29, 86.07],
  ["downstream", 86.07, 93.9],
];

const SIGNS = [14.08, 25.04, 35.99];
const WORK_MID = 76.68;

// R42's plot order, in seconds from load.  The devices start as the work
// box closes and drop 45 ms apart; the last lands at about 2.0 s.
const ROAD_AT = [0, 0.15, 0.3]; // top edge, bottom edge, lane line
const FLOW_AT = 0.4;
const SIGN_AT = 0.5;
const SIGN_STEP = 0.12;
const BAND_AT = 0.7;
const BAND_STEP = 0.06;
const BOX_AT = 0.85;
const DEVICE_AT = 1.0;
const DEVICE_STEP = 0.045;
const CALLOUT_AT = 1.85;
const at = (s: number) => ({ animationDelay: `${Math.round(s * 1000)}ms` });

function devices(g: Geometry): [number, number][] {
  const edge = g.bot - 4;
  const out: [number, number][] = [];
  // Merging taper: edge -> lane line across the taper zone.
  for (let i = 0; i < 8; i++) out.push([40.93 + i * 2.403, edge - (i * (edge - g.lane)) / 7]);
  // Along the lane line through the work area (layout.py work-zone tangent).
  for (let i = 0; i < 7; i++) out.push([67.29 + i * 3.13, g.lane]);
  // Downstream taper: lane line -> edge.
  for (let k = 1; k <= 3; k++) out.push([86.07 + k * 2.35, g.lane + (k * (edge - g.lane)) / 3]);
  return out;
}

function Glyph({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <svg x={`${x}%`} y={y} overflow="visible">
      {children}
    </svg>
  );
}

function Drawing({ g, className }: { g: Geometry; className: string }) {
  const s = g.sign;
  return (
    <svg
      className={className}
      width="100%"
      height={g.h}
      role="img"
      aria-label={DRAWING.aria}
    >
      <defs>
        {ROAD_AT.map((t, i) => (
          <mask key={t} id={`${g.id}-draw-${i}`} maskUnits="userSpaceOnUse">
            <rect className="cs-draw" style={at(t)} x="0" y="0" width="100%" height={g.h} fill="white" />
          </mask>
        ))}
      </defs>
      {/* Road: edges and the lane line (decorative), plotted in turn. */}
      <line className="cs-road" mask={`url(#${g.id}-draw-0)`} x1="0" x2="100%" y1={g.top} y2={g.top} />
      <line className="cs-road" mask={`url(#${g.id}-draw-1)`} x1="0" x2="100%" y1={g.bot} y2={g.bot} />
      <line className="cs-lane" mask={`url(#${g.id}-draw-2)`} x1="0" x2="100%" y1={g.lane} y2={g.lane} />
      {/* Direction of travel, both lanes. */}
      {[(g.top + g.lane) / 2, (g.lane + g.bot) / 2].map((y) => (
        <Glyph key={y} x={3.13} y={y}>
          <path
            className="cs-flow cs-stroke"
            style={at(FLOW_AT)}
            pathLength={1}
            d={`M0 0H${g.arrow}M${g.arrow - 8} -6L${g.arrow} 0L${g.arrow - 8} 6`}
          />
        </Glyph>
      ))}
      {/* Zone bands along the closed lane's edge (R9), drawn left to right. */}
      {ZONES.map(([zone, from, to], i) => (
        <rect
          key={zone}
          className="cs-band cs-draw"
          style={at(BAND_AT + i * BAND_STEP)}
          x={`${from}%`}
          y={g.bandY}
          width={`${to - from}%`}
          height={g.bandH}
          fill={ZONE_COLOR[zone]}
        />
      ))}
      {/* Advance warning signs, stroke by stroke. */}
      {SIGNS.map((x, i) => (
        <Glyph key={x} x={x} y={g.signY}>
          <rect
            className="cs-sign cs-stroke"
            style={at(SIGN_AT + i * SIGN_STEP)}
            pathLength={1}
            x={-s / 2}
            y={-s / 2}
            width={s}
            height={s}
            transform="rotate(45)"
          />
          {g.post > 0 && (
            <path
              className="cs-sign cs-stroke"
              style={at(SIGN_AT + i * SIGN_STEP + 0.08)}
              pathLength={1}
              d={`M0 ${s * 0.5}V${s * 0.5 + g.post}`}
            />
          )}
        </Glyph>
      ))}
      {/* The work: its outline plotted, then its fill and word. */}
      <rect
        className="cs-box-fill cs-fade"
        style={at(BOX_AT + 0.2)}
        x={`${ZONES[3][1]}%`}
        y={g.boxY}
        width={`${ZONES[3][2] - ZONES[3][1]}%`}
        height={g.boxH}
      />
      <rect
        className="cs-box-line cs-stroke"
        style={at(BOX_AT)}
        pathLength={1}
        x={`${ZONES[3][1]}%`}
        y={g.boxY}
        width={`${ZONES[3][2] - ZONES[3][1]}%`}
        height={g.boxH}
      />
      <text
        className="tr-section cs-fade"
        style={at(BOX_AT + 0.25)}
        fill="currentColor"
        x={`${WORK_MID}%`}
        y={g.boxY + g.boxH / 2 + 4}
        textAnchor="middle"
      >
        {DRAWING.work}
      </text>
      {/* Channelizing devices: taper, work area, downstream taper — each
          drops into place in turn, in traffic order. */}
      {devices(g).map(([x, y], i) => (
        <Glyph key={`${x}-${y}`} x={x} y={y}>
          <rect
            className="cs-dev cs-drop"
            style={at(DEVICE_AT + i * DEVICE_STEP)}
            x={-g.dev / 2}
            y={-g.dev / 2}
            width={g.dev}
            height={g.dev}
          />
        </Glyph>
      ))}
      {/* The callout on the work (A2-Q7: --ink, not the interactive blue). */}
      <g className="cs-fade" style={at(CALLOUT_AT)}>
        <line className="cs-call" x1={`${WORK_MID}%`} x2={`${WORK_MID}%`} y1={g.boxY} y2={g.leaderTop} />
        <Glyph x={WORK_MID} y={g.boxY}>
          <circle className="cs-call-dot" r={g.calloutText ? 3 : 2.5} />
        </Glyph>
        {g.calloutText ? (
          <>
            <line className="cs-call" x1={`${WORK_MID}%`} x2="73.55%" y1={g.leaderTop} y2={g.leaderTop} />
            <text className="tr-prov cs-on-ink" fill="currentColor" x="72.93%" y={g.leaderTop + 4} textAnchor="end">
              {DRAWING.callout}
            </text>
          </>
        ) : (
          <Glyph x={WORK_MID} y={g.leaderTop - 4}>
            <circle className="cs-call" r={4} />
          </Glyph>
        )}
      </g>
    </svg>
  );
}

// The legend: each zone's colour WITH its word (Rule 13, P9) — the colour
// is decorative, the word carries the meaning.
export function ZoneLegend() {
  return (
    <ul className="cs-legend">
      {ZONES.map(([zone]) => (
        <li key={zone} className="tr-prov cs-legend-item">
          <span className="cs-swatch" style={{ background: ZONE_COLOR[zone] }} aria-hidden="true" />
          {ZONE_LABEL[zone]}
        </li>
      ))}
    </ul>
  );
}

export function PlanDrawing() {
  return (
    <div className="cs-drawing">
      <div className="cs-drawing-head">
        <span className="tr-step">{DRAWING.label}</span>
        <span className="tr-prov">{DRAWING.scale}</span>
      </div>
      <div className="cs-drawing-art">
        <Drawing g={WIDE} className="cs-wide" />
        <Drawing g={NARROW} className="cs-narrow" />
      </div>
      <div className="cs-drawing-foot">
        <ZoneLegend />
        <span className="tr-prov cs-only-wide">{DRAWING.note}</span>
        <span className="tr-prov cs-on-ink cs-only-narrow">{DRAWING.callout}</span>
      </div>
    </div>
  );
}
