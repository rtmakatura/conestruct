import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb, users } from "@/db";
import { TERMS_VERSION } from "@/lib/legal";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const db = getDb();
  const [row] = await db
    .select({
      acceptedTermsAt: users.acceptedTermsAt,
      acceptedTermsVersion: users.acceptedTermsVersion,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return Response.json({
    acceptedTerms: !!row?.acceptedTermsAt,
    acceptedTermsVersion: row?.acceptedTermsVersion ?? null,
    currentTermsVersion: TERMS_VERSION,
  });
}
