interface Props {
  project: string;
  address: string;
  cdotSheet: string;
}

// UX-20: the drafting-table strip is skeuomorphic title-block chrome, and
// in this domain title-block fields are load-bearing — decorative-but-false
// is worse than decorative-and-honest. So it no longer asserts plan facts
// it can't back:
//   - ISSUED is DROPPED (#288, #281 Part 1 s8.32). It previously bound to
//     the current date, computed at render, with the claim that UTC kept
//     SSR and hydration identical. It does not: the SSR HTML is baked at
//     deploy time, so from the first UTC midnight after a deploy until the
//     next one the server's date and the client's date differ and the page
//     throws a hydration error (#212 -- bounded by the deploy, not the
//     cache, which is why deploy-day runs structurally cannot see it).
//     s8.32 moves this strip's TA/sheet citation to the nav post-generate
//     and specifies that citation as static text with no date, so the
//     defect must not travel with it. Under Rule 10 a date this header
//     cannot back is not a fact it should assert. The strip itself is
//     dropped from the screen when the results stack lands.
//   - SHT is dropped entirely: the real sheet count is scenario-dependent
//     and unknown to this pre-render header (the PDFs are 2 pages, not the
//     "01 / 01" it used to claim).
//   - BY dropped the false "TCS ·" authorship (the tool generates the plan;
//     a TCS reviews it downstream) and is relabeled LOCATION — honest data
//     under a clear label.
export function AppSheetMeta({ project, address, cdotSheet }: Props) {
  const items: Array<[string, string]> = [
    ["MHT", cdotSheet],
    ["PROJECT", project ? project.toUpperCase() : "UNTITLED"],
    ["LOCATION", address ? address.toUpperCase() : "—"],
    ["SCALE", "AS NOTED"],
  ];
  return (
    <div className="flex justify-between gap-8 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] px-6 py-2 border-b border-[color:var(--rule)] bg-[color:var(--canvas)] overflow-x-auto whitespace-nowrap">
      {items.map(([k, v]) => (
        <span key={k} className="flex items-baseline gap-2">
          <span>{k}:</span>
          <span className="text-[color:var(--ink-on-dark)]">{v}</span>
        </span>
      ))}
    </div>
  );
}
