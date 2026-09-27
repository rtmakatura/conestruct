"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ROAD } from "@/lib/coming-soon-copy";
import {
  ROAD_MIN_WIDTH,
  STRETCHES,
  X,
  easeToward,
  roadFront,
  roadLayout,
  stretchAt,
  type RoadLayout,
} from "@/lib/coming-soon-road";

// The milepost road (coming-soon-gate R13) and its marker (R14).
//
// Wraps sections 01 → close.  Each milepost section carries
// `data-milepost="0".."4"`; the road is laid out from their measured tops
// (lib/coming-soon-road.ts roadLayout), again on resize.
//
// Motion (R13, extending R10's recorded exception): ONE passive scroll
// listener plus requestAnimationFrame.  Each frame writes the reveal
// clip's height and the fade gradient's two stops straight onto the SVG —
// no React render per frame.  React renders only when the layout changes
// (resize) or the highlight crosses into another stretch (the marker).
// The road is absolutely positioned in the left margin and the marker is
// fixed, so nothing on the page moves (P1).
//
// prefers-reduced-motion: reduce — the road is fully drawn, no fade, no
// rAF.  The marker still follows the scroll, stretch by stretch, with no
// transition (A3-Q3).  Below ROAD_MIN_WIDTH neither exists (CSS hides the
// road; the marker is never shown).

const REDUCE = "(prefers-reduced-motion: reduce)";
const WIDE = `(min-width: ${ROAD_MIN_WIDTH}px)`;

function matches(q: string): boolean {
  try {
    return window.matchMedia(q).matches;
  } catch {
    return false;
  }
}

function sameLayout(a: RoadLayout | null, b: RoadLayout): boolean {
  return !!a && a.h === b.h && a.starts.every((s, i) => s === b.starts[i]);
}

function RoadArt({ l }: { l: RoadLayout }) {
  const t = l.top;
  return (
    <>
      <line className="cs-road" x1={X.edgeL} x2={X.edgeL} y1={t} y2={l.end} />
      <line className="cs-road" x1={X.edgeR} x2={X.edgeR} y1={t} y2={l.end} />
      <line className="cs-lane" x1={X.lane} x2={X.lane} y1={t} y2={l.end} />
      <path
        className="cs-flow"
        d={`M85 ${t + 20}V${t + 60}M79 ${t + 52}L85 ${t + 60}L91 ${t + 52}M115 ${t + 20}V${t + 60}M109 ${t + 52}L115 ${t + 60}L121 ${t + 52}`}
      />
      {STRETCHES.map((s, i) => {
        const a = l.starts[i];
        const b = l.starts[i + 1];
        return (
          <g key={s.zone} className="cs-road-stretch" data-zone={s.zone}>
            <rect className="cs-road-bar" x={X.bar} y={a} width="4" height={b - a} fill={s.colour} />
            <text
              className="tr-prov cs-road-word"
              fill="currentColor"
              textAnchor="middle"
              transform={`translate(${X.word} ${(a + b) / 2}) rotate(-90)`}
            >
              {s.word}
            </text>
            <rect className="cs-post-box" x="144" y={a} width="36" height="28" />
            <text className="tr-step cs-on-ink" fill="currentColor" x={X.post} y={a + 18} textAnchor="middle">
              {s.post}
            </text>
            <line className="cs-post-line" x1={X.post} x2={X.post} y1={a + 28} y2={a + 44} />
          </g>
        );
      })}
      {l.signs.map((y, k) => (
        <g key={k}>
          <rect className="cs-sign" x="14" y={y - 6} width="12" height="12" transform={`rotate(45 20 ${y})`} />
          <line className="cs-sign" x1="26" x2="34" y1={y} y2={y} />
        </g>
      ))}
      <rect className="cs-box" x="72" y={l.work[0]} width="22" height={l.work[1] - l.work[0]} />
      <text
        className="tr-section"
        fill="currentColor"
        textAnchor="middle"
        transform={`translate(87 ${(l.work[0] + l.work[1]) / 2}) rotate(-90)`}
      >
        {ROAD.work}
      </text>
      {l.devices.map(([x, y], k) => (
        <rect key={k} className="cs-dev" x={x - 3} y={y - 3} width="6" height="6" />
      ))}
    </>
  );
}

