import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { desc, eq } from "drizzle-orm";
import { getDb, plans, users } from "@/db";
import { PlanRow } from "@/components/PlanRow";

export const metadata: Metadata = {
  title: "Plans · Conestruct",
  description: "Your saved traffic-control plans.",
};

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString();
}

export default async function AppPage() {
  const { orgId } = await auth();
  if (!orgId) return null;

  const db = getDb();
  const rows = await db
    .select({
      id: plans.id,
      name: plans.name,
      updatedAt: plans.updatedAt,
      createdByName: users.name,
      createdByEmail: users.email,
    })
    .from(plans)
    .innerJoin(users, eq(plans.createdByUserId, users.id))
    .where(eq(plans.companyId, orgId))
    .orderBy(desc(plans.updatedAt));

  return (
    <div className="workbench min-h-screen">
      <nav className="sticky top-0 z-30 flex items-stretch justify-between h-[52px] border-b border-[color:var(--rule)] bg-[color:var(--canvas-tint)]">
        <div className="flex items-stretch">
          <Link
            href="/"
            className="flex items-center gap-3 px-5 border-r border-[color:var(--rule)] font-sans font-bold text-[16px] tracking-[-0.01em] text-white hover:text-[color:var(--cyan)] transition-colors"
          >
            <span>
              conestruct<span className="text-[color:var(--orange)]">.</span>
            </span>
            <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[color:var(--ink-on-dark-faint)]">
              v0.4
            </span>
          </Link>
          <span className="hidden md:flex items-center px-5 border-r border-[color:var(--rule)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
            Plans
          </span>
        </div>
        <div className="flex items-stretch">
          <div className="flex items-center px-3 border-l border-[color:var(--rule)]">
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/app"
            />
          </div>
          <div className="flex items-center px-3 border-l border-[color:var(--rule)]">
            <UserButton />
          </div>
        </div>
      </nav>

      <div className="px-10 pt-10 pb-6 max-md:px-6 flex items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--cyan)] inline-flex items-center gap-2.5 mb-3 before:content-[''] before:w-6 before:h-px before:bg-[color:var(--cyan)] before:inline-block">
            01 · PLANS
          </div>
          <h1 className="text-[28px] font-bold tracking-tighter text-white m-0 leading-[1.1]">
            Your saved plans
          </h1>
        </div>
        <Link
          href="/try"
          className="px-4 py-2 border border-[color:var(--cyan)] text-[color:var(--cyan)] font-sans text-[13px] hover:bg-[color:var(--cyan)] hover:text-[color:var(--canvas)] transition-colors whitespace-nowrap"
        >
          + New plan
        </Link>
      </div>

      <div className="px-10 pb-20 max-md:px-6">
        {rows.length === 0 ? (
          <div className="border border-[color:var(--rule)] p-12 text-center">
            <p className="text-[color:var(--ink-on-dark-faint)] mb-4">
              No plans yet — start one in the workbench.
            </p>
            <Link
              href="/try"
              className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--cyan)] hover:text-white"
            >
              Open the workbench →
            </Link>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-[color:var(--rule)]">
                <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
                  Name
                </th>
                <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] w-[160px]">
                  Updated
                </th>
                <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] w-[240px]">
                  Created by
                </th>
                <th aria-hidden className="w-[80px]" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <PlanRow
                  key={row.id}
                  id={row.id}
                  name={row.name}
                  updatedLabel={formatRelative(row.updatedAt)}
                  createdByLabel={row.createdByName ?? row.createdByEmail}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
