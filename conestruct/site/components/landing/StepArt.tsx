// The lean page's three "How it works" pictures, inlined from
// design/landing-v2/lean-page/svg/ so their animation classes (a-drop,
// a-pop, a-slide, a-rise, a-fade, a-draw) reach the page's CSS.  Every
// hex is swapped for the workbench token it names (globals.css, "landing
// v2"); geometry, delays and copy are the design file's.  Decorative:
// aria-hidden, the step's own words carry the meaning.

const MONO = { fontFamily: "var(--font-mono)" };
const SANS = { fontFamily: "var(--font-sans)" };
const delay = (s: string) => ({ animationDelay: s });

export function StepPin() {
  return (
    <svg viewBox="0 0 320 180" width="100%" aria-hidden="true" className="lv-step-art">
      <rect width="320" height="180" fill="var(--da-ground)" />
      <rect x="0" y="62" width="320" height="64" fill="var(--lv-road)" />
      <line x1="0" y1="93" x2="320" y2="93" stroke="var(--lv-center)" strokeWidth="1.2" />
      <line x1="0" y1="96" x2="320" y2="96" stroke="var(--lv-center)" strokeWidth="1.2" />
      <line x1="0" y1="78" x2="320" y2="78" stroke="var(--paper-line)" strokeDasharray="10 8" />
      <line x1="0" y1="111" x2="320" y2="111" stroke="var(--paper-line)" strokeDasharray="10 8" />
      <rect x="150" y="0" width="26" height="180" fill="var(--lv-road)" />
      <path className="a-draw" pathLength={1} d="M120 116 h120" stroke="var(--act)" strokeWidth="3" style={delay(".75s")} />
      <circle className="a-pop" cx="120" cy="116" r="4" fill="var(--act)" style={delay(".6s")} />
      <g className="a-drop" style={delay(".25s")}>
        <path
          d="M120 70 c-11 0 -18 8 -18 18 c0 13 18 28 18 28 s18 -15 18 -28 c0 -10 -7 -18 -18 -18 z"
          fill="var(--act)"
        />
        <circle cx="120" cy="88" r="6" fill="var(--da-ground)" />
      </g>
      <text className="a-fade" style={{ ...MONO, ...delay("1.2s") }} x="246" y="121" fontSize="10" fill="var(--ink-faint)">
        1,000 FT
      </text>
    </svg>
  );
}

const READS: { y: number; label: string; value: string; slide: string; mark: string; ok: boolean }[] = [
  { y: 34, label: "Speed", value: "30 mph", slide: "1.30s", mark: "1.55s", ok: true },
  { y: 78, label: "Lanes", value: "2 per side", slide: "1.55s", mark: "1.80s", ok: true },
  { y: 122, label: "Road type", value: "Urban street", slide: "1.80s", mark: "2.35s", ok: false },
];

export function StepCheck() {
  return (
    <svg viewBox="0 0 320 180" width="100%" aria-hidden="true" className="lv-step-art">
      <rect width="320" height="180" fill="var(--da-ground)" />
      {READS.map((r) => (
        <g key={r.label} transform={`translate(24 ${r.y})`}>
          <g className="a-slide" style={delay(r.slide)}>
            <rect width="272" height="34" fill="var(--panel-ground)" stroke="var(--da-hair)" />
            <text x="14" y="22" style={SANS} fontSize="12.5" fill="var(--ink-on-dark)">
              {r.label}
            </text>
            <text x="210" y="22" style={MONO} fontSize="11" fill="var(--ink)" textAnchor="end">
              {r.value}
            </text>
          </g>
          <text
            className="a-pop"
            style={delay(r.mark)}
            x="252"
            y="22"
            fontSize="13"
            fill={r.ok ? "var(--lv-ok)" : "var(--warn)"}
            textAnchor="middle"
          >
            {r.ok ? "✓" : "⚠"}
          </text>
        </g>
      ))}
    </svg>
  );
}

// The cones along the sheet's taper and work zone: [x, y, delay].
const CONES: [number, number, string][] = [
  [107, 116, "3.00s"],
  [117, 112, "3.08s"],
  [127, 108, "3.16s"],
  [137, 104, "3.24s"],
  [147, 104, "3.40s"],
  [159, 104, "3.46s"],
  [171, 104, "3.52s"],
  [183, 104, "3.58s"],
  [195, 104, "3.64s"],
  [207, 104, "3.70s"],
  [219, 104, "3.76s"],
  [231, 104, "3.82s"],
  [243, 104, "3.88s"],
  [255, 104, "3.94s"],
  [267, 104, "4.00s"],
  [279, 104, "4.06s"],
];

export function StepSheet() {
  return (
    <svg viewBox="0 0 320 180" width="100%" aria-hidden="true" className="lv-step-art">
      <rect width="320" height="180" fill="var(--da-ground)" />
      <g className="a-rise" style={delay("2.6s")}>
        <rect x="28" y="20" width="264" height="140" fill="var(--lv-sheet)" />
        <rect x="28" y="20" width="264" height="18" fill="var(--lv-sheet-band)" />
        <rect x="36" y="27" width="90" height="4" fill="var(--lv-sheet-ink)" />
        <rect x="40" y="76" width="244" height="46" fill="var(--lv-sheet-road)" />
        <line x1="40" y1="98" x2="284" y2="98" stroke="var(--lv-sheet-center)" strokeWidth="1" />
      </g>
      <rect
        className="a-fade"
        style={delay("3.0s")}
        x="150"
        y="104"
        width="134"
        height="12"
        fill="var(--lv-sheet-zone)"
        fillOpacity="0.18"
        stroke="var(--lv-sheet-zone)"
        strokeWidth="0.8"
      />
      {CONES.map(([x, y, d]) => (
        <path key={x} className="a-pop" style={delay(d)} d={`M${x} ${y} l3 -7 l3 7 z`} fill="var(--dim)" />
      ))}
      <g className="a-fade" style={delay("2.9s")}>
        <rect x="40" y="132" width="70" height="4" fill="var(--lv-sheet-faint)" />
        <rect x="40" y="140" width="50" height="4" fill="var(--lv-sheet-faint)" />
        <rect x="228" y="130" width="56" height="22" fill="none" stroke="var(--lv-sheet-ink)" />
      </g>
    </svg>
  );
}
