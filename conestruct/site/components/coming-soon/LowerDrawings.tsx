import { ZONE_COLOR } from "@/lib/corridor-zones";
import { CLOSE, HOW, SOURCES } from "@/lib/coming-soon-copy";

// The lower half's line drawings (coming-soon-gate R15, R18;
// design/FullPage.dc.html — reference, not source).  Same geometry rule
// as PlanDrawing: x in PERCENT of the drawing's width, y in pixels, every
// <text> in a type role, so text keeps its role size at every width.
// Every colour is a class (globals.css, "coming-soon-gate Arc 3").
//
// A2-Q7 applies throughout: strokes the artboard draws in --act-bright
// (01's pin, bracket and flow arrows) are --ink — nothing here is
// clickable.  The artboard's #56718f (no token) is --ink-faint.
//
// Nothing here carries a figure (checkpoint-arc3.md §3): the dimension
// lines in 03 are labelled "taper", "buffer", "spacing", never a value.

const pc = (x: number, w: number) => `${((x / w) * 100).toFixed(2)}%`;

// ── 01: one road drawn three times ────────────────────────────────────
// Each station is 453 of the artboard's 1358 units; y is the artboard's
// ×0.88 (its 300-unit strip drawn 264 px tall).
const S = 453;
const sx = (x: number) => pc(x, S);

function Glyph({ x, y, children }: { x: string; y: number; children: React.ReactNode }) {
  return (
    <svg x={x} y={y} overflow="visible">
      {children}
    </svg>
  );
}

export function StationDrawing({ i }: { i: 0 | 1 | 2 }) {
  const step = HOW.steps[i];
  return (
    <svg className="cs-station-art" width="100%" height="264" aria-hidden="true">
      <text className="tr-step" fill="currentColor" x={sx(24)} y="35">
        {step.step}
      </text>
      <line className="cs-road" x1={sx(24)} x2={sx(429)} y1="114" y2="114" />
      <line className="cs-road" x1={sx(24)} x2={sx(429)} y1="185" y2="185" />
      <line className="cs-lane cs-lane-sm" x1={sx(24)} x2={sx(429)} y1="150" y2="150" />
      {i < 2 && (
        <>
          <line className="cs-station-div" x1="100%" x2="100%" y1="21" y2="243" />
          <Glyph x="100%" y={79}>
            <path className="cs-call cs-station-flow" d="M-12 0H12M6 -6L12 0L6 6" />
          </Glyph>
        </>
      )}
      {i === 0 && (
        <>
          <line className="cs-call" x1="50%" x2="50%" y1="167" y2="88" />
          <Glyph x="50%" y={0}>
            <circle className="cs-call cs-pin" cy="81" r="7" />
            <circle className="cs-call-dot" cy="167" r="3.5" />
          </Glyph>
        </>
      )}
      {i === 1 && (
        <>
          <rect className="cs-box" x={sx(157)} y="155" width={pc(140, S)} height="26" />
          <text className="tr-section" fill="currentColor" x="50%" y="172" textAnchor="middle">
            {SOURCES.detail.work}
          </text>
          <line className="cs-call" x1={sx(157)} x2={sx(157)} y1="195" y2="202" />
          <line className="cs-call" x1={sx(157)} x2={sx(297)} y1="202" y2="202" />
          <line className="cs-call" x1={sx(297)} x2={sx(297)} y1="195" y2="202" />
        </>
      )}
      {i === 2 && (
        <>
          {(
            [
              [34, 89, ZONE_COLOR.advance_warning],
              [89, 179, ZONE_COLOR.transition],
              [179, 244, ZONE_COLOR.buffer],
              [244, 349, ZONE_COLOR.work_zone],
              [349, 409, ZONE_COLOR.downstream],
            ] as const
          ).map(([a, b, c]) => (
            <rect key={a} className="cs-station-band" x={sx(a)} y="187" width={pc(b - a, S)} height="4" fill={c} />
          ))}
          {[44.5, 70.5].map((x) => (
            <Glyph key={x} x={sx(x)} y={199}>
              <rect className="cs-sign" x="-4.5" y="-4.5" width="9" height="9" transform="rotate(45)" />
            </Glyph>
          ))}
          <rect className="cs-box" x={sx(244)} y="155" width={pc(105, S)} height="26" />
          {(
            [
              [96.5, 181.7],
              [116.5, 174.7],
              [136.5, 167.6],
              [156.5, 160.6],
              [176.5, 153.6],
              [246.5, 150],
              [271.5, 150],
              [296.5, 150],
              [321.5, 150],
              [346.5, 150],
              [368.5, 162.4],
              [388.5, 176.4],
            ] as const
          ).map(([x, y]) => (
            <Glyph key={x} x={sx(x)} y={y}>
              <rect className="cs-dev" x="-2.5" y="-2.5" width="5" height="5" />
            </Glyph>
          ))}
        </>
      )}
      <text className="tr-prov" fill="currentColor" x="50%" y={i === 0 ? 216 : 222} textAnchor="middle">
        {step.label}
      </text>
    </svg>
  );
}

