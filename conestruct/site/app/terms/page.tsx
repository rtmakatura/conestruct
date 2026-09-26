import type { Metadata } from "next";
import { PublicChrome } from "@/components/PublicChrome";
import { TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service — Conestruct",
};

export default function TermsPage() {
  return (
    // coming-soon-gate C-Q8: the placeholder's chrome; words unchanged,
    // classes moved onto workbench tokens and ruled sizes (D2).
    <PublicChrome>
      <article className="pt-10 max-md:pt-6 max-w-[720px]">
        <h1 className="tr-question">
          Terms of Service
        </h1>
        <p className="tr-step mt-2 mb-6">
          DRAFT · VERSION {TERMS_VERSION}
        </p>
        <div className="space-y-4 font-sans text-[length:var(--fs-body-value)] leading-[1.6] text-[color:var(--ink-on-dark)]">
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
      </article>
    </PublicChrome>
  );
}
