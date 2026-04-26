/* global React */
const { useState, useEffect, useRef } = React;

// ——— Animated scenario card: types out a scenario, then resolves to "GENERATED" ———
function ScenarioCard({ phase, typed, progress }) {
  return (
    <div className="scenario-card">
      <div className="scenario-card-header">
        <span>SCENARIO INPUT</span>
        <span className="live-dot"></span>
      </div>
      <div className="scenario-card-body">
        {SCENARIO_FIELDS.map((f, i) => {
          const isActive = i === typed.activeIdx;
          const isDone = i < typed.activeIdx;
          if (i > typed.activeIdx) return null;
          return (
            <div key={f.key} className="typed-line">
              <span className="key">{f.key} </span>
              <span className="val">{isDone ? f.val : typed.partial}</span>
              {isActive && <span className="cursor"></span>}
            </div>
          );
        })}
      </div>
      <div className="scenario-progress">
        <span>{phase === 'typing' ? 'INPUT' : phase === 'generating' ? 'GENERATING' : 'READY'}</span>
        <div className="progress-bar-wrap">
          <div className="progress-bar" style={{ width: progress + '%' }}></div>
        </div>
        <span>{Math.round(progress)}%</span>
      </div>
    </div>
  );
}

const SCENARIO_FIELDS = [
  { key: 'road_type:',   val: 'rural divided hwy' },
  { key: 'speed_limit:', val: '65 mph' },
  { key: 'closure:',     val: 'right lane' },
  { key: 'length:',      val: '0.4 mi' },
  { key: 'lanes_dir:',   val: '2' },
  { key: 'project:',     val: 'I-25 MM 184' },
];

// ——— The plan sheet (animated SVG schematic) ———
function PlanSheet({ revealStage }) {
  // revealStage: 0 = skeleton, 1 = roadway, 2 = devices, 3 = dimensions, 4 = signs
  return (
    <div className="plan-sheet">
      <div className="plan-sheet-grid"></div>
      <div className="plan-titleblock">
        <span className="tb-title">METHOD OF HANDLING TRAFFIC</span>
        <span className="tb-meta">SHT 1 OF 1 · MUTCD 2023 · CDOT S-630-1</span>
      </div>

      <div className="schematic">
        <Schematic revealStage={revealStage} />
        <div className={`skeleton-overlay ${revealStage > 0 ? 'hidden' : ''}`}>
          <span className="spinner"></span>
          COMPUTING TAPER · SPACING · SIGN PLACEMENT
        </div>
      </div>

      <div className="plan-bottom">
        <div className="plan-legend">
          <h4>Legend</h4>
          <div className="legend-item"><span className="legend-swatch cone"></span>Channelizing device (cone)</div>
          <div className="legend-item"><span className="legend-swatch sign"></span>Advance warning sign</div>
          <div className="legend-item"><span className="legend-swatch arrow"></span>Arrow board</div>
        </div>
        <div className="plan-notes">
          <h4>Notes</h4>
          <div className="notes-row"><span className="label">Taper L</span><span>650 ft</span></div>
          <div className="notes-row"><span className="label">Buffer B</span><span>645 ft</span></div>
          <div className="notes-row"><span className="label">Spacing</span><span>65 ft o.c.</span></div>
          <div className="notes-row"><span className="label">Devices</span><span>34 cones · 5 signs</span></div>
        </div>
      </div>
    </div>
  );
}

