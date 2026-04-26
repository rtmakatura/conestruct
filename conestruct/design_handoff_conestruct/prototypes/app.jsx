/* global React, ReactDOM, ScenarioCard, PlanSheet, MathSection, SCENARIO_FIELDS,
          useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakToggle */
const { useState, useEffect, useRef, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "tagline": "plan_generate_go",
  "logo": "wordmark_plain",
  "heroLayout": "split",
  "colorIntensity": "balanced",
  "taglineCustom": ""
}/*EDITMODE-END*/;

const TAGLINES = {
  plan_generate_go: ["Plan.", "Generate.", "Go."],
  describe_download: ["Describe the zone.", "Download the plan."],
  scenario_to_mht:  ["From scenario", "to MHT", "in seconds."],
  fastest_co:       ["The fastest way to generate", "Colorado-compliant", "traffic control plans."],
};

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Animation state
  // Phase: typing → generating → revealed
  const [phase, setPhase] = useState('typing');
  const [activeIdx, setActiveIdx] = useState(0);
  const [partial, setPartial] = useState('');
  const [progress, setProgress] = useState(0);
  const [revealStage, setRevealStage] = useState(0);

  // Type the scenario fields
  useEffect(() => {
    if (phase !== 'typing') return;
    if (activeIdx >= SCENARIO_FIELDS.length) {
      setPhase('generating');
      return;
    }
    const target = SCENARIO_FIELDS[activeIdx].val;
    if (partial.length < target.length) {
      const t = setTimeout(() => setPartial(target.slice(0, partial.length + 1)), 38);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setActiveIdx(activeIdx + 1);
        setPartial('');
      }, 240);
      return () => clearTimeout(t);
    }
  }, [phase, activeIdx, partial]);

  // Generating phase: progress + reveal stages
  useEffect(() => {
    if (phase !== 'generating') return;
    let pct = 0;
    setProgress(0);
    setRevealStage(0);
    const i = setInterval(() => {
      pct += 4;
      setProgress(Math.min(100, pct));
      if (pct === 12) setRevealStage(1);
      else if (pct === 36) setRevealStage(2);
      else if (pct === 64) setRevealStage(3);
      else if (pct === 88) setRevealStage(4);
      if (pct >= 100) {
        clearInterval(i);
        setTimeout(() => setPhase('revealed'), 800);
      }
    }, 70);
    return () => clearInterval(i);
  }, [phase]);

  // Loop: after revealed, restart after a pause
  useEffect(() => {
    if (phase !== 'revealed') return;
    const t = setTimeout(() => {
      setActiveIdx(0);
      setPartial('');
      setProgress(0);
      setRevealStage(0);
      setPhase('typing');
    }, 5500);
    return () => clearTimeout(t);
  }, [phase]);

  // Apply color intensity to body
  useEffect(() => {
    document.body.classList.remove('orange-heavy', 'restrained');
    if (tweaks.colorIntensity === 'orange-heavy') document.body.classList.add('orange-heavy');
    if (tweaks.colorIntensity === 'restrained') document.body.classList.add('restrained');
  }, [tweaks.colorIntensity]);

  const taglineWords = TAGLINES[tweaks.tagline] || TAGLINES.plan_generate_go;

  const wordmark = useMemo(() => {
    if (tweaks.logo === 'wordmark_dot') {
      return <span className="wordmark">conestruct<span className="wordmark-mark">.</span></span>;
    }
    if (tweaks.logo === 'wordmark_cone') {
      return (
        <span className="wordmark" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="18" viewBox="0 0 16 18" style={{ marginBottom: -2 }}>
            <path d="M 8 1 L 14 16 L 2 16 Z" fill="#E8710A" stroke="#C45F08" strokeWidth="0.6"/>
            <line x1="3.5" y1="11" x2="12.5" y2="11" stroke="white" strokeWidth="1.4"/>
          </svg>
          conestruct
        </span>
      );
    }
    if (tweaks.logo === 'bracket') {
      return <span className="wordmark"><span className="wordmark-mark">[</span> conestruct <span className="wordmark-mark">]</span></span>;
    }
    return <span className="wordmark">conestruct</span>;
  }, [tweaks.logo]);

  return (
    <>
      <div className="page">
        {/* Top nav */}
        <nav className="nav">
          <div className="nav-left">
            {wordmark}
            <span className="nav-meta">v0.4 · Colorado · MUTCD 2023</span>
          </div>
          <div className="nav-right">
            <a className="nav-link" href="#math">How it works</a>
            <a className="nav-link" href="#">Sample plan</a>
            <a className="nav-link" href="#">Sign in</a>
            <button className="nav-cta">Try the generator →</button>
          </div>
        </nav>

        {/* Sheet meta strip */}
        <div className="sheet-meta">
          <span>SHEET: 01 / 03</span>
          <span>PROJECT: CONESTRUCT.COM / LANDING</span>
          <span>ISSUED: 2026-04-26</span>
          <span>BY: TCS · CDOT</span>
          <span>SCALE: AS NOTED</span>
        </div>

        {/* HERO */}
        <section className={`hero ${tweaks.heroLayout === 'stacked' ? 'flow-stacked' : ''}`}>
          <div className="hero-left">
            <div className="eyebrow">01 · MHT GENERATOR · COLORADO</div>
            <h1>
              MUTCD-compliant <span className="hl">traffic control plans</span> in under two minutes.
            </h1>
            <div className="hero-tagline">
              {taglineWords.map((w, i) => (
                <span className="word" key={i}>
                  <span className="dot"></span>{w}
                </span>
              ))}
            </div>
            <p className="hero-sub">
              Describe a work zone. Conestruct computes the taper, buffer, device
              count and sign placement — then ships a stamped-ready PDF, Excel
              device list and crew narrative.
            </p>
            <div className="hero-cta-row">
              <button className="btn-primary">
                Try the generator
                <span className="arrow">→</span>
              </button>
              <span className="cta-meta">Free · No card · ~90 sec</span>
            </div>
          </div>

          <div className="hero-right">
            <ScenarioCard
              phase={phase}
              typed={{ activeIdx, partial }}
              progress={progress}
            />
            <PlanSheet revealStage={revealStage} />
          </div>
        </section>

        {/* Stats / dimension strip */}
        <div className="dim-strip">
          <span><span className="stat"><span className="num">~90s</span> from scenario to PDF</span></span>
          <span>· · · ·</span>
          <span><span className="stat"><span className="num">3</span> scenarios supported</span></span>
          <span>· · · ·</span>
          <span><span className="stat"><span className="num">PDF + XLSX + MD</span> in one click</span></span>
          <span>· · · ·</span>
          <span><span className="stat"><span className="num">100%</span> MUTCD-cited</span></span>
        </div>
      </div>

      {/* Math section (full bleed page bg) */}
      <MathSection />

      {/* Final CTA */}
      <div className="page">
        <section className="final-cta">
          <div className="final-cta-grid">
            <div>
              <div className="final-cta-meta">03 · GET STARTED · FREE DEMO</div>
              <h2>Stop drawing. <span className="hl">Start describing.</span></h2>
              <p>
                Built by TCS, for TCS. Colorado-first. Drop in a scenario,
                get a PDF your supervisor can stamp.
              </p>
              <button className="btn-primary">
                Try the generator
                <span className="arrow">→</span>
              </button>
            </div>
            <div className="cta-spec">
              <div className="row"><span>OUTPUT</span><span className="v">PDF + XLSX + MD</span></div>
              <div className="row"><span>SHEET SIZE</span><span className="v">11×17 LANDSCAPE</span></div>
              <div className="row"><span>STANDARD</span><span className="v">MUTCD 2023</span></div>
              <div className="row"><span>SUPPLEMENT</span><span className="v">CDOT S-630-1</span></div>
              <div className="row"><span>TIME</span><span className="v">~90 SECONDS</span></div>
              <div className="row"><span>PRICE</span><span className="v">FREE DEMO</span></div>
            </div>
          </div>
        </section>

        <footer className="footer">
          <div className="left">
            <span>© 2026 CONESTRUCT</span>
            <span>BUILT IN COLORADO</span>
          </div>
          <div className="right">
            <span>OUTPUT REQUIRES TCS REVIEW · NOT A SUBSTITUTE FOR LICENSED JUDGMENT</span>
          </div>
        </footer>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Tagline">
          <TweakRadio value={tweaks.tagline}
                      onChange={(v) => setTweak('tagline', v)}
                      options={[
                        { value: 'plan_generate_go', label: 'Plan. Generate. Go.' },
                        { value: 'describe_download', label: 'Describe / Download' },
                        { value: 'scenario_to_mht', label: 'Scenario → MHT' },
                        { value: 'fastest_co', label: 'Fastest in Colorado' },
                      ]} />
        </TweakSection>

        <TweakSection title="Logo treatment">
          <TweakRadio value={tweaks.logo}
                      onChange={(v) => setTweak('logo', v)}
                      options={[
                        { value: 'wordmark_plain', label: 'Plain' },
                        { value: 'wordmark_dot', label: 'With dot' },
                        { value: 'wordmark_cone', label: 'Cone icon' },
                        { value: 'bracket', label: '[ Brackets ]' },
                      ]} />
        </TweakSection>

        <TweakSection title="Hero layout">
          <TweakRadio value={tweaks.heroLayout}
                      onChange={(v) => setTweak('heroLayout', v)}
                      options={[
                        { value: 'split', label: 'Split (left + right)' },
                        { value: 'stacked', label: 'Stacked' },
                      ]} />
        </TweakSection>

        <TweakSection title="Color intensity">
          <TweakRadio value={tweaks.colorIntensity}
                      onChange={(v) => setTweak('colorIntensity', v)}
                      options={[
                        { value: 'restrained', label: 'Restrained' },
                        { value: 'balanced', label: 'Balanced' },
                        { value: 'orange-heavy', label: 'Orange heavy' },
                      ]} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
