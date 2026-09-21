import Link from "next/link";

// #288 Phase 1 clause 7 — rule 15 reaches the footer.
//
// Part 1 §8.14 keeps the footer "unchanged", and #288's body says why
// that is not an exemption: "§8.14/rule 30 keep it unchanged, rule 15
// admits no exemption".  Unchanged in CONTENT is not unchanged in hit
// target — #264 was filed against rail entries under 32 px and its
// results half lands here.
//
// The two links were 10 px inline text, so their tappable box was the
// line box: about 13 px tall, against rule 15's 32 px at 1440 and 44 px
// at 380.  They are now inline-flex with a min-height, which grows the
// HIT BOX without moving the text: same words, same size, same row, same
// place.  Nothing in §8.14's "unchanged" is touched by that.
//
// The `gap-5` between them is kept deliberately: two 44 px targets 20 px
// apart clear WCAG 2.5.5's spacing allowance, and closing the gap to fit
// them would trade one target failure for another.

export function AppFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-y-3 px-10 py-6 border-t border-[color:var(--rule)] bg-[color:var(--canvas-tint)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
      <span>© 2026 Conestruct · Built in Colorado</span>
      <div className="flex gap-5 items-center">
        <Link
          href="/terms"
          className="inline-flex items-center min-h-[32px] max-[480px]:min-h-[44px] hover:text-white"
        >
          Terms
        </Link>
        <Link
          href="/privacy"
          className="inline-flex items-center min-h-[32px] max-[480px]:min-h-[44px] hover:text-white"
        >
          Privacy
        </Link>
        <span>Output requires TCS review · Not a substitute for licensed judgment</span>
      </div>
    </footer>
  );
}
