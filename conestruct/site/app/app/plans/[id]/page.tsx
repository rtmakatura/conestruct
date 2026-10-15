import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { getDb, plans } from "@/db";
import { GeneratorShell } from "@/components/GeneratorShell";
import { toScenario } from "@/lib/scenarios";
import { AUTH_UI_ENABLED } from "@/lib/feature-flags";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PlanPage({
  params,
}: {
  params: { id: string };
}) {
  // #195: with the auth UI compiled out a saved plan opens with no Save,
  // so an edit dead-ends behind "Save to download"; send the visit to /
  // until the flag is on (#204).  First, before auth or the database.
  if (!AUTH_UI_ENABLED) redirect("/");
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
      mode="workbench"
      initialScenario={toScenario(row.data)}
      initialPlanId={row.id}
      initialPlanName={row.name}
    />
  );
}
