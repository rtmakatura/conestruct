// The landing check — the arc-28 machinery, moved out of the shell.
//
// #289 Phase 2 moved it here for one reason: ruling 184 makes it the band
// stack's machinery too ("every collapse lands the next band at a computed
// spot — the arc-28 landing machinery applies to every collapse, not only
// Generate"), and `components/BandStack.tsx` cannot import it from
// `GeneratorShell.tsx` without the shell importing the stack right back.
// A circular import between two components is not a design; a shared
// module is.
//
// Nothing about the check changed in the move except #289 R8's
// reachability predicate, which is commented where it sits.  The history
// below is the whole reason the check looks the way it does and is kept
// verbatim: every clause in it was paid for by a measured failure.
//
// #250 (a) — the landing check.  The post-generate ``scrollIntoView``
// lands the results zone at its scroll-margin-top only if nothing moves
// in the same frame; when the sidebar's unmount lands in the frame of
// the programmatic scroll, Chrome suppresses scroll anchoring and the
// zone settles wherever the swap left it (1 of 2 prod runs in arc 21;
// the refused generate in audit F-S5-3 at −104).  So the landing is
// checked once after the scroll settles — one ``scrollend``, or, where
// it never fires (nothing to move, or no support), scrollY stable
// across LANDING_STABLE_FRAMES — and re-issued ONCE if the zone's top
// is more than LANDING_TOLERANCE_PX from its scroll-margin-top.  A
// wheel / touch / navigation key from the user disarms it (the viewport
// is theirs from that moment).  The pair's settle (the strip's verdict
// re-mounting into its f2 slot) gets one more check under the same
// one-re-issue cap: never twice.  Idempotent on the good path — a
// landing within tolerance issues nothing.
//
// #271 — the settle INSIDE the landing scroll.  Arc 26's prod run at
// ``3fa7d18`` (380x800, 1 of 10) caught the case the one-shot cap was
// never written for: the memoised pair settled at 705 ms while the
// smooth landing scroll was still animating.  The settle mounted the
// corrections block ABOVE the zone (+1296 px of document), Chrome's
// scroll anchoring held the zone by moving scrollY — and the running
// smooth scroll then finished to the destination it had computed
// BEFORE the settle, dropping the zone to 793 instead of 154.  Chrome
// does not re-target a running smooth scroll after an anchoring
// adjustment, and the one re-issue had already been spent inside the
// animation window, so nothing could recover it.  So: a settle that
// arrives in flight (``checked === false``) grants ONE extra round —
// the check waits for that stale animation's own settle and re-checks
// with a fresh re-issue budget.  The cap is two ``scrollIntoView``
// re-issues per Generate, never re-granted (no round three); the
// good-path "never twice" cap is unchanged, and a user scroll disarms
// round two exactly as it disarms round one.
//
// #271 (a) — and the arc-28 evidence run said that was not enough.  On
// a live page ``checked`` is spent at ~70 ms, long before the settle:
// Chrome fires a ``scrollend`` about 30 ms after the landing scroll is
// issued, with the zone still ~1939 px from its margin, because the
// stage swap's relayout CANCELS the smooth scroll and the browser
// reports the sequence as ended.  The check took that for the landing,
// spent itself and its one re-issue there, and it was the RE-ISSUE's
// animation that ran on to ~810 ms — so the pair's settle always
// arrived with ``checked === true`` and the settle-granted round above
// was unreachable.  Ryan's ruling of 2026-09-10, verbatim: "A
// ``scrollend`` that arrives with the results zone still beyond
// tolerance is a cancelled scroll, not a landing — re-issue and keep
// waiting rather than spending the check.  Do not treat it as the
// terminal signal."  So the terminal signal is no longer "a settle
// happened" but "a settle happened AND the zone is within tolerance".
// The cap is unchanged and now counted, not latched: at most
// LANDING_MAX_REISSUES ``scrollIntoView`` re-issues per Generate, after
// which the next signal ends the check wherever the zone is.  Two hard
// bounds keep it from waiting forever — LANDING_MAX_FRAMES per round,
// and LANDING_DEADLINE_MS across the whole check — and the user-scroll
// disarm still wins at every point.
//
// #271 (finding 4, ruled 2026-09-10) — and the correction is INSTANT.
// (a) works, but at ``4c4dce0`` it worked by animating: the arc-28 run
// measured the zone travelling 793 -> 154 in four steps over ~450 ms,
// AFTER the answer had landed.  Ryan: "A 450 ms wander after the answer
// has landed reads as cheap — P12 — and one reposition is easier to
// understand than four steps."  So a re-issue that fires once the pair
// has SETTLED uses ``behavior: "auto"``: ``settle()`` sets ``settled``,
// and ``reissueIfOff`` reads it.  The initial landing scroll is the
// shell's and is untouched; a re-issue BEFORE any settle keeps the
// arming behaviour, so the ordinary landing is still smooth.  Declared
// behaviour change; reduced motion is unaffected — that arming is
// already ``"auto"`` on both sides of the settle.
export interface LandingCheck {
  /** The pair's settle: one more check, still capped at one re-issue. */
  settle: () => void;
  /** Drop every listener without checking (unmount, a new arming). */
  cancel: () => void;
}
const LANDING_TOLERANCE_PX = 1;
const LANDING_STABLE_FRAMES = 6;
const LANDING_MAX_FRAMES = 90;
// #271 (a): the ruled cap, counted across the whole check — the landing
// scroll itself is the shell's, these are the check's corrections.
const LANDING_MAX_REISSUES = 2;
// The wall clock the whole check lives under.  A landing scroll measures
// ~810 ms at 380 and two corrections fit inside ~2.5 s; past this the
// check ends wherever the zone is rather than holding its listeners.
const LANDING_DEADLINE_MS = 4000;
const USER_SCROLL_EVENTS = ["wheel", "touchmove", "keydown"] as const;
const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Space"]);
export function armLandingCheck(
  el: HTMLElement,
  behavior: ScrollBehavior,
): LandingCheck {
  // #271 (a): a count, not a latch — the cap is total, across every
  // round, so no path can reach a third re-issue.
  let reissues = 0;
  let userScrolled = false;
  let checked = false;
  let settleWanted = false;
  // #271: granted only by a settle that arrives in flight, spent by
  // round two, never re-granted.
  let grantExtra = false;
  let done = false;
  // #271 (finding 4): set by ``settle()`` — the pair has answered, so a
  // correction from here is a reposition, not part of the landing.
  let settled = false;
  const armedAt = Date.now();
  const expired = () => Date.now() - armedAt > LANDING_DEADLINE_MS;
  let raf = 0;
  let onScrollEnd: (() => void) | null = null;
  const offBy = () => {
    const margin = parseFloat(window.getComputedStyle(el).scrollMarginTop ?? "") || 0;
    return Math.abs(el.getBoundingClientRect().top - margin);
  };
  // #289 R8 (ruled 2026-09-22) — IS THE SPOT REACHABLE AT ALL?
  //
  // Measured on the band-stack prototype at 1440x1000: in S3 the column
  // is 1000 px tall in a 1000 px viewport, so there are ZERO scrollable
  // pixels and no scroll call can move the target anywhere.  Four of six
  // band transitions were in that position; `scrollIntoView` did what it
  // could (nothing) and the target sat up to 276 px below its margin.
  //
  // Without this predicate the check reads that as a failed landing,
  // re-issues twice, measures the same number, and spends its whole
  // counted cap on a target that was never reachable — reporting a
  // product failure for a page that is simply short.
  //
  // So the landing succeeds when the target is at its spot OR the page
  // is already scrolled as far as it goes.  Both are "the browser put it
  // where it can"; only the first is "the spot exists".  The 1 px
  // tolerance is arc-28's, reused here rather than re-chosen.
  // Evidence: validation-artifacts/committed/issue-289-band-stack/
  // prototype/band-stack-landing.md section 2.
  const atScrollEnd = () => {
    const height = document.documentElement.scrollHeight;
    // No layout engine, no layout conclusions.  A document reporting a
    // scrollHeight of 0 has not been laid out (happy-dom reports exactly
    // that), and "0 - 768 <= 0, therefore the page cannot scroll" would
    // turn every unit test of this check into a no-op — which is how a
    // guard meant to stop false failures becomes a guard that stops true
    // ones.  Measured, not assumed: the probe is in the arc evidence.
    if (height <= 0) return false;
    const max = height - window.innerHeight;
    return max <= 0 || window.scrollY >= max - LANDING_TOLERANCE_PX;
  };
  const landed = () => offBy() <= LANDING_TOLERANCE_PX || atScrollEnd();
  const reissueIfOff = () => {
    if (userScrolled || reissues >= LANDING_MAX_REISSUES) return;
    if (!landed()) {
      reissues += 1;
      el.scrollIntoView({
        behavior: settled ? "auto" : behavior,
        block: "start",
      });
    }
  };
  const onUser = (e: Event) => {
    if (e.type === "keydown" && !NAV_KEYS.has((e as KeyboardEvent).key)) return;
    userScrolled = true;
    finish();
  };
  const stopWaiting = () => {
    if (onScrollEnd) window.removeEventListener("scrollend", onScrollEnd);
    onScrollEnd = null;
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  };
  const finish = () => {
    done = true;
    stopWaiting();
    for (const t of USER_SCROLL_EVENTS) window.removeEventListener(t, onUser);
  };
  // One wait for one scroll to settle: its ``scrollend``, or — where it
  // never fires (nothing to move, or no support) — scrollY unchanged
  // across consecutive frames, bounded.  Each round gets its own
  // frame/stable counters, so round two measures the stale animation
  // from where it starts, not from the arming.
  const waitForSettle = (onSettled: () => void) => {
    onScrollEnd = () => {
      stopWaiting();
      onSettled();
    };
    window.addEventListener("scrollend", onScrollEnd);
    let last = window.scrollY;
    let stable = 0;
    let frames = 0;
    const tick = () => {
      frames += 1;
      const y = window.scrollY;
      stable = y === last ? stable + 1 : 0;
      last = y;
      if (stable >= LANDING_STABLE_FRAMES || frames >= LANDING_MAX_FRAMES) {
        raf = 0;
        stopWaiting();
        onSettled();
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
  };
  const round2 = () => {
    reissueIfOff();
    finish();
  };
  const landingCheck = () => {
    if (checked || done) return;
    // #271 (a): this signal is only the landing if the zone is actually
    // AT its margin.  A ``scrollend`` (or a stable-frame window) with the
    // zone still beyond tolerance is a cancelled scroll — correct it and
    // keep waiting, without spending the check.  Bounded by the re-issue
    // cap and by the wall clock: when either is reached, the next signal
    // ends the check wherever the zone is.
    if (
      !userScrolled &&
      reissues < LANDING_MAX_REISSUES &&
      !expired() &&
      // R8: `landed()`, not `offBy()` — a target the page cannot reach
      // has landed as far as the browser is concerned, and retrying is
      // how the check turns a short page into a reported defect.
      !landed()
    ) {
      reissueIfOff();
      waitForSettle(landingCheck);
      return;
    }
    checked = true;
    reissueIfOff();
    if (settleWanted && grantExtra && !userScrolled) {
      // #271: the settle landed inside this scroll's animation window —
      // whatever this check just issued (or declined to issue) was
      // measured against a document the still-running scroll does not
      // know about.  Wait for that scroll's own settle, then re-check
      // with a fresh budget.  Once.
      grantExtra = false;
      waitForSettle(round2);
      return;
    }
    if (settleWanted) finish();
  };
  for (const t of USER_SCROLL_EVENTS) window.addEventListener(t, onUser, { passive: true });
  waitForSettle(landingCheck);
  return {
    settle() {
      // Set before every early return: from this moment any correction
      // is a reposition of an answer already on screen.
      settled = true;
      if (done) return;
      if (!checked) {
        // The landing has not settled yet: the one check covers both —
        // and, because the scroll is still in flight, earns round two.
        settleWanted = true;
        grantExtra = true;
        return;
      }
      reissueIfOff();
      finish();
    },
    cancel: finish,
  };
}
