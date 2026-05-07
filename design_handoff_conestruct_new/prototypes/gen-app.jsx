/* global React, ReactDOM, Sidebar, MainPanel, compute, useTweaks, TweaksPanel, TweakSection, TweakRadio */
const { useState: useAppState, useEffect: useAppEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "paperPalette": "slate"
}/*EDITMODE-END*/;

// Each option overrides the paper card surfaces. Tuned for the charcoal canvas.
const PAPER_PALETTES = {
  vellum: {
    label: "Vellum (current)",
    desc: "Warm drafting paper",
    "--paper":           "#F7F2EA",
    "--paper-deep":      "#EFE7DA",
    "--paper-line":      "#C9BEAA",
    "--paper-line-soft": "#DCD2BE",
  },
  bone: {
    label: "Bone",
    desc: "Cooler off-white, calmer",
    "--paper":           "#F4F1EC",
    "--paper-deep":      "#EAE5DD",
    "--paper-line":      "#D4CCBE",
    "--paper-line-soft": "#E2DCD0",
  },
  porcelain: {
    label: "Porcelain",
    desc: "Cool neutral, almost white",
    "--paper":           "#F2F4F6",
    "--paper-deep":      "#E6EAEE",
    "--paper-line":      "#C8D0D8",
    "--paper-line-soft": "#DDE3E8",
  },
  slate: {
    label: "Slate (dark mode)",
    desc: "Tinted dark cards, no paper",
    "--paper":             "#243447",
    "--paper-deep":        "#1E2D3F",
    "--paper-line":        "#3A4D66",
    "--paper-line-soft":   "#2E4058",
    "--ink":               "#EAF0F7",
    "--ink-mute":          "#A8B5C6",
    "--ink-faint":         "#7E8DA1",
    "--heading-on-paper":  "#FFFFFF",
    /* table-row highlight needs to read on dark cards */
    "--match-bg":          "rgba(232,113,10,0.18)",
    "--match-ink":         "#FFD9B0",
    "--match-weight":      "600",
    /* lighten the brand orange on dark for better punch */
    "--orange":            "#FF8A2E",
    "--orange-deep":       "#E8710A",
    "--orange-soft":       "rgba(232,113,10,0.18)",
    /* and the green pill bg / fg */
    "--green":             "#5BD68A",
    "--green-soft":        "rgba(39,174,96,0.22)",
    "--red":               "#FF7A7A",
    "--red-soft":          "rgba(235,87,87,0.22)",
  },
};

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
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply selected paper palette as CSS variable overrides on :root.
  // Reset every key any palette can touch, so switching between them is clean.
  useAppEffect(() => {
    const palette = PAPER_PALETTES[t.paperPalette] || PAPER_PALETTES.vellum;
    const root = document.documentElement;
    const allKeys = new Set();
    Object.values(PAPER_PALETTES).forEach(p => {
      Object.keys(p).forEach(k => { if (k.startsWith('--')) allKeys.add(k); });
    });
    allKeys.forEach(k => root.style.removeProperty(k));
    Object.entries(palette).forEach(([k, v]) => {
      if (k.startsWith('--')) root.style.setProperty(k, v);
    });
  }, [t.paperPalette]);

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
          <div className="brand-cell">
            <span className="wordmark">conestruct<span className="dot">.</span></span>
          </div>
          <div className="crumb">
            <span>Generator</span>
            <span>/</span>
            <span className="here">New MHT</span>
          </div>
        </div>
        <div className="right">
          <button className="ghost">Recent plans</button>
          <button className="ghost">Help</button>
          <div className="meta"><span className="live"></span>CDOT · MUTCD 2023</div>
        </div>
      </header>

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
        <span>© 2026 Conestruct · built in Colorado</span>
        <span>Output requires TCS review · not a substitute for licensed judgment</span>
      </footer>

      <TweaksPanel>
        <TweakSection label="Card palette" />
        <TweakRadio
          label="Paper"
          value={t.paperPalette}
          options={Object.keys(PAPER_PALETTES)}
          onChange={(v) => setTweak('paperPalette', v)}
        />
        <div style={{ fontSize: 11, color: '#8A95A4', padding: '4px 0 8px', lineHeight: 1.4 }}>
          {PAPER_PALETTES[t.paperPalette]?.desc}
        </div>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