export function MilepostRoad({ children }: { children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const reveal = useRef<SVGRectElement>(null);
  const fade = useRef<SVGLinearGradientElement>(null);
  const [layout, setLayout] = useState<RoadLayout | null>(null);
  const [at, setAt] = useState(-1);
  const st = useRef({
    layout: null as RoadLayout | null,
    roadTop: 0,
    navBottom: 0,
    cur: null as number | null,
    target: 0,
    still: false,
    wide: false,
    raf: 0,
    at: -1,
  });

  // Painting: attribute writes only.
  const paint = () => {
    const s = st.current;
    const l = s.layout;
    if (!l) return;
    const f = s.still ? l.h : (s.cur ?? 0);
    reveal.current?.setAttribute("height", String(Math.max(0, f)));
    const done = s.still || f >= l.h - 1;
    fade.current?.setAttribute("y1", String(done ? l.h + 1 : f + 300));
    fade.current?.setAttribute("y2", String(done ? l.h + 2 : f + 1000));
    // A3-Q3: under reduced motion the marker reads the scroll directly.
    // The marker is fixed top-right, where the nav's "Get notified" sits:
    // it waits until the nav has scrolled away (a tall window can start
    // the highlight at the top of the page).
    const clear = window.scrollY >= s.navBottom;
    const i = s.wide && clear ? stretchAt(s.still ? s.target : f, l.starts) : -1;
    if (i !== s.at) {
      s.at = i;
      setAt(i);
    }
  };

  const tick = () => {
    const s = st.current;
    s.raf = 0;
    s.cur = easeToward(s.cur ?? s.target, s.target);
    paint();
    if (s.cur !== s.target) s.raf = requestAnimationFrame(tick);
  };

  const frame = () => {
    const s = st.current;
    const l = s.layout;
    if (!l) return;
    const vh = window.innerHeight;
    const docH = document.documentElement.scrollHeight;
    s.wide = matches(WIDE);
    s.still = matches(REDUCE) || docH <= vh + 20;
    s.target = roadFront({ scrollY: window.scrollY, vh, docH, roadTop: s.roadTop, h: l.h });
    // First paint lands where the page already is; no catch-up on load.
    if (s.cur === null || s.still) s.cur = s.target;
    paint();
    if (!s.still && s.cur !== s.target && !s.raf) s.raf = requestAnimationFrame(tick);
  };

  const measure = () => {
    const w = wrap.current;
    if (!w) return;
    const r = w.getBoundingClientRect();
    const tops = STRETCHES.map((_, i) => {
      const el = w.querySelector(`[data-milepost="${i}"]`);
      return el ? el.getBoundingClientRect().top - r.top : 0;
    });
    const l = roadLayout(tops, Math.round(r.height));
    st.current.roadTop = r.top + window.scrollY;
    const nav = document.querySelector("nav");
    st.current.navBottom = nav ? nav.getBoundingClientRect().bottom + window.scrollY : 0;
    if (!sameLayout(st.current.layout, l)) {
      st.current.layout = l;
      setLayout(l);
    }
  };

  // After a layout render, the refs point at the new SVG: paint it now,
  // before the browser shows it.
  useLayoutEffect(() => {
    frame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  useEffect(() => {
    const onScroll = () => frame();
    const onResize = () => {
      measure();
      frame();
    };
    measure();
    frame();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && wrap.current) {
      ro = new ResizeObserver(onResize);
      ro.observe(wrap.current);
    }
    const mqs = [REDUCE, WIDE].map((q) => {
      try {
        return window.matchMedia(q);
      } catch {
        return null;
      }
    });
    mqs.forEach((m) => m?.addEventListener?.("change", onScroll));
    const s = st.current;
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      mqs.forEach((m) => m?.removeEventListener?.("change", onScroll));
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = STRETCHES[Math.max(0, at)];
  return (
    <div ref={wrap} className="cs-road-wrap">
      {layout && (
        <svg className="cs-road-svg" width="200" height={layout.h} role="img" aria-label={ROAD.aria}>
          <defs>
            <clipPath id="cs-road-reveal">
              <rect ref={reveal} className="cs-road-reveal" x="0" y="0" width="200" height={layout.h} />
            </clipPath>
            <linearGradient
              ref={fade}
              id="cs-road-fade"
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="0"
              y1={layout.h + 1}
              y2={layout.h + 2}
            >
              <stop offset="0" stopColor="white" />
              <stop offset="1" stopColor="black" />
            </linearGradient>
            <mask id="cs-road-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height={layout.h}>
              <rect x="0" y="0" width="200" height={layout.h} fill="url(#cs-road-fade)" />
            </mask>
          </defs>
          {/* Ahead of the highlight: the road, faint, fading to nothing. */}
          <g mask="url(#cs-road-mask)">
            <g className="cs-road-ahead">
              <RoadArt l={layout} />
            </g>
          </g>
          {/* The highlight: the road as far as the visitor has come. */}
          <g className="cs-road-lit" clipPath="url(#cs-road-reveal)">
            <RoadArt l={layout} />
          </g>
        </svg>
      )}
      {children}
      <div className="cs-mp" hidden={at < 0} aria-hidden="true">
        <span className="tr-step">{ROAD.milepost}</span>
        <span className="tr-section">{shown.post}</span>
        <span className="cs-swatch" style={{ background: shown.colour }} />
        <span className="tr-prov cs-on-ink">{shown.word}</span>
      </div>
    </div>
  );
}
