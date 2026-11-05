// R116 item 1 / R117 Q1a-c / R118 — the words for one jurisdiction rule,
// shared by every surface that shows one (NEEDS YOU, the checked row, the
// Plan reference impact column) so a rule reads the same everywhere (P2).
//
// The facts are the backend's (src/rules/jurisdiction.py
// annotate_count_effects): `device_label` names the device, `raised` says
// whether the rule added to a count on THIS plan (rule 3: no frontend
// count).  These functions only choose words.  R116: "No raw keys anywhere
// in the UI" -- a recording from before the label existed still gets a
// readable name, never the key.

import type { AppliedDelta, TriggerStatus } from "./jurisdiction";

/** The device's sentence-case name: the backend's label, or (on a wire
 *  that predates it) the id read as words. */
function deviceName(d: AppliedDelta): string | null {
  if (d.device_label) return d.device_label;
  const id = d.effect.device;
  if (!id) return null;
  const words = id.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** R117 Q1a: "'Arrow board required' when the layout already places it;
 *  'added' only when a count was raised."  Q1c: a rule with no device and
 *  no note is "{Jurisdiction} work-method rule". */
export function deltaTitle(d: AppliedDelta, jurisdictionName: string | null): string {
  if (d.effect.note) return d.effect.note;
  const name = deviceName(d);
  if (name && d.effect.op === "swap_device") return `Swapped to ${lowerFirst(name)}`;
  if (name && (d.effect.op === "add_device" || d.effect.op === "add_accessory")) {
    return `${name} ${d.raised ? "added" : "required"}`;
  }
  if (name) return `${name} required`;
  return `${jurisdictionName ?? "Jurisdiction"} work-method rule`;
}

/** The one detail line (R116: "one detail line"): whose requirement, and
 *  what the plan did about it. */
export function deltaDetail(d: AppliedDelta, jurisdictionName: string | null): string {
  const by = `required by ${jurisdictionName ?? "the jurisdiction"}`;
  if (d.raised === true) return `${by} · added to the plan`;
  if (d.raised === false) return `${by} · the plan already places it`;
  return by;
}

/** R117 Q1d: the citation is the source, short -- never the rule's
 *  sentence (that stays in Plan reference, quoted as sourced). */
export function deltaCite(d: AppliedDelta): string {
  return d.source.section ? `${d.source.doc} § ${d.source.section}` : d.source.doc;
}

const STATUS_WORDS: Record<TriggerStatus, string | null> = {
  fires: null,
  conditional: "conditional: shown here, not applied automatically",
  unknown: "needs input (set the street class)",
};

/** R116: a rule's status in words; a firing rule says nothing extra. */
export function statusWords(status: TriggerStatus): string | null {
  return STATUS_WORDS[status];
}

/** #388 R5: what a delta does to this plan, from the backend's count (Rule 3). */
export function deltaImpact(d: AppliedDelta): { main: string; unit?: string } {
  if (d.severity === "count") {
    // R116: never a raw key: the backend's label, or the id read as words on
    // an older wire.
    if (d.effect.op === "swap_device")
      return { main: "→ swap", unit: d.device_label ?? d.effect.device?.replace(/_/g, " ") };
    // A rule counted per direction with no plan count shows no number (Rule 10).
    if (d.qty === undefined && d.effect.qty_per_direction !== undefined)
      return { main: "—", unit: "per direction" };
    const qty = d.qty ?? d.effect.qty ?? 1;
    return { main: `+${qty}`, unit: qty === 1 ? "device" : "devices" };
  }
  return { main: d.severity === "op" ? "method" : "admin" };
}
