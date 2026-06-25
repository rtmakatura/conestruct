import type { AuditResponse, AuditState } from "@/lib/render-types";

export type Status = "idle" | "generating" | "done";

// ---------------------------------------------------------------------------
// PR 7 (UX audit findings UX-21 + UX-22): this strip used to be
// hardcoded demo chrome — "GENERATED · 3 validation warnings · all CDOT
// supplement checks pass · READY FOR TCS REVIEW" rendered verbatim from
// first paint, before any generation, regardless of input validity or
// what the backend reported.  The copy descended from the legacy
// Streamlit app (src/api/app.py), which genuinely ran validate_layout
// and reported real counts; the production UI kept the chrome and
// dropped the data.  It was a fiction, not a coercion bug.
//
// The strip is now derived, in precedence order:
//   1. generating          → COMPUTING (unchanged spinner state)
//   2. invalid input       → red FAIL — client mirror (validateWorkZone)
//                            or backend geometry 400
//   3. first audit load    → VERIFYING
//   4. audit fetch error   → VERIFICATION UNAVAILABLE (neutral — a
//                            network blip is not a plan defect)
//   5. warnings > 0        → amber CAUTION, expandable disclosure
//                            listing each warning with rule ID +
//                            citation (UX-22: a count the user can't
//                            inspect is worse than none)
//   6. warnings == 0       → green PASS · READY FOR TCS REVIEW
//
// "GENERATED" became "VERIFIED" (the audit/breakdown are live-computed
// per scenario; nothing is generated until the CTA is clicked) and the
// unverifiable "all CDOT supplement checks pass" claim is gone.
//
// #60: the strip used to flip green on validation warnings ALONE — a
// plan with a failing compliance check or a known V1 limitation showed
// full-green READY, which is honest for validation warnings but
// misleading for an estimator who reads green as "no flags."  The
// green/off-green verdict now comes from the backend ``plan_flags``
// rollup (``is_clean``), so the strip and the audit panel can never
// disagree on whether a plan is clean (single-source; the strip does
// NOT re-derive the verdict).  When any category is non-empty the strip
// goes amber and the disclosure breaks the count down by category —
// validation warnings (fix your input) kept distinct from compliance
// fails and V1 limitations (capability gaps).  The rollup is OPTIONAL on
// the response: during the brief deploy window where the frontend ships
// before ``modal deploy``, ``plan_flags`` is absent and the strip falls
// back to the pre-#60 validation-warnings-only behavior.
// ---------------------------------------------------------------------------

export interface StripWarning {
  ruleId: string;
  message: string;
  citation: string;
}

interface ViolationSpec {
  rule_id: string;
  severity: string;
  message: string;
  mutcd_section: string;
}

interface CorridorWarning {
  flag: string;
  level: string;
  message: string;
}

// Flatten the two warning streams already present in the audit
// response.  Geometry *errors* never appear in a 200 (the render API
// raises 400 before building the audit), so in practice this carries
// soft rules like WORK_ZONE_SHORT_VS_BUFFER plus the OSM corridor
// soft-check findings.
export function collectValidationWarnings(
  audit: AuditResponse,
): StripWarning[] {
  const out: StripWarning[] = [];
  const geo = audit.sections.geometry_validation ?? {};
  const geoViolations =
    (geo.violations as ViolationSpec[] | undefined) ?? [];
  for (const v of geoViolations) {
    out.push({
      ruleId: v.rule_id,
      message: v.message,
      citation: `MUTCD § ${v.mutcd_section}`,
    });
  }
  const corridor = audit.sections.corridor_validation ?? {};
  if (corridor.checked === true) {
    const corridorWarnings =
      (corridor.warnings as CorridorWarning[] | undefined) ?? [];
    for (const w of corridorWarnings) {
      out.push({
        ruleId: w.flag,
        message: w.message,
        citation: "OSM GROUND-TRUTH (SOFT CHECK)",
      });
    }
  }
  return out;
}

interface Props {
  status: Status;
  /** Validation message blocking generation, or null when input is valid. */
  inputError: string | null;
  audit: AuditState;
}

