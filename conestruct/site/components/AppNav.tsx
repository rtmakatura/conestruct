import Link from "next/link";
import {
  OrganizationSwitcher,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import type { Scenario } from "@/lib/scenarios";
import { AUTH_UI_ENABLED } from "@/lib/feature-flags";
import { Wordmark } from "./Wordmark";
import {
  PlanSaveButton,
  PlanSignInToSaveButton,
} from "./PlanSaveButton";

interface Props {
  mode: "sandbox" | "workbench";
  /** #289 fidelity F4 — Part 2 rule 23: the TA / sheet citation that
   *  joins the right slot POST-GENERATE ("TA-3 · S-630-1 · MUTCD 2023 ·
   *  CDOT"), or null before a plan exists.  It was its own middle cell,
   *  rendered pre-generate as a bare "·" between two empty strings. */
  citation: string | null;
  scenario: Scenario;
  planId: string | null;
  planName: string | null;
  onSaved: (id: string, name: string, saved: Scenario) => void;
}

export function AppNav({ mode, citation, scenario, planId, planName, onSaved }: Props) {
  const isSandbox = mode === "sandbox";
  return (
    <nav className="sticky top-0 z-[var(--z-nav)] flex items-stretch justify-between h-[var(--nav-h)] border-b border-[color:var(--rule)] bg-[color:var(--canvas-tint)]">
      <div className="flex items-stretch">
        {/* #289 fidelity F4 — Part 2 rule 22: the wordmark, then nav
            items.  The drawing lives in Wordmark.tsx, shared with the
            public chrome (coming-soon-gate C-Q8). */}
        <Wordmark />
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
        {/* Rule 22's nav items: mono 10 px .16em uppercase #93a0b0.
            #289 fidelity F4 (ruled Q2): DEMO stays, in those normal
            colours — it was the generated-number orange, which rule 10
            reserves for generated numerals. */}
        {isSandbox || !AUTH_UI_ENABLED ? (
          <span className="hidden md:flex items-center gap-2 px-5 border-r border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--ink-on-dark-faint)]">
            <span>Demo</span>
            <span>/</span>
            <span>MUTCD plan generator</span>
          </span>
        ) : (
          <span className="hidden md:flex items-center gap-2 px-5 border-r border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--ink-on-dark-faint)]">
            <span>Workbench</span>
            <span>/</span>
            <span className="text-[color:var(--act)]">{planName ?? "New MHT"}</span>
          </span>
        )}
      </div>
      <div className="flex items-stretch">
        {/* Deliberately no status dot here (#132): the green pulse that
            used to sit beside this badge was hardcoded chrome derived
            from nothing — under Rule 10 the honest render of no signal
            is absence.  The edition text is the badge; if a real nav
            status ever exists, it derives from real verification state
            and carries a non-hue second channel. */}
        {/* Rule 23: "Pre-generate: 'MUTCD 2023 · CDOT'.  Post-generate:
            'TA-3 · S-630-1 · MUTCD 2023 · CDOT'.  Static strings only — no
            date, no clock" (Part 1 §8.32: the sheet meta's citation moves
            here; its hydration defect must not follow it). */}
        <span
          className="hidden md:flex items-center px-5 border-l border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--ink-on-dark-faint)]"
          data-testid="nav-citation"
        >
          {citation ? `${citation} · MUTCD 2023 · CDOT` : "MUTCD 2023 · CDOT"}
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
