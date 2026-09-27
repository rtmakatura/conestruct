import { NAV, NOTIFY_HREF } from "@/lib/coming-soon-copy";
import { AppFooter } from "./AppFooter";
import { Wordmark } from "./Wordmark";

// The chrome of every public page (coming-soon-gate R1.2, C-Q8): `/`,
// `/terms`, `/privacy`.  Workbench tokens only (D2), the generator's own
// wordmark and footer (P11).  Never a "Sign in" (R1.5), never "Try the
// demo" (the builder is gated, R1.1), no dead links.
//
// Serves the prospect (FLOW.md §1, R3): someone who has heard of
// Conestruct and lands here before it opens.
//
// `sheet` (Arc 2, R5a): the coming-soon page's own nav — two in-page
// anchors and "Get notified", a mail link (A2-Q1) — and a full-width main
// for the Plan Sheet.  Terms and Privacy keep the wordmark-only nav and
// the generator's column.
//
// `wide` (Arc 3, R19): the 404's chrome — the wordmark-only nav and the
// sheet's full-width main (design/NotFound.dc.html), no in-page anchors.
export function PublicChrome({
  children,
  sheet = false,
  wide = false,
}: {
  children: React.ReactNode;
  sheet?: boolean;
  wide?: boolean;
}) {
  return (
    <div className="workbench min-h-screen flex flex-col">
      <nav className="flex items-stretch h-[var(--nav-h)] border-b border-[color:var(--rule)] bg-[color:var(--canvas-tint)]">
        <Wordmark />
        {sheet && (
          <>
            <a className="tr-step cs-navlink cs-only-wide" href="#how">
              {NAV.how}
            </a>
            <a className="tr-step cs-navlink cs-only-wide" href="#sources">
              {NAV.sources}
            </a>
            <a className="tr-step cs-navlink cs-navlink-act" href={NOTIFY_HREF}>
              {NAV.notify}
            </a>
          </>
        )}
      </nav>
      {sheet || wide ? (
        <main className="flex-1 w-full [container-type:inline-size]">{children}</main>
      ) : (
        /* The generator's column (GeneratorShell.tsx:1749, Part 2 rule 24).
           container-type lets type role 5 take its below-520 size. */
        <main className="flex-1 w-full max-w-[960px] mx-auto px-10 pt-[26px] pb-[30px] max-md:px-[14px] max-md:py-4 [container-type:inline-size]">
          {children}
        </main>
      )}
      <AppFooter />
    </div>
  );
}
