import type { AuditResponse, AuditState, Refusal } from "@/lib/render-types";
import { symClass } from "@/lib/design/symbols";

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
//   2. (retired, #252)     COMPUTING lived here — the breakdown's
//                            in-flight state.  Post-generate the working
//                            band is the page's one working voice
//                            (components/WorkingBand.tsx); pre-generate
//                            the breakdown has no strip state of its
//                            own (it never did beyond this line).
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
//                            verdict as if it were current).  #252:
//                            PRE-GENERATE only.  Once generated, the
//                            working band speaks for every open request
//                            and this branch renders nothing (one
//                            voice) — still never the stale verdict.
//   5. plan_flags absent   → VERIFICATION UNAVAILABLE (a response with
//                            no verdict gets no derived one)
//   6. warnings > 0        → amber CAUTION with the count in its word.
//                            UX-22's point stands — a count the user
//                            can't inspect is worse than none — but since
//                            #289 fidelity F5 (ruled Q4) the rows are
//                            inspected in the results stack (NEEDS YOU's
//                            ⚠ items, the pending disclosure), not in a
//                            disclosure on the strip (rules 50–55 give
//                            the strip nothing that opens).
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
  /**
   * #289 hand-check, 2026-09-23, finding 1 (Rule 10): a pin is down but
   * no person has confirmed the kind.  The strip reads "◌ AWAITING KIND
   * OF WORK" — the state; the instruction is the disabled primary's —
   * and nothing else: no verdict, no input-error or refusal state,
   * because every check behind those is for a kind nobody picked (the
   * shell does not fire them).  Ranked FIRST: it is
   * only ever true with a pin, so it never competes with AWAITING
   * LOCATION.
   */
  kindUnconfirmed?: boolean;
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
   * #252: true once the plan is generated — the working band is then
   * the page's one working voice, so the in-flight branch below renders
   * nothing instead of VERIFYING.  Every verdict branch is unchanged.
   */
  bandVoice?: boolean;
  /**
   * #289 hand-check, 2026-09-23, correction 2: true while no plan has
   * been generated, when Part 1 §2.1 gives the page no results zone at
   * all.  Read by the two VERIFICATION UNAVAILABLE branches ONLY, and
   * only to re-aim their pointer: "the audit trail panel below" is a
   * true instruction after a Generate and a lie before one (rule 10 —
   * a pointer must land on something that exists).  The verdict, the
   * ranking and every other branch are untouched.
   */
  preGenerate?: boolean;
}

// fix-spec-02 P1·05 (spec'd under P1·02): the strip is the product's
// verdict surface, so its state changes are announced politely to
// screen readers.  The live region is a stable wrapper — the state
// elements inside it swap wholesale, which is exactly the change a
// polite region reports.
// #250 (option f2, P1): the wrapper is also the strip's reserved slot —
// ``.status-slot`` holds the pill-state height (``--status-h``) and the
// 24 px gap in EVERY state, including the band-voice null below, so the
// verdict's re-mount at the pair's settle lands in room already
// allocated instead of pushing the results zone 76 px (audit F-S2-3).
export function StatusBar(props: Props) {
  return (
    <div className="status-slot" aria-live="polite">
      <StatusBarState {...props} />
    </div>
  );
}

/** #289 fidelity F5 — Part 2 rule 51: "Symbol to its left per rule 18".
 *  Every state leads with rule 17's TEXT symbol in rule 18's fixed hue
 *  (symClass): ✓ ready, ⚠ flag, × bad, ◌ none.  It replaces the 8 px
 *  `.indicator` square — a shape with no name, animated as a spinner while
 *  verifying, which rule 14 bans ("no indeterminate progress, anywhere").
 *  aria-hidden: the word beside it says the same thing (the house idiom). */
function Sym({ g }: { g: string }) {
  return (
    <span className={`status-glyph ${symClass(g)}`} aria-hidden>
      {g}
    </span>
  );
}

