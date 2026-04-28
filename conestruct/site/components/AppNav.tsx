import Link from "next/link";
import {
  OrganizationSwitcher,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import type { Scenario } from "@/lib/scenarios";
import {
  PlanSaveButton,
  PlanSignInToSaveButton,
} from "./PlanSaveButton";

interface Props {
  mode: "sandbox" | "workbench";
  ta: string;
  cdotSheet: string;
  scenario: Scenario;
  planId: string | null;
  planName: string | null;
  onSaved: (id: string, name: string) => void;
}

export function AppNav({ mode, ta, cdotSheet, scenario, planId, planName, onSaved }: Props) {
  const isSandbox = mode === "sandbox";
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
        {!isSandbox && (
          <SignedIn>
            <Link
              href="/app"
              className="hidden md:flex items-center gap-2 px-5 border-r border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] hover:text-white hover:bg-[color:var(--rule)] transition-colors"
            >
              <span>←</span>
              <span>My plans</span>
            </Link>
          </SignedIn>
        )}
        {isSandbox ? (
          <span className="hidden md:flex items-center gap-2 px-5 border-r border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.1em]">
            <span className="text-[color:var(--orange)]">Sandbox</span>
            <span className="text-[color:var(--ink-on-dark-faint)]">/</span>
            <span className="text-[color:var(--ink-on-dark-faint)]">Public demo</span>
          </span>
        ) : (
          <span className="hidden md:flex items-center gap-2 px-5 border-r border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
            <span>Workbench</span>
            <span>/</span>
            <span className="text-[color:var(--cyan)]">{planName ?? "New MHT"}</span>
          </span>
        )}
        <span className="hidden lg:flex items-center gap-2 px-5 border-r border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
          <span className="text-[color:var(--orange)]">{ta}</span>
          <span>·</span>
          <span>{cdotSheet}</span>
        </span>
      </div>
      <div className="flex items-stretch">
        <span className="hidden md:flex items-center px-5 border-l border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
          <span className="w-1.5 h-1.5 bg-[color:var(--green)] inline-block mr-2 animate-pulse" />
          MUTCD 2023 · CDOT
        </span>
        <SignedOut>
          <PlanSignInToSaveButton />
        </SignedOut>
        <SignedIn>
          <PlanSaveButton
            scenario={scenario}
            planId={planId}
            planName={planName}
            onSaved={onSaved}
          />
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
