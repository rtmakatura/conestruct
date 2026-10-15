import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GeneratorShell } from "@/components/GeneratorShell";
import { AUTH_UI_ENABLED } from "@/lib/feature-flags";

export const metadata: Metadata = {
  title: "New plan · Conestruct",
  description: "Start a new traffic-control plan in the Conestruct workbench.",
};

export default function NewPlanPage() {
  // #195: with the auth UI compiled out the workbench has no Save and every
  // download reads "Sign up", even to a signed-in user; send them to / until
  // the flag is on (#204).
  if (!AUTH_UI_ENABLED) redirect("/");
  return <GeneratorShell mode="workbench" />;
}