function Schematic({ revealStage }) {
  // 11x8.5 plan sheet, schematic occupies center band
  // viewBox 1100 x 380 — long horizontal scene, traffic flows left → right
  const cls = (n) => 's-fade ' + (revealStage >= n ? 'in' : '');

  // taper cones: 7 cones forming the merging taper, then a series along the closed lane
  const taperCones = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    const x = 360 + t * 220;
    const y = 220 - t * 50; // taper from outer lane edge inward
    return { x, y, key: 't' + i };
  });
  const lineCones = Array.from({ length: 10 }, (_, i) => ({
    x: 590 + i * 38, y: 170, key: 'l' + i,
  }));

  return (
    <svg className="taper-svg" viewBox="0 0 1100 380" preserveAspectRatio="xMidYMid meet"
         style={{ width: '100%', height: '100%' }}>

      {/* Roadway */}
      <g className={cls(1)} style={{ transitionDelay: '0ms' }}>
        {/* shoulder + lanes (divided hwy: 2 lanes each direction with median) */}
        <rect x="0" y="120" width="1100" height="55" fill="#D9D3CA" />
        <rect x="0" y="175" width="1100" height="55" fill="#CFC8BD" />
        {/* median */}
        <rect x="0" y="230" width="1100" height="14" fill="#ECE4D9" />
        <rect x="0" y="244" width="1100" height="55" fill="#CFC8BD" />
        <rect x="0" y="299" width="1100" height="55" fill="#D9D3CA" />
        {/* yellow median lines */}
        <line x1="0" y1="232" x2="1100" y2="232" stroke="#E5B83A" strokeWidth="1.4" />
        <line x1="0" y1="242" x2="1100" y2="242" stroke="#E5B83A" strokeWidth="1.4" />
        {/* lane divider dashed */}
        <line x1="0" y1="175" x2="1100" y2="175" stroke="#FAF6F0" strokeWidth="1.5" strokeDasharray="14 10" />
        <line x1="0" y1="299" x2="1100" y2="299" stroke="#FAF6F0" strokeWidth="1.5" strokeDasharray="14 10" />
        {/* shoulder edges */}
        <line x1="0" y1="120" x2="1100" y2="120" stroke="#9A8E7A" strokeWidth="1" />
        <line x1="0" y1="354" x2="1100" y2="354" stroke="#9A8E7A" strokeWidth="1" />

        {/* travel direction arrow (top travel direction → right) */}
        <g opacity="0.55">
          <path d="M 60 148 L 90 148 L 86 144 M 90 148 L 86 152" stroke="#1B2838" strokeWidth="1.2" fill="none"/>
          <path d="M 60 207 L 90 207 L 86 203 M 90 207 L 86 211" stroke="#1B2838" strokeWidth="1.2" fill="none"/>
        </g>
      </g>

      {/* Closed lane (pink fill — work area) */}
      <g className={cls(2)} style={{ transitionDelay: '300ms' }}>
        <path d="M 580 175 L 1000 175 L 1000 230 L 580 230 Z" fill="#F2C9D6" opacity="0.65"/>
        {/* hatching */}
        <defs>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#C44A6E" strokeWidth="0.7" opacity="0.4"/>
          </pattern>
        </defs>
        <rect x="580" y="175" width="420" height="55" fill="url(#hatch)" />

        {/* work zone label */}
        <text x="790" y="207" textAnchor="middle" fontFamily="JetBrains Mono, monospace"
              fontSize="11" fill="#1B2838" fontWeight="600" letterSpacing="0.12em">WORK AREA</text>
      </g>

      {/* Cones (taper + line) */}
      <g className={cls(2)} style={{ transitionDelay: '550ms' }}>
        {taperCones.map(c => <Cone key={c.key} x={c.x} y={c.y} />)}
        {lineCones.map(c => <Cone key={c.key} x={c.x} y={c.y} />)}
      </g>

      {/* Dimensions */}
      <g className={cls(3)} style={{ transitionDelay: '850ms' }}>
        {/* Taper L */}
        <Dimension x1={360} x2={580} y={92} label="L = 650 ft" sub="TAPER" />
        {/* Buffer B */}
        <Dimension x1={580} x2={780} y={92} label="B = 645 ft" sub="BUFFER" />
        {/* Work zone */}
        <Dimension x1={780} x2={1000} y={92} label="0.40 mi" sub="WORK ZONE" />
      </g>

      {/* Advance warning signs */}
      <g className={cls(4)} style={{ transitionDelay: '1100ms' }}>
        <Sign x={120} y={108} code="W20-1" />
        <Sign x={210} y={108} code="W20-5" />
        <Sign x={300} y={108} code="W4-2" />
        {/* arrow board */}
        <ArrowBoard x={480} y={195}/>
      </g>

      {/* north arrow */}
      <g className={cls(1)} transform="translate(1040, 350)" opacity="0.7">
        <circle cx="0" cy="0" r="14" fill="none" stroke="#1B2838" strokeWidth="0.8"/>
        <path d="M 0 -10 L 4 6 L 0 3 L -4 6 Z" fill="#1B2838" />
        <text x="0" y="22" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#1B2838">N</text>
      </g>
    </svg>
  );
}

function Cone({ x, y }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path d="M 0 0 L -4 8 L 4 8 Z" fill="#E8710A" stroke="#C45F08" strokeWidth="0.5"/>
      <line x1="-3" y1="4" x2="3" y2="4" stroke="white" strokeWidth="0.6"/>
    </g>
  );
}

function Sign({ x, y, code }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-7" y="-7" width="14" height="14" fill="#27AE60" transform="rotate(45)"/>
      <text x="0" y="22" textAnchor="middle" fontFamily="JetBrains Mono, monospace"
            fontSize="8" fill="#1B2838" fontWeight="600">{code}</text>
    </g>
  );
}

function ArrowBoard({ x, y }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-14" y="-5" width="28" height="10" fill="#F2C94C" stroke="#1B2838" strokeWidth="0.4"/>
      <path d="M -8 0 L 6 0 L 4 -3 M 6 0 L 4 3" stroke="#1B2838" strokeWidth="1" fill="none"/>
    </g>
  );
}

function Dimension({ x1, x2, y, label, sub }) {
  const mid = (x1 + x2) / 2;
  return (
    <g>
      {/* extension lines */}
      <line x1={x1} y1={y} x2={x1} y2={y + 25} stroke="#E8710A" strokeWidth="0.6" />
      <line x1={x2} y1={y} x2={x2} y2={y + 25} stroke="#E8710A" strokeWidth="0.6" />
      {/* dim line */}
      <line x1={x1} y1={y + 6} x2={x2} y2={y + 6} stroke="#E8710A" strokeWidth="0.6"/>
      {/* arrow ticks */}
      <path d={`M ${x1+1} ${y+3} L ${x1+5} ${y+6} L ${x1+1} ${y+9}`} fill="none" stroke="#E8710A" strokeWidth="0.6"/>
      <path d={`M ${x2-1} ${y+3} L ${x2-5} ${y+6} L ${x2-1} ${y+9}`} fill="none" stroke="#E8710A" strokeWidth="0.6"/>
      {/* label */}
      <rect x={mid - 36} y={y - 6} width="72" height="12" fill="#FAF6F0"/>
      <text x={mid} y={y + 2} textAnchor="middle" fontFamily="JetBrains Mono, monospace"
            fontSize="9" fill="#1B2838" fontWeight="600">{label}</text>
      <text x={mid} y={y + 22} textAnchor="middle" fontFamily="JetBrains Mono, monospace"
            fontSize="7" fill="#8A95A4" letterSpacing="0.12em">{sub}</text>
    </g>
  );
}

window.ScenarioCard = ScenarioCard;
window.PlanSheet = PlanSheet;
window.SCENARIO_FIELDS = SCENARIO_FIELDS;
