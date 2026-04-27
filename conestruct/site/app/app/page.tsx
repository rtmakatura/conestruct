import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { SheetMeta } from "@/components/SheetMeta";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Closed beta · Conestruct",
  description:
    "Try the Conestruct MHT generator demo today. Stamped-ready PDF, Excel device list, and crew-narrative downloads are in closed beta — request early access.",
};

const SPEC_ROWS: Array<[string, string]> = [
  ["VERSION", "v0.5 · CLOSED BETA"],
  ["SCOPE", "COLORADO · MUTCD 2023 · CDOT S-630-1"],
  ["SCENARIOS", "SHOULDER · LANE · FULL CLOSURE · FLAGGER · MOBILE"],
  ["OUTPUTS", "PDF · XLSX · MARKDOWN"],
  ["EARLY ACCESS", "TCS-LED · COLORADO-FIRST"],
];

export default function AppPlaceholder() {
  return (
    <>
      <div className="max-w-page mx-auto px-6 md:px-12">
        <Nav />
        <SheetMeta />

        <section className="py-24 md:py-32 grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-16 items-start">
          <div>
            <div className="eyebrow mb-6">
              0X · GENERATOR · CLOSED BETA
            </div>
            <h1 className="font-sans font-bold text-[40px] md:text-[56px] leading-[1.02] tracking-tightest text-navy mb-6 [text-wrap:balance]">
              Real downloads are{" "}
              <span className="text-orange">in closed beta.</span>
            </h1>
            <p className="text-[18px] leading-[1.55] text-ink-mute mb-9 max-w-[480px] [text-wrap:pretty]">
              The interactive demo is live — try every calculation and see
              every citation. Stamped-ready PDF, Excel device list, and crew
              narrative downloads ship to closed-beta users first. Drop your
              email for a key.
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <Link href="/try" className="btn-primary">
                Try the demo
                <span className="font-mono">→</span>
              </Link>
              <a
                className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy hover:text-orange"
                href="mailto:rtmakatura1@gmail.com?subject=Conestruct%20early%20access&body=Add%20me%20to%20the%20generator%20waitlist."
              >
                Request early access →
              </a>
            </div>
          </div>

          {/* Spec card */}
          <div className="relative bg-white border border-line p-8 mt-2">
            <span className="absolute -top-px -left-px w-3.5 h-3.5 border-[1.5px] border-orange border-r-0 border-b-0" />
            <span className="absolute -top-px -right-px w-3.5 h-3.5 border-[1.5px] border-orange border-l-0 border-b-0" />
            <span className="absolute -bottom-px -left-px w-3.5 h-3.5 border-[1.5px] border-orange border-r-0 border-t-0" />
            <span className="absolute -bottom-px -right-px w-3.5 h-3.5 border-[1.5px] border-orange border-l-0 border-t-0" />

            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint mb-4">
              <span className="text-orange">REL</span> · WHAT&rsquo;S SHIPPING
            </div>
            <div className="border-t border-line">
              {SPEC_ROWS.map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between py-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.08em]"
                >
                  <span className="text-ink-faint">{k}</span>
                  <span className="text-navy font-medium text-right">{v}</span>
                </div>
              ))}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint mt-4">
              Output requires TCS review · Not a substitute for licensed
              judgment
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
