import { clerkClient, clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import {
  GATE_HEADER,
  bypassMatches,
  emailFromClaims,
  emailFromUser,
  isAllowlisted,
  isApiPath,
  isPublicPath,
  parseAllowlist,
  type VerifiedEmail,
} from "@/lib/gate";

// The coming-soon gate (validation-artifacts/committed/coming-soon-gate/
// rulings.md; the route table in middleware.test.ts is its spec).
//
// R1.2 — only `/`, `/terms`, `/privacy`, `/sign-in` and the Clerk webhook
//        are public; every other path, `/api/*` included, is gated.
// R1.3 — a signed-in user passes only if their VERIFIED primary email is
//        in GATE_ALLOWED_EMAILS.  This holds whatever the Clerk dashboard
//        says: public sign-up being closed there is defence in depth.
// R1.4 — scripts pass with GATE_HEADER equal to GATE_BYPASS_TOKEN.
// C-Q1/C-Q2 — a denied page goes to `/` (never /sign-in: R1.5 keeps the
//        door unlinked); a denied /api call gets 401 JSON, no redirect.
// C-Q3 — signed in but not allowlisted is treated exactly as signed out;
//        the session is left alone (no surface accepts it anyway).

const NOINDEX = { "X-Robots-Tag": "noindex" };

// The dormant workbench (R1.6) keeps its own rules behind the gate.
const WORKBENCH = /^\/(app|onboarding)(\/.*)?$/;
const ONBOARDING = /^\/onboarding(\/.*)?$/;

type AuthState = {
  userId: string | null;
  orgId?: string | null;
  sessionClaims?: Record<string, unknown> | null;
  redirectToSignIn: (opts?: { returnBackUrl?: string }) => Response;
};

async function verifiedEmail(state: AuthState): Promise<VerifiedEmail> {
  if (!state.userId) return null;
  const fromClaim = emailFromClaims(state.sessionClaims);
  if (fromClaim) return fromClaim;
  try {
    const user = await (await clerkClient()).users.getUser(state.userId);
    return emailFromUser(user);
  } catch {
    // Fail closed.  Nothing about the failure is logged: the request
    // carries no secret, but the policy is that the gate says nothing.
    return null;
  }
}

function deny(req: NextRequest): Response {
  if (isApiPath(req.nextUrl.pathname)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NOINDEX },
    );
  }
  const res = NextResponse.redirect(new URL("/", req.url), 307);
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return;

  const state = (await auth()) as AuthState;
  const bypass = await bypassMatches(
    req.headers.get(GATE_HEADER),
    process.env.GATE_BYPASS_TOKEN,
  );
  const allowed =
    bypass ||
    isAllowlisted(
      await verifiedEmail(state),
      parseAllowlist(process.env.GATE_ALLOWED_EMAILS),
    );
  if (!allowed) return deny(req);

  // Past the gate.  The workbench's pre-existing rules, unchanged in
  // intent: /app and /onboarding need a session (a bypass request has
  // none), and a session without an organisation goes to onboarding.
  if (WORKBENCH.test(pathname)) {
    if (!state.userId) return state.redirectToSignIn({ returnBackUrl: req.url });
    if (!state.orgId && !ONBOARDING.test(pathname)) {
      return NextResponse.redirect(new URL("/onboarding", req.url), 307);
    }
  }

  // The route never sees the bypass header.
  const headers = new Headers(req.headers);
  headers.delete(GATE_HEADER);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
