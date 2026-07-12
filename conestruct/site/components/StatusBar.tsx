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
//   2. invalid input       → red FAIL — backend geometry 400 (the taper
//                            floor et al., engine-removal PR D) or the
//                            schema-bound client checks (required /
//                            ceiling / lanes)
//   3. audit fetch error   → VERIFICATION UNAVAILABLE (neutral — a
//                            network blip is not a plan defect)
//   4. verification        → VERIFYING (Decision 2, frontend-engine-
//      in flight             removal: any in-flight state, not just the
//                            first load — the strip never shows a stale
//                            verdict as if it were current)
//   5. plan_flags absent   → VERIFICATION UNAVAILABLE (a response with
//                            no verdict gets no derived one)
//   6. warnings > 0        → amber CAUTION, expandable disclosure
//                            listing each warning with rule ID +
//                            citation (UX-22: a count the user can't
//                            inspect is worse than none)
//   7. warnings == 0       → green PASS · READY FOR TCS REVIEW
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
// the response type: when ``plan_flags`` is absent (deploy window or
// rollback) the strip shows VERIFICATION UNAVAILABLE rather than
// re-deriving a verdict from warning counts (frontend-engine-removal
// PR A — the pre-#60 derived-verdict fallback was itself the rule-3
// pattern being retired).
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
  /**
   * Cold-start honesty (Refs #122, rule 10): true once the in-flight
   * audit fetch has run unusually long (GeneratorShell's 2 s timer —
   * warm round-trips measure 0.5–0.7 s, a Modal cold start ~5.5 s).
   * Swaps the VERIFYING copy for one that says the server is waking up.
   * Same chromeless treatment — a slow answer is not an error.
   */
  verifySlow?: boolean;
}

// fix-spec-02 P1·05 (spec'd under P1·02): the strip is the product's
// verdict surface, so its state changes are announced politely to
// screen readers.  The live region is a stable wrapper — the state
// elements inside it swap wholesale, which is exactly the change a
// polite region reports.
export function StatusBar(props: Props) {
  return (
    <div aria-live="polite">
      <StatusBarState {...props} />
    </div>
  );
}

function StatusBarState({ status, inputError, audit, verifySlow }: Props) {
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

  // fix-spec-02 P1·02: ``verifying`` / ``unavail`` are additive style
  // modifiers on the ``idle`` base (spinner vs. chromaless hollow dot);
  // the derivation order and every string of copy are unchanged.
  if (audit.state === "error") {
    return (
      <div className="status-bar idle unavail">
        <span className="indicator" />
        <span>
          VERIFICATION UNAVAILABLE · retry from the audit trail panel below
        </span>
      </div>
    );
  }

  // Frontend-engine-removal Decision 2: while a verification is in
  // flight the strip shows an explicit checking state — never the
  // previous verdict presented as current.  (This strip used to derive
  // from ``lastReady`` here, stale-while-revalidate; AuditTrail keeps
  // that pattern for its *content*, but a verdict is a claim — a green
  // READY against an input the backend hasn't answered is a false one,
  // rule 10.)  The failure state stays reachable from here: a fetch
  // that errors flips to "error" → VERIFICATION UNAVAILABLE above.
  if (audit.state !== "ready") {
    return (
      <div className="status-bar idle verifying">
        <span className="indicator" />
        <span>
          {verifySlow
            ? "VERIFYING · waking the verification server — the first check can take a few extra seconds"
            : "VERIFYING · taper · buffer · spacing · sign placement"}
        </span>
      </div>
    );
  }
  const data = audit.data;

  const warnings = collectValidationWarnings(data);

  // #60: the green/off-green verdict is the backend's, not ours — we
  // read the ``plan_flags`` rollup's ``is_clean`` (single source; the
  // strip and the audit panel can't disagree).  When the rollup is
  // absent (a deploy window or rollback serving a pre-#60 response),
  // the strip no longer re-derives a verdict from warning counts — a
  // verdict we compute is one the audit panel can disagree with
  // (frontend-engine-removal PR A; rule 10).  Honest unavailability
  // instead: never green without a backend ``is_clean``.
  const flags = data.plan_flags;
  if (!flags) {
    return (
      <div className="status-bar idle unavail">
        <span className="indicator" />
        <span>
          VERIFICATION UNAVAILABLE · this response carries no plan verdict —
          retry from the audit trail panel below
        </span>
      </div>
    );
  }
  const isClean = flags.is_clean;

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
  // compliance fails, no V1 limitations) the existing
  // validation-warnings disclosure renders unchanged: the common path
  // looks exactly as it did pre-#60.
  const hasOtherCategories =
    flags.compliance_fails > 0 || flags.v1_limitations > 0;

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
