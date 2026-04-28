import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { getDb, plans } from "@/db";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
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
    .update(plans)
    .set({ name: name.trim(), data, updatedAt: new Date() })
    .where(and(eq(plans.id, params.id), eq(plans.companyId, orgId)))
    .returning();

  if (!row) return new Response("Not found", { status: 404 });
  return Response.json(row);
}
