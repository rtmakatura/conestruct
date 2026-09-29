import { withSentryConfig } from "@sentry/nextjs";

// coming-soon-gate R42: the sheet's revision date is the day it was built,
// in Denver (YYYY-MM-DD).  Computed once, when this config loads for a
// build, and inlined — so a production build carries its ship date and
// nobody types one.
const SHEET_REVISED = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Denver",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SHEET_REVISED: SHEET_REVISED,
  },
  async redirects() {
    return [
      // coming-soon-gate C-Q5: both land on the public placeholder at /
      // as 307s.  /sandbox is gated (R1.1, R1.2); a 308 is cached hard by
      // browsers and these destinations have already moved once.
      { source: "/try", destination: "/", permanent: false },
      // The archived marketing page (app/(archived)/landing/page.tsx)
      // carries pre-verification copy and a Sign in link the public
      // surface does not offer; it stays on disk for the parked /landing
      // rewrite but must not be served meanwhile.
      { source: "/landing", destination: "/", permanent: false },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "conestruct",
  project: "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  hideSourceMaps: true,
});
