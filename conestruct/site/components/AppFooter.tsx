import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-y-3 px-10 py-6 border-t border-[color:var(--rule)] bg-[color:var(--canvas-tint)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
      <span>© 2026 Conestruct · Built in Colorado</span>
      <div className="flex gap-5 items-center">
        <Link href="/terms" className="hover:text-white">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-white">
          Privacy
        </Link>
        <span>Output requires TCS review · Not a substitute for licensed judgment</span>
      </div>
    </footer>
  );
}