// ── 02: the four outputs as paper stacks ──────────────────────────────
// 322 × 220 units; the top sheet (.cs-s1) carries the drawing.  The
// hover is PaperStack's class toggle plus globals.css.  R21: each card
// moves its own way, and its sequenced marks (class cs-seq, --i their
// place in the sequence) replay in turn: 1 the taper devices appear, 2
// the amount bars fill ending on the total, 3 the citation boxes draw,
// 4 the numbered squares fill 1 → 4.
type Seq = React.CSSProperties & { "--i": number };
const seq = (i: number): Seq => ({ "--i": i });
const P = 322;
const px = (x: number) => pc(x, P);

function Bar({
  x,
  y,
  w,
  h,
  cls,
  i,
  draw = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  cls: string;
  i?: number;
  draw?: boolean;
}) {
  return (
    <rect
      className={cls}
      x={px(x)}
      y={y}
      width={px(w)}
      height={h}
      style={i === undefined ? undefined : seq(i)}
      pathLength={draw ? 1 : undefined}
    />
  );
}

function Hair({ y, cls = "cs-doc-line" }: { y: number; cls?: string }) {
  return <line className={cls} x1={px(36)} x2={px(254)} y1={y} y2={y} />;
}

function Sheet1({ i }: { i: 0 | 1 | 2 | 3 }) {
  if (i === 0)
    return (
      <>
        <line className="cs-road" x1={px(36)} x2={px(254)} y1="70" y2="70" />
        <line className="cs-road" x1={px(36)} x2={px(254)} y1="120" y2="120" />
        <line className="cs-lane cs-lane-xs" x1={px(36)} x2={px(254)} y1="95" y2="95" />
        {(
          [
            [92, 114],
            [108, 108],
            [124, 102],
            [140, 96],
            [172, 92],
            [196, 92],
            [220, 92],
          ] as const
        ).map(([x, y], k) =>
          // The first four are the taper's: they appear one after another.
          k < 4 ? (
            <rect
              key={x}
              className="cs-dev cs-seq cs-seq-appear"
              style={seq(k)}
              x={px(x)}
              y={y}
              width="4"
              height="4"
            />
          ) : (
            <rect key={x} className="cs-dev" x={px(x)} y={y} width="4" height="4" />
          ),
        )}
        <Bar cls="cs-hole" x={170} y={99} w={54} h={18} />
        {(
          [
            [36, 56, ZONE_COLOR.advance_warning],
            [92, 52, ZONE_COLOR.transition],
            [144, 26, ZONE_COLOR.buffer],
            [170, 54, ZONE_COLOR.work_zone],
          ] as const
        ).map(([x, w, c]) => (
          <rect key={x} x={px(x)} y="124" width={px(w)} height="3" fill={c} />
        ))}
        <Bar cls="cs-doc" x={176} y={150} w={78} h={34} />
        <line className="cs-doc-line" x1={px(176)} x2={px(254)} y1="161" y2="161" />
        <line className="cs-doc-line" x1={px(176)} x2={px(254)} y1="172" y2="172" />
      </>
    );
  if (i === 1)
    return (
      <>
        {[52, 74, 96, 118, 140].map((y) => (
          <Hair key={y} y={y} />
        ))}
        {(
          [
            [60, 90],
            [82, 70],
            [104, 100],
            [126, 60],
          ] as const
        ).map(([y, w]) => (
          <Bar key={y} cls="cs-bar" x={36} y={y} w={w} h={6} />
        ))}
        {(
          [
            [214, 60, 40],
            [222, 82, 32],
            [210, 104, 44],
            [226, 126, 28],
          ] as const
        ).map(([x, y, w], k) => (
          <Bar key={y} cls="cs-bar-dim cs-seq cs-seq-fill" i={k} x={x} y={y} w={w} h={6} />
        ))}
        <Hair y={156} cls="cs-road" />
        <Bar cls="cs-dev" x={36} y={166} w={80} h={8} />
        <Bar cls="cs-bar-dim cs-seq cs-seq-fill" i={4} x={200} y={166} w={54} h={8} />
      </>
    );
  if (i === 2)
    return (
      <>
        {(
          [
            [62, 55, 120],
            [88, 81, 96],
            [114, 107, 130],
            [140, 133, 84],
            [166, 159, 110],
          ] as const
        ).map(([ty, y, w], k) => (
          <g key={y}>
            <text className="tr-step" fill="currentColor" x={px(36)} y={ty}>
              §
            </text>
            <Bar cls="cs-bar" x={52} y={y} w={w} h={6} />
            <Bar cls="cs-hollow cs-seq cs-seq-draw" i={k} draw x={196} y={y - 4} w={58} h={14} />
          </g>
        ))}
      </>
    );
  return (
    <>
      {(
        [
          ["1", 62, 55, 140],
          ["2", 92, 85, 110],
          ["3", 122, 115, 150],
          ["4", 152, 145, 96],
        ] as const
      ).map(([n, ty, y, w], k) => (
        <g key={n}>
          <text className="tr-step" fill="currentColor" x={px(36)} y={ty}>
            {n}
          </text>
          <rect className="cs-dev cs-seq cs-seq-ink" style={seq(k)} x={px(54)} y={y} width="6" height="6" />
          <Bar cls="cs-bar" x={70} y={y} w={w} h={6} />
        </g>
      ))}
    </>
  );
}

