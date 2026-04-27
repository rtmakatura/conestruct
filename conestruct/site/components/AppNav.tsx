import Link from "next/link";

export function AppNav() {
  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 border-b border-line bg-beige/85 backdrop-blur">
      <div className="flex items-baseline gap-4">
        <Link
          href="/"
          className="font-sans font-bold text-[18px] tracking-tighter text-navy hover:text-orange transition-colors"
        >
          conestruct
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint flex items-center gap-2">
          <span>Generator</span>
          <span className="text-line">/</span>
          <span className="text-orange">New MHT</span>
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
          CDOT · MUTCD 2023
        </span>
        <Link
          href="/app"
          className="font-sans font-medium text-[13px] text-navy bg-transparent border border-line px-3.5 py-2 hover:border-navy transition-colors"
        >
          Sign in
        </Link>
      </div>
    </nav>
  );
}
