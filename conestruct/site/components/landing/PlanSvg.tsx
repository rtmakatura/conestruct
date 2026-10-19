import type { SVGAttributes } from "react";
import type { PlanArt } from "./plan-art";

// Landing v2: one drawn Colfax plan, inlined.  The markup is the
// designer's (design/landing-v2/*.svg via scripts/landing-plan-art.mjs),
// static and ours, so it goes in as inner HTML; the root <svg> is real
// JSX so the spotlight can set its class and the hero can listen on it.
type Events = Pick<SVGAttributes<SVGSVGElement>, "onPointerOver" | "onPointerOut">;

export function PlanSvg({ art, className, ...events }: { art: PlanArt; className?: string } & Events) {
  return (
    <svg
      {...events}
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
