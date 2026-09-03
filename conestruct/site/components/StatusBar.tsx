import type { AuditResponse, AuditState, Refusal } from "@/lib/render-types";

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
//   1. invalid input       → red FAIL — the schema-bound client checks
//                            (workLen required / ceiling, and since #184
//                            the lanes + approaches mirrors, which
//                            previously gated the CTA and rendered
//                            inline but never reached this strip).
//                            Client bounds ONLY since #180; a backend
//                            400 is the next state, not this one.
//   1b. plan declined      → red PLAN DECLINED (#180) — any backend 400
//                            (gate refusals, the geometry taper floor).
//                            With a confirm affordance on screen the
//                            line is a short pointer to it; without one
//                            it is the full 400, rendered exactly once.
//   1c. awaiting location  → AWAITING LOCATION (#186) — no site has ever
//                            been chosen (meta.lat/lng at the 0/0 unset
//                            sentinel; ``hasLocation``).  Below the two
//                            above: a genuine problem with what the user
//                            actually edited outranks the missing pin.
//                            Above COMPUTING and every verdict branch:
//                            the strip can never certify — or even show
//                            a verdict for — a site nobody chose (rule
//                            10; the pre-#186 strip rendered green READY
//                            on a fresh, untouched /sandbox load).
//                            Chromeless neutral (rule 13 no-verdict).
//   2. generating          → COMPUTING (the spinner state).  #192: this
//                            branch sits BELOW the two above — "no
//                            answer yet" must never mask "answer
//                            refused"; a computing line over a refused
//                            or invalid input inverts the strip's
//                            honesty contract.
//   3. audit fetch 429     → VERIFICATION PAUSED (#182) — the rate
//                            limiter answered; the actual cause (edit
//                            pace) is named, never presented as an
//                            outage.  Same chromeless neutral treatment
//                            (rule 13: the words carry the distinction).
//   3b. audit fetch error  → VERIFICATION UNAVAILABLE (neutral — a
//                            network blip is not a plan defect; reserved
//                            for GENUINE unavailability since #182)
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
  /**
   * Client schema-bounds message (required / ceiling — genuinely invalid
   * input), or null.  Since #180 this NEVER carries a backend 400: a
   * refusal is a different state with a different vocabulary (below).
   */
  inputError: string | null;
  /**
   * #180 — a backend gate/geometry 400: the tool DECLINING for a stated
   * reason, not broken and not invalid input.  ``pointer`` non-null means
   * a confirm affordance is on screen — render the short pointer, never
   * the full 400 (the row's note is the primary voice).  ``pointer`` null
   * means no affordance — render the full ``message`` here, exactly once
   * on the whole screen.  Network/5xx failures never arrive here; they
   * stay on the VERIFICATION UNAVAILABLE path below, unreframed.
   */
  refusal?: Refusal | null;
  /**
   * #186 — true when no site has ever been chosen (``!hasLocation(meta)``,
   * the 0/0 unset sentinel).  Renders AWAITING LOCATION instead of any
   * verdict: never green — never any verdict — for a site nobody chose.
   * Ranked below inputError/refusal (problems with actual edits win) and
   * above everything else.
   */
  locationUnset?: boolean;
  audit: AuditState;
  /**
   * Cold-start honesty (Refs #122, rule 10): true once the in-flight
   * audit fetch has run unusually long (GeneratorShell's 2 s timer —
   * warm round-trips measure 0.5–0.7 s, a Modal cold start ~5.5 s).
   * Swaps the VERIFYING copy for one that says the server is waking up.
   * Same chromeless treatment — a slow answer is not an error.
   */
  verifySlow?: boolean;
  /**
   * #224 phase 2 (ruling 2): true while the request in flight carries the
   * in-generate site scan (every post-generate request does).  The
   * COMPUTING line and the slow-verify copy name the scan — the #122
   * "waking up" claim is false during a scan (the server is up; it is
   * scanning OpenStreetMap, up to the 20 s budget) and never shows then.
   */
  scanning?: boolean;
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

function StatusBarState({
  status,
  inputError,
  refusal = null,
  locationUnset = false,
  audit,
  verifySlow,
  scanning = false,
}: Props) {
  if (inputError) {
    return (
      <div className="status-bar fail">
        <span className="indicator" />
        <span>INVALID INPUT · {inputError}</span>
        <span className="pill fail">GENERATION BLOCKED</span>
      </div>
    );
  }

  // #180 — declined, not broken.  With an affordance the pointer routes
  // the reader to the control that resolves the dispute (the pill says
  // NEEDS REVIEW, not "confirm" — detection might be right, and honest
  // resolutions include fixing the location or walking away).  Without
  // an affordance the full 400 renders here, the only place it does.
  // This branch must precede the audit-error branch below: a refusal IS
  // an audit-fetch error state (httpStatus 400).
  if (refusal) {
    return (
      <div className="status-bar fail">
        <span className="indicator" />
        <span>PLAN DECLINED · {refusal.pointer ?? refusal.message}</span>
        <span className="pill fail">
          {refusal.pointer ? "NEEDS REVIEW" : "NEEDS INPUT"}
        </span>
      </div>
    );
  }

  // #186 — no site has ever been chosen.  Below inputError/refusal (a
  // genuine problem with what the user actually edited outranks the
  // missing pin), above COMPUTING and every verdict branch: whatever the
  // audit fetch answered about the geometry, the strip renders no verdict
  // for a site nobody chose.  Chromeless neutral — absence is not an
  // error the user made (rule 13 no-verdict treatment; the words carry
  // the distinction, same as the 429 state below).
  if (locationUnset) {
    return (
      <div className="status-bar idle unavail">
        <span className="indicator" />
        <span>
          AWAITING LOCATION · pick a location on the map to verify this plan
        </span>
      </div>
    );
  }

  // #192: below inputError/refusal on purpose — the spinner never masks
  // a refused or invalid input (see the precedence block up top).
  if (status === "generating") {
    return (
      <div className="status-bar warn">
        <span className="indicator" />
        <span>
          {scanning
            ? "COMPUTING · scanning site conditions (up to 20 s) · taper · buffer · spacing · sign placement"
            : "COMPUTING · taper · buffer · spacing · sign placement"}
        </span>
      </div>
    );
  }

  // fix-spec-02 P1·02: ``verifying`` / ``unavail`` are additive style
  // modifiers on the ``idle`` base (spinner vs. chromaless hollow dot);
  // the derivation order and every string of copy are unchanged.
  if (audit.state === "error") {
    // #182 — a 429 is the app's own rate limiter, not an outage: name
    // the actual cause.  Retrying helps once the minute rolls, so the
    // pointer to the panel's Retry stays.
    if (audit.httpStatus === 429) {
      return (
        <div className="status-bar idle unavail">
          <span className="indicator" />
          <span>
            VERIFICATION PAUSED · too many updates in the last minute —
            retry from the audit trail panel in a moment
          </span>
        </div>
      );
    }
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
            ? scanning
              ? "VERIFYING · scanning site conditions along the corridor — up to 20 s"
              : "VERIFYING · waking the verification server — the first check can take a few extra seconds"
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
              <span className="check-list-src">CDOT S-630-1</span>
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
