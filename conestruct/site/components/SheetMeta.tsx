// Title-block fields are load-bearing in this domain — decorative-but-false
// is worse than decorative-and-honest (same rule as AppSheetMeta / UX-20).
// SHEET, ISSUED, and BY were fabricated (no sheet set, stale date, false
// TCS/CDOT authorship) and are removed; only rows this page can back stay.
export function SheetMeta() {
  const items = [
    "PROJECT: CONESTRUCT.COM / LANDING",
    "SCALE: AS NOTED",
  ];
  return (
    <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint py-2.5 border-b border-line-soft">
      {items.map((s) => (
        <span key={s}>{s}</span>
      ))}
    </div>
  );
}
