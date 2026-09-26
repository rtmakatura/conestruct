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
// R10: the road lines draw, then signs, devices and zone bands fade in,
// once, ~1.5 s — CSS only (globals.css .cs-draw / .cs-fade), and only
// under prefers-reduced-motion: no-preference; otherwise it is static.
// The lines draw through a growing mask, so the dashed lane line keeps
// its dashes while it draws.

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
const ZONES: readonly (readonly [CorridorZone, number, number, string])[] = [
  ["advance_warning", 7.82, 40.69, ".7s"],
  ["transition", 40.69, 57.9, ".8s"],
  ["buffer", 57.9, 67.29, ".9s"],
  ["work_zone", 67.29, 86.07, "1s"],
  ["downstream", 86.07, 93.9, "1.1s"],
];

const SIGNS = [14.08, 25.04, 35.99];
const WORK_MID = 76.68;

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
        <mask id={`${g.id}-draw`} maskUnits="userSpaceOnUse">
          <rect className="cs-draw" x="0" y="0" width="100%" height={g.h} fill="white" />
        </mask>
      </defs>
      {/* Road: edges and the lane line (decorative). */}
      <g mask={`url(#${g.id}-draw)`}>
        <line className="cs-road" x1="0" x2="100%" y1={g.top} y2={g.top} />
        <line className="cs-road" x1="0" x2="100%" y1={g.bot} y2={g.bot} />
        <line className="cs-lane" x1="0" x2="100%" y1={g.lane} y2={g.lane} />
      </g>
      {/* Direction of travel, both lanes. */}
      {[(g.top + g.lane) / 2, (g.lane + g.bot) / 2].map((y) => (
        <Glyph key={y} x={3.13} y={y}>
          <path
            className="cs-flow"
            d={`M0 0H${g.arrow}M${g.arrow - 8} -6L${g.arrow} 0L${g.arrow - 8} 6`}
          />
        </Glyph>
      ))}
      {/* Zone bands along the closed lane's edge (R9). */}
      {ZONES.map(([zone, from, to, delay]) => (
        <rect
          key={zone}
          className="cs-fade"
          style={{ animationDelay: delay }}
          x={`${from}%`}
          y={g.bandY}
          width={`${to - from}%`}
          height={g.bandH}
          fill={ZONE_COLOR[zone]}
        />
      ))}
      {/* Advance warning signs. */}
      <g className="cs-fade" style={{ animationDelay: ".4s" }}>
        {SIGNS.map((x) => (
          <Glyph key={x} x={x} y={g.signY}>
            <rect className="cs-sign" x={-s / 2} y={-s / 2} width={s} height={s} transform="rotate(45)" />
            {g.post > 0 && <path className="cs-sign" d={`M0 ${s * 0.5}V${s * 0.5 + g.post}`} />}
          </Glyph>
        ))}
      </g>
      {/* The work. */}
      <g className="cs-fade" style={{ animationDelay: "1.1s" }}>
        <rect
          className="cs-box"
          x={`${ZONES[3][1]}%`}
          y={g.boxY}
          width={`${ZONES[3][2] - ZONES[3][1]}%`}
          height={g.boxH}
        />
        <text
          className="tr-section"
          fill="currentColor"
          x={`${WORK_MID}%`}
          y={g.boxY + g.boxH / 2 + 4}
          textAnchor="middle"
        >
          {DRAWING.work}
        </text>
      </g>
      {/* Channelizing devices: taper, work area, downstream taper. */}
      <g className="cs-fade" style={{ animationDelay: ".9s" }}>
        {devices(g).map(([x, y]) => (
          <Glyph key={`${x}-${y}`} x={x} y={y}>
            <rect className="cs-dev" x={-g.dev / 2} y={-g.dev / 2} width={g.dev} height={g.dev} />
          </Glyph>
        ))}
      </g>
      {/* The callout on the work (A2-Q7: --ink, not the interactive blue). */}
      <g className="cs-fade" style={{ animationDelay: "1.3s" }}>
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
