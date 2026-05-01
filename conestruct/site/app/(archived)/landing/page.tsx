import { Nav } from "@/components/Nav";
import { SheetMeta } from "@/components/SheetMeta";
import { Hero } from "@/components/Hero";
import { DimStrip } from "@/components/DimStrip";
import { MathSection } from "@/components/MathSection";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";

// Archived marketing landing. Reachable at /landing while the public
// flow is the generator. To restore as the homepage, move the body of
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
