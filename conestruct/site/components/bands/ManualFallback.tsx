"use client";

// #289 Phase 2 — the manual coordinate fallback, moved out of the setup
// panel and into the WHERE band.
//
// Authority: validation-artifacts/committed/issue-289-band-stack/rulings.md
// · #281 Part 1 §8.19 ("Location section — became the WHERE band's search
// field plus aerial").
//
// WHY IT SURVIVES A REDESIGN THAT DROPS THE SECTION IT LIVED IN.  It is
// the degraded-environment path: with no Mapbox token, or after a JS
// error during the modal's load, this is the only way to set a pin.  The
// picker is the decision surface (ruling 189) and this is what the band
// does when the picker cannot open.  Deleting it because the new design
// does not draw it would remove a recovery path the design never
// considered.
//
// UNCHANGED, verbatim from `GeneratorSidebar.tsx:1175-1274`: the four
// inputs, the blur-gated work-zone validation, and — the load-bearing
// part — a typed coordinate going through `withPin`, so a manual pin move
// clears the site-condition corrections exactly as the picker's Save does
// (fix-224-manual-pin-move).  A second door onto `meta.lat/lng` that
// skipped `withPin` is precisely the defect that fix closed.

import { useState } from "react";
import type { Scenario, ScenarioMeta } from "@/lib/scenarios";
import { validateWorkZone } from "@/lib/scenarios/validation";
import { withPin } from "@/lib/scenarios/site-corrections";
import { FieldErrorLine } from "../GeneratorFormPrimitives";

export function ManualFallback({
  scenario,
  setMeta,
  setScenario,
}: {
  scenario: Scenario;
  setMeta: (m: ScenarioMeta) => void;
  setScenario: (next: Scenario) => void;
}) {
  const meta = scenario.meta;
  // UX-21: same blur-gated inline validation as the per-kind forms —
  // this fallback panel is the third surface that edits workLen.
  const [wzTouched, setWzTouched] = useState(false);
  const wzValidation = validateWorkZone(scenario);
  return (
    <div className="border border-[color:var(--rule)] bg-[color:var(--canvas)] p-3">
      {/* #226: mini-card heading — section role. */}
      <div className="tr-section mb-2">Manual entry (fallback)</div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="tr-field block mb-1">Latitude</label>
          <input
            type="number"
            step="0.000001"
            data-write=""
            className="field-input w-full"
            value={meta.lat}
            // A typed coordinate is a pin move: through THE door
            // (withPin), so the site-condition corrections clear exactly
            // as they do on the picker's Save (fix-224-manual-pin-move).
            onChange={(e) => setMeta(withPin(meta, { lat: +e.target.value || 0 }))}
          />
        </div>
        <div>
          <label className="tr-field block mb-1">Longitude</label>
          <input
            type="number"
            step="0.000001"
            data-write=""
            className="field-input w-full"
            value={meta.lng}
            onChange={(e) => setMeta(withPin(meta, { lng: +e.target.value || 0 }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="tr-field block mb-1">Bearing (° from N)</label>
          <input
            type="number"
            step="1"
            min="0"
            max="359"
            data-write=""
            className="field-input w-full"
            value={meta.bearingDeg ?? ""}
            placeholder="0–359"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setMeta({ ...meta, bearingDeg: undefined });
              } else {
                const n = parseInt(raw, 10);
                setMeta({
                  ...meta,
                  bearingDeg: Number.isFinite(n) ? n : undefined,
                });
              }
            }}
          />
        </div>
        <div>
          <label className="tr-field block mb-1">Work zone (ft)</label>
          <input
            type="number"
            step="10"
            min="0"
            data-write=""
            className="field-input w-full"
            value={scenario.workLen || ""}
            placeholder="e.g., 200"
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setScenario({
                ...scenario,
                workLen: Number.isFinite(n) ? n : 0,
              } as Scenario);
            }}
            onBlur={() => setWzTouched(true)}
          />
        </div>
      </div>
      {wzTouched && !wzValidation.ok && (
        <FieldErrorLine>{wzValidation.message}</FieldErrorLine>
      )}
    </div>
  );
}
