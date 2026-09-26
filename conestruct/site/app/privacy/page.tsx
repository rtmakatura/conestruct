import type { Metadata } from "next";
import { PublicChrome } from "@/components/PublicChrome";
import { TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Conestruct",
};

export default function PrivacyPage() {
  return (
    // coming-soon-gate C-Q8: the placeholder's chrome; words unchanged,
    // classes moved onto workbench tokens and ruled sizes (D2).
    <PublicChrome>
      <article className="pt-10 max-md:pt-6 max-w-[720px]">
        <h1 className="tr-question">
          Privacy Policy
        </h1>
        <p className="tr-step mt-2 mb-6">
          DRAFT · VERSION {TERMS_VERSION}
        </p>
        <div className="space-y-4 font-sans text-[length:var(--fs-body-value)] leading-[1.6] text-[color:var(--ink-on-dark)]">
          <p>
            This document is a placeholder. A complete Privacy Policy will be
            published before paid use of Conestruct begins.
          </p>
          <p>In the interim, the following holds:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Account information (name, email, organization) is stored to
              authenticate users and associate plans with the company that
              created them.
            </li>
            <li>
              Plan inputs you provide (project name, address, scenario
              parameters) are stored so you can reopen and edit your plans
              later.
            </li>
            <li>
              Conestruct does not sell user data. Data is shared only with
              service providers required to operate the service (e.g.,
              authentication and database hosting).
            </li>
            <li>
              You may request deletion of your account and plan data at any
              time.
            </li>
          </ul>
        </div>
      </article>
    </PublicChrome>
  );
}
