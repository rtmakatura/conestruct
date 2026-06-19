export interface QuoteSettings {
  project_duration_days: number;
  num_flaggers: number;
  delivery_distance_miles: number;
  // Markup and labor rates. Percentages are fractions (0.1 == 10%) to match
  // the backend wire format; the panel displays them 0-100 and converts.
  overhead_pct: number;
  profit_pct: number;
  flagger_hourly_rate: number;
  tcs_hourly_rate: number;
  crew_hourly_rate: number;
}

export const DEFAULT_QUOTE_SETTINGS: QuoteSettings = {
  project_duration_days: 1,
  num_flaggers: 0,
  delivery_distance_miles: 20,
  overhead_pct: 0.1,
  profit_pct: 0.1,
  flagger_hourly_rate: 55,
  tcs_hourly_rate: 75,
  crew_hourly_rate: 45,
};

// Single source for coercing an untrusted request body into a bounded
// QuoteSettings. Shared by every render route that forwards quote settings
// (quote-breakdown, [kind], bundle) so the field set and clamps cannot drift
// between them — a divergence would silently drop fields on one path.
export function coerceQuoteSettings(raw: unknown): QuoteSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_QUOTE_SETTINGS;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    project_duration_days: Math.max(
      1,
      Math.min(365, Math.floor(num(r.project_duration_days, 1))),
    ),
    num_flaggers: Math.max(0, Math.min(20, Math.floor(num(r.num_flaggers, 0)))),
    delivery_distance_miles: Math.max(
      0,
      Math.min(500, num(r.delivery_distance_miles, 20)),
    ),
    overhead_pct: Math.max(0, Math.min(1, num(r.overhead_pct, 0.1))),
    profit_pct: Math.max(0, Math.min(1, num(r.profit_pct, 0.1))),
    flagger_hourly_rate: Math.max(
      0,
      Math.min(500, num(r.flagger_hourly_rate, 55)),
    ),
    tcs_hourly_rate: Math.max(0, Math.min(500, num(r.tcs_hourly_rate, 75))),
    crew_hourly_rate: Math.max(0, Math.min(500, num(r.crew_hourly_rate, 45))),
  };
}
