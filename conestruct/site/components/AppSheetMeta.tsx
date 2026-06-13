interface Props {
  project: string;
  address: string;
  cdotSheet: string;
}

// UX-20: the drafting-table strip is skeuomorphic title-block chrome, and
// in this domain title-block fields are load-bearing — decorative-but-false
// is worse than decorative-and-honest. So it no longer asserts plan facts
// it can't back:
//   - ISSUED binds to the current date (UTC, computed at render) instead of
//     a hardcoded "2026-04-27" that went stale weeks ago. UTC keeps the
//     value identical across SSR and hydration (no client-only drift).
//   - SHT is dropped entirely: the real sheet count is scenario-dependent
//     and unknown to this pre-render header (the PDFs are 2 pages, not the
//     "01 / 01" it used to claim).
//   - BY dropped the false "TCS ·" authorship (the tool generates the plan;
//     a TCS reviews it downstream) and is relabeled LOCATION — honest data
//     under a clear label.
export function AppSheetMeta({ project, address, cdotSheet }: Props) {
  const issued = new Date().toISOString().slice(0, 10);
  const items: Array<[string, string]> = [
    ["MHT", cdotSheet],
    ["PROJECT", project ? project.toUpperCase() : "UNTITLED"],
    ["ISSUED", issued],
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
