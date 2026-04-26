/* global React */
const { useState: useGenState } = React;

const ROAD_TYPES = [
  { v: 'rural_undivided', l: 'Rural — undivided' },
  { v: 'rural_divided',   l: 'Rural — divided hwy' },
  { v: 'urban_arterial',  l: 'Urban arterial' },
  { v: 'freeway',         l: 'Freeway / interstate' },
];
const CLOSURE_TYPES = [
  { v: 'shoulder',  l: 'Shoulder' },
  { v: 'lane',      l: 'Lane' },
  { v: 'full_road', l: 'Full road' },
  { v: 'mobile',    l: 'Mobile' },
];

function Sidebar({ params, setParam, generating, onGenerate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h2>Scenario</h2>
        <span className="ix">01 · INPUT</span>
      </div>

      {/* Road & traffic */}
      <div className="fieldgroup">
        <div className="fieldgroup-label">
          <span>Roadway</span><span className="ix">A</span>
        </div>

        <div className="field">
          <label>Road type</label>
          <select value={params.roadType} onChange={(e) => setParam('roadType', e.target.value)}>
            {ROAD_TYPES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
        </div>

        <div className="field">
          <label>
            Speed limit
            <span className="v">{params.speed} mph</span>
          </label>
          <input type="range" min="25" max="75" step="5"
                 value={params.speed}
                 onChange={(e) => setParam('speed', +e.target.value)} />
          <div className="hint">MUTCD: ≥45 mph uses L=W·S</div>
        </div>

        <div className="field">
          <label>Lanes per direction</label>
          <div className="chip-row">
            {[1, 2, 3, 4].map(n => (
              <button key={n}
                      className={`chip ${params.lanes === n ? 'on' : ''}`}
                      onClick={() => setParam('lanes', n)}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>
            Lane width
            <span className="v">{params.laneWidth} ft</span>
          </label>
          <input type="range" min="9" max="14" step="0.5"
                 value={params.laneWidth}
                 onChange={(e) => setParam('laneWidth', +e.target.value)} />
        </div>
      </div>

      {/* Closure */}
      <div className="fieldgroup">
        <div className="fieldgroup-label">
          <span>Closure</span><span className="ix">B</span>
        </div>

        <div className="field">
          <label>Closure type</label>
          <div className="chip-row">
            {CLOSURE_TYPES.map(c => (
              <button key={c.v}
                      className={`chip ${params.closure === c.v ? 'on' : ''}`}
                      onClick={() => setParam('closure', c.v)}>
                {c.l}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Work zone length (ft)</label>
          <input type="number" value={params.workLen}
                 onChange={(e) => setParam('workLen', +e.target.value || 0)} />
        </div>

        <div
          className={`check-row ${params.divided ? 'on' : ''}`}
          onClick={() => setParam('divided', !params.divided)}
        >
          <span className="check-box"></span>
          <span className="lbl">Divided highway</span>
          <span className="desc">Median present</span>
        </div>
        <div
          className={`check-row ${params.night ? 'on' : ''}`}
          onClick={() => setParam('night', !params.night)}
        >
          <span className="check-box"></span>
          <span className="lbl">Night operation</span>
          <span className="desc">+ retroreflective</span>
        </div>
      </div>

      {/* Location */}
      <div className="fieldgroup">
        <div className="fieldgroup-label">
          <span>Location</span><span className="ix">C · OPT</span>
        </div>

        <div className="field">
          <label>Address / intersection</label>
          <input type="text" value={params.address}
                 placeholder="US-75 & Bromley Ln, Brighton, CO"
                 onChange={(e) => setParam('address', e.target.value)} />
        </div>

        <div className="field" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label>Latitude</label>
            <input type="number" step="0.000001" value={params.lat}
                   onChange={(e) => setParam('lat', +e.target.value || 0)} />
          </div>
          <div>
            <label>Longitude</label>
            <input type="number" step="0.000001" value={params.lng}
                   onChange={(e) => setParam('lng', +e.target.value || 0)} />
          </div>
        </div>

        <div className="field">
          <label>Project name</label>
          <input type="text" value={params.project}
                 placeholder="I-25 MM 184 Resurfacing"
                 onChange={(e) => setParam('project', e.target.value)} />
        </div>
      </div>

      <button className="generate-btn" onClick={onGenerate} disabled={generating}>
        {generating ? <>
          <span style={{
            width: 12, height: 12, border: '1.5px solid rgba(255,255,255,0.4)',
            borderTopColor: 'white', borderRadius: '50%', display: 'inline-block',
            animation: 'spin 0.7s linear infinite'
          }}></span>
          Generating MHT…
        </> : <>
          Generate MHT package
          <span className="arrow">→</span>
        </>}
      </button>

      <div className="sidebar-footer">
        Output requires TCS review
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
window.ROAD_TYPES = ROAD_TYPES;
window.CLOSURE_TYPES = CLOSURE_TYPES;
