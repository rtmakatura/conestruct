import Link from "next/link";

const SPEC_ROWS: Array<[string, string]> = [
  ["OUTPUT", "PDF + XLSX + MD"],
  ["SHEET SIZE", "11×17 LANDSCAPE"],
  ["STANDARD", "MUTCD 2023"],
  ["SUPPLEMENT", "CDOT S-630-1"],
  ["TIME", "~90 SECONDS"],
  ["PRICE", "FREE DEMO"],
];

export function FinalCTA() {
  return (
    <section className="relative bg-navy text-paper px-16 py-20 mt-16 overflow-hidden max-md:px-6 max-md:py-12 max-md:-mx-6">
      <div className="absolute inset-0 pointer-events-none blueprint-grid-light" />
      <div className="relative z-[2] grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-20 items-end max-md:gap-8">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-paper/40 mb-4">
            03 · GET STARTED · FREE DEMO
          </div>
          <h2 className="font-sans font-bold text-[40px] md:text-[56px] leading-[1.02] tracking-tightest mb-6 [text-wrap:balance]">
            Stop drawing. <span className="text-orange">Start describing.</span>
          </h2>
          <p className="text-[17px] text-paper/70 m-0 max-w-[460px]">
            Built by TCS, for TCS. Colorado-first. Drop in a scenario, get a PDF
            your supervisor can stamp.
          </p>
          <Link
            href="/app"
            className="btn-primary mt-9"
            style={{ padding: "18px 32px", fontSize: 16 }}
          >
            Try the generator
            <span className="font-mono">→</span>
          </Link>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-paper/50 border-t border-paper/15 pt-4 grid grid-cols-2 gap-2">
          {SPEC_ROWS.map(([k, v]) => (
            <div key={k} className="flex justify-between col-span-2">
              <span>{k}</span>
              <span className="text-paper font-medium">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
