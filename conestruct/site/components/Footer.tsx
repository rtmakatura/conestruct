import Link from "next/link";

export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-y-3 pt-8 pb-12 border-t border-line font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
      <div className="flex gap-6">
        <span>© 2026 Conestruct</span>
        <span>Built in Colorado</span>
      </div>
      <div className="flex gap-6 items-center">
        <Link href="/terms" className="hover:text-ink">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-ink">
          Privacy
        </Link>
        <span>
          Output requires TCS review · Not a substitute for licensed judgment
        </span>
      </div>
    </footer>
  );
}
