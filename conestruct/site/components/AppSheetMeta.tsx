interface Props {
  project: string;
  address: string;
}

export function AppSheetMeta({ project, address }: Props) {
  const items = [
    "SHEET: 01 / 01",
    `PROJECT: ${project ? project.toUpperCase() : "UNTITLED MHT"}`,
    "ISSUED: 2026-04-27",
    `BY: TCS · ${address ? address.toUpperCase() : "NO LOCATION"}`,
    "SCALE: AS NOTED",
  ];
  return (
    <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint px-8 py-2 border-b border-line-soft bg-beige">
      {items.map((s) => (
        <span key={s}>{s}</span>
      ))}
    </div>
  );
}
