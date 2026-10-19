"use client";

import { useEffect } from "react";

// The lean page's scroll-in motion (design/landing-v2/lean-page/
// lean-motion.css).  Each `.an` section gets `go` the first time a quarter
// of it is on screen, then is dropped from the observer: it plays once and
// never replays.  The starting state is hidden only under `.js-anim` on
// `.lv-outer`, which this adds after it has marked the sections already on
// screen, so without JS everything is visible and still, and nothing
// flashes away.
// Under reduced motion it does nothing: no `go`, everything shows finished.
const THRESHOLD = 0.25;

export function LeanMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;
    const sections = [...document.querySelectorAll<HTMLElement>(".an:not(.go)")];
    const vh = window.innerHeight;
    const onScreen = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const seen = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      return r.height > 0 && seen / Math.min(r.height, vh) >= THRESHOLD;
    };
    const rest = sections.filter((el) => {
      if (!onScreen(el)) return true;
      el.classList.add("go");
      return false;
    });
    const root = document.querySelector(".lv-outer");
    if (!root) return;
    root.classList.add("js-anim");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("go");
          io.unobserve(e.target);
        }
      },
      { threshold: THRESHOLD },
    );
    for (const el of rest) io.observe(el);
    return () => {
      io.disconnect();
      root.classList.remove("js-anim");
    };
  }, []);
  return null;
}
