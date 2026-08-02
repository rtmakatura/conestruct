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
  | {
      state: "loading";
      // #192: the previous successful breakdown, carried through a
      // refetch so the results zone can dim-and-refresh in place instead
      // of unmounting (same stale-while-revalidate contract as
      // AuditState.lastReady — presented only under an explicit
      // recomputing ribbon, never as current).  Absent/null on the first
      // load and after an error.
      lastReady?: DeviceBreakdownData | null;
    }
  | { state: "ready"; data: DeviceBreakdownData }
  | {
      state: "error";
      message: string;
      // #184 — the HTTP status when the failure was an HTTP response
      // (absent on network errors).  400 = the backend declined the
      // scenario: the chip mirrors AuditTrail's declined line and offers
      // no Retry (retrying an unchanged input re-earns the same 400).
      httpStatus?: number;
    };

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
  // #184 — declined, not broken (same contract as AuditTrail): a 400 is
  // the backend refusing the input for a stated reason.  The StatusBar
  // owns that reason's single voice; this chip neither re-quotes it nor
  // offers a Retry that would re-earn the same 400.
  const declined = state.state === "error" && state.httpStatus === 400;
  const summary =
    state.state === "loading" ? (
      <>loading…</>
    ) : state.state === "error" ? (
      declined ? (
        <span className="verdict-bad">unavailable — generation declined</span>
      ) : (
        <span className="verdict-bad">unavailable — retry inside</span>
      )
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

      {state.state === "error" &&
        (declined ? (
          <div className="flex items-baseline gap-3 py-4">
            <div className="font-mono text-[12px] text-[color:var(--fail)]">
              Device schedule unavailable while generation is declined — see
              the notice above.
            </div>
          </div>
        ) : (
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
        ))}

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