function StatusBarState({
  inputError,
  refusal = null,
  locationUnset = false,
  kindUnconfirmed = false,
  audit,
  verifySlow,
  bandVoice = false,
  preGenerate = false,
}: Props) {
  // #289 finding 1 — ranked above INVALID INPUT on purpose: the client
  // bounds it checks (lanes per kind, the approach mirrors) are the
  // placeholder kind's, so no verdict and no input error speak until the
  // kind is confirmed.  Same chromeless no-verdict treatment as AWAITING
  // LOCATION (rule 13), same ◌ glyph (rule 18).
  //
  // THE WORDS NAME THE STATE (2026-09-23, after the prod check): the strip
  // reads "◌ AWAITING KIND OF WORK", and "choose the kind of work" lives
  // only on the disabled primary.  That restores #260 P2 for this state —
  // the strip names the state, the CTA reason is the one live speaker of
  // the instruction — which the first build of finding 1 had broken by
  // putting the instruction here too.
  if (kindUnconfirmed) {
    return (
      <div className="status-bar idle unavail" data-testid="strip-kind-unconfirmed">
        <Sym g="◌" />
        <span>AWAITING KIND OF WORK</span>
      </div>
    );
  }

  if (inputError) {
    return (
      <div className="status-bar fail">
        <Sym g="×" />
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
        <Sym g="×" />
        <span>PLAN DECLINED · {refusal.pointer ?? refusal.message}</span>
        {/* #224 phase 2 (ruling 2): a refused site scan is neither a
            review of the user's input nor missing input — the service
            was unavailable.  The pill says so. */}
        <span className="pill fail">
          {refusal.code === "site_scan_unavailable"
            ? "SERVICE UNAVAILABLE"
            : refusal.pointer
              ? "NEEDS REVIEW"
              : "NEEDS INPUT"}
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
  // #260 (P2): the state, not the instruction — "pick a location on the
  // map …" was the gate's third voice (the rail blocker and the CTA
  // reason say it; the CTA reason is the one live speaker).
  if (locationUnset) {
    return (
      <div className="status-bar idle unavail">
        {/* #289 hand-check, 2026-09-22, correction 5: the null-state
            glyph is ◌, per rule 18.
            Rule 17: "Symbols are text, not icons: ✓ ▲ ⚠ ◌ × i, mono
            12.5 px / 1".  Rule 18 fixes ◌ at #93a0b0 — --none, the
            chromeless no-signal token this state already used for its
            8 px square.  Part 1 §2.1 prints the strip as "◌ AWAITING
            LOCATION · NO SITE CHOSEN", and the square was a shape with
            no name: a reader could not say what it meant, and a screen
            reader was told nothing at all.  aria-hidden because the
            words beside it say the same thing (the house idiom). */}
        <Sym g="◌" />
        <span>AWAITING LOCATION · no site chosen</span>
      </div>
    );
  }

  // fix-spec-02 P1·02: ``verifying`` / ``unavail`` are additive modifiers
  // on the ``idle`` base; since #289 fidelity F5 both draw rule 53's
  // "none" variant with the ◌ glyph (the spinner is gone, rule 14).  The
  // classes stay as the states' names; the derivation order and every
  // string of copy are unchanged.
  if (audit.state === "error") {
    // #182 — a 429 is the app's own rate limiter, not an outage: name
    // the actual cause.  Retrying helps once the minute rolls, so the
    // pointer to the panel's Retry stays.
    if (audit.httpStatus === 429) {
      return (
        <div className="status-bar idle unavail">
          <Sym g="◌" />
          <span>
            VERIFICATION PAUSED · too many updates in the last minute —
            {preGenerate
              ? " Generate in a moment to check again"
              : " retry from the audit trail panel in a moment"}
          </span>
        </div>
      );
    }
    return (
      <div className="status-bar idle unavail">
        <Sym g="◌" />
        <span>
          VERIFICATION UNAVAILABLE ·
          {preGenerate
            ? " Generate to check again"
            : " retry from the audit trail panel below"}
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
    // #252: post-generate the working band is the voice; the strip says
    // nothing rather than a second VERIFYING (and never the old verdict).
    if (bandVoice) return null;
    return (
      <div className="status-bar idle verifying">
        <Sym g="◌" />
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
        <Sym g="◌" />
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
        <Sym g="✓" />
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

  // #289 fidelity F5 (ruled Q4): THE STRIP NO LONGER OPENS.  Part 2 rules
  // 50–55 give it a symbol, a word and a pill — nothing that expands — and
  // the expanding check list restated what the results stack already
  // shows: every validation warning and geometry violation is an
  // ATTENTION fact (lib/tiering.ts), and §8.9 lifts ⚠ into NEEDS YOU;
  // compliance fails render there as ⚠ rows; V1 limitations are the
  // "Pending / not verified" disclosure.  The count stays in the word.
  if (!hasOtherCategories) {
    return (
      <div className="status-bar caution">
        <Sym g="⚠" />
        <span>
          VERIFIED · {warnings.length} validation warning
          {warnings.length === 1 ? "" : "s"}
        </span>
        <span className="pill caution">REVIEW WARNINGS</span>
      </div>
    );
  }

  // Generalized plan-flags count (#60 option b/c): one amber strip whose
  // word carries the rollup's total.  The per-category breakdown used to
  // open under it; #289 fidelity F5 (Q4) removed the disclosure — each
  // category is on screen in the results stack (see the note above), so
  // the strip states the count and the stack shows the rows.
  const total =
    flags.validation_warnings + flags.compliance_fails + flags.v1_limitations;
  return (
    <div className="status-bar caution">
      <Sym g="⚠" />
      <span>
        VERIFIED · {total} plan flag{total === 1 ? "" : "s"}
      </span>
      <span className="pill caution">REVIEW FLAGS</span>
    </div>
  );
}
