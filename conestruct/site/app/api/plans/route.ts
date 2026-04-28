import { auth } from "@clerk/nextjs/server";
import { getDb, plans } from "@/db";

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
  const { name, data } = body as { name?: unknown; data?: unknown };
  if (typeof name !== "string" || name.trim().length === 0) {
    return new Response("name is required", { status: 400 });
  }
  if (typeof data !== "object" || data === null) {
    return new Response("data is required", { status: 400 });
  }

  const db = getDb();
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
