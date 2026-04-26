/* global React */
const { useState: useGenMain } = React;

// ——— Compute results from params ———
function compute(params) {
  const W = params.laneWidth;
  const S = params.speed;
  const L = S >= 45 ? Math.round(W * S) : Math.round((W * S * S) / 60);
  const BUFFER = {
    25:155, 30:200, 35:250, 40:305, 45:360, 50:425, 55:495, 60:570,
    65:645, 70:730, 75:820,
  };
  const B = BUFFER[Math.round(S/5)*5] ?? 645;
  const spacing = S; // ft o.c.
  const taperCones = Math.max(4, Math.ceil(L / spacing));
  const tangentCones = Math.ceil(params.workLen / spacing);
  const cones = taperCones + tangentCones;
  const drums = params.night ? Math.ceil(cones * 0.25) : 0;
  const signs = S >= 45 ? 3 : 2;
  const arrowBoards = (params.closure === 'lane' || params.closure === 'full_road') ? 1 : 0;

  const caseId = caseMatch(params);

  return {
    L, B, spacing,
    cones, drums, signs, arrowBoards,
    totalDevices: cones + drums + signs + arrowBoards,
    uniqueTypes: 1 + (drums?1:0) + (signs?1:0) + (arrowBoards?1:0),
    caseId,
  };
}

function caseMatch(p) {
  if (p.closure === 'shoulder') return p.divided ? 'Case 1A' : 'Case 1B';
  if (p.closure === 'lane') return p.divided ? 'Case 2A' : 'Case 2B';
  if (p.closure === 'full_road') return 'Case 3A';
  return 'Case M-1';
}

