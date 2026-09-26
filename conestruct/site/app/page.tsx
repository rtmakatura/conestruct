import { ComingSoon } from "@/components/coming-soon/ComingSoon";
import { PublicChrome } from "@/components/PublicChrome";

// coming-soon-gate Arc 2: the Plan Sheet (R5a) replaces Arc 1's
// placeholder.  The generator is at /sandbox, gated (R1.1); nothing here
// links to /sign-in (R1.5).  No form (A2-Q1): "Get notified" is a mail
// link.
export default function Page() {
  return (
    <PublicChrome sheet>
      <ComingSoon />
    </PublicChrome>
  );
}
