import { Nav } from "@/components/Nav";
import { SheetMeta } from "@/components/SheetMeta";
import { Hero } from "@/components/Hero";
import { DimStrip } from "@/components/DimStrip";
import { MathSection } from "@/components/MathSection";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";

// Archived marketing landing. UNREACHABLE: next.config.mjs permanently
// redirects /landing to /sandbox (2026-09-02, pre-demo) because this copy
// pre-dates verification ("~90 sec", "100% MUTCD-cited") and offers a
// Sign in link the flag-off public surface does not. The component is
// kept, not deleted, pending the parked /landing rewrite item; drop the
// redirect when that lands. To restore as the homepage, move the body of
// this file back into app/page.tsx.
export default function LandingPage() {
  return (
    <>
      <div className="max-w-page mx-auto px-6 md:px-12">
        <Nav />
        <SheetMeta />
        <Hero />
        <DimStrip />
      </div>

      <MathSection />

      <div className="max-w-page mx-auto px-6 md:px-12">
        <FinalCTA />
        <Footer />
      </div>
    </>
  );
}
