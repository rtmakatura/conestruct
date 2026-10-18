import { Landing } from "@/components/landing/Landing";

// Landing v2 (design/landing-v2/, the Oct 17 canvas) replaces the
// coming-soon Plan Sheet.  The generator is at /sandbox, gated (R1.1);
// nothing here links to /sign-in (R1.5).  The page carries its own nav and
// footer (the reference's), on the workbench tokens.
export default function Page() {
  return <Landing />;
}
