import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/try", destination: "/sandbox", permanent: true },
      // The archived marketing page (app/(archived)/landing/page.tsx)
      // carries pre-verification copy and a Sign in link the flag-off
      // public surface does not offer; it stays on disk for the parked
      // /landing rewrite but must not be served meanwhile.
      { source: "/landing", destination: "/sandbox", permanent: true },
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
