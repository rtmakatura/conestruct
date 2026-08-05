import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service — Conestruct",
};

export default function TermsPage() {
  return (
    <div className="max-w-page mx-auto px-6 md:px-12">
      <Nav />
      <main className="pt-12 pb-16 max-w-[720px]">
        <h1 className="text-[36px] font-bold tracking-tight text-ink mb-2 leading-[1.1]">
          Terms of Service
        </h1>
        <p className="text-[11px] text-ink-faint font-mono uppercase tracking-[0.1em] mb-8">
          DRAFT · VERSION {TERMS_VERSION}
        </p>
        <div className="space-y-4 text-[15px] leading-relaxed text-ink">
          <p>
            This document is a placeholder. A complete Terms of Service will be
            published before paid use of Conestruct begins.
          </p>
          <p>In the interim, by using the service you acknowledge that:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Conestruct outputs are engineering reference materials, not sealed
              engineering plans. A licensed Professional Engineer must review,
              adjust as needed, and apply seal before any plan is used in the
              field.
            </li>
            <li>
              Conestruct&rsquo;s references currently cover the federal MUTCD
              and CDOT standards (S-630-1) only. Other jurisdictions may impose
              additional requirements not yet captured.
            </li>
            <li>
              The service is provided as-is, without warranty of fitness for any
              specific work zone or jurisdiction.
            </li>
            <li>
              You are responsible for the accuracy of inputs you provide and for
              the suitability of any output for its intended use.
            </li>
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}
