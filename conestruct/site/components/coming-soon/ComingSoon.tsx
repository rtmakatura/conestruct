import { Fragment } from "react";
import {
  CLOSE,
  FOUNDERS,
  HAND_OVER,
  HERO,
  HOW,
  NOTIFY,
  NOTIFY_HREF,
  REVISED_KEY,
  SHEET,
  SOURCES,
  STAMP,
  TITLE_BLOCK,
  WHO,
} from "@/lib/coming-soon-copy";
import {
  ColoradoMap,
  DetailDrawing,
  LaptopArt,
  PhoneArt,
  StackArt,
  StationDrawing,
} from "./LowerDrawings";
import { MilepostRoad } from "./MilepostRoad";
import { PaperStack } from "./PaperStack";
import { STACK_MOVES } from "./stack-moves";
import { PlanDrawing } from "./PlanDrawing";

// The coming-soon page, B+ "The Plan Sheet" (coming-soon-gate R5a).
// Authority: design/PlanSheet.dc.html (1440) and PlanSheetPhone.dc.html
// (390) for the sheet; design/FullPage.dc.html for sections 01 → close
// (Arc 3, R12) — rebuilt here on workbench tokens and type roles, never
// pasted.  Every word is in lib/coming-soon-copy.ts; every colour is a
// token (checkpoint-arc2.md §2, checkpoint-arc3.md).  Serves the prospect
// (FLOW.md §1, R3): what this is, whether it is for them, and a way to
// hear when it opens.
//
// A2-Q1: no form.  "Get notified" is a mail link, in three places: the
// nav, the sheet (the page's one primary, P18) and the closing band (the
// outlined secondary, A2-Q10).  Nothing links to /sign-in (R1.5).
//
// Arc 3: the sheet is unchanged (R12).  Sections 01 → close sit beside
// the milepost road (R13), each milepost section marked data-milepost;
// 05 is the founders' note (R17), which the road's work zone runs past.

function SectionHead({ id, n, title, prov }: { id: string; n: string; title: string; prov?: string }) {
  return (
    <div className="cs-head">
      <span className="tr-step">{n}</span>
      <h2 id={id} className="tr-section">{title}</h2>
      {prov && <span className="tr-prov cs-head-prov">{prov}</span>}
    </div>
  );
}

