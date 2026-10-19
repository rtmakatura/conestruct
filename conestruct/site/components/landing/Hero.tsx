"use client";

import { useState, type PointerEvent } from "react";
import { HERO_ISO, HERO_NARROW } from "./plan-art";
import { PlanSvg } from "./PlanSvg";

// Landing v2 hero (design/landing-v2/landing-v2-reference.html, the first
// section).  C, the spotlight: each NEEDS YOU row and number is a button;
// hover or focus puts one f-* class on the drawing, and leaving or blurring
// clears it.  The drawing's own CSS (globals.css, "landing v2") does the
// dimming, so keyboard and mouse land on the same state.
//
// The desktop drawing is the 3D scene (design/landing-v2/hero-3d/, v2).  It
// links back: its hover zones (.hit) and the two pins carry data-k, and
// pointing at one sets the same focus; the matching card row or number shows
// data-on="1".  Mouse only; the card buttons already reach every key from
// the keyboard.  From 1100 px the card sits inside the figure, over the
// scene's empty corner.  Phones keep the flat drawing (Ryan's ruling,
// 2026-10-19).
type Focus = "int" | "walk" | "dev" | "taper" | "buffer";
const KEYS: readonly string[] = ["int", "walk", "dev", "taper", "buffer"];

function sceneKey(el: EventTarget | null): Focus | null {
  const k = el instanceof Element ? el.closest("[data-k]")?.getAttribute("data-k") : null;
  return k && KEYS.includes(k) ? (k as Focus) : null;
}

export function Hero() {
  const [focus, setFocus] = useState<Focus | null>(null);
  const on = (f: Focus) => ({
    onMouseEnter: () => setFocus(f),
    onFocus: () => setFocus(f),
    onMouseLeave: () => setFocus(null),
    onBlur: () => setFocus(null),
    "data-on": focus === f ? "1" : "0",
  });
  const planClass = `plan mB mC${focus ? ` f-${focus}` : ""}`;
  const isoClass = `hero-iso${focus ? ` f-${focus}` : ""}`;
  // One handler on the <svg> (its markup is inner HTML): whatever the
  // pointer moves onto sets the key, so crossing from zone to zone switches
  // and bare scene clears; leaving the svg clears.  The zones touch edge to
  // edge, and everything but them and the pins ignores the pointer (CSS).
  const sceneOver = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "mouse") return;
    const k = sceneKey(e.target);
    setFocus((cur) => (cur === k ? cur : k));
  };
  const sceneLeave = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse") setFocus(null);
  };

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
        </div>
        <div className="lv-hero-pitch">
          <p className="lv-lede">
            Conestruct reads the road at your pin and drafts the MHT. It tells you what it found
            near the work, and what that changed, before a reviewer has to.
          </p>
          <div className="lv-cta-stack">
            <div className="lv-cta-row">
              <a className="lv-pri" href="#send">
                Send us a past job
              </a>
              <a className="lv-textlink" href="#join">
                or join the waitlist
              </a>
            </div>
          </div>
          <p className="lv-mono-note">
            drafts for review by a certified tcs or pe
          </p>
        </div>
      </div>
      <figure className="lv-hero-fig">
        <div className="lv-hero-stage">
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
                <span className="lv-flag-meta">
                  nearest 64 ft · no devices added · mutcd §6n.12
                </span>
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
                  nearest 65.9 ft · changed this plan · <span className="lv-dim">4</span> devices
                  added · mutcd §6c.02
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
                  <span className="lv-stat-label">taper · 6b-4</span>
                </span>
              </button>
              <button type="button" className="lv-stat" {...on("buffer")}>
                <span className="lv-stat-in">
                  <span className="lv-stat-num">200 ft</span>
                  <span className="lv-stat-label">buffer · 6b-2</span>
                </span>
              </button>
            </div>
          </aside>
          <div className="lv-frame">
            <div className="lv-illus-wide">
              <PlanSvg
                art={HERO_ISO}
                className={isoClass}
                onPointerOver={sceneOver}
                onPointerLeave={sceneLeave}
              />
            </div>
            <div className="lv-illus-narrow">
              <PlanSvg art={HERO_NARROW} className={planClass} />
            </div>
          </div>
        </div>
        <figcaption className="lv-figcap">
          <span>
            E COLFAX AVE EASTBOUND · SHOULDER WORK · FROM THE OCT 17 RUN ·{" "}
            <span className="lv-illus-wide">POINT AT THE CARD OR THE ROAD</span>
            <span className="lv-illus-narrow">POINT AT THE CARD</span>
          </span>
          <span className="lv-illus-wide">
            DISTANCES TO SCALE ALONG THE ROAD · WIDTHS EXAGGERATED
          </span>
          <span className="lv-illus-narrow">ILLUSTRATION · NOT TO SCALE</span>
        </figcaption>
      </figure>
    </section>
  );
}
