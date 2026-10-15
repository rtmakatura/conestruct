// @vitest-environment happy-dom
//
// #195 — route test: with NEXT_PUBLIC_AUTH_UI off, /app/plans/new and
// /app/plans/[id] redirect to / before touching auth or the database, so
// no signed-in user lands on a workbench that tells them to "Sign up".
// With the flag on, both pages render as before.

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ flag: false }));

vi.mock("@/lib/feature-flags", () => ({
  get AUTH_UI_ENABLED() {
    return state.flag;
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => {
    throw new Error("REACHED_AUTH");
  }),
}));

vi.mock("@/db", () => ({
  getDb: vi.fn(() => {
    throw new Error("REACHED_DB");
  }),
  plans: {},
}));

vi.mock("@/components/GeneratorShell", () => ({
  GeneratorShell: (props: { mode: string }) => `shell:${props.mode}`,
}));

import NewPlanPage from "./new/page";
import PlanPage from "./[id]/page";

const ID = "0b6a1f2e-6d7c-4f1e-9a55-2b1d3c4e5f60";

beforeEach(() => {
  state.flag = false;
});

describe("/app/plans/* with the auth UI off (#195)", () => {
  it("/app/plans/new redirects to /", () => {
    expect(() => NewPlanPage()).toThrow("REDIRECT /");
  });

  it("/app/plans/[id] redirects to / before auth or the database", async () => {
    await expect(PlanPage({ params: { id: ID } })).rejects.toThrow("REDIRECT /");
  });
});

describe("/app/plans/* with the auth UI on", () => {
  it("/app/plans/new renders the workbench", () => {
    state.flag = true;
    const el = NewPlanPage() as unknown as { props: { mode: string } };
    expect(el.props.mode).toBe("workbench");
  });

  it("/app/plans/[id] goes on to auth as before", async () => {
    state.flag = true;
    await expect(PlanPage({ params: { id: ID } })).rejects.toThrow("REACHED_AUTH");
  });
});
