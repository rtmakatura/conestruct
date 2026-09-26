import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

// Public (R1.2) but unlinked (R1.5): allowlisted people come here
// directly.  Kept out of search results for the same reason.
export const metadata: Metadata = {
  title: "Sign in · Conestruct",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main className="workbench min-h-screen flex items-center justify-center px-6 py-16 bg-[color:var(--canvas)]">
      {/* C-Q6: land on the builder (R1.1), not the dormant /app (R1.6). */}
      <SignIn fallbackRedirectUrl="/sandbox" />
    </main>
  );
}
