// #446 ruling 3: once a tap's street is found, the CONFIRM card's ✓ row and
// its "Next question" come into view just below the aerial; focus lands on
// the row's heading.  Authority: validation-artifacts/committed/
// ux-tap-feedback/rulings.md, ruling 3 and T8, T9, T15, T19.
//
// Page layout only: nothing here is a plan value (Rule 3).

/** CHOSEN (#446 T8): room under "Next question" after a scroll, so the
 *  button doesn't sit on the viewport's edge.  One --space step's worth;
 *  not a safety value and no source sets it. */
export const REVEAL_MARGIN_PX = 16;

/** CHOSEN (#446 T15): the longest the scroll waits for the mark's
 *  nearest-intersection read, whose answer lengthens the summary line and
 *  the ✓ row above the button.  The bar has already answered by then. */
export const REVEAL_WAIT_MS = 1500;

/** The least scroll that puts the row's top and the button's bottom in the
 *  visible band; 0 when both are already in it (ruling 3).  T19 (Ryan,
 *  2026-11-06, build B): the row and the button win over the aerial; only
 *  the row's top stops the scroll.  The margin alone gives way to ruling 2's
 *  words, when they would otherwise stay on screen or nearly so; once the
 *  button's own scroll takes them well past the band's top, it stays. */
export function revealDelta(
  barWordsTop: number,
  rowTop: number,
  nextBottom: number,
  viewTop: number,
  viewBottom: number,
): number {
  if (rowTop >= viewTop && nextBottom <= viewBottom) return 0;
  if (rowTop < viewTop) return rowTop - viewTop;
  const needed = nextBottom - viewBottom;
  const wanted = needed + REVEAL_MARGIN_PX;
  const wordsRoom = barWordsTop - viewTop;
  const scroll =
    wordsRoom >= needed - REVEAL_MARGIN_PX ? Math.max(needed, Math.min(wanted, wordsRoom)) : wanted;
  return Math.min(scroll, rowTop - viewTop);
}

/** #446 T24, T25: the least scroll that shows an element in the visible band;
 *  0 when it is already all there.  An element taller than the band keeps its
 *  top. */
export function intoViewDelta(
  top: number,
  bottom: number,
  viewTop: number,
  viewBottom: number,
): number {
  if (top < viewTop) return top - viewTop;
  if (bottom > viewBottom) return Math.min(bottom - viewBottom, top - viewTop);
  return 0;
}

/** The scroll, a jump under reduced motion. */
function scrollPage(top: number): void {
  if (top === 0) return;
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollBy({ top, behavior: reduce ? "instant" : "smooth" });
}

/** #446 T24, T25: brings one element of the aerial into view, under the nav. */
export function scrollAerialPartIn(el: HTMLElement): void {
  const chrome = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const box = el.getBoundingClientRect();
  scrollPage(intoViewDelta(box.top, box.bottom, chrome, window.innerHeight));
}

/** #446 T26: a retry's button left with the retry, and focus fell to the page.
 *  If the person has since moved it somewhere, it stays there. */
export function focusWasDropped(): boolean {
  const now = document.activeElement;
  return now === null || now === document.body;
}

export function scrollCrossRowIn(frame: HTMLElement, row: HTMLElement, next: HTMLElement): void {
  // The sticky nav's budget, from the row's own scroll-margin-top.
  const chrome = parseFloat(getComputedStyle(row).scrollMarginTop) || 0;
  // The words themselves, inside their span's padding.
  const words = frame.querySelector<HTMLElement>(".a-aerial-bar-text");
  const wordsTop = words
    ? words.getBoundingClientRect().top + (parseFloat(getComputedStyle(words).paddingTop) || 0)
    : frame.getBoundingClientRect().top;
  scrollPage(
    revealDelta(
      wordsTop,
      row.getBoundingClientRect().top,
      next.getBoundingClientRect().bottom,
      chrome,
      window.innerHeight,
    ),
  );
}
