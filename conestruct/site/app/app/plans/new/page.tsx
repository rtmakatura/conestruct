import type { Metadata } from "next";
import { GeneratorShell } from "@/components/GeneratorShell";

export const metadata: Metadata = {
  title: "New plan · Conestruct",
  description: "Start a new traffic-control plan in the Conestruct workbench.",
};

export default function NewPlanPage() {
  return <GeneratorShell mode="workbench" />;
}
