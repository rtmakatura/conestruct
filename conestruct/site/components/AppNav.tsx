import Link from "next/link";
import {
  OrganizationSwitcher,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import type { Scenario } from "@/lib/scenarios";
import { AUTH_UI_ENABLED } from "@/lib/feature-flags";
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
  onSaved: (id: string, name: string, saved: Scenario) => void;
}

export function AppNav({ mode, ta, cdotSheet, scenario, planId, planName, onSaved }: Props) {
  const isSandbox = mode === "sandbox";
  return (
    <nav className="sticky top-0 z-30 flex items-stretch justify-between h-[52px] border-b border-[color:var(--rule)] bg-[color:var(--canvas-tint)]">
      <div className="flex items-stretch">
        <Link
          href="/"
          className="flex items-center gap-3 px-5 border-r border-[color:var(--rule)] font-sans font-bold text-[16px] tracking-[-0.01em] text-white hover:text-[color:var(--act)] transition-colors"
        >
          <span>
            conestruct<span className="text-[color:var(--dim)]">.</span>
          </span>
          <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[color:var(--ink-on-dark-faint)]">
            v0.4
          </span>
        </Link>
        {AUTH_UI_ENABLED && !isSandbox && (
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
        {isSandbox || !AUTH_UI_ENABLED ? (
          <span className="hidden md:flex items-center gap-2 px-5 border-r border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.1em]">
            <span className="text-[color:var(--dim)]">Demo</span>
            <span className="text-[color:var(--ink-on-dark-faint)]">/</span>
            <span className="text-[color:var(--ink-on-dark-faint)]">MUTCD plan generator</span>
          </span>
        ) : (
          <span className="hidden md:flex items-center gap-2 px-5 border-r border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
            <span>Workbench</span>
            <span>/</span>
            <span className="text-[color:var(--act)]">{planName ?? "New MHT"}</span>
          </span>
        )}
        <span className="hidden lg:flex items-center gap-2 px-5 border-r border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
          <span className="text-[color:var(--dim)]">{ta}</span>
          <span>·</span>
          <span>{cdotSheet}</span>
        </span>
      </div>
      <div className="flex items-stretch">
        {/* Deliberately no status dot here (#132): the green pulse that
            used to sit beside this badge was hardcoded chrome derived
            from nothing — under Rule 10 the honest render of no signal
            is absence.  The edition text is the badge; if a real nav
            status ever exists, it derives from real verification state
            and carries a non-hue second channel. */}
        <span className="hidden md:flex items-center px-5 border-l border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
          MUTCD 2023 · CDOT
        </span>
        {AUTH_UI_ENABLED && (
          <>
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
          </>
        )}
      </div>
    </nav>
  );
}
