import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, plans, users } from "@/db";
import { TERMS_VERSION } from "@/lib/legal";

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  if (!orgId) return new Response("No active company", { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return new Response("Invalid body", { status: 400 });
  }
  const { name, data, acceptedTerms, acceptedTermsVersion } = body as {
    name?: unknown;
    data?: unknown;
    acceptedTerms?: unknown;
    acceptedTermsVersion?: unknown;
  };
  if (typeof name !== "string" || name.trim().length === 0) {
    return new Response("name is required", { status: 400 });
  }
  if (typeof data !== "object" || data === null) {
    return new Response("data is required", { status: 400 });
  }

  const db = getDb();

  if (
    acceptedTerms === true &&
    typeof acceptedTermsVersion === "string" &&
    acceptedTermsVersion === TERMS_VERSION
  ) {
    await db
      .update(users)
      .set({
        acceptedTermsAt: new Date(),
        acceptedTermsVersion: TERMS_VERSION,
      })
      .where(and(eq(users.id, userId), isNull(users.acceptedTermsAt)));
  }

  const [user] = await db
    .select({ acceptedTermsAt: users.acceptedTermsAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.acceptedTermsAt) {
    return new Response("Terms acceptance required", { status: 412 });
  }

  const [row] = await db
    .insert(plans)
    .values({
      companyId: orgId,
      createdByUserId: userId,
      name: name.trim(),
      data,
    })
    .returning();

  return Response.json(row, { status: 201 });
}
