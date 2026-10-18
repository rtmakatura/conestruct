import Image from "next/image";
import Link from "next/link";
import { CompareForm } from "./CompareForm";
import { Hero } from "./Hero";
import { STEP1 } from "./plan-art";
import { PlanSvg } from "./PlanSvg";
import { WaitlistForm } from "./WaitlistForm";

// Landing v2 at `/` — the approved page from the Oct 17 canvas
// (design/landing-v2/landing-v2-reference.html), rebuilt on the workbench
// tokens.  Copy, section order and the spacing system are the reference's;
// the styles live in globals.css under "landing v2".
//
// Held from the reference until its prerequisites close (cc-prompt-landing-
// v2-page.md): "Download the sample plan" (the Colfax sheet is unconfirmed),
// and the form's submit (cc-prompt-landing-v2-form.md wires it).

const PILOT_HREF = "mailto:ryan@conestruct.com?subject=Conestruct%20paid%20pilot";

function SectionLabel({ n, title, aside }: { n: string; title: string; aside: string }) {
  return (
    <div className="lv-label">
      <span className="lv-head-ink">
        <span className="lv-label-n">{n}</span>
        {title}
      </span>
      <span className="lv-label-aside">{aside}</span>
    </div>
  );
}

function Section({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <>
      <div className="lv-rule rule-draw" aria-hidden="true" />
      <section id={id} className="lv-section">
        <div className="reveal">{children}</div>
      </section>
    </>
  );
}

function Pain({ head, body, cite }: { head: string; body: string; cite: string }) {
  return (
    <div className="lv-pain">
      <div className="lv-pain-head">{head}</div>
      <div className="lv-pain-body">
        <p>{body}</p>
        <span className="lv-cite">{cite}</span>
      </div>
    </div>
  );
}

function Step({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div className="lv-step-copy">
      <div className="lv-step-kicker">{kicker}</div>
      <h3 className="lv-h3">{title}</h3>
      <p className="lv-step-body">{body}</p>
    </div>
  );
}

function Found({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`lv-found${last ? " lv-row-last" : ""}`}>
      <span aria-hidden="true" className="lv-pass">
        ✓
      </span>
      <span className="lv-found-label">{label}</span>
      <span className="lv-found-value">{value}</span>
    </div>
  );
}

function Read({
  label,
  source,
  guess,
  value,
  last,
}: {
  label: string;
  source: string;
  guess?: boolean;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={`lv-read${last ? " lv-row-last" : ""}`}>
      <span className="lv-read-name">
        <span className="lv-read-label">{label}</span>
        <span className={guess ? "lv-read-src lv-warn" : "lv-read-src"}>{source}</span>
      </span>
      <span className="lv-read-value">{value}</span>
    </div>
  );
}

function Fact({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`lv-fact${last ? " lv-fact-last" : ""}`}>
      <span className="lv-fact-label">{label}</span>
      <span className={label === "TYPICAL" ? "lv-fact-value" : "lv-fact-value lv-dim"}>{value}</span>
    </div>
  );
}

function FileCard({
  aud,
  kind,
  title,
  body,
  n,
  rest,
}: {
  aud: string;
  kind: string;
  title: string;
  body: string;
  n: string;
  rest: string;
}) {
  return (
    <article className="lv-cell lv-file">
      <div className="lv-file-head">
        <span>{aud}</span>
        <span>{kind}</span>
      </div>
      <h3 className="lv-file-title">{title}</h3>
      <p className="lv-small">{body}</p>
      <div className="lv-file-foot">
        <span className="lv-dim">{n}</span>
        {rest}
      </div>
    </article>
  );
}

function AuditRow({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`lv-audit-row${last ? " lv-row-last" : ""}`}>
      <span className={last ? "lv-ink" : undefined}>{label}</span>
      <span className="lv-audit-val">{children}</span>
    </div>
  );
}

function Wont({ head, body }: { head: string; body: string }) {
  return (
    <div className="lv-cell lv-wont">
      <span className="lv-wont-head">{head}</span>
      <p className="lv-small">{body}</p>
    </div>
  );
}

function Who({ term, body }: { term: string; body: string }) {
  return (
    <div className="lv-who">
      <dt>{term}</dt>
      <dd>{body}</dd>
    </div>
  );
}

function Founder({ name, role }: { name: string; role: string }) {
  return (
    <li className="lv-founder">
      <span aria-hidden="true" className="lv-founder-initial">
        {name[0]}
      </span>
      <span className="lv-founder-text">
        <span className="lv-founder-name">{name}</span>
        <span className="lv-founder-role">{role}</span>
      </span>
    </li>
  );
}