export function StatusBar({ status, inputError, audit }: Props) {
  if (status === "generating") {
    return (
      <div className="status-bar warn">
        <span className="indicator" />
        <span>COMPUTING · taper · buffer · spacing · sign placement</span>
      </div>
    );
  }

  if (inputError) {
    return (
      <div className="status-bar fail">
        <span className="indicator" />
        <span>INVALID INPUT · {inputError}</span>
        <span className="pill fail">GENERATION BLOCKED</span>
      </div>
    );
  }

  if (audit.state === "error") {
    return (
      <div className="status-bar idle">
        <span className="indicator" />
        <span>
          VERIFICATION UNAVAILABLE · retry from the audit trail panel below
        </span>
      </div>
    );
  }

  // Stale-while-revalidate: during a refetch, derive from the previous
  // audit (same pattern as AuditTrail) rather than flashing VERIFYING.
  const data = audit.state === "ready" ? audit.data : audit.lastReady;
  if (!data) {
    return (
      <div className="status-bar idle">
        <span className="indicator" />
        <span>VERIFYING · taper · buffer · spacing · sign placement</span>
      </div>
    );
  }

  const warnings = collectValidationWarnings(data);

  // #60: the green/off-green verdict is the backend's, not ours.  When
  // the plan_flags rollup is present we read its ``is_clean`` verdict
  // (single source — the strip and the audit panel can't disagree).
  // When it's absent — the brief deploy window where Vercel ships the
  // frontend before ``modal deploy`` lands the rollup — we fall back to
  // the pre-#60 validation-warnings-only behavior so the strip never
  // crashes or shows a wrong color (raw-dict robustness class).
  const flags = data.plan_flags;
  const isClean = flags ? flags.is_clean : warnings.length === 0;

  if (isClean) {
    return (
      <div className="status-bar pass">
        <span className="indicator" />
        <span>VERIFIED · 0 validation warnings</span>
        <span className="pill pass">READY FOR TCS REVIEW</span>
      </div>
    );
  }

  // Not clean.  When the only flags are validation warnings (no
  // compliance fails, no V1 limitations) — or the rollup is absent — the
  // existing validation-warnings disclosure renders unchanged: the
  // common path looks exactly as it did pre-#60.
  const hasOtherCategories =
    flags !== undefined &&
    (flags.compliance_fails > 0 || flags.v1_limitations > 0);

  if (!hasOtherCategories) {
    return (
      <details className="status-details">
        <summary className="status-bar caution">
          <span className="indicator" />
          <span>
            VERIFIED · {warnings.length} validation warning
            {warnings.length === 1 ? "" : "s"}
            <span className="disclosure-caret" aria-hidden>
              {" "}
              ▸
            </span>
          </span>
          <span className="pill caution">REVIEW WARNINGS</span>
        </summary>
        <div className="status-warnings">
          <div className="check-list">
            {warnings.map((w, i) => (
              <div className="check-list-item" key={`${w.ruleId}-${i}`}>
                <span className="ck warn">!</span>
                <span className="check-list-lbl">
                  <strong>{w.ruleId.replace(/_/g, " ").toUpperCase()}</strong> —{" "}
                  {w.message}
                </span>
                <span className="check-list-src">{w.citation}</span>
              </div>
            ))}
          </div>
        </div>
      </details>
    );
  }

  // Generalized plan-flags breakdown (#60 option b/c): one amber strip,
  // count broken down by category in the disclosure so "fix your input"
  // (validation warnings) stays separate from "Conestruct doesn't do X
  // yet" (V1 limitations) and "a compliance check failed".  Counts come
  // from the authoritative rollup; the validation-warning detail rows
  // reuse collectValidationWarnings for their text/citations.  Compliance
  // fails and V1 limitations carry their full detail in the audit panel
  // below (single-source — the strip points there rather than restating).
  const total =
    flags.validation_warnings + flags.compliance_fails + flags.v1_limitations;
  return (
    <details className="status-details">
      <summary className="status-bar caution">
        <span className="indicator" />
        <span>
          VERIFIED · {total} plan flag{total === 1 ? "" : "s"}
          <span className="disclosure-caret" aria-hidden>
            {" "}
            ▸
          </span>
        </span>
        <span className="pill caution">REVIEW FLAGS</span>
      </summary>
      <div className="status-warnings">
        <div className="check-list">
          {flags.validation_warnings > 0 && (
            <div className="check-list-item">
              <span className="ck warn">!</span>
              <span className="check-list-lbl">
                <strong>
                  {flags.validation_warnings} validation warning
                  {flags.validation_warnings === 1 ? "" : "s"}
                </strong>{" "}
                — inputs to review
              </span>
              <span className="check-list-src">FIX INPUTS</span>
            </div>
          )}
          {warnings.map((w, i) => (
            <div className="check-list-item" key={`${w.ruleId}-${i}`}>
              <span className="ck warn">!</span>
              <span className="check-list-lbl">
                <strong>{w.ruleId.replace(/_/g, " ").toUpperCase()}</strong> —{" "}
                {w.message}
              </span>
              <span className="check-list-src">{w.citation}</span>
            </div>
          ))}
          {flags.compliance_fails > 0 && (
            <div className="check-list-item">
              <span className="ck fail">✕</span>
              <span className="check-list-lbl">
                <strong>
                  {flags.compliance_fails} compliance check
                  {flags.compliance_fails === 1 ? "" : "s"} failed
                </strong>{" "}
                — see the audit trail below for details
              </span>
              <span className="check-list-src">COLORADO SUPPLEMENT</span>
            </div>
          )}
          {flags.v1_limitations > 0 && (
            <div className="check-list-item">
              <span className="ck">ℹ</span>
              <span className="check-list-lbl">
                <strong>
                  {flags.v1_limitations} V1 limitation
                  {flags.v1_limitations === 1 ? "" : "s"}
                </strong>{" "}
                — known capability gap; see the audit trail below
              </span>
              <span className="check-list-src">MANUAL HANDLING</span>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
