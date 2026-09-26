// The coming-soon gate's decisions (validation-artifacts/committed/
// coming-soon-gate/rulings.md).  Pure and Edge-safe: middleware.ts owns
// the Clerk calls and the responses; this file owns which paths are
// public, what the bypass header must match, and who is allowlisted.
//
// Everything here fails CLOSED: an unset token accepts no header, an
// unset allowlist admits no one, and an unrecognised path is gated.

/** The header scripts send to get past the gate (R1.4). */
export const GATE_HEADER = "x-conestruct-gate";

// R1.2: "Public paths are exactly: `/` (coming soon), `/terms`,
// `/privacy`, `/sign-in`, and the Clerk webhook."  `/sign-in(.*)`
// because Clerk's <SignIn/> is a catch-all route that walks its own
// sub-steps (/sign-in/factor-one, /sign-in/sso-callback …).
const PUBLIC_EXACT = new Set(["/", "/terms", "/privacy", "/api/clerk/webhook"]);

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_EXACT.has(pathname) ||
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/")
  );
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

// ── the bypass header (R1.4) ───────────────────────────────────────────
// Compared in constant time.  The Edge runtime has no Node
// crypto.timingSafeEqual, so both values are hashed with SHA-256 first
// (fixed 32-byte digests, so the comparison's length is independent of
// the input) and the digests are XOR-accumulated with no early exit.
async function sha256(value: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

export async function bypassMatches(
  given: string | null,
  expected: string | undefined,
): Promise<boolean> {
  if (!expected || given === null) return false;
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ── the allowlist (R1.3) ───────────────────────────────────────────────
// GATE_ALLOWED_EMAILS: comma-separated; whitespace and case ignored.
export function parseAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0),
  );
}

/** A verified primary email, or null when none can be established. */
export type VerifiedEmail = string | null;

/**
 * The email carried by a custom Clerk session-token claim, when the
 * dashboard has been configured to add one ({"email", "email_verified"}).
 * Returns undefined when the claim is absent or not affirmatively
 * verified, so the caller falls back to Clerk's Backend API; the default
 * session token carries no email at all.
 */
export function emailFromClaims(
  claims: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!claims) return undefined;
  const email = claims.email;
  if (typeof email === "string" && email.length > 0 && claims.email_verified === true) {
    return email;
  }
  return undefined;
}

/** The subset of @clerk/backend's User this gate reads. */
export type ClerkUserLike = {
  primaryEmailAddress?: {
    emailAddress?: string;
    verification?: { status?: string } | null;
  } | null;
} | null;

export function emailFromUser(user: ClerkUserLike): VerifiedEmail {
  const primary = user?.primaryEmailAddress;
  if (!primary?.emailAddress) return null;
  return primary.verification?.status === "verified" ? primary.emailAddress : null;
}

export function isAllowlisted(email: VerifiedEmail, allowlist: Set<string>): boolean {
  return email !== null && allowlist.has(email.trim().toLowerCase());
}