export function StackArt({ i }: { i: 0 | 1 | 2 | 3 }) {
  return (
    <svg className="cs-stack-art" width="100%" height="220" aria-hidden="true">
      <g className="cs-s3">
        <rect className="cs-sheet-under" x={px(36)} y="18" width={px(250)} height="190" />
      </g>
      <g className="cs-s2">
        <rect className="cs-sheet-under" x={px(28)} y="12" width={px(250)} height="190" />
      </g>
      <g className="cs-s1">
        <rect className="cs-box" x={px(20)} y="6" width={px(250)} height="190" />
        <Sheet1 i={i} />
        <line className="cs-doc-title" x1={px(36)} x2={px(110)} y1="26" y2="26" />
      </g>
    </svg>
  );
}

// ── 03: the taper-and-buffer detail ───────────────────────────────────
// 856 units wide, 360 px tall.  The road, then the dimensions BELOW it
// (R15), then one note with three leaders.
const D = 856;
const dx = (x: number) => pc(x, D);

export function DetailDrawing() {
  const d = SOURCES.detail;
  return (
    <svg className="cs-detail-art" width="100%" height="360" role="img" aria-label={d.aria}>
      <text className="tr-step" fill="currentColor" x={dx(24)} y="32">
        {d.label}
      </text>
      <text className="tr-prov" fill="currentColor" x={dx(832)} y="32" textAnchor="end">
        {d.scale}
      </text>
      <line className="cs-road" x1={dx(24)} x2={dx(832)} y1="170" y2="170" />
      <line className="cs-road" x1={dx(24)} x2={dx(832)} y1="250" y2="250" />
      <line className="cs-lane cs-lane-md" x1={dx(24)} x2={dx(832)} y1="210" y2="210" />
      {(
        [
          [120, 243],
          [170, 233],
          [220, 223],
          [270, 213],
          [320, 207],
          [560, 207],
          [610, 207],
          [660, 207],
          [710, 207],
        ] as const
      ).map(([x, y]) => (
        <rect key={x} className="cs-dev" x={dx(x)} y={y} width="6" height="6" />
      ))}
      <rect className="cs-box" x={dx(560)} y="216" width={dx(200)} height="30" />
      <text className="tr-section" fill="currentColor" x={dx(660)} y="235" textAnchor="middle">
        {d.work}
      </text>
      {[123, 323, 563, 663, 713].map((x) => (
        <line key={x} className="cs-dim-line" x1={dx(x)} x2={dx(x)} y1="256" y2="280" />
      ))}
      <line className="cs-dim-line" x1={dx(123)} x2={dx(563)} y1="272" y2="272" />
      <line className="cs-dim-line" x1={dx(663)} x2={dx(713)} y1="272" y2="272" />
      {([223, 443, 688] as const).map((x, k) => (
        <text key={x} className="tr-prov cs-dim-text" fill="currentColor" x={dx(x)} y="294" textAnchor="middle">
          {d.dims[k]}
        </text>
      ))}
      {[223, 443, 688].map((x) => (
        <line key={x} className="cs-leader" x1={dx(443)} y1="322" x2={dx(x)} y2="300" />
      ))}
      <circle className="cs-leader-dot" cx={dx(443)} cy="322" r="3" />
      <text className="tr-prov cs-on-ink cs-detail-note" fill="currentColor" x={dx(443)} y="344" textAnchor="middle">
        {d.note}
      </text>
    </svg>
  );
}

