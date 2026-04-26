import { Nav } from "@/components/Nav";
import { SheetMeta } from "@/components/SheetMeta";
import { Hero } from "@/components/Hero";
import { DimStrip } from "@/components/DimStrip";
import { MathSection } from "@/components/MathSection";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";

export default function Page() {
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
