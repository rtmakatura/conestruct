import type { Metadata } from "next";
import { GeneratorShell } from "@/components/GeneratorShell";

export const metadata: Metadata = {
  title: "Try the generator · Conestruct",
  description:
    "Live demo of the Conestruct MHT generator. Configure a Colorado work zone scenario and watch every MUTCD calculation cite back to its source. Sign up to download real PDF, XLSX, and crew narrative outputs.",
};

export default function TryPage() {
  return <GeneratorShell />;
}
