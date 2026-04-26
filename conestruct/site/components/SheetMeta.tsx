export function SheetMeta() {
  const items = [
    "SHEET: 01 / 03",
    "PROJECT: CONESTRUCT.COM / LANDING",
    "ISSUED: 2026-04-26",
    "BY: TCS · CDOT",
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
