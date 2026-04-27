import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export function Nav() {
  return (
    <nav className="flex items-center justify-between py-6 border-b border-line">
      <div className="flex items-baseline gap-4">
        <Link
          href="/"
          className="font-sans font-bold text-[22px] tracking-tighter text-navy hover:text-orange transition-colors"
        >
          conestruct
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
          v0.4 · Colorado · MUTCD 2023
        </span>
      </div>
      <div className="flex items-center gap-7">
        <Link
          href="/#math"
          className="text-sm font-medium text-navy hover:text-orange"
        >
          How it works
        </Link>
        <a
          href="#"
          className="text-sm font-medium text-navy hover:text-orange"
        >
          Sample plan
        </a>
        <SignedOut>
          <Link
            href="/sign-in"
            className="text-sm font-medium text-navy hover:text-orange"
          >
            Sign in
          </Link>
        </SignedOut>
        <SignedIn>
          <Link
            href="/app"
            className="text-sm font-medium text-navy hover:text-orange"
          >
            Go to app →
          </Link>
        </SignedIn>
        <Link
          href="/try"
          className="font-sans text-[13px] font-semibold bg-navy text-paper px-4 py-2.5 cursor-pointer tracking-[0.01em] hover:bg-orange transition-colors"
        >
          Try the demo →
        </Link>
      </div>
    </nav>
  );
}
