import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { getDb, plans } from "@/db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!UUID_RE.test(params.id)) {
    return new Response("Not found", { status: 404 });
  }

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

  const updates: { name?: string; data?: unknown; updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return new Response("name must be a non-empty string", { status: 400 });
    }
    updates.name = name.trim();
  }

  if (data !== undefined) {
    if (typeof data !== "object" || data === null) {
      return new Response("data must be an object", { status: 400 });
    }
    updates.data = data;
  }

  if (updates.name === undefined && updates.data === undefined) {
    return new Response("nothing to update", { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .update(plans)
    .set(updates)
    .where(and(eq(plans.id, params.id), eq(plans.companyId, orgId)))
    .returning();

  if (!row) return new Response("Not found", { status: 404 });
  return Response.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!UUID_RE.test(params.id)) {
    return new Response("Not found", { status: 404 });
  }

  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  if (!orgId) return new Response("No active company", { status: 403 });

  const db = getDb();
  const [row] = await db
    .delete(plans)
    .where(and(eq(plans.id, params.id), eq(plans.companyId, orgId)))
    .returning({ id: plans.id });

  if (!row) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 204 });
}