// R42: the title block plus the revision date, when the build set one
// (next.config.mjs).  No date, no row.
export function titleBlock(): readonly (readonly [string, string])[] {
  const revised = process.env.NEXT_PUBLIC_SHEET_REVISED;
  return revised ? [...TITLE_BLOCK, [REVISED_KEY, revised]] : TITLE_BLOCK;
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
      {/* R25: the wordmark and title block first, the drawing under them —
          in the markup, so reading and tab order match the screen. */}
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
          {/* R42: the stamp sits over the title block, absolutely placed,
              so it takes no room and moves nothing when it lands. */}
          <div className="cs-tb-wrap">
            <dl className="cs-tb">
              {titleBlock().map(([k, v]) => (
                <div key={k} className="cs-tb-row">
                  <dt className="tr-step cs-tb-k">{k}</dt>
                  <dd className="tr-field cs-tb-v">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="tr-section cs-stamp">{STAMP}</p>
          </div>
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
      <PlanDrawing />
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

      <MilepostRoad>
        <section id="how" className="cs-section" data-milepost="0" aria-labelledby="cs-how">
          <SectionHead id="cs-how" n={HOW.n} title={HOW.title} prov={HOW.prov} />
          <p className="sr-only">{HOW.strip}</p>
          <div className="cs-strip3">
            {HOW.steps.map((s, i) => (
              <Fragment key={s.step}>
                <div className={`cs-station cs-at-${i}`}>
                  <StationDrawing i={i as 0 | 1 | 2} />
                </div>
                <div className={`cs-step-text cs-at-${i}`}>
                  <h3 className="cs-title">{s.title}</h3>
                  <p className="cs-body">{s.body}</p>
                </div>
              </Fragment>
            ))}
          </div>
        </section>

        <section className="cs-section" data-milepost="1" aria-labelledby="cs-hand">
          <SectionHead id="cs-hand" n={HAND_OVER.n} title={HAND_OVER.title} prov={HAND_OVER.prov} />
          <div className="cs-stacks">
            {HAND_OVER.items.map((it, i) => (
              <PaperStack key={it.step} move={STACK_MOVES[i]}>
                <StackArt i={i as 0 | 1 | 2 | 3} />
                <div className="cs-stack-text">
                  <span className="tr-step">{it.step}</span>
                  <h3 className="cs-title">{it.title}</h3>
                  <p className="cs-body">{it.body}</p>
                </div>
              </PaperStack>
            ))}
          </div>
        </section>

        <section id="sources" className="cs-section" data-milepost="2" aria-labelledby="cs-sources">
          <SectionHead id="cs-sources" n={SOURCES.n} title={SOURCES.title} />
          <div className="cs-sources">
            <div className="cs-sources-text">
              <h3 className="tr-question">{SOURCES.question}</h3>
              <p className="cs-body">{SOURCES.body}</p>
              <span className="tr-prov cs-sources-prov">{SOURCES.prov}</span>
              <ul className="cs-chips">
                {SOURCES.chips.map((c) => (
                  <li key={c} className="tr-prov cs-chip">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div className="cs-detail">
              <DetailDrawing />
            </div>
          </div>
        </section>

        <section className="cs-section" data-milepost="3" aria-labelledby="cs-who">
          <SectionHead id="cs-who" n={WHO.n} title={WHO.title} prov={WHO.prov} />
          <div className="cs-who">
            {WHO.people.map((p, i) => (
              <Fragment key={p.step}>
                {i === 1 && (
                  <div className="cs-same">
                    <span className="tr-prov cs-on-ink">{WHO.same}</span>
                  </div>
                )}
                <div className="cs-who-card">
                  {i === 0 ? <PhoneArt /> : <LaptopArt />}
                  <div className="cs-who-text">
                    <span className="tr-step">{p.step}</span>
                    <h3 className="cs-title">{p.title}</h3>
                    <p className="cs-body">{p.body}</p>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </section>

        <section className="cs-section" aria-labelledby="cs-founders">
          <SectionHead id="cs-founders" n={FOUNDERS.n} title={FOUNDERS.title} prov={FOUNDERS.prov} />
          <div className="cs-founders">
            <div className="cs-founders-note">
              <h3 className="tr-question">{FOUNDERS.headline}</h3>
              {FOUNDERS.paragraphs.map((p) => (
                <p key={p.slice(0, 24)} className="cs-body">
                  {p}
                </p>
              ))}
            </div>
            <div className="cs-founders-side">
              <h4 className="tr-section cs-founders-head">{FOUNDERS.signoff}</h4>
              <ul className="cs-founders-list">
                {FOUNDERS.people.map(({ name, role, photo }) => (
                  <li key={name} className="cs-founder">
                    {photo ? (
                      // R24: already 112 px square for 56 px at 2×, so
                      // there is nothing for next/image to resize.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="cs-founder-photo" src={photo} width={56} height={56} alt={name} />
                    ) : (
                      <span className="cs-founder-photo cs-founder-initial" aria-hidden="true">
                        {name[0]}
                      </span>
                    )}
                    <span className="cs-founder-text">
                      <span className="cs-title">{name}</span>
                      <span className="tr-step">{role}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="cs-close" data-milepost="4" aria-label={CLOSE.title}>
          <ColoradoMap />
          <div className="cs-close-stack">
            <span className="tr-section">{CLOSE.title}</span>
            <p className="cs-body">{CLOSE.body}</p>
            <a className="dl-btn cs-close-btn" href={NOTIFY_HREF}>
              {CLOSE.link}
            </a>
          </div>
        </section>
      </MilepostRoad>
    </div>
  );
}
