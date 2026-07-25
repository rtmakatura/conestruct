import type { JurisdictionBlock, SourceRef } from "@/lib/jurisdiction";
import { ReferenceChip } from "./ReferenceChip";

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

// Restage: the plan-details table lives in a Zone 3 density-contract
// chip.  The collapsed summary carries the backend counts; an error
// auto-expands so the Retry is never hidden behind a collapsed chip.
// Rows a jurisdiction count-delta added carry the backend's
// jurisdiction_required flag + source — highlighted with the JR tag,
// never by hue alone (diff-note §2: already-present response fields the
// old table ignored).
export function DeviceBreakdown({ state, onRetry }: Props) {
  const summary =
    state.state === "loading" ? (
      <>loading…</>
    ) : state.state === "error" ? (
      <span className="verdict-bad">unavailable — retry inside</span>
    ) : (
      <>
        <b>{state.data.unique_types}</b> device types ·{" "}
        <b>{state.data.total_devices}</b> total units
      </>
    );
  const jrCount =
    state.state === "ready"
      ? state.data.devices.filter((r) => r.jurisdiction_required).length
      : 0;
  const jurName = state.state === "ready" ? state.data.jurisdiction?.name : undefined;

  return (
    <ReferenceChip
      glyph="▤"
      label="Plan details — device schedule"
      sev={state.state === "error" ? "warn" : "info"}
      autoExpand={state.state === "error"}
      summary={summary}
    >
      {state.state === "loading" && (
        <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-4">
          Loading device breakdown…
        </div>
      )}

      {state.state === "error" && (
        <div className="flex items-baseline gap-3 py-4">
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
        <>
          {jrCount > 0 && jurName && (
            <p className="text-[12px] text-[color:var(--ink-on-dark)] mt-1 mb-3 pl-3 border-l-2 border-[color:var(--dim)]">
              Highlighted rows are jurisdiction-required — added by{" "}
              {jurName}&apos;s published rules on top of the MUTCD baseline.
            </p>
          )}
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
                <tr
                  key={`${row.device}-${row.code}`}
                  className={row.jurisdiction_required ? "jr" : undefined}
                >
                  <td>
                    {row.device}
                    {row.jurisdiction_required && (
                      <span
                        className="jr-tag"
                        title={row.jurisdiction_source?.doc}
                      >
                        {jurName ?? "JR"}
                      </span>
                    )}
                  </td>
                  <td>{row.code}</td>
                  <td>{row.function}</td>
                  <td className="num">{row.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </ReferenceChip>
  );
}
