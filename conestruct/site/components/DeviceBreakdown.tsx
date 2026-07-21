import type { JurisdictionBlock, SourceRef } from "@/lib/jurisdiction";

export interface DeviceBreakdownRow {
  device: string;
  code: string;
  function: string;
  qty: number;
  /** Present only on rows a jurisdiction count-delta added or topped up
   *  (backend apply_count_deltas — spec §3.2). */
  jurisdiction_required?: boolean;
  jurisdiction_source?: SourceRef;
}

export interface ZoneGeometry {
  taper_l_ft: number;
  buffer_b_ft: number;
  device_spacing_ft: number;
  work_len_ft: number;
}

export interface DeviceBreakdownData {
  devices: DeviceBreakdownRow[];
  total_devices: number;
  unique_types: number;
  /** Additive (spec §3.2); absent only against a pre-extension backend. */
  zone_geometry?: ZoneGeometry;
  /** Present only when the scenario named a jurisdiction_key. */
  jurisdiction?: JurisdictionBlock;
}

export type DeviceBreakdownState =
  | { state: "loading" }
  | { state: "ready"; data: DeviceBreakdownData }
  | { state: "error"; message: string };

interface Props {
  state: DeviceBreakdownState;
  onRetry: () => void;
}

export function DeviceBreakdown({ state, onRetry }: Props) {
  return (
    <section className="mt-9">
      <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-[color:var(--rule)]">
        <h2 className="text-[20px] font-bold tracking-[-0.005em] text-white m-0">
          Plan details
        </h2>
      </div>

      {state.state === "loading" && (
        <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-6">
          Loading device breakdown…
        </div>
      )}

      {state.state === "error" && (
        <div className="flex items-baseline gap-3 py-6">
          <div className="font-mono text-[12px] text-[color:var(--fail)]">
            Device breakdown failed: {state.message}
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--act)] hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {state.state === "ready" && (
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
            {state.data.devices.map((row) => (
              <tr key={`${row.device}-${row.code}`}>
                <td>{row.device}</td>
                <td>{row.code}</td>
                <td>{row.function}</td>
                <td className="num">{row.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
