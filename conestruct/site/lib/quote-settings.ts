export interface QuoteSettings {
  project_duration_days: number;
  num_flaggers: number;
  delivery_distance_miles: number;
}

export const DEFAULT_QUOTE_SETTINGS: QuoteSettings = {
  project_duration_days: 1,
  num_flaggers: 0,
  delivery_distance_miles: 20,
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
  };
}
