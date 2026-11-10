// #470 (UX group 6, Part 1, rulings 1 and 4): the outline of the results
// while the Generate's one call is in flight.  Each block stands where its
// section will stand, at the height reserved for it in globals.css (the
// `--ro-*` reserves, CHOSEN from the measured settled sections, rulings.md
// R145-3), so the answer swaps in without moving anything (ruling 2).
//
// Presentation only: no value, no count, no verdict is drawn here.  The
// whole outline is aria-hidden; the WorkingBand is the page's spoken
// working voice (#193/#252) and the strip slot's status line carries the
// step.  The cold-start sentence lives in the NEEDS YOU block's note, a
// reserved space, so a slow step grows nothing (ruling 6).  Past 14 s the
// note is empty: only the strip's sentence speaks (#482 (a), Ryan
// 2026-11-10).  If the road check does stop, the page's scan refusal says
// so and carries Retry scan (rulings.md R145-2).
//
// The map placeholder is the WHERE aerial the band last showed for this
// pin (ruling 4), dimmed and partly greyscale under the sheen.  With no
// picture remembered it is a plain grey block (Rule 10: no picture is
// drawn for this pin that the band never showed).

import { MapboxMarks } from "./bands/MapboxMarks";

export type WaitSlow = "none" | "cold" | "road";

/** ruling 6 / R145-4 — the cold start, today's honest claim (SLOW_VERIFY_MS)
 *  in a full sentence (group 1 ruling 2). */
export const COLD_START_NOTE =
  "The first plan after a quiet spell can take a few extra seconds while the server wakes up.";

/** The map placeholder's picture: the WHERE aerial dimmed under the sheen,
 *  or a grey block with none remembered.  #483 ruling 1 (R145-11): it stands
 *  in only during the Generate wait, since the first question's frame isn't
 *  known before the scan answers; the NEEDS YOU map itself loads soft, then
 *  sharp, in its own frame (NeedsYouMap). */
export function OutlineAerial({ src }: { src: string | null }) {
  return (
    <>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ro-aerial" src={src} alt="" />
      ) : (
        <div className="ro-aerial ro-block" />
      )}
      <span className="ro-sheen" />
    </>
  );
}

export function OutlineNeedsYou({
  aerialSrc,
  slow,
}: {
  aerialSrc: string | null;
  slow: WaitSlow;
}) {
  return (
    <div data-testid="results-outline" className="results-outline" aria-hidden="true">
      <div data-outline="needs" className="ro-needs">
        <div className="ro-block ro-head" />
        <div className="ro-map">
          <OutlineAerial src={aerialSrc} />
          {/* #490 C13: the band picture has no Mapbox marks of its own
              (C11) and is cropped to cover here, so the marks are drawn on
              the placeholder's foot, under its label, unlinked (the outline
              is aria-hidden: nothing in it may be focusable). */}
          <div className="ro-map-foot">
            <span className="ro-label tr-note">Checking this stretch of road</span>
            {aerialSrc ? <MapboxMarks testid="ro-map" linked={false} /> : null}
          </div>
        </div>
        <p className="ro-note tr-help">{slow === "cold" ? COLD_START_NOTE : ""}</p>
        <div className="ro-block ro-line" />
        <div className="ro-block ro-line is-short" />
      </div>
      <div data-outline="other" className="ro-other">
        <div className="ro-block ro-line" />
      </div>
      {/* Setup's outline, in ResultsHead's place (R145-3 as repaired: the
          reserved row is not mounted under the outline, so nothing that
          stands through the wait can move at the swap). */}
      <div data-outline="setup" className="ro-setup ro-block" />
    </div>
  );
}

/** The search and reference group's outline, in its place (R145-3). */
export function OutlineRefs() {
  return (
    <div data-outline="refs" className="ro-refs" aria-hidden="true">
      <div className="ro-block ro-head" />
      <div className="ro-block ro-head" />
      <div className="ro-block ro-head" />
    </div>
  );
}

/** Your plan's outline, in ResultsHero's place. */
export function OutlinePlan() {
  return (
    <div data-testid="results-outline-plan" data-outline="plan" className="ro-plan" aria-hidden="true">
      <div className="ro-block ro-head" />
      <div className="ro-row">
        <div className="ro-block ro-tile" />
        <div className="ro-block ro-tile" />
        <div className="ro-block ro-tile" />
      </div>
    </div>
  );
}

/** Downloads' outline, in OutputCards' place inside #downloads. */
export function OutlineDownloads() {
  return (
    <div data-outline="downloads" className="ro-downloads" aria-hidden="true">
      <div className="ro-block ro-head" />
      <div className="ro-row">
        <div className="ro-block ro-card" />
        <div className="ro-block ro-card" />
        <div className="ro-block ro-card" />
        <div className="ro-block ro-card" />
      </div>
    </div>
  );
}
