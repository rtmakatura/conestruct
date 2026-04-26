/* global React */
const { useState: useStateMath, useEffect: useEffectMath, useMemo } = React;

// MUTCD taper formula:
// For S >= 45 mph: L = W * S
// For S < 45 mph: L = W * S^2 / 60
function taperLength(W, S) {
  if (S >= 45) return W * S;
  return (W * S * S) / 60;
}

// Buffer length lookup (MUTCD Table 6C-2 approx)
const BUFFER_TABLE = {
  25: 155, 30: 200, 35: 250, 40: 305, 45: 360,
  50: 425, 55: 495, 60: 570, 65: 645, 70: 730, 75: 820,
};
function bufferLength(S) {
  // round to nearest 5
  const k = Math.round(S / 5) * 5;
  return BUFFER_TABLE[k] ?? 645;
}

function deviceSpacing(S) {
  // MUTCD: spacing in feet ≈ speed limit
  return Math.round(S);
}

function MathSection() {
  const [W, setW] = useStateMath(12);   // lane width ft
  const [S, setS] = useStateMath(65);   // speed mph
  const L = Math.round(taperLength(W, S));
  const B = bufferLength(S);
  const sp = deviceSpacing(S);

  return (
    <section className="math" id="math">
      <div className="page">
        <div className="section-head">
          <h2>The math is the<br/>product.</h2>
          <div className="section-num"><span className="accent">02</span> · SHOW THE WORK</div>
        </div>

        <div className="math-grid">
          {/* Left: formula card */}
          <div className="formula-card">
            <span className="corner-tick tl"></span>
            <span className="corner-tick tr"></span>
            <span className="corner-tick bl"></span>
            <span className="corner-tick br"></span>

            <div className="formula-label">
              MUTCD <span className="cite">§ 6C.08</span> · MERGING TAPER LENGTH
            </div>

            <div className="formula-display">
              <span className="var">L</span>
              <span className="op">=</span>
              <span className="var">W</span>
              <span className="op">×</span>
              <span className="var">S</span>
              <span className="op">=</span>
              <span>{W}</span>
              <span className="op">×</span>
              <span>{S}</span>
              <span className="op">=</span>
              <span className="res">{L} ft</span>
            </div>

            <div className="input-row">
              <div className="input-block">
                <label>
                  Lane width (W)
                  <span className="val-readout">{W} ft</span>
                </label>
                <input type="range" min="9" max="14" value={W}
                       onChange={(e) => setW(+e.target.value)} />
              </div>
              <div className="input-block">
                <label>
                  Speed limit (S)
                  <span className="val-readout">{S} mph</span>
                </label>
                <input type="range" min="25" max="75" step="5" value={S}
                       onChange={(e) => setS(+e.target.value)} />
              </div>
            </div>

            <div className="taper-viz" style={{ marginTop: 28 }}>
              <div className="taper-viz-grid"></div>
              <span className="viz-label">TAPER GEOMETRY · 1:80 SCALE</span>
              <span className="viz-result">L = {L} ft · B = {B} ft</span>
              <TaperViz W={W} S={S} L={L} B={B} sp={sp} />
            </div>

            <div className="citation-row">
              <div className="cite-chip"><span className="check">✓</span>MUTCD § 6C.08</div>
              <div className="cite-chip"><span className="check">✓</span>CDOT S-630-1</div>
              <div className="cite-chip"><span className="check">✓</span>FHWA TABLE 6C-3</div>
            </div>
          </div>

          {/* Right: list of what's calculated */}
          <div>
            <p style={{
              fontSize: 17, lineHeight: 1.5, color: 'var(--ink-mute)',
              margin: '0 0 32px', textWrap: 'pretty', maxWidth: 440
            }}>
              Every dimension on a Conestruct plan is computed from MUTCD formulas,
              cited, and shown on the audit trail. Drag the sliders — watch the plan
              recompute in real time.
            </p>

            <div className="calc-list">
              <CalcItem n="01" label="Merging taper length" value={`${L} ft`}
                        cite="MUTCD § 6C.08" desc="W × S for ≥ 45 mph" />
              <CalcItem n="02" label="Buffer space" value={`${B} ft`}
                        cite="MUTCD TABLE 6C-2" desc="Stopping sight distance @ S" />
              <CalcItem n="03" label="Channelizing device spacing" value={`${sp} ft o.c.`}
                        cite="MUTCD § 6F.65" desc="≈ S in feet, in taper / tangent" />
              <CalcItem n="04" label="Advance warning sign placement" value="500 / 1000 / 1500 ft"
                        cite="MUTCD TABLE 6C-1" desc="Three-sign series for high-speed hwy" />
              <CalcItem n="05" label="S-630-1 case match" value="Case 2A"
                        cite="CDOT S-630-1" desc="Right lane closure · divided · ≥45 mph" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CalcItem({ n, label, value, cite, desc }) {
  return (
    <div className="calc-item">
      <span className="num">{n}</span>
      <div>
        <div className="label">{label}</div>
        <div className="desc">{desc}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600,
          color: 'var(--orange)'
        }}>{value}</div>
        <div className="cite">{cite}</div>
      </div>
    </div>
  );
}

