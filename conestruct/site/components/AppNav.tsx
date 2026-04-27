import Link from "next/link";
import {
  OrganizationSwitcher,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

interface Props {
  caseId: string;
}

export function AppNav({ caseId }: Props) {
  return (
    <nav className="sticky top-0 z-30 flex items-stretch justify-between h-[52px] border-b border-[color:var(--rule)] bg-[color:var(--canvas-tint)]">
      <div className="flex items-stretch">
        <Link
          href="/"
          className="flex items-center gap-3 px-5 border-r border-[color:var(--rule)] font-sans font-bold text-[16px] tracking-[-0.01em] text-white hover:text-[color:var(--cyan)] transition-colors"
        >
          <span>
            conestruct<span className="text-[color:var(--orange)]">.</span>
          </span>
          <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[color:var(--ink-on-dark-faint)]">
            v0.4
          </span>
        </Link>
        <span className="hidden md:flex items-center gap-2 px-5 border-r border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
          <span>Generator</span>
          <span>/</span>
          <span className="text-[color:var(--cyan)]">New MHT</span>
        </span>
        <span className="hidden lg:flex items-center px-5 border-r border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
          CASE: <span className="text-[color:var(--orange)] ml-1.5">{caseId}</span>
        </span>
      </div>
      <div className="flex items-stretch">
        <span className="hidden md:flex items-center px-5 border-l border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
          <span className="w-1.5 h-1.5 bg-[color:var(--green)] inline-block mr-2 animate-pulse" />
          MUTCD 2023 · CDOT
        </span>
        <SignedOut>
          <Link
            href="/sign-in"
            className="flex items-center px-5 border-l border-[color:var(--rule)] font-sans font-medium text-[13px] text-[color:var(--ink-on-dark)] hover:text-white hover:bg-[color:var(--rule)] transition-colors"
          >
            Sign in
          </Link>
        </SignedOut>
        <SignedIn>
          <div className="flex items-center px-3 border-l border-[color:var(--rule)]">
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/app"
            />
          </div>
          <div className="flex items-center px-3 border-l border-[color:var(--rule)]">
            <UserButton />
          </div>
        </SignedIn>
      </div>
    </nav>
  );
}
