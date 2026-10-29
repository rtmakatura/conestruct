import Link from "next/link";
import { CompareForm } from "./CompareForm";
import { Hero } from "./Hero";
import { LeanMotion } from "./LeanMotion";
import { StepCheck, StepPin, StepSheet } from "./StepArt";
import { WaitlistForm } from "./WaitlistForm";

// The lean landing page at `/` (design/landing-v2/lean-page/, the Oct 19
// canvas): hero v2, then the problem, how it works, what you get, the
// past-job form and a short trust row.  Copy and order are the canvas's,
// on the workbench tokens and the landing spacing system; the styles live
// in globals.css under "landing v2".  Sections marked `an` play their
// scroll-in once (LeanMotion); the hero has its own motion and none here.
//
// Held until #350 closes (the Colfax sample sheet is unconfirmed): the
// sample plan download.  SAMPLE_HREF is null, so "See the audit in the
// sample plan", "Download the sample plan" and the file tiles' links are
// absent, and the tiles render as plain cards with no hover.

const PILOT_HREF = "mailto:ryan@conestruct.com?subject=Conestruct%20paid%20pilot";
const SAMPLE_HREF: string | null = null;

const d = (s: string) => ({ animationDelay: s });

function Pain({ head, body, note, delay }: { head: string; body: string; note: string; delay: string }) {
  return (
    <div className="rv lv-pain" style={d(delay)}>
      <h3 className="lv-h3">{head}</h3>
      <p className="lv-body">
        {body}
        <sup className="lv-sup">{note}</sup>
      </p>
    </div>
  );
}

function Step({
  n,
  title,
  body,
  delay,
  children,
}: {
  n: string;
  title: string;
  body: string;
  delay: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rv lv-step" style={d(delay)}>
      <div className="lv-step-pic">{children}</div>
      <h3 className="lv-h3 lv-step-title">
        <span className="lv-step-n">{n}</span>
        {title}
      </h3>
      <p className="lv-body">{body}</p>
    </div>
  );
}

function FileTile({ kind, title, body, delay }: { kind: string; title: string; body: string; delay: string }) {
  const inner = (
    <>
      <span className="lv-ft-k ft-k">{kind}</span>
      <span className="lv-ft-title">{title}</span>
      <span className="lv-small">{body}</span>
    </>
  );
  return SAMPLE_HREF ? (
    <a className="rv lv-ft ft" href={SAMPLE_HREF} download style={d(delay)}>
      {inner}
    </a>
  ) : (
    <div className="rv lv-ft" style={d(delay)}>
      {inner}
    </div>
  );
}

function Band({
  id,
  tint,
  an = true,
  children,
}: {
  id?: string;
  tint?: boolean;
  an?: boolean;
  children: React.ReactNode;
}) {
  const cls = ["lv-band", tint && "lv-band-tint", an && "an"].filter(Boolean).join(" ");
  return (
    <section id={id} className={cls}>
      <div className="lv-wrap">{children}</div>
    </section>
  );
}

