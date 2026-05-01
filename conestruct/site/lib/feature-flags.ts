// Single env switch to revive the auth/save/companies UI. When unset
// (or anything other than "true"), the public flow shows: homepage is
// the generator, no Sign In / Save / org switcher, downloads go through
// the public /api/render/[kind] endpoint instead of /api/plans/[id]/[kind].
//
// To revive the gated flow:
//   1. Set NEXT_PUBLIC_AUTH_UI=true in .env.local / Vercel
//   2. Restore the marketing landing as the homepage (see
//      app/(archived)/landing/page.tsx)
//   3. (Optional) Re-link /app from the public nav
export const AUTH_UI_ENABLED =
  process.env.NEXT_PUBLIC_AUTH_UI === "true";