export function Landing() {
  return (
    <div className="workbench lv-page">
      <div className="lv-outer">
        <header className="lv-nav">
          <div className="lv-nav-left">
            <a className="lv-wordmark" href="#top">
              conestruct<span className="lv-dim">.</span>
            </a>
            <nav className="lv-nav-links" aria-label="Sections">
              <a href="#how">HOW IT WORKS</a>
              <a href="#files">WHAT YOU GET</a>
              <a href="#sources">SOURCES</a>
            </nav>
          </div>
          <a className="lv-nav-cta" href="#compare">
            SEND US A PAST JOB
          </a>
        </header>

        <main id="top" className="lv-main">
          <Hero />

          <Section>
            <SectionLabel n="02" title="HOW IT GOES NOW" aside="from plan reviewers and city permit documents" />
            <p className="lv-statement">
              The bid is due at 3. The plan designer can get to it Thursday. The city gets it after that, and if one
              taper is short, it comes back.
            </p>
            <div className="lv-pains">
              <Pain
                head="Sent back."
                body="Plan review checks your plan against the code. It doesn't fix it. A missing sign or a short taper sends the whole plan to the back of the line."
                cite={'denver doti pwpt-121.2 · "rejected as incomplete"'}
              />
              <Pain
                head="Paid twice."
                body="In Aurora, every TCP resubmittal carries another review fee. The second plan costs more than the first."
                cite="aurora tcp instructions · fee per additional review"
              />
              <Pain
                head="Waiting."
                body="First on a plan, then on the city. In Denver, a resubmittal waits as long as the first review did."
                cite="denver doti pwpt-121.2 · resubmittal review times"
              />
            </div>
            <p className="lv-close-line">
              The city&apos;s review clock belongs to the city. A plan that goes in right the first time only waits on it
              once.
            </p>
          </Section>

          <Section id="how">
            <SectionLabel n="03" title="HOW A PLAN IS MADE" aside="the colfax run · oct 17, 2026" />
            <h2 className="lv-h2">Three moves. Every one shows its work.</h2>
            <div className="lv-steps">
              <div className="lv-step">
                <Step
                  kicker="STEP 1 · PIN"
                  title="Mark the work."
                  body="Type an address or drop a pin where the work starts. Conestruct finds the road and asks which way it runs, then lays out the work zone on the aerial."
                />
                <div className="lv-step-panel-col">
                  <div className="lv-panel">
                    <div className="lv-panel-head lv-panel-head-start">
                      <span className="lv-step-of">STEP 1 OF 4</span>
                      <span className="lv-step-name">WHERE</span>
                    </div>
                    <div className="lv-found-list">
                      <Found label="Found the spot" value="East Colfax Avenue Eastbound · Denver" />
                      <Found label="Work starts" value="90 ft W of Williams Street" />
                      <Found label="Extent" value="1,000 ft · typed" />
                      <Found label="Side and kind" value="South side · shoulder work" last />
                    </div>
                    <div className="lv-step1-art">
                      <PlanSvg art={STEP1} />
                    </div>
                    <div className="lv-legend">
                      <span>
                        <span aria-hidden="true" className="lv-swatch lv-swatch-adv" />
                        advance warning
                      </span>
                      <span>
                        <span aria-hidden="true" className="lv-swatch lv-swatch-dim" />
                        taper · buffer
                      </span>
                      <span>
                        <span aria-hidden="true" className="lv-swatch lv-swatch-work" />
                        work zone
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lv-step">
                <Step
                  kicker="STEP 2 · CHECK"
                  title="Check what we read."
                  body="Speed, lanes, road type and jurisdiction come off the road at your pin. Each one says where it came from: measured, from the road, or from the pin. Fix what's wrong and leave what's right."
                />
                <div className="lv-step-panel-col">
                  <div className="lv-panel">
                    <div className="lv-panel-head">
                      <span className="lv-panel-head-start">
                        <span className="lv-step-of">STEP 2 OF 4</span>
                        <span className="lv-step-name">WHAT</span>
                      </span>
                      <span className="lv-faint">3 guesses marked</span>
                    </div>
                    <div className="lv-read-list">
                      <div className="lv-read-q">Anything we got wrong?</div>
                      <Read label="Speed" source="✓ measured" value="30 mph" />
                      <Read label="Lanes" source="✓ measured" value="2 per side · 12 ft" />
                      <Read label="Road type" source="⚠ from the road" guess value="Urban street" />
                      <Read label="Jurisdiction" source="⚠ from the pin" guess value="Denver" last />
                    </div>
                  </div>
                </div>
              </div>

              <div className="lv-step3">
                <div className="lv-step3-copy">
                  <Step
                    kicker="STEP 3 · PLAN"
                    title="Take the plan."
                    body="You get the drawing, the device count and the crew sheet, laid out on the road you picked. Anything near the work that changed the plan is listed with its MUTCD section and what it added."
                  />
                </div>
                <figure className="lv-panel lv-sheet">
                  <div className="lv-panel-head">
                    <span className="lv-head-ink">METHOD OF HANDLING TRAFFIC · E COLFAX AVE EB</span>
                    <span className="lv-draft">DRAFT</span>
                  </div>
                  <Image
                    src="/landing/colfax-plan-dark.jpg"
                    alt="The generated plan drawn in light linework: taper, buffer, cones, signs and the arrow board along the shoulder"
                    width={2400}
                    height={765}
                    sizes="(max-width: 1320px) 100vw, 1240px"
                    className="lv-sheet-img"
                  />
                  <div className="lv-facts">
                    <Fact label="TYPICAL" value="TA-3 · S-630-1" />
                    <Fact label="SPEED" value="30 mph" />
                    <Fact label="TAPER" value="50 ft" />
                    <Fact label="BUFFER" value="200 ft" />
                    <Fact label="WORK ZONE" value="1,000 ft" />
                    <Fact label="DEVICES" value="43" last />
                  </div>
                </figure>
              </div>
            </div>
          </Section>

          <Section id="files">
            <SectionLabel n="04" title="WHAT YOU HAND OVER" aside="each one written for the person who reads it" />
            <h2 className="lv-h2">One job in, four files out.</h2>
            <div className="lv-grid lv-grid-framed">
              <FileCard
                aud="FOR THE BID AND PERMIT"
                kind="PDF"
                title="Plan sheet"
                body="The drawing on the road you picked, with the sign schedule, device summary and legend on the sheet."
                n="11×17"
                rest=" · TA-3 · S-630-1"
              />
              <FileCard
                aud="FOR THE ESTIMATOR"
                kind="XLSX"
                title="Device list"
                body="Every device the plan calls for, by MUTCD code, CDOT pay item and quantity, ready to price."
                n="11"
                rest=" line items · CDOT pay items"
              />
              <FileCard
                aud="FOR THE CREW"
                kind="PDF"
                title="Crew sheet"
                body="What to set and where, in the order to set it, plus takedown."
                n="14"
                rest=" steps · setup + takedown"
              />
              <FileCard
                aud="FOR THE REVIEWER"
                kind="PDF"
                title="Audit"
                body="Every check the plan ran and the MUTCD or CDOT source behind it."
                n="15"
                rest=" checks · each cited"
              />
            </div>
            <div className="lv-files-foot">
              <p className="lv-mono-note">all four from one run on e colfax ave, oct 17, 2026</p>
              {/* "Download the sample plan ↓" is held until the Colfax sheet is
                  confirmed (prerequisite 3); with no sample there is no button. */}
            </div>
          </Section>

          <Section id="sources">
            <SectionLabel n="05" title="EVERY NUMBER SHOWS WHERE IT CAME FROM" aside="mutcd 11th edition · cdot s-630-1" />
            <div className="lv-split">
              <div className="lv-split-copy lv-split-copy-340">
                <h2 className="lv-h2 lv-h2-flush">Where did that number come from?</h2>
                <p className="lv-body">
                  Every taper, buffer and spacing on the plan carries its citation in the audit: the MUTCD section,
                  table or figure, or the CDOT S-630-1 sheet it came from. The person who reviews the plan can check it
                  in one step. Where a value needs a person, the plan says so.
                </p>
              </div>
              <figure className="lv-panel lv-audit">
                <div className="lv-panel-head">
                  <span className="lv-head-ink">AUDIT · TAPER LENGTH</span>
                  <span className="lv-head-aside">from the colfax run</span>
                </div>
                <div className="lv-audit-body">
                  <AuditRow label="Posted speed">
                    <span className="lv-dim">30 mph</span>
                  </AuditRow>
                  <AuditRow label="Below 45 mph, so">
                    <span className="lv-ink">L = W × S² / 60</span>
                  </AuditRow>
                  <AuditRow label="Shoulder width W">
                    <span className="lv-dim">10 ft</span> <span className="lv-warn">⚠ assumed</span>
                  </AuditRow>
                  <AuditRow label="L = 10 × 30² / 60">
                    <span className="lv-dim">150 ft</span>
                  </AuditRow>
                  <AuditRow label="Shoulder taper, L/3" last>
                    <span className="lv-dim lv-strong">50 ft</span>
                  </AuditRow>
                  <p className="lv-audit-src">
                    source: mutcd 11th ed. §6b.08, table 6b-4 · shoulder closures use l/3 per §6b.08, table 6b-3 · cdot
                    s-630-1, case 11
                  </p>
                </div>
              </figure>
            </div>
            <div className="lv-panel lv-wonts">
              <div className="lv-panel-head">
                <span className="lv-head-ink">WHAT IT WON&apos;T DO</span>
              </div>
              <div className="lv-grid">
                <Wont head="It won't stamp a plan." body="A Certified TCS or PE reviews and signs every one." />
                <Wont head="It won't promise approval." body="That's the city's call." />
                <Wont
                  head="It won't guess quietly."
                  body="A value it inferred is marked as inferred, and anything it couldn't check is listed as not verified."
                />
              </div>
            </div>
          </Section>

          <Section>
            <SectionLabel n="06" title="WHO IT'S FOR, AND WHO'S BUILDING IT" aside="colorado first" />
            <div className="lv-split">
              <div className="lv-split-copy lv-split-copy-380">
                <h2 className="lv-h2 lv-h2-flush">
                  Built for the people who set the cones, and the people who price them.
                </h2>
                <dl className="lv-whos">
                  <Who term="IN THE FIELD" body="The rep with a bid due today, marking the work on a phone at the truck." />
                  <Who
                    term="AT THE DESK"
                    body="The estimator whose device count drives the number, changing one thing to see what it does."
                  />
                  <Who term="ALSO" body="Utility, excavation and paving crews pulling their own Street Occupancy Permits." />
                </dl>
              </div>
              <div className="lv-panel lv-why">
                <div className="lv-why-body">
                  <div className="lv-eyebrow">WHY WE&apos;RE BUILDING IT</div>
                  <p className="lv-why-p lv-ink">
                    The first national manual on traffic control devices came out in 1935. Every edition since has added
                    what the last one learned. Applying it to one road at one speed is careful work every single time.
                  </p>
                  <p className="lv-why-p">
                    Two of us come from the field. We built the tool we kept wishing we had: it applies the manual to your
                    road, shows where every number came from, and leaves the judgment calls to the licensed people who
                    make them.
                  </p>
                </div>
                <ul className="lv-founders">
                  <Founder name="Ryan" role="PRODUCT" />
                  <Founder name="James" role="PRICING" />
                  <Founder name="Zac" role="CUSTOMERS" />
                </ul>
              </div>
            </div>
          </Section>

          <Section id="compare">
            <SectionLabel n="07" title="BUILT IN COLORADO" aside="a draft of a job you already know" />
            <h2 className="lv-h2-close">Send us a job you&apos;ve already permitted.</h2>
            <p className="lv-close-lede">
              We&apos;ll draft it from the road and send back all four files, ready to set beside the plan that got
              approved. It&apos;s the quickest way to see Conestruct on a road you already know.
            </p>
            <div className="lv-compare">
              <CompareForm />
              <div id="pilot" className="lv-panel lv-pilot">
                <div className="lv-pilot-block lv-pilot-how">
                  <div className="lv-eyebrow">HOW THE COMPARISON WORKS</div>
                  <ol className="lv-how-list">
                    <li>
                      <span className="lv-how-n">1</span>
                      <span>You send a job you already permitted.</span>
                    </li>
                    <li>
                      <span className="lv-how-n">2</span>
                      <span>We draft it from the road and send the four files back.</span>
                    </li>
                    <li>
                      <span className="lv-how-n">3</span>
                      <span>You see it side by side with the plan that got approved.</span>
                    </li>
                  </ol>
                </div>
                <div className="lv-pilot-block">
                  <div className="lv-eyebrow">THE PAID PILOT</div>
                  <p className="lv-body-15">
                    A small number of Colorado traffic control companies. You send real jobs, we draft the plans, your TCS
                    reviews them, and we tune Conestruct to the way your company works.
                  </p>
                  <a className="lv-pilot-link" href={PILOT_HREF}>
                    Apply for the pilot →
                  </a>
                </div>
                <WaitlistForm />
              </div>
            </div>
          </Section>
        </main>

        <footer className="lv-footer">
          <div className="lv-footer-in">
            <span>© 2026 CONESTRUCT · BUILT IN COLORADO</span>
            <span className="lv-footer-links">
              <Link href="/terms">TERMS</Link>
              <Link href="/privacy">PRIVACY</Link>
              <span>OUTPUT REQUIRES TCS REVIEW · NOT A SUBSTITUTE FOR LICENSED JUDGMENT</span>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
