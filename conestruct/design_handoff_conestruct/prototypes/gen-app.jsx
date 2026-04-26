/* global React, ReactDOM, Sidebar, MainPanel, compute */
const { useState: useAppState } = React;

const DEFAULT_PARAMS = {
  roadType: 'rural_divided',
  speed: 65,
  lanes: 2,
  laneWidth: 12,
  closure: 'lane',
  workLen: 800,
  divided: true,
  night: false,
  address: '',
  lat: 0,
  lng: 0,
  project: '',
};

function App() {
  const [params, setParams] = useAppState(DEFAULT_PARAMS);
  const [status, setStatus] = useAppState('done'); // idle | generating | done — start with done so it's not empty
  const [results, setResults] = useAppState(compute(DEFAULT_PARAMS));

  const setParam = (k, v) => setParams(p => ({ ...p, [k]: v }));

  const onGenerate = () => {
    setStatus('generating');
    setTimeout(() => {
      setResults(compute(params));
      setStatus('done');
    }, 1100);
  };

  return (
    <>
      <header className="app-nav">
        <div className="left">
          <span className="wordmark">conestruct</span>
          <span className="crumb">
            <span>Generator</span>
            <span className="sep">/</span>
            <span className="here">New MHT</span>
          </span>
        </div>
        <div className="right">
          <span className="meta">CDOT · MUTCD 2023</span>
          <button className="ghost">Recent plans</button>
          <button className="ghost">Sign out</button>
        </div>
      </header>

      <div className="sheet-strip">
        <span>SHEET: 01 / 01</span>
        <span>PROJECT: {params.project || 'UNTITLED MHT'}</span>
        <span>ISSUED: 2026-04-26</span>
        <span>BY: TCS · {params.address ? params.address.toUpperCase() : 'NO LOCATION'}</span>
        <span>SCALE: AS NOTED</span>
      </div>

      <div className="app-shell">
        <Sidebar
          params={params}
          setParam={setParam}
          generating={status === 'generating'}
          onGenerate={onGenerate}
        />
        <MainPanel
          params={params}
          status={status}
          results={results}
        />
      </div>

      <footer className="app-footer">
        <span>© 2026 CONESTRUCT · BUILT IN COLORADO</span>
        <span>OUTPUT REQUIRES TCS REVIEW · NOT A SUBSTITUTE FOR LICENSED JUDGMENT</span>
      </footer>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
