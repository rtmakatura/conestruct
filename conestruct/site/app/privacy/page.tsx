import type { Metadata } from "next";
import { PublicChrome } from "@/components/PublicChrome";
import { TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy · Conestruct",
};

// #346 ruling (Ryan, 2026-10-18): this section added as written, no
// rewording, then "for a short time" -> "for up to an hour" (address
// ruling, S17).  One string, so the words are byte-for-byte his.
const PAST_JOB_FORM =
  '"Send us a past job" form. When you use this form, we collect your name, company, email, phone (if you give it), the job\'s location, and the job details you enter. We email them to Conestruct through Resend, our email provider, and send you a copy. We use them only to draft your comparison plan and to reply to you. If you send us an approved plan, it arrives by email reply and we use it only for that comparison. To block abuse, our rate limiter (Upstash) keeps your IP address for up to an hour. We don\'t sell any of this. To have it deleted, email safety@conestruct.com.';

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
              time by emailing safety@conestruct.com.
            </li>
          </ul>
          <p>{PAST_JOB_FORM}</p>
        </div>
      </article>
    </PublicChrome>
  );
}
