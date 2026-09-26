import {
  CLOSE,
  HAND_OVER,
  HERO,
  HOW,
  NOTIFY,
  NOTIFY_HREF,
  SHEET,
  SOURCES,
  TITLE_BLOCK,
  WHO,
} from "@/lib/coming-soon-copy";
import { PlanDrawing } from "./PlanDrawing";
import { StepDrawing } from "./StepDrawings";

// The coming-soon page, B+ "The Plan Sheet" (coming-soon-gate R5a).
// Authority: design/PlanSheet.dc.html (1440) and PlanSheetPhone.dc.html
// (390) — rebuilt here on workbench tokens and type roles, never pasted.
// Every word is in lib/coming-soon-copy.ts; every colour is a token
// (checkpoint-arc2.md §2).  Serves the prospect (FLOW.md §1, R3): what
// this is, whether it is for them, and a way to hear when it opens.
//
// A2-Q1: no form.  "Get notified" is a mail link, in three places: the
// nav, the sheet (the page's one primary, P18) and the closing band (the
// outlined secondary, A2-Q10).  Nothing links to /sign-in (R1.5).

function SectionHead({ id, n, title, prov }: { id: string; n: string; title: string; prov?: string }) {
  return (
    <div className="cs-head">
      <span className="tr-step">{n}</span>
      <h2 id={id} className="tr-section">{title}</h2>
      {prov && <span className="tr-prov cs-head-prov">{prov}</span>}
    </div>
  );
}

function Sheet() {
  return (
    <section className="cs-sheet" aria-labelledby="cs-notify-q">
      {/* Registration marks at the four corners (decorative). */}
      <svg className="cs-crop" aria-hidden="true" overflow="visible">
        {(
          [
            ["0", "0"],
            ["100%", "0"],
            ["0", "100%"],
            ["100%", "100%"],
          ] as const
        ).map(([x, y]) => (
          <svg key={`${x}${y}`} x={x} y={y} overflow="visible">
            <path d="M-12 0H14M0 -12V14" />
          </svg>
        ))}
      </svg>
      <div className="cs-sheet-head">
        <span className="tr-step">{SHEET.step}</span>
        <span className="tr-section">{SHEET.title}</span>
        <span className="tr-prov cs-head-prov">{SHEET.standards}</span>
      </div>
      <PlanDrawing />
      <div className="cs-lower">
        <div className="cs-intro">
          <span className="tr-step cs-only-wide">{HERO.step}</span>
          <span className="tr-step cs-only-narrow">{HERO.stepPhone}</span>
          <p className="cs-wordmark">
            conestruct<span className="text-[color:var(--dim)]">.</span>
          </p>
          <p className="cs-body cs-measure">{HERO.line}</p>
          <div className="cs-intro-links">
            <a className="cs-body cs-link" href="#how">
              {HERO.howLink}
            </a>
            <a className="cs-body cs-link" href="#sources">
              {HERO.sourcesLink}
            </a>
          </div>
        </div>
        <div id="notify" className="cs-notify-col">
          <dl className="cs-tb">
            {TITLE_BLOCK.map(([k, v]) => (
              <div key={k} className="cs-tb-row">
                <dt className="tr-step cs-tb-k">{k}</dt>
                <dd className="tr-field cs-tb-v">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="cs-notify">
            <h1 id="cs-notify-q" className="tr-question">
              {NOTIFY.question}
            </h1>
            <a className="pri cs-notify-btn" href={NOTIFY_HREF}>
              {NOTIFY.button}
            </a>
            <p className="cs-body">{NOTIFY.line}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ComingSoon() {
  return (
    <div className="cs-page">
      <svg className="cs-grid" aria-hidden="true">
        <defs>
          <pattern id="cs-grid" width="48" height="48" patternUnits="userSpaceOnUse" x="12" y="4">
            <path d="M20 24H28M24 20V28" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cs-grid)" />
      </svg>

      <Sheet />

      <section id="how" className="cs-section" aria-labelledby="cs-how">
        <SectionHead id="cs-how" n={HOW.n} title={HOW.title} prov={HOW.prov} />
        <div className="cs-cards cs-cards-3">
          {HOW.steps.map((s, i) => (
            <div key={s.step} className="cs-card">
              <StepDrawing step={i as 0 | 1 | 2} />
              <div className="cs-card-text">
                <span className="tr-step">{s.step}</span>
                <h3 className="cs-title">{s.title}</h3>
                <p className="cs-body">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="cs-section" aria-labelledby="cs-hand">
        <SectionHead id="cs-hand" n={HAND_OVER.n} title={HAND_OVER.title} prov={HAND_OVER.prov} />
        <div className="cs-strip">
          {HAND_OVER.items.map((it) => (
            <div key={it.step} className="cs-strip-item">
              <span className="tr-step">{it.step}</span>
              <h3 className="cs-title">{it.title}</h3>
              <p className="cs-body">{it.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="sources" className="cs-section" aria-labelledby="cs-sources">
        <SectionHead id="cs-sources" n={SOURCES.n} title={SOURCES.title} />
        <div className="cs-sources">
          <div className="cs-sources-text">
            <h3 className="tr-question">{SOURCES.question}</h3>
            <p className="cs-body cs-measure">{SOURCES.body}</p>
          </div>
          <div className="cs-sources-refs">
            <span className="tr-prov">{SOURCES.prov}</span>
            <ul className="cs-chips">
              {SOURCES.chips.map((c) => (
                <li key={c} className="tr-prov cs-chip">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="cs-section" aria-labelledby="cs-who">
        <SectionHead id="cs-who" n={WHO.n} title={WHO.title} prov={WHO.prov} />
        <div className="cs-cards cs-cards-2">
          {WHO.people.map((p) => (
            <div key={p.step} className="cs-card cs-card-pad">
              <span className="tr-step">{p.step}</span>
              <h3 className="cs-title">{p.title}</h3>
              <p className="cs-body">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cs-close" aria-label={CLOSE.title}>
        <div className="cs-close-text">
          <span className="tr-section">{CLOSE.title}</span>
          <p className="cs-body">{CLOSE.body}</p>
        </div>
        <a className="dl-btn cs-close-btn" href={NOTIFY_HREF}>
          {CLOSE.link}
        </a>
      </section>
    </div>
  );
}
