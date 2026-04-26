const STATS: Array<[string, string]> = [
  ["~90s", "from scenario to PDF"],
  ["3", "scenarios supported"],
  ["PDF + XLSX + MD", "in one click"],
  ["100%", "MUTCD-cited"],
];

export function DimStrip() {
  const items: React.ReactNode[] = [];
  STATS.forEach(([num, label], i) => {
    items.push(
      <span key={`s-${i}`} className="text-navy">
        <span className="text-orange font-semibold">{num}</span> {label}
      </span>,
    );
    if (i < STATS.length - 1) {
      items.push(<span key={`d-${i}`}>· · · ·</span>);
    }
  });
  return (
    <div className="flex justify-between items-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint py-3.5 border-t border-b border-line-soft mt-8">
      {items}
    </div>
  );
}
