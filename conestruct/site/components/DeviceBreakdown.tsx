import type { ScenarioResult } from "@/lib/scenarios";

interface Props {
  results: ScenarioResult;
}

export function DeviceBreakdown({ results }: Props) {
  return (
    <section className="mt-9">
      <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-[color:var(--rule)]">
        <h2 className="text-[20px] font-bold tracking-[-0.005em] text-white m-0">
          Plan details
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-on-dark-faint)]">
          <span className="text-[color:var(--cyan)]">04</span> · BREAKDOWN
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
          {results.devices.map((row) => (
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
