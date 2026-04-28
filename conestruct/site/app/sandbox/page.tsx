import type { Metadata } from "next";
import { GeneratorShell } from "@/components/GeneratorShell";

export const metadata: Metadata = {
  title: "Sandbox · Conestruct",
  description:
    "Public sandbox for the Conestruct MHT generator. Configure a Colorado work zone and watch every MUTCD calculation cite back to its source. Sign up to save plans and download real PDF, XLSX, and crew narrative outputs.",
};

export default function SandboxPage() {
  return <GeneratorShell mode="sandbox" />;
}
