import type { Metadata } from "next";
import { GeneratorShell } from "@/components/GeneratorShell";

// coming-soon-gate D3: "Sign up to save plans…" is gone (sign-up is
// closed, R1.3) and so is "Public" — the builder is gated (R1.1).  Kept
// out of search results: only the allowlist can open it.
export const metadata: Metadata = {
  title: "Sandbox · Conestruct",
  description:
    "The Conestruct MHT generator. Configure a Colorado work zone and watch every MUTCD calculation cite back to its source.",
  robots: { index: false, follow: false },
};

export default function SandboxPage() {
  return <GeneratorShell mode="sandbox" />;
}
