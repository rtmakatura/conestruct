interface Props {
  project: string;
  address: string;
}

export function AppSheetMeta({ project, address }: Props) {
  const items: Array<[string, string]> = [
    ["SHT", "01 / 01"],
    ["MHT", "S-630-1"],
    ["PROJECT", project ? project.toUpperCase() : "UNTITLED"],
    ["ISSUED", "2026-04-27"],
    ["BY", `TCS · ${address ? address.toUpperCase() : "NO LOCATION"}`],
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
