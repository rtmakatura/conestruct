import { AppFooter } from "./AppFooter";
import { Wordmark } from "./Wordmark";

// The chrome of every public page (coming-soon-gate R1.2, C-Q8): `/`,
// `/terms`, `/privacy`.  Workbench tokens only (D2), the generator's own
// wordmark and footer (P11).  Deliberately no nav items: no "Sign in"
// (R1.5), no "Try the demo" (the builder is gated, R1.1), no dead links.
//
// Serves the prospect (FLOW.md §1, R3): someone who has heard of
// Conestruct and lands here before it opens.
export function PublicChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="workbench min-h-screen flex flex-col">
      <nav className="flex items-stretch h-[var(--nav-h)] border-b border-[color:var(--rule)] bg-[color:var(--canvas-tint)]">
        <Wordmark />
      </nav>
      {/* The generator's column (GeneratorShell.tsx:1749, Part 2 rule 24).
          container-type lets type role 5 take its below-520 size. */}
      <main className="flex-1 w-full max-w-[960px] mx-auto px-10 pt-[26px] pb-[30px] max-md:px-[14px] max-md:py-4 [container-type:inline-size]">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
