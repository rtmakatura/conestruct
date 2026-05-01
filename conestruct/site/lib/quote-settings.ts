export interface QuoteSettings {
  project_duration_days: number;
  num_flaggers: number;
  delivery_distance_miles: number;
  permit_fee: number;
}

export const DEFAULT_QUOTE_SETTINGS: QuoteSettings = {
  project_duration_days: 1,
  num_flaggers: 0,
  delivery_distance_miles: 20,
  permit_fee: 0,
};
