import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { getDb, plans } from "@/db";
import { GeneratorShell } from "@/components/GeneratorShell";
import type { ScenarioParams } from "@/lib/compute";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PlanPage({
  params,
}: {
  params: { id: string };
}) {
  if (!UUID_RE.test(params.id)) notFound();

  const { orgId } = await auth();
  if (!orgId) return null;

  const db = getDb();
  const [row] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, params.id), eq(plans.companyId, orgId)))
    .limit(1);

  if (!row) notFound();

  return (
    <GeneratorShell
      initialParams={row.data as ScenarioParams}
      initialPlanId={row.id}
      initialPlanName={row.name}
    />
  );
}
