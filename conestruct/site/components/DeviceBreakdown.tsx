import type { ScenarioResults } from "@/lib/compute";

interface Props {
  results: ScenarioResults;
}

interface Row {
  device: string;
  code: string;
  fn: string;
  qty: number;
}

export function DeviceBreakdown({ results }: Props) {
  const rows: Row[] = [
    {
      device: 'Traffic cone (28")',
      code: "—",
      fn: "Channelizing",
      qty: results.cones,
    },
  ];
  if (results.drums > 0) {
    rows.push({
      device: "Drum",
      code: "—",
      fn: "Channelizing (night)",
      qty: results.drums,
    });
  }
  rows.push({
    device: "Road work ahead",
    code: "W20-1",
    fn: "Advance warning",
    qty: results.signs >= 1 ? 2 : 0,
  });
  rows.push({
    device: "Right lane closed",
    code: "W20-5R",
    fn: "Advance warning",
    qty: results.signs >= 2 ? 2 : 0,
  });
  rows.push({
    device: "Merge right",
    code: "W4-2R",
    fn: "Advance warning",
    qty: results.signs >= 3 ? 2 : 0,
  });
  if (results.arrowBoards > 0) {
    rows.push({
      device: "Type C arrow board",
      code: "—",
      fn: "Active warning",
      qty: results.arrowBoards,
    });
  }

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-5 pb-3 border-b border-line">
        <h2 className="text-[22px] font-bold tracking-[-0.01em] text-navy m-0">
          Plan details
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          <span className="text-orange">04</span> · BREAKDOWN
        </span>
      </div>
      <table className="device-table">
        <thead>
          <tr>
            <th>Device type</th>
            <th>MUTCD code</th>
            <th>Function</th>
            <th style={{ textAlign: "right" }}>Qty</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.device}-${row.code}`}>
              <td>{row.device}</td>
              <td>{row.code}</td>
              <td>{row.fn}</td>
              <td className="num">{row.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
