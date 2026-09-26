import { PublicChrome } from "@/components/PublicChrome";
import { PUBLIC_LINE } from "@/lib/public-copy";

// coming-soon-gate D2: the placeholder — wordmark, "Coming soon", the one
// line, footer.  No form, no claims beyond PUBLIC_LINE, no sign-in link
// (R1.5).  The generator no longer renders here; it is at /sandbox, gated
// (R1.1).  The designed page and the email sign-up are Arc 2 (D1, R5).
export default function Page() {
  return (
    <PublicChrome>
      <section className="pt-10 max-md:pt-6">
        <h1 className="tr-question">Coming soon</h1>
        <p className="mt-3 max-w-[560px] font-sans text-[length:var(--fs-body-value)] leading-[1.6] text-[color:var(--ink-on-dark)]">
          {PUBLIC_LINE}
        </p>
      </section>
    </PublicChrome>
  );
}
