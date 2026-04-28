import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Conestruct",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-page mx-auto px-6 md:px-12">
      <Nav />
      <main className="pt-12 pb-16 max-w-[720px]">
        <h1 className="text-[36px] font-bold tracking-tight text-ink mb-2 leading-[1.1]">
          Privacy Policy
        </h1>
        <p className="text-[11px] text-ink-faint font-mono uppercase tracking-[0.1em] mb-8">
          DRAFT · VERSION {TERMS_VERSION}
        </p>
        <div className="space-y-4 text-[15px] leading-relaxed text-ink">
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
      </main>
      <Footer />
    </div>
  );
}
