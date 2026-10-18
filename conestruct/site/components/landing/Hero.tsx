"use client";

import { useState } from "react";
import { HERO_NARROW, HERO_WIDE } from "./plan-art";
import { PlanSvg } from "./PlanSvg";

// Landing v2 hero (design/landing-v2/landing-v2-reference.html, the first
// section).  C, the spotlight: each NEEDS YOU row and number is a button;
// hover or focus puts one f-* class on the drawing, and leaving or blurring
// clears it.  The drawing's own CSS (globals.css, "landing v2") does the
// dimming, so keyboard and mouse land on the same state.
type Focus = "int" | "walk" | "dev" | "taper" | "buffer";

export function Hero() {
  const [focus, setFocus] = useState<Focus | null>(null);
  const on = (f: Focus) => ({
    onMouseEnter: () => setFocus(f),
    onFocus: () => setFocus(f),
    onMouseLeave: () => setFocus(null),
    onBlur: () => setFocus(null),
  });
  const planClass = `plan mB mC${focus ? ` f-${focus}` : ""}`;

  return (
    <section className="lv-hero">
      <div className="lv-hero-row">
        <div className="lv-hero-copy">
          <div className="lv-kicker">TRAFFIC CONTROL PLANS FOR COLORADO WORK ZONES</div>
          <h1 className="lv-h1">
            Mark the work.
            <br />
            Get the plan.
          </h1>
          <p className="lv-lede">
            Conestruct reads the road at your pin and drafts the MHT. It tells you what it found near
            the work, and what that changed, before a reviewer has to.
          </p>
          <div className="lv-cta-stack">
            <div className="lv-cta-row">
              <a className="lv-pri" href="#compare">
                Send us a past job
              </a>
              <a className="lv-textlink" href="#join">
                or join the waitlist
              </a>
            </div>
            <p className="lv-cta-note">
              Pick a job you&apos;ve already permitted. We&apos;ll draft it from the road so you can see
              Conestruct on a road you know.
            </p>
          </div>
          <p className="lv-mono-note">
            drafts for review by a certified tcs or pe
            <br />
            conestruct doesn&apos;t stamp or approve plans
          </p>
        </div>
        <div className="lv-card-col">
          <aside className="lv-needs" aria-label="Site conditions found near the work">
            <div className="lv-panel-head">
              <span className="lv-head-ink">NEEDS YOU</span>
              <span className="lv-head-aside">2 site conditions</span>
            </div>
            <button type="button" className="lv-flag lv-flag-first" {...on("int")}>
              <span className="lv-flag-grid">
                <span aria-hidden="true" className="lv-flag-glyph">
                  ▲
                </span>
                <span className="lv-flag-title">Adjacent at-grade intersection</span>
                <span />
                <span className="lv-flag-meta">nearest 64 ft · no devices added · mutcd §6n.12</span>
              </span>
            </button>
            <button type="button" className="lv-flag" {...on("walk")}>
              <span className="lv-flag-grid">
                <span aria-hidden="true" className="lv-flag-glyph">
                  ▲
                </span>
                <span className="lv-flag-title">Pedestrian sidewalks</span>
                <span />
                <span className="lv-flag-meta">
                  nearest 65.9 ft · changed this plan · <span className="lv-dim">4</span> devices added
                  · mutcd §6c.02
                </span>
              </span>
            </button>
            <div className="lv-stats">
              <button type="button" className="lv-stat" {...on("dev")}>
                <span className="lv-stat-in">
                  <span className="lv-stat-num">43</span>
                  <span className="lv-stat-label">devices</span>
                </span>
              </button>
              <button type="button" className="lv-stat" {...on("taper")}>
                <span className="lv-stat-in">
                  <span className="lv-stat-num">50 ft</span>
                  <span className="lv-stat-label">taper · table 6b-4</span>
                </span>
              </button>
              <button type="button" className="lv-stat" {...on("buffer")}>
                <span className="lv-stat-in">
                  <span className="lv-stat-num">200 ft</span>
                  <span className="lv-stat-label">buffer · table 6b-2</span>
                </span>
              </button>
            </div>
          </aside>
          <p className="lv-hint">point at a flag or a number to find it on the drawing</p>
        </div>
      </div>
      <figure className="lv-hero-fig">
        <div className="lv-frame">
          <div className="lv-illus-wide">
            <PlanSvg art={HERO_WIDE} className={planClass} />
          </div>
          <div className="lv-illus-narrow">
            <PlanSvg art={HERO_NARROW} className={planClass} />
          </div>
        </div>
        <figcaption className="lv-figcap">
          <span>E COLFAX AVE EASTBOUND · SHOULDER WORK · FROM THE OCT 17 RUN</span>
          <span>ILLUSTRATION · NOT TO SCALE</span>
        </figcaption>
      </figure>
    </section>
  );
}
