import type { PlanArt } from "./plan-art";

// Landing v2: one drawn Colfax plan, inlined.  The markup is the
// designer's (design/landing-v2/*.svg via scripts/landing-plan-art.mjs),
// static and ours, so it goes in as inner HTML; the root <svg> is real
// JSX so the spotlight can set its class.
export function PlanSvg({ art, className }: { art: PlanArt; className?: string }) {
  return (
    <svg
      className={className}
      viewBox={art.viewBox}
      width="100%"
      role="img"
      aria-label={art.label}
      style={{ display: "block", height: "auto" }}
      dangerouslySetInnerHTML={{ __html: art.inner }}
    />
  );
}