// ── 04: the phone and the laptop (fixed size, no text) ────────────────
export function PhoneArt() {
  return (
    <svg className="cs-who-art" width="140" height="200" viewBox="0 0 140 200" aria-hidden="true">
      <rect className="cs-device-frame" x="30" y="10" width="80" height="170" />
      <path className="cs-road" d="M40 60H100M40 100H100" />
      <path className="cs-lane cs-lane-2xs" d="M40 80H100" />
      <rect className="cs-box" x="66" y="84" width="26" height="12" />
      <rect className="cs-dev" x="48" y="94" width="3" height="3" />
      <rect className="cs-dev" x="56" y="88" width="3" height="3" />
      <rect className="cs-dev" x="62" y="82" width="3" height="3" />
      <rect className="cs-device-key" x="40" y="140" width="60" height="22" />
    </svg>
  );
}

export function LaptopArt() {
  return (
    <svg className="cs-who-art" width="180" height="200" viewBox="0 0 180 200" aria-hidden="true">
      <rect className="cs-device-frame" x="14" y="40" width="152" height="100" />
      <path className="cs-road" d="M0 150H180" />
      <path className="cs-doc-line" d="M26 58H154" />
      {(
        [
          [68, 60],
          [82, 46],
          [96, 70],
          [110, 40],
        ] as const
      ).map(([y, w]) => (
        <rect key={y} className="cs-bar" x="26" y={y} width={w} height="5" />
      ))}
      {(
        [
          [126, 68, 28],
          [132, 82, 22],
          [122, 96, 32],
          [134, 110, 20],
        ] as const
      ).map(([x, y, w]) => (
        <rect key={y} className="cs-bar-dim" x={x} y={y} width={w} height="5" />
      ))}
    </svg>
  );
}

// ── Close: the drawn Colorado map (R18) ───────────────────────────────
// Plotted equirectangular from lat/long into a 286 × 210 box
// (−109.05°…−102.05°, 37°…41°); every city within 2 px of its true
// position (checkpoint-arc3.md §3).  A drawing, named as one (A3-Q4).
// In CLOSE.map.cities order: dot x, dot y, label x, label y.
const CITIES: readonly (readonly [number, number, number, number])[] = [
  [170.2, 29.5, 180.2, 35.5], // fort collins
  [180.8, 121.9, 190.8, 127.9], // colorado springs
  [189.4, 152.4, 199.4, 158.4], // pueblo
  [28.4, 109.8, 36.4, 125.8], // grand junction
  [55.8, 203.8, 63.8, 208.8], // durango
];

export function ColoradoMap() {
  const m = CLOSE.map;
  return (
    <svg className="cs-map" width="320" height="236" viewBox="0 0 320 236" role="img" aria-label={m.aria}>
      <defs>
        <pattern id="cs-map-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path className="cs-map-hatch" d="M0 0V6" />
        </pattern>
        <clipPath id="cs-map-clip">
          <rect x="10" y="10" width="286" height="210" />
        </clipPath>
      </defs>
      <g clipPath="url(#cs-map-clip)">
        <path
          d="M10 10 L164.0 10.0 L167.3 46.8 L166.5 76.1 L177.5 120.3 L171.4 157.0 L175.5 220.0 L10 220 Z"
          fill="url(#cs-map-hatch)"
        />
        <path
          className="cs-map-range"
          d="M164.0 10.0 L167.3 46.8 L166.5 76.1 L177.5 120.3 L171.4 157.0 L175.5 220.0"
        />
        <path
          className="cs-map-road"
          d="M177.5 10.0 L176.3 31.5 L175.9 76.1 L182.8 123.9 L191.4 154.4 L195.5 211.1 L197.1 220.0"
        />
        <path
          className="cs-map-road"
          d="M10.0 108.7 L30.4 111.8 L80.7 86.1 L119.5 81.4 L163.2 78.2 L175.9 76.1 L229.0 101.4 L296.0 99.3"
        />
      </g>
      <rect className="cs-map-road" x="10" y="10" width="286" height="210" />
      {CITIES.map(([x, y, lx, ly], k) => (
        <g key={m.cities[k]}>
          <rect className="cs-map-city" x={x} y={y} width="4" height="4" />
          <text className="tr-step" fill="currentColor" x={lx} y={ly}>
            {m.cities[k]}
          </text>
        </g>
      ))}
      <path className="cs-map-pin" d="M175.9 76.1V58.1" />
      <circle className="cs-map-pin cs-pin" cx="175.9" cy="52.1" r="6" />
      <circle className="cs-map-pin-dot" cx="175.9" cy="76.1" r="3" />
      <text className="tr-prov cs-on-ink" fill="currentColor" x="185.9" y="56.1">
        {m.pinned}
      </text>
      <text className="tr-step" fill="currentColor" x="186" y="20">
        {m.roads[0]}
      </text>
      <text className="tr-step" fill="currentColor" x="87.8" y="70.2">
        {m.roads[1]}
      </text>
      <text className="tr-step" fill="currentColor" x="288" y="212" textAnchor="end">
        {m.state}
      </text>
    </svg>
  );
}