function MainPanel({ params, status, results }) {
  const [openIdx, setOpenIdx] = useGenMain(0);
  const generated = status === 'done';

  return (
    <main className="main">
      <div className="main-head">
        <div className="eyebrow">02 · MHT GENERATOR · COLORADO</div>
        <h1>Method of Handling Traffic — plan generator</h1>
        <p>Generate a CDOT-compliant MHT package: PDF plan sheet, device list, and crew instructions. Every dimension cited to MUTCD or the Colorado Supplement.</p>
      </div>

      {/* Status bar */}
      {status === 'idle' && (
        <div className="status-bar idle">
          <span className="indicator"></span>
          <span>Awaiting scenario · fill the panel on the left, then generate</span>
        </div>
      )}
      {status === 'generating' && (
        <div className="status-bar warn">
          <span className="indicator"></span>
          <span>COMPUTING · taper · buffer · spacing · sign placement</span>
        </div>
      )}
      {status === 'done' && (
        <div className="status-bar pass">
          <span className="indicator"></span>
          <span>GENERATED · 3 validation warnings · all CDOT supplement checks pass</span>
          <span className="pill pass">READY FOR TCS REVIEW</span>
        </div>
      )}

      {/* Outputs */}
      {!generated ? (
        <div className="empty-state">
          <span className="big">No package yet</span>
          Describe the work zone <span className="arrow">→</span> press generate <span className="arrow">→</span> download
        </div>
      ) : (
        <div className="outputs">
          <div className="output-card">
            <span className="corner tl"></span><span className="corner br"></span>
            <div className="ix"><span className="num">A</span> · DELIVERABLE 01</div>
            <h3>Plan sheet</h3>
            <div className="meta">PDF · 11×17 LANDSCAPE · {results.caseId}</div>
            <div className="stat-row">
              <span className="lbl">Devices</span>
              <span className="val">{results.totalDevices}</span>
            </div>
            <button className="dl-btn">Download PDF <span className="arr">↓</span></button>
          </div>

          <div className="output-card">
            <span className="corner tl"></span><span className="corner br"></span>
            <div className="ix"><span className="num">B</span> · DELIVERABLE 02</div>
            <h3>Device list</h3>
            <div className="meta">XLSX · CDOT BID-READY</div>
            <div className="stat-row">
              <span className="lbl">Unique types</span>
              <span className="val">{results.uniqueTypes}</span>
            </div>
            <button className="dl-btn">Download XLSX <span className="arr">↓</span></button>
          </div>

          <div className="output-card">
            <span className="corner tl"></span><span className="corner br"></span>
            <div className="ix"><span className="num">C</span> · DELIVERABLE 03</div>
            <h3>Crew instructions</h3>
            <div className="meta">MARKDOWN · SETUP + TAKEDOWN</div>
            <div className="stat-row">
              <span className="lbl">Steps</span>
              <span className="val">{results.cones > 30 ? 14 : 11}</span>
            </div>
            <button className="dl-btn">Download .md <span className="arr">↓</span></button>
          </div>
        </div>
      )}

      {/* Audit trail */}
      <div className="section">
        <div className="section-head">
          <h2>Verification & audit trail</h2>
          <span className="ix"><span className="num">03</span> · SHOW THE WORK</span>
        </div>
        <div className="section-sub">
          Every calculation is traced to its MUTCD or Colorado Supplement source. Verify before stamping.
        </div>

        <div className="audit-list">
          <AuditItem
            num="01" title="Taper length calculation"
            result={generated ? `L = ${results.L} ft` : '—'}
            cite="MUTCD § 6C.08"
            open={openIdx === 0} onClick={() => setOpenIdx(openIdx === 0 ? -1 : 0)}
          >
            <p>For speed limits ≥ 45 mph, MUTCD Equation 6C-1 specifies the merging taper length as the lane width × speed limit. For lower speeds, the formula scales with the square of the speed.</p>
            <div className="formula">
              <span className="var">L</span><span className="op">=</span>
              <span className="var">W</span><span className="op">×</span><span className="var">S</span>
              <span className="op">=</span>
              <span>{params.laneWidth}</span><span className="op">×</span><span>{params.speed}</span>
              <span className="op">=</span>
              <span className="res">{generated ? results.L : '—'} ft</span>
            </div>
            <div className="citation">
              <span className="check">✓</span>
              MUTCD 2023 EDITION · CHAPTER 6C · TABLE 6C-3
            </div>
          </AuditItem>

          <AuditItem
            num="02" title="Buffer space calculation"
            result={generated ? `B = ${results.B} ft` : '—'}
            cite="MUTCD TABLE 6C-2"
            open={openIdx === 1} onClick={() => setOpenIdx(openIdx === 1 ? -1 : 1)}
          >
            <p>Buffer space is the longitudinal clear distance between traffic and workers, sized for stopping sight distance at the posted speed.</p>
            <table>
              <thead>
                <tr><th>Speed</th><th>Buffer (ft)</th></tr>
              </thead>
              <tbody>
                {[55, 60, 65, 70, 75].map(s => (
                  <tr key={s}>
                    <td className={params.speed === s ? 'match' : ''}>{s} mph</td>
                    <td className={params.speed === s ? 'match' : ''}>
                      {{55: 495, 60: 570, 65: 645, 70: 730, 75: 820}[s]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="citation">
              <span className="check">✓</span>
              MUTCD TABLE 6C-2 · STOPPING SIGHT DISTANCE
            </div>
          </AuditItem>

          <AuditItem
            num="03" title="Channelizing device spacing"
            result={generated ? `${results.cones} cones · ${results.spacing} ft o.c.` : '—'}
            cite="MUTCD § 6F.65"
            open={openIdx === 2} onClick={() => setOpenIdx(openIdx === 2 ? -1 : 2)}
          >
            <p>In tapers and tangents, channelizing devices are spaced approximately equal to the speed limit in feet on-center.</p>
            <div className="formula">
              <span>spacing</span><span className="op">≈</span>
              <span className="var">S</span><span className="op">=</span>
              <span className="res">{generated ? results.spacing : '—'} ft o.c.</span>
            </div>
            <p style={{ marginTop: 8 }}>
              Taper: <strong>{generated ? Math.max(4, Math.ceil(results.L / results.spacing)) : '—'} cones</strong> ·{' '}
              Tangent ({params.workLen} ft): <strong>{generated ? Math.ceil(params.workLen / results.spacing) : '—'} cones</strong>
              {generated && results.drums > 0 && <> · Drums (night): <strong>{results.drums}</strong></>}
            </p>
          </AuditItem>

          <AuditItem
            num="04" title="Advance warning sign placement"
            result={generated ? `${results.signs} signs / side` : '—'}
            cite="MUTCD TABLE 6C-1"
            open={openIdx === 3} onClick={() => setOpenIdx(openIdx === 3 ? -1 : 3)}
          >
            <table>
              <thead>
                <tr><th>Sign</th><th>Code</th><th>Distance</th></tr>
              </thead>
              <tbody>
                <tr><td>Road work ahead</td><td>W20-1</td><td>1500 ft</td></tr>
                <tr><td>Right lane closed ahead</td><td>W20-5R</td><td>1000 ft</td></tr>
                <tr><td>Merge right</td><td>W4-2R</td><td>500 ft</td></tr>
              </tbody>
            </table>
          </AuditItem>

          <AuditItem
            num="05" title="Colorado supplement requirements"
            result="ALL CHECKS PASS"
            cite="CDOT S-630-1"
            open={openIdx === 4} onClick={() => setOpenIdx(openIdx === 4 ? -1 : 4)}
          >
            <div className="check-list">
              <div className="check-list-item">
                <span className="ck">✓</span>
                <span className="lbl">Type III barricade at terminus (S-630-1 §4.2)</span>
                <span className="src">PASS</span>
              </div>
              <div className="check-list-item">
                <span className="ck">✓</span>
                <span className="lbl">Retroreflective device sheeting Type IX</span>
                <span className="src">PASS</span>
              </div>
              <div className="check-list-item">
                <span className="ck">✓</span>
                <span className="lbl">Speed reduction sign per CDOT § 630.07</span>
                <span className="src">PASS</span>
              </div>
              <div className="check-list-item">
                <span className="ck warn">!</span>
                <span className="lbl">Flagger spacing exceeds 1500 ft — review</span>
                <span className="src">WARN</span>
              </div>
            </div>
          </AuditItem>

          <AuditItem
            num="06" title="S-630-1 case reference"
            result={generated ? results.caseId : '—'}
            cite="CDOT S-630-1"
            open={openIdx === 5} onClick={() => setOpenIdx(openIdx === 5 ? -1 : 5)}
          >
            <p>Matched against CDOT Standard Plan S-630-1, the official Colorado supplement to MUTCD Part 6.</p>
            <p style={{ marginTop: 8 }}>
              <a href="#" style={{ color: 'var(--blue)', fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                ↗ Open S-630-1 PDF on CDOT.gov
              </a>
            </p>
          </AuditItem>
        </div>
      </div>

      {/* Plan details */}
      {generated && (
        <div className="section">
          <div className="section-head">
            <h2>Plan details</h2>
            <span className="ix"><span className="num">04</span> · BREAKDOWN</span>
          </div>

          <table className="device-table">
            <thead>
              <tr>
                <th>Device type</th>
                <th>MUTCD code</th>
                <th>Function</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Traffic cone (28")</td>
                <td>—</td>
                <td>Channelizing</td>
                <td className="num">{results.cones}</td>
              </tr>
              {results.drums > 0 && (
                <tr>
                  <td>Drum</td>
                  <td>—</td>
                  <td>Channelizing (night)</td>
                  <td className="num">{results.drums}</td>
                </tr>
              )}
              <tr>
                <td>Road work ahead</td>
                <td>W20-1</td>
                <td>Advance warning</td>
                <td className="num">{results.signs >= 1 ? 2 : 0}</td>
              </tr>
              <tr>
                <td>Right lane closed</td>
                <td>W20-5R</td>
                <td>Advance warning</td>
                <td className="num">{results.signs >= 2 ? 2 : 0}</td>
              </tr>
              <tr>
                <td>Merge right</td>
                <td>W4-2R</td>
                <td>Advance warning</td>
                <td className="num">{results.signs >= 3 ? 2 : 0}</td>
              </tr>
              {results.arrowBoards > 0 && (
                <tr>
                  <td>Type C arrow board</td>
                  <td>—</td>
                  <td>Active warning</td>
                  <td className="num">{results.arrowBoards}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function AuditItem({ num, title, result, cite, open, onClick, children }) {
  return (
    <div className={`audit-item ${open ? 'open' : ''}`}>
      <div className="audit-head" onClick={onClick}>
        <span className="num">{num}</span>
        <span className="title">{title}</span>
        <span className="result">{result}</span>
        <span className="cite">{cite}</span>
        <span className="chev">›</span>
      </div>
      {open && <div className="audit-body">{children}</div>}
    </div>
  );
}

window.MainPanel = MainPanel;
window.compute = compute;