export function Landing() {
  return (
    <div className="workbench lv-page">
      <LeanMotion />
      <div className="lv-outer">
        <header className="lv-nav">
          <div className="lv-nav-left">
            <a className="lv-wordmark" href="#top">
              conestruct<span className="lv-dim">.</span>
            </a>
            <nav className="lv-nav-links" aria-label="Sections">
              <a href="#how">HOW IT WORKS</a>
              <a href="#files">WHAT YOU GET</a>
            </nav>
          </div>
          <a className="lv-nav-cta" href="#send">
            SEND US A PAST JOB
          </a>
        </header>

        <main id="top">
          <div className="lv-main">
            <Hero />
          </div>

          <Band>
            <h2 className="rv lv-h2" style={d("0s")}>
              A plan that comes back costs you twice.
            </h2>
            <div className="lv-cols3">
              <Pain
                head="Sent back."
                body="Review checks your plan against the code. One short taper sends it to the back of the line."
                note="1"
                delay="0.18s"
              />
              <Pain
                head="Paid twice."
                body="In Aurora, every resubmittal carries another review fee."
                note="2"
                delay="0.27s"
              />
              <Pain
                head="Waiting."
                body="In Denver, a resubmittal waits as long as the first review did."
                note="1"
                delay="0.36s"
              />
            </div>
            <p className="rv lv-mono-note lv-notes" style={d(".5s")}>
              1 Denver DOTI PWPT-121.2 · 2 Aurora TCP instructions
            </p>
          </Band>

          <Band id="how">
            <div className="lv-eyebrow lv-band-label">HOW IT WORKS</div>
            <h2 className="rv lv-h2" style={d("0s")}>
              Three moves, and every number shows its work.
            </h2>
            <div className="lv-cols3">
              <Step
                n="1"
                title="Mark the work."
                body="Drop a pin where the work starts. Conestruct finds the road and the direction. You enter the work zone length."
                delay="0.1s"
              >
                <StepPin />
              </Step>
              <Step
                n="2"
                title="Check what we read."
                body="Speed, lanes and road type come off the road. Anything it guessed is marked so you can fix it."
                delay="1.1s"
              >
                <StepCheck />
              </Step>
              <Step
                n="3"
                title="Take the plan."
                body="The drawing, device count and crew sheet, laid out on your road. Every number cites its MUTCD or CDOT source."
                delay="2.4s"
              >
                <StepSheet />
              </Step>
            </div>
            {SAMPLE_HREF && (
              <a className="rv lv-textlink lv-after" href={SAMPLE_HREF} download style={d("3.6s")}>
                See the audit in the sample plan →
              </a>
            )}
          </Band>

          <Band id="files">
            <div className="lv-eyebrow lv-band-label">WHAT YOU GET</div>
            <h2 className="rv lv-h2" style={d("0s")}>
              One job in, four files out.
            </h2>
            <div className="lv-cols4">
              <FileTile
                kind="PDF"
                title="Plan sheet"
                body="The drawing on your road, ready for the bid and the permit."
                delay="0.15s"
              />
              <FileTile
                kind="XLSX"
                title="Device list"
                body="Every device by MUTCD code and CDOT pay item, ready to price."
                delay="0.24s"
              />
              <FileTile
                kind="PDF"
                title="Crew sheet"
                body="What to set and where, in order, plus takedown."
                delay="0.33s"
              />
              <FileTile kind="PDF" title="Audit" body="Every check the plan ran, and the source behind it." delay="0.42s" />
            </div>
            {SAMPLE_HREF && (
              <a className="rv lv-textlink lv-after" href={SAMPLE_HREF} download style={d(".55s")}>
                Download the sample plan ↓
              </a>
            )}
          </Band>

          <Band id="send" tint an={false}>
            <div className="lv-eyebrow lv-band-label">SEE IT ON A ROAD YOU KNOW</div>
            <h2 className="lv-h2">Send us a job you&apos;ve already permitted.</h2>
            <div className="lv-compare">
              <CompareForm />
              <div className="lv-compare-aside">
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
                    <span>You set it beside the plan that got approved.</span>
                  </li>
                </ol>
                <div id="pilot" className="lv-aside-links">
                  <a className="lv-textlink" href={PILOT_HREF}>
                    Traffic control company? Apply for the paid pilot →
                  </a>
                  <WaitlistForm />
                </div>
              </div>
            </div>
          </Band>

          <Band an={false}>
            <div className="lv-trust">
              <p className="lv-trust-who">
                <span className="lv-ink lv-strong">Built in Colorado by Ryan, James and Zac.</span> Two of us come from
                the field. We built the tool we kept wishing we had.
              </p>
              <p className="lv-trust-review">
                Drafts for review by a certified TCS or PE. Conestruct doesn&apos;t stamp or approve plans, and anything
                it inferred is marked as inferred. It won&apos;t promise approval. That&apos;s the city&apos;s call.
              </p>
            </div>
          </Band>
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