// Schematic taper SVG with live geometry
function TaperViz({ W, S, L, B, sp }) {
  // viewBox 800x180; left = upstream tangent, then taper, then closed lane + buffer + work
  // Scale: 1 ft = 0.5 px (so 1000 ft ≈ 500 px). We'll size to fit.
  const scale = 0.45;
  const taperPx = L * scale;
  const bufferPx = B * scale;
  const tangentPx = 60;
  const totalContent = tangentPx + taperPx + bufferPx + 100;
  const vbW = Math.max(800, totalContent + 60);
  const vbH = 180;

  const lane1Y = 50;       // travel
  const lane2Y = 95;       // closed lane (originally)
  const laneH = 38;

  const t0 = 30 + tangentPx;            // taper start x
  const t1 = t0 + taperPx;              // taper end / buffer start
  const b1 = t1 + bufferPx;             // buffer end / work start
  const w1 = b1 + 80;                   // work zone end (just for show)

  // device positions
  const taperDevices = [];
  const numTaper = Math.max(4, Math.round(L / sp));
  for (let i = 0; i <= numTaper; i++) {
    const tt = i / numTaper;
    const x = t0 + tt * taperPx;
    const y = lane2Y + tt * laneH * 0.5; // moves from outer edge of travel down across to closed lane edge
    taperDevices.push({ x, y });
  }

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet"
         style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 200 }}>
      {/* travel lane */}
      <rect x="0" y={lane1Y} width={vbW} height={laneH} fill="#D9D3CA" />
      {/* closed lane */}
      <rect x="0" y={lane2Y} width={vbW} height={laneH} fill="#CFC8BD" />
      {/* edge lines */}
      <line x1="0" y1={lane1Y} x2={vbW} y2={lane1Y} stroke="#9A8E7A" strokeWidth="0.6"/>
      <line x1="0" y1={lane2Y + laneH} x2={vbW} y2={lane2Y + laneH} stroke="#9A8E7A" strokeWidth="0.6"/>
      {/* dashed lane line (only in tangent and after work area) */}
      <line x1="0" y1={lane2Y} x2={t0} y2={lane2Y} stroke="#FAF6F0" strokeWidth="1.4" strokeDasharray="10 8"/>
      {/* hatched closed area (buffer + work) */}
      <defs>
        <pattern id="hatch2" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#C44A6E" strokeWidth="0.5" opacity="0.5"/>
        </pattern>
      </defs>
      <rect x={t1} y={lane2Y} width={w1 - t1} height={laneH} fill="#F2C9D6" opacity="0.6"/>
      <rect x={t1} y={lane2Y} width={w1 - t1} height={laneH} fill="url(#hatch2)"/>

      {/* taper cones */}
      {taperDevices.map((d, i) => (
        <g key={i} transform={`translate(${d.x}, ${d.y})`}>
          <path d="M 0 0 L -3 6 L 3 6 Z" fill="#E8710A" stroke="#C45F08" strokeWidth="0.4"/>
        </g>
      ))}

      {/* dimension lines */}
      {/* Taper L */}
      <DimLine x1={t0} x2={t1} y={28} label={`L = ${L} ft`} />
      {/* Buffer B */}
      <DimLine x1={t1} x2={b1} y={28} label={`B = ${B} ft`} />

      {/* spacing tick under taper */}
      <DimLine x1={t0} x2={t0 + sp * scale} y={lane2Y + laneH + 22} label={`${sp} ft o.c.`} small/>

      {/* travel direction */}
      <g transform={`translate(40, ${lane1Y + laneH/2})`} opacity="0.55">
        <line x1="0" y1="0" x2="20" y2="0" stroke="#1B2838" strokeWidth="1"/>
        <path d="M 20 0 L 16 -3 M 20 0 L 16 3" stroke="#1B2838" strokeWidth="1" fill="none"/>
      </g>
    </svg>
  );
}

function DimLine({ x1, x2, y, label, small }) {
  const mid = (x1 + x2) / 2;
  const w = Math.max(50, label.length * 6 + 8);
  return (
    <g>
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 22} stroke="#E8710A" strokeWidth="0.6"/>
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 22} stroke="#E8710A" strokeWidth="0.6"/>
      <line x1={x1} y1={y + 5} x2={x2} y2={y + 5} stroke="#E8710A" strokeWidth="0.6"/>
      <path d={`M ${x1+1} ${y+2} L ${x1+5} ${y+5} L ${x1+1} ${y+8}`} fill="none" stroke="#E8710A" strokeWidth="0.6"/>
      <path d={`M ${x2-1} ${y+2} L ${x2-5} ${y+5} L ${x2-1} ${y+8}`} fill="none" stroke="#E8710A" strokeWidth="0.6"/>
      <rect x={mid - w/2} y={y - 6} width={w} height="11" fill="#FAF6F0"/>
      <text x={mid} y={y + 2} textAnchor="middle" fontFamily="JetBrains Mono, monospace"
            fontSize={small ? 8 : 9} fill="#1B2838" fontWeight="600">{label}</text>
    </g>
  );
}

window.MathSection = MathSection;
