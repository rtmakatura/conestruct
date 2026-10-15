// #242: the frontend build this deployment serves.  The value is inlined
// at build time, so a tab opened before a deploy (still running the old
// bundle) gets the NEW deployment's sha here and can tell it's behind.
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { sha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}
