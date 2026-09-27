import type { Metadata } from "next";
import { RoadClosed } from "@/components/coming-soon/RoadClosed";
import { PublicChrome } from "@/components/PublicChrome";
import { NOT_FOUND } from "@/lib/coming-soon-copy";

// coming-soon-gate R19: the 404, "Road closed".  Public at /404 (A3-Q2,
// lib/gate.ts).  An anonymous visitor at any OTHER unknown path never
// reaches it — the gate sends them to `/` first (R1.2, C-Q1); an
// allowlisted or bypass request, and a path the middleware matcher skips,
// get it with a 404 status.
export const metadata: Metadata = {
  title: NOT_FOUND.title,
};

export default function NotFound() {
  return (
    <PublicChrome wide>
      <RoadClosed />
    </PublicChrome>
  );
}
