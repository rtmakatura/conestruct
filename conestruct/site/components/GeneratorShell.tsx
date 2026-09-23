"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_SCENARIO, hasLocation, type Scenario } from "@/lib/scenarios";
import type { StagedCorrection } from "@/lib/scenarios/types";
import {
  SITE_SCAN_UNAVAILABLE_CODE,
  withSiteScan,
} from "@/lib/scenarios/site-scan";
import {
  validateApproaches,
  validateLanes,
  validateWorkZone,
} from "@/lib/scenarios/validation";
import {
  matchRefusalAffordance,
  matchRefusalCode,
} from "@/lib/scenarios/auto-apply";
import { stampMatches } from "@/lib/answer-stamp";
import type {
  AuditResponse,
  AuditState,
  Refusal,
  SiteScanProvenance,
} from "@/lib/render-types";
import {
  DEFAULT_QUOTE_SETTINGS,
  type QuoteSettings,
} from "@/lib/quote-settings";
import { AppNav } from "./AppNav";
import { SITE_ADJUSTMENT_DETAIL } from "./AuditTrail";
import { deriveTierSources } from "@/lib/tier-sources";
import { buildNeedsYouItems } from "@/lib/needs-you-items";
import { deriveNeedsYou } from "@/lib/needs-you";
import { GeneratorSidebar } from "./GeneratorSidebar";
import { StatusBar } from "./StatusBar";
import { WorkingBand } from "./WorkingBand";
import { RenderRequestContext, WriteLockContext } from "./WriteLock";
import { deriveWorkingBand } from "@/lib/working-band";
import { OutputCards } from "./OutputCards";
import { type DeliveryStatus, type FlaggerSource } from "./QuotePanel";
import { PricingCard } from "./PricingCard";
import { ResultsHero } from "./ResultsHero";
import { TieredReference } from "./TieredReference";
import { SCAN_BUCKET_TO_FLAG, assignTiers, type ScanBucketWire } from "@/lib/tiering";
import { settledData } from "./AuditTrail";
import {
  applyStaged,
  fmtScanStamp,
  stage,
} from "@/lib/scenarios/site-corrections";
// #289 Phase 2, S7 (ruling e) — revision's producers.  The fold and the
// enumerating sentence live with the other writes that are more than a
// set; the preview's states and strings live with the flag they carry.
import {
  applyStagedFields,
  stagedEnumeration,
} from "@/lib/scenarios/what-writes";
import {
  blindApplySentence,
  type PreviewState,
} from "@/lib/scenarios/preview";
import type {
  StagedFieldEdit,
  StagedFieldKey,
} from "@/lib/scenarios/types";
import { derivePrimaryOwner } from "@/lib/results-primary";
import { referenceSummary } from "@/lib/reference-summary";
import { NeedsYou } from "./NeedsYou";
import { CheckedDisclosure, PendingDisclosure } from "./ResultsDisclosures";
import { SiteConditionRows, hasConditionRows } from "./NeedsYouConditions";
import { ReferenceDisclosure } from "./ReferenceDisclosure";
import { ResultsHead } from "./ResultsHead";
import { SiteNotChecked } from "./SiteNotChecked";
import { RevisionPanel } from "./bands/RevisionPanel";
import {
  FIELD_LABEL,
  RevisionBand,
  STAGED_FIELD_OF,
  fieldCurrentValue,
  fieldValueLabel,
} from "./bands/RevisionBand";
import type {
  BandId,
  KindState,
  SetupSegmentKey,
} from "@/lib/scenarios/band-facts";
import type { OpenRequest } from "./BandStack";
import type {
  DeviceBreakdownData,
  DeviceBreakdownState,
} from "./DeviceBreakdown";
import { AppFooter } from "./AppFooter";
import {
  DebugSnapshotButton,
  type SnapshotDetection,
} from "./DebugSnapshotButton";
import { suggestStreetClass } from "@/lib/road-detection/classify";
import {
  JurisdictionControls,
  JurisdictionSuggestSlot,
  type SuggestionResolution,
} from "./JurisdictionSection";
import type {
  JurisdictionBlock,
  JurisdictionSuggestion,
  StreetClass,
} from "@/lib/jurisdiction";

type Mode = "sandbox" | "workbench";

// #289 Phase 2: the landing check moved to `lib/landing.ts` so the band
// stack can arm it too (ruling 184) without a circular import.  Re-exported
// here because arc-28's suites import it from this module by name, and a
// test that has to be edited to follow a file move is a test that stopped
// asserting the thing it was written for.
import { armLandingCheck, type LandingCheck } from "@/lib/landing";
export { armLandingCheck };
export type { LandingCheck };

// Cold-start honesty (Refs #122, rule 10): a warm audit round-trip
// measures 0.5–0.7 s; past 2 s the wait is almost certainly the Modal
// container cold-starting (~5.5 s measured), and an unexplained
// VERIFYING reads as a hang.  The strip can't know a call will be cold
// — it can only observe one running long — so after this threshold it
// escalates to copy that says the server is waking up.  Presentation
// only: a timer and a flag, no frontend computation.
const SLOW_VERIFY_MS = 2000;

// #182 — the verification fetches used to re-fire on EVERY scenario
// write: a slider drag plus a few typed digits dispatched one audit +
// one device-breakdown request per step against two 30/min/IP rate
// buckets (rateLimitOr429), so ordinary editing self-DOSed the app into
// VERIFICATION UNAVAILABLE for the rest of the minute.  The scenario
// value feeding both effects is now debounced, leading + trailing: the
// first edit after a quiet period fires immediately (a discrete edit
// still verifies promptly), a burst collapses to that leading fetch
// plus one trailing fetch for the final value once the burst pauses.
// 350 ms is CHOSEN, not traced (Rule 12): comfortably above typing
// inter-key gaps (~150 ms) and slider-step cadence, below perceptible
// lag on a settled edit.  ``retryNonce`` bypasses (Retry is deliberate).
const FETCH_DEBOUNCE_MS = 350;

function useDebouncedScenario(value: Scenario, ms: number): Scenario {
  const [debounced, setDebounced] = useState(value);
  const lastFireRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(value);

  useEffect(() => {
    if (value === debounced) return;
    pendingRef.current = value;
    if (
      timerRef.current === null &&
      Date.now() - lastFireRef.current >= ms
    ) {
      // Leading edge: quiet period over, fire now.
      lastFireRef.current = Date.now();
      setDebounced(value);
      return;
    }
    // Mid-burst: (re)arm the trailing timer for the latest value.
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      lastFireRef.current = Date.now();
      setDebounced(pendingRef.current);
    }, ms);
  }, [value, debounced, ms]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  return debounced;
}

interface Props {
  mode?: Mode;
  initialScenario?: Scenario;
  initialPlanId?: string | null;
  initialPlanName?: string | null;
}

export function GeneratorShell({
  mode = "workbench",
  initialScenario,
  initialPlanId = null,
  initialPlanName = null,
}: Props = {}) {
  const [scenario, setScenario] = useState<Scenario>(
    initialScenario ?? DEFAULT_SCENARIO,
  );
  // #289 hand-check, 2026-09-23, defect 1 — "the kind is confirmed, never
  // inferred" (FLOW.md §5a, #281 §4.4, P21).  `scenario.kind` cannot
  // carry that: it is a discriminant, so DEFAULT_SCENARIO arrives holding
  // `shoulder` before anyone chose anything.  This is the separate fact —
  // did a person choose it — and it lives HERE, not in the sidebar,
  // because the sidebar unmounts post-generate and a re-opened column
  // must not ask again for a kind already confirmed.
  //
  // A saved plan (`initialScenario`; production passes it only from
  // app/app/plans/[id]) starts confirmed: its kind was chosen when the
  // plan was made.  A fresh session starts at `none`.  Never on the wire.
  const [kindState, setKindState] = useState<KindState>(
    initialScenario ? "confirmed" : "none",
  );
  // Generator restage (Endeavor A): the page runs a real staged
  // lifecycle again — ``generated`` flips on the Generate click and the
  // rest of ``genState`` derives from the device-breakdown request the
  // shell already makes per scenario change (no fake timer, no second
  // reload path):
  //   pre        → Generate not yet clicked; Zone 1 dominant, Zone 2 empty
  //   generating → clicked, breakdown in flight; Zone 1 slim, placeholder
  //   post       → breakdown ready; Zone 2 dominant
  //   error      → breakdown failed; Zone 2 stale under a red ribbon
  // Quote settings stay owned here (the #74 fix), so the pricing card
  // unmounting across stage changes can never wipe edited rates.
  const [generated, setGenerated] = useState(false);
  // Live quote settings owned here (the single source) so the bundle download
  // can read the user's edits and QuotePanel reads/writes the same store
  // through props — no second settings copy.
  const [settings, setSettings] = useState<QuoteSettings>(
    DEFAULT_QUOTE_SETTINGS,
  );
  // Manual-override guards for the quote inputs, shell-owned (restage):
  // the pricing card unmounts across reopen → regenerate cycles, and
  // component-local guard state made the auto-effects re-clobber manual
  // edits on remount (the #74 bug class).  Kind switches re-arm the
  // flagger auto-fill, same as before.
  const [flaggerSource, setFlaggerSource] = useState<FlaggerSource>("auto");
  const [delivery, setDelivery] = useState<DeliveryStatus>({ state: "idle" });
  const scenarioKind = scenario.kind;
  useEffect(() => {
    setFlaggerSource("auto");
  }, [scenarioKind]);
  const [bundling, setBundling] = useState(false);
  // #252 (ruling a): the open file renders, by the label each renderer
  // declared (RenderRequestContext).  The band names the first; the
  // write lock holds while any is open.  Read off the requests, never a
  // timer; ``end`` removes exactly one entry so two renders of one kind
  // are counted twice.
  const [openRenders, setOpenRenders] = useState<string[]>([]);
  const beginRender = useCallback((label: string) => {
    setOpenRenders((o) => [...o, label]);
    return () => {
      setOpenRenders((o) => {
        const i = o.indexOf(label);
        return i === -1 ? o : [...o.slice(0, i), ...o.slice(i + 1)];
      });
    };
  }, []);
  // Dev-only replication snapshot (Refs #102, TEMPORARY): the last picker
  // classification + the pin it was captured at, surfaced by
  // GeneratorSidebar. Delete with DebugSnapshotButton.
  const [lastDetection, setLastDetection] = useState<SnapshotDetection | null>(
    null,
  );
  const [planId, setPlanId] = useState<string | null>(initialPlanId);
  const [planName, setPlanName] = useState<string | null>(initialPlanName);
  // #183 — the #197 baseline-ref variant (lib/answer-stamp.ts): the last
  // scenario object PERSISTED to the plan row.  Seeded with the object the
  // server page loaded (the same one the scenario state starts from, so an
  // unedited open reads clean) and replaced only by a successful save.
  // Compared by identity: any edit spread-replaces ``scenario`` and the
  // row-backed downloads stop presenting as downloads of the screen.
  // Edit-then-undo therefore reads dirty — CHOSEN: it errs toward asking
  // for a save, never toward serving a stale crew document.
  const [savedScenario, setSavedScenario] = useState<Scenario | null>(
    initialScenario ?? null,
  );

  const onSaved = (id: string, name: string, saved: Scenario) => {
    setPlanId(id);
    setPlanName(name);
    setSavedScenario(saved);
  };
  // Rows only exist to be downloaded in workbench mode with a saved plan;
  // everywhere else the flag is inert (public mode POSTs the live
  // scenario, so it can't go stale).
  const planDirty =
    mode === "workbench" && planId !== null && scenario !== savedScenario;

  // OutputCards stay visible from first paint (original behavior); the
  // Generate button now performs a real bundled-zip download rather than
  // gating visibility.
  const [bundleError, setBundleError] = useState<string | null>(null);

  // Both Plan Details and AuditTrail are server-driven: fetch from the
  // matching Modal endpoint so the panels read from the same placements
  // list that feeds the PDF, XLSX, and crew narrative.  Refetch per
  // scenario change through the #182 debounce (``fetchScenario`` below —
  // a burst of writes collapses to a leading + one trailing fetch);
  // ``retryNonce`` lets a single Retry button re-trigger both effects
  // immediately (shared by design — an underlying network failure
  // usually affects both).
  const [deviceBreakdown, setDeviceBreakdown] = useState<DeviceBreakdownState>({
    state: "loading",
  });
  // AuditTrail uses a stale-while-revalidate variant: ``lastReady`` keeps
  // the previously-ready audit visible while the next refetch is in
  // flight, so a user reading mid-edit doesn't see content flash empty.
  // DeviceBreakdown stays on the simpler clear-on-refetch pattern — its
  // tally is a small sidebar element where keeping stale numbers visible
  // would be more confusing than a brief loading hop.
  const [auditState, setAuditState] = useState<AuditState>({
    state: "loading",
    lastReady: null,
  });
  const [retryNonce, setRetryNonce] = useState(0);
  // True once the in-flight audit fetch has run past SLOW_VERIFY_MS;
  // reset whenever a new fetch starts or a response lands.
  const [verifySlow, setVerifySlow] = useState(false);
  // #182: the debounced scenario BOTH fetch effects key on and POST.
  // The answer stamps (``forScenario``) carry this value — it is the
  // input the backend actually saw; the strip's stamp comparison against
  // the live ``scenario`` keeps the deferred window an explicit
  // VERIFYING, never a stale verdict presented as current.
  // #224 phase 2 — the wire scenario.  Generate is a stage flip; what it
  // changes is what the loop SENDS: once generated, every request (the
  // two fetches below, the bundle, the per-file downloads, the quote)
  // carries ``site_scan`` so the backend scans the corridor inside
  // generation (src/api/site_scan.py).  Derived, memoised on identity:
  // the #197 stamps compare against THIS object, never ``scenario``, or
  // every post-generate answer would read as stale.  Reopen drops the
  // flag with ``generated``.
  //
  // ``proceedFor`` (ruling 1) is the explicit proceed-anyway
  // acknowledgement after a refused scan: a per-INPUT stamp (the #197
  // idiom — the scenario object it was given for).  Any edit is a new
  // object, so the acknowledgement drops and the next scan must succeed
  // or be acknowledged again; a fresh Generate click resets it.  Shell
  // state only — never on the scenario the forms edit or a saved plan
  // carries, never a default (suggest-never-set).
  const [proceedFor, setProceedFor] = useState<Scenario | null>(null);
  // #254: the operator's STAGED corrections — intents held here (one
  // owner: the strip's block and the results ribbon read one state, and
  // it survives the spec-34 held-scan swap).  Never on the scenario, so
  // staging opens no request; Apply folds the set into one setScenario.
  // Reopen clears it (the block unmounts; the intents' subject is gone).
  const [staged, setStaged] = useState<StagedCorrection[]>([]);
  // #289 Phase 2, S7 (ruling e) — revision.  The staged FIELD edits live
  // in the list above, beside #254's staged corrections: one staging
  // mechanism, never per editor, so APPLY is one write and the sentence
  // enumerates what is in it (ruling 191).
  //
  // What lives here instead is the PREVIEW — which is a read, not a
  // stage.  It is the answer to "what would this value do", fired on
  // commit and never on a keystroke, and it is deliberately NOT in the
  // staged list: nothing about it is applied, and discarding it costs
  // nothing.
  const [preview, setPreview] = useState<PreviewState>({ kind: "idle" });
  const previewSeq = useRef(0);
  /** Which field the column re-opened on, or null when it is not in S7.
   *  Rule 190: "CHANGE ONE THING re-opens one field, in place, with its
   *  consequence shown." */
  const [revisingField, setRevisingField] = useState<StagedFieldKey | null>(
    null,
  );
  // #253: an answer for the GENERATED scenario has settled since the
  // Generate click — the next-steps strip renders only after it (rule
  // 10: the pre-generate answer is never shown as this plan's).  Cleared
  // at the click, set at the pair's settle (the announcement effect).
  const [landed, setLanded] = useState(false);
  const wireScenario = useMemo(
    () =>
      generated ? withSiteScan(scenario, proceedFor === scenario) : scenario,
    [scenario, generated, proceedFor],
  );
  const fetchScenario = useDebouncedScenario(wireScenario, FETCH_DEBOUNCE_MS);

  // The STAMPED audit view — the rationale sits with the strip's
  // derivations below ("Decision 2 (frontend-engine-removal)…"); the
  // declarations live here because the #152 E landing effect reads the
  // verdict (#258 ruling c2).
  const auditSettled =
    (auditState.state === "ready" || auditState.state === "error") &&
    stampMatches([auditState.forScenario], [wireScenario]);
  const stripAudit: AuditState = auditSettled
    ? auditState
    : {
        state: "loading",
        lastReady:
          auditState.state === "ready"
            ? auditState.data
            : auditState.lastReady,
      };
  // #187 — declined, from the STAMPED view: true only when the 400 is
  // the settled answer for the scenario on screen (a stale 400 downgrades
  // to checking above and must not blank the trail for the new input).
  const auditDeclined =
    stripAudit.state === "error" && stripAudit.httpStatus === 400;

  // #289 hand-check, 2026-09-23, finding 1 (Rule 10): "the live checks
  // send no kind ... until the kind is confirmed — no verdict for a kind
  // nobody picked."  `scenario.kind` always holds a value, so the only way
  // to send no kind is to send nothing: the audit and the breakdown do not
  // fire until a person has confirmed the kind, and fire the moment they
  // have (the flag is in both effects' deps).  The strip says why in the
  // meantime (StatusBar's kind branch), and the WHERE band's corridor rows
  // say they wait on it (`corridorSpecLengths` below).
  //
  // EVERY SENDER OF THE SCENARIO, enumerated: the breakdown and the audit
  // (gated here); the S7 preview (gated in `firePreview`); the picker's
  // corridor-spec (gated in the modal via `initial.kindConfirmed`); the
  // bundle, the per-file downloads, save and the quote are post-generate
  // and Generate is gated on the same flag (`deriveRail`).  The
  // jurisdiction suggest sends lat/lng only.  The debug snapshot
  // (?debug=1 only, on click) is not a check and is left as is.
  const checksArmed = kindState === "confirmed";

  useEffect(() => {
    if (!checksArmed) return;
    const controller = new AbortController();
    // #192: carry the previous breakdown through the refetch so the
    // results zone dims in place instead of unmounting (presented only
    // under the recomputing ribbon).  An error drops the carry — after a
    // failure there is no last-known-good to hold.
    setDeviceBreakdown((prev) => ({
      state: "loading",
      lastReady:
        prev.state === "ready"
          ? prev.data
          : prev.state === "loading"
            ? (prev.lastReady ?? null)
            : null,
    }));
    (async () => {
      try {
        const res = await fetch("/api/render/device-breakdown", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenario: fetchScenario }),
          signal: controller.signal,
        });
        if (!res.ok) {
          let detail = "";
          let code: string | undefined;
          try {
            const body = await res.json();
            detail =
              typeof body?.detail?.message === "string"
                ? body.detail.message
                : typeof body?.detail === "string"
                  ? body.detail
                  : "";
            // #224 phase 2: the machine-readable code, when sent.
            if (typeof body?.detail?.error === "string") code = body.detail.error;
          } catch {
            detail = await res.text().catch(() => "");
          }
          setDeviceBreakdown({
            state: "error",
            message: detail || `HTTP ${res.status}`,
            // #184: 400 = declined — the chip renders its declined line
            // and offers no Retry (see DeviceBreakdownState).
            httpStatus: res.status,
            code,
          });
          return;
        }
        const data = (await res.json()) as DeviceBreakdownData;
        setDeviceBreakdown({ state: "ready", data });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setDeviceBreakdown({ state: "error", message: "Network error" });
      }
    })();
    return () => controller.abort();
  }, [fetchScenario, retryNonce, checksArmed]);

  useEffect(() => {
    // Finding 1 — see `checksArmed`.
    if (!checksArmed) return;
    const controller = new AbortController();
    setVerifySlow(false);
    const slowTimer = setTimeout(() => setVerifySlow(true), SLOW_VERIFY_MS);
    setAuditState((prev) => ({
      state: "loading",
      lastReady: prev.state === "ready" ? prev.data : prev.lastReady,
      // #252: the stamp of the answer that settled before this fetch —
      // the working band diffs it against the wire to name the flight.
      lastSettledFor:
        prev.state === "loading" ? prev.lastSettledFor : prev.forScenario,
    }));
    (async () => {
      try {
        const res = await fetch("/api/render/audit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenario: fetchScenario }),
          signal: controller.signal,
        });
        clearTimeout(slowTimer);
        setVerifySlow(false);
        if (!res.ok) {
          let detail = "";
          let code: string | undefined;
          let siteScan: SiteScanProvenance | undefined;
          try {
            const body = await res.json();
            detail =
              typeof body?.detail?.message === "string"
                ? body.detail.message
                : typeof body?.detail === "string"
                  ? body.detail
                  : "";
            // #224 phase 2: the machine-readable code + the scan
            // provenance that rode with the refusal, when sent.
            if (typeof body?.detail?.error === "string") code = body.detail.error;
            if (body?.detail?.site_scan && typeof body.detail.site_scan === "object") {
              siteScan = body.detail.site_scan as SiteScanProvenance;
            }
          } catch {
            detail = await res.text().catch(() => "");
          }
          setAuditState((prev) => ({
            state: "error",
            message: detail || `HTTP ${res.status}`,
            // 400 = the backend judged the scenario invalid (geometry
            // validation) — the StatusBar renders that as a red input
            // error instead of a neutral "verification unavailable".
            httpStatus: res.status,
            code,
            siteScan,
            lastReady: prev.state === "ready" ? prev.data : prev.lastReady,
            forScenario: fetchScenario,
            lastSettledFor: prev.lastSettledFor,
          }));
          return;
        }
        const data = (await res.json()) as AuditResponse;
        setAuditState((prev) => ({
          state: "ready",
          data,
          forScenario: fetchScenario,
          lastSettledFor: prev.lastSettledFor,
        }));
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        clearTimeout(slowTimer);
        setVerifySlow(false);
        setAuditState((prev) => ({
          state: "error",
          message: "Network error",
          lastReady: prev.state === "ready" ? prev.data : prev.lastReady,
          forScenario: fetchScenario,
          lastSettledFor: prev.lastSettledFor,
        }));
      }
    })();
    return () => {
      controller.abort();
      clearTimeout(slowTimer);
    };
  }, [fetchScenario, retryNonce, checksArmed]);

  // #258 (#193): the package announcement's own arming — set by the
  // operator's actions (Generate, Retry, proceed-anyway), never by an
  // edit; consumed at the PAIR's settle below.  Separate from the
  // landing's ``scrollPendingRef``: a Retry re-announces a recovered
  // plan but never re-lands the viewport (P1).
  const announcePendingRef = useRef(false);
  // #289 Phase 2 — the click nonce.  Both armings above are REFS, so
  // arming one changes nothing React watches.  That was invisible while
  // every arming action also changed the wire scenario: the pair
  // refired, the lifecycle effects re-ran on the new state, and the
  // armings were consumed there.  CHANGE ONE THING does not — it keeps
  // the answer on screen and changes no value (Part 1 §5.4) — so a
  // repeat Generate over an unedited scenario asks for a wire the
  // backend has already answered.  No request flies, no settle arrives,
  // and without this nonce neither effect re-runs at all: the click
  // would neither land the viewport (#152 E) nor re-announce (#193),
  // for a click the operator did make.
  //
  // The nonce makes the ARMING observable.  The refs still own the
  // CONSUMPTION, so Retry still announces without re-landing (P1).
  const [clickArm, setClickArm] = useState(0);
  const lastAnnounceArmRef = useRef(0);
  const lastScrollArmRef = useRef(0);
  const armClick = () => {
    announcePendingRef.current = true;
    setClickArm((n) => n + 1);
  };

  /**
   * #289 S7 — fire the preview.  Called on BLUR or ENTER only (rule
   * 95.2), never per keystroke: the one editor in the build already
   * doing the right thing is #252's commit-on-blur, and this is that
   * pattern generalised.
   *
   * It carries #282's `preview: true` and hits the breakdown path only —
   * never the audit, the scan or the PDFs, which the backend refuses for
   * a preview with a named 400.  It writes nothing: no band, no lock, no
   * memo, and the field stays editable while it is in flight.
   */
  const firePreview = (next: Scenario, forValue: string) => {
    // Finding 1: a preview is a live check too.  A kind picked from the
    // column's WHERE band but not yet confirmed must not ride one.
    if (!checksArmed) return;
    const seq = ++previewSeq.current;
    setPreview({ kind: "loading" });
    (async () => {
      try {
        const res = await fetch("/api/render/device-breakdown", {
          method: "POST",
          headers: { "content-type": "application/json" },
          // #282: the flag rides the SCENARIO, where the mixin defines
          // it.  A preview asks the cheap question about a value that is
          // not on the plan yet, so the scenario is the staged one.
          body: JSON.stringify({ scenario: { ...next, preview: true } }),
        });
        if (seq !== previewSeq.current) return; // superseded by a newer commit
        if (!res.ok) {
          setPreview({ kind: "error" });
          return;
        }
        const data = (await res.json()) as DeviceBreakdownData;
        if (seq !== previewSeq.current) return;
        setPreview({ kind: "ready", data, forValue });
      } catch {
        if (seq === previewSeq.current) setPreview({ kind: "error" });
      }
    })();
  };

  /** Stage a field edit and ask what it would do.  The scenario is NOT
   *  written — §1.1: "nothing is written until APPLY". */
  const stageField = (entry: StagedFieldEdit, forValue: string) => {
    setStaged((prev) => stage(prev, entry));
    firePreview(applyStagedFields(scenario, [entry]), forValue);
  };

  /** DISCARD (Part 1 §5.6, and Escape).  Un-stages everything and fires
   *  ZERO requests — the preview is the only request in the
   *  neighbourhood and it is already fired only on commit, so this holds
   *  by construction.  No dialog. */
  /** The staged value for the field S7 re-opened, or undefined when
   *  nothing is staged for it — the editor shows what the operator asked
   *  for, the plan still says what it said. */
  const stagedFieldValue =
    revisingField === null
      ? undefined
      : staged.find(
          (x): x is StagedFieldEdit =>
            "field" in x && x.field === revisingField,
        )?.to;

  /** The verdict the panel's deferred row carries — ruling 195: "verdict
   *  is for the plan on screen, not the staged change."  One word, off
   *  the settled audit; never predicted for the staged value. */
  const stripVerdictWord =
    auditState.state === "error"
      ? "unavailable"
      : auditDeclined
        ? "declined"
        : auditSettled
          ? "on screen"
          : "checking";

  const discardStaged = () => {
    previewSeq.current += 1; // any in-flight answer is now nobody's
    setStaged([]);
    setPreview({ kind: "idle" });
    setRevisingField(null);
    setRevising(false);
  };

  /** APPLY — ruling e's fold: the staged fields into the scenario and
   *  the staged corrections into the meta, in ONE `setScenario`, then
   *  one generate.  Ruling 191: one Apply is known to carry both because
   *  the sentence enumerated both. */
  const applyStagedAll = () => {
    if (staged.length === 0) return;
    const withFields = applyStagedFields(scenario, staged);
    setScenario({
      ...withFields,
      meta: applyStaged(withFields.meta, staged),
    } as Scenario);
    setStaged([]);
    setPreview({ kind: "idle" });
    setRevisingField(null);
    setRevising(false);
    onGenerate();
  };

  // Shared retry: a single click refires BOTH fetches unconditionally.
  // No smart-retry that targets only the failed call — a network
  // failure usually affects both, and a coordinated retry keeps the two
  // panels' "last refresh" timestamps aligned.
  const onRetry = () => {
    armClick();
    setRetryNonce((n) => n + 1);
  };

  // Derive the current "best known" audit summary for components that
  // need scalar fields (AppNav, OutputCards).  Reads from
  // ``state.data`` when ready, falls back to ``state.lastReady`` during
  // refetch/error so those headers don't flash empty mid-edit.  Null
  // only on the very first load before any audit has resolved.
  const currentAudit: AuditResponse | null =
    auditState.state === "ready" ? auditState.data : auditState.lastReady;
  const summary = currentAudit?.summary ?? null;

  // --- Pin-based jurisdiction suggestion (Endeavor B) -----------------
  // Advice only: this fetch NEVER writes to the scenario.  The single
  // writer of jurisdiction_key from this feature is the user's Confirm
  // click (onConfirmSuggestion below).  Endpoint absent or failing ⇒
  // the slot goes quiet and the picker works exactly as today — B is
  // additive, never load-bearing.
  const [suggestState, setSuggestState] = useState<{
    status: "idle" | "loading" | "ready" | "error";
    data: JurisdictionSuggestion | null;
  }>({ status: "idle", data: null });
  // #227: resolving a suggestion leaves a RECORD, not a cleared slot —
  // confirm/dismiss re-render the same container with ✓/× + evidence +
  // undo (the #179 semantics copied to this seam: the record carries
  // exactly what undo needs — the value in effect at click, null
  // included — and undo restores it / re-arms the live proposal).
  // Shell state only, cleared on pin move, NEVER written to scenario
  // state or the payload (GO ruling 3; the handoff-summary.ts:12-16
  // precedent) — a reload drops the record but re-derives the
  // suggestion, so nothing is lost silently.
  const [suggestResolution, setSuggestResolution] =
    useState<SuggestionResolution<string> | null>(null);
  // #152 C: street-class suggestion, same record lifecycle.
  const [classResolution, setClassResolution] =
    useState<SuggestionResolution<StreetClass> | null>(null);
  const pinLat = scenario.meta.lat;
  const pinLng = scenario.meta.lng;
  useEffect(() => {
    // lat=lng=0 is the "no pin yet" default — nothing to suggest.
    if (!pinLat && !pinLng) {
      setSuggestState({ status: "idle", data: null });
      setSuggestResolution(null);
      setClassResolution(null);
      return;
    }
    // A moved pin clears a prior resolution record (spec §3 / #227:
    // the record's subject — this pin's suggestion — no longer exists).
    setSuggestResolution(null);
    setClassResolution(null);
    let cancelled = false;
    const t = setTimeout(async () => {
      setSuggestState((s) => ({ ...s, status: "loading" }));
      try {
        const res = await fetch("/api/jurisdiction/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: pinLat, lng: pinLng }),
        });
        if (!res.ok) throw new Error(`suggest ${res.status}`);
        const data = (await res.json()) as JurisdictionSuggestion;
        // A malformed body is an error, not advice — the slot goes
        // quiet rather than rendering a broken suggestion (rule 10).
        if (
          typeof data?.reason !== "string" ||
          !Array.isArray(data.warnings) ||
          !data.boundary_source
        ) {
          throw new Error("suggest: malformed response");
        }
        if (!cancelled) setSuggestState({ status: "ready", data });
      } catch {
        if (!cancelled) setSuggestState({ status: "error", data: null });
      }
    }, 400); // debounce pin drags
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pinLat, pinLng]);

  // #152 C — street-class suggestion off the confirmed road's OSM tier.
  // Advice only, exactly like the jurisdiction suggestion: the single
  // writer of street_class from this feature is the user's Confirm
  // click.  The confirmed road is the picker's committed choice
  // (scenario.meta.confirmedRoad), keyed to the pin it was made at — a
  // pin that no longer matches makes the suggestion vanish rather than
  // ever suggesting from a stale road (#149's failure class).  Pure
  // presentation derivation from the persisted OSM highway tier; no
  // MUTCD math (rule 3).
  const confirmedRoadMeta = scenario.meta.confirmedRoad ?? null;
  const roadForPin =
    confirmedRoadMeta &&
    confirmedRoadMeta.pinLat === pinLat &&
    confirmedRoadMeta.pinLng === pinLng
      ? confirmedRoadMeta
      : null;
  const classSuggestion = roadForPin
    ? suggestStreetClass(roadForPin.candidate.highway_class)
    : null;

  // #228 (ruling 7): the rail's Location info line counts the
  // proposals awaiting Confirm/Dismiss — computed from the SAME
  // expressions the two slots branch on (rule 3 mirror:
  // JurisdictionSection's SuggestSlot proposal row renders iff a
  // suggestion exists with no jurisdiction_key and no resolution;
  // ClassSuggestSlot's iff classSuggest with no street_class and no
  // resolution — mirror comments there name this count).
  // Informational only: deriveRail renders it on Location's ``info``
  // subline and nothing else — never a state, never the blocker
  // (suggestions never gate).
  const suggestionKey =
    suggestState.status === "ready"
      ? (suggestState.data?.suggestion ?? null)
      : null;
  const pendingSuggestions =
    (suggestionKey && !scenario.jurisdiction_key && !suggestResolution
      ? 1
      : 0) +
    (classSuggestion && !scenario.street_class && !classResolution ? 1 : 0);

  // The evaluated jurisdiction block rides the device-breakdown response
  // (spec §3.2) — present only when the scenario names a jurisdiction_key.
  //
  // #152 D — stale-while-revalidate keyed by jurisdiction_key: a
  // street-class (or any input) change refires the breakdown fetch, and
  // flipping the whole bar/section to skeleton for that half-second was
  // the flicker.  While a refetch for the SAME jurisdiction is in
  // flight, the last evaluated block stays rendered as content;
  // ``jurisdictionRevalidating`` tells the section to present the one
  // class-dependent VERDICT (hours_eval) as checking, never as current
  // (rule 10 — content may be visibly mid-refresh, a verdict cannot).
  // A changed key has no matching block to hold, so it skeletons as
  // before; an error clears to null (the error ribbon names it).
  const [lastJurisdiction, setLastJurisdiction] =
    useState<JurisdictionBlock | null>(null);
  useEffect(() => {
    if (deviceBreakdown.state === "ready") {
      setLastJurisdiction(deviceBreakdown.data.jurisdiction ?? null);
    }
  }, [deviceBreakdown]);
  // #182: the debounce's deferred window is part of the in-flight window
  // for VERDICT derivations — a deferred fetch must not present the last
  // answer's verdict as current for up to 350 ms (rule 10).  Same
  // identity comparison as the #197 stamps (every writer spread-replaces).
  // Content surfaces keep #187's loading-only stale-while-revalidate.
  const fetchDeferred = scenario !== fetchScenario;
  const breakdownInFlight =
    deviceBreakdown.state === "loading" ||
    (deviceBreakdown.state === "ready" && fetchDeferred);
  const jurisdictionBlock =
    deviceBreakdown.state === "ready" && !fetchDeferred
      ? (deviceBreakdown.data.jurisdiction ?? null)
      : breakdownInFlight &&
          lastJurisdiction &&
          lastJurisdiction.key === scenario.jurisdiction_key
        ? lastJurisdiction
        : null;
  const jurisdictionRevalidating =
    breakdownInFlight && jurisdictionBlock !== null;
  const jurisdictionLoading =
    Boolean(scenario.jurisdiction_key) &&
    breakdownInFlight &&
    jurisdictionBlock === null;

  const safeFilename = (name: string | undefined): string => {
    const cleaned = (name ?? "")
      .trim()
      .replace(/[^a-zA-Z0-9 _-]+/g, "_")
      .replace(/\s+/g, "_");
    return cleaned || "plan";
  };

  // Generator restage: Generate stages the page (pre → generating →
  // post); it no longer auto-downloads the zip.  The bundle download
  // moved to Zone 2's "All (.zip)" — same endpoint, same
  // { scenario, settings } body (the #74 contract), different trigger.
  // #152 E: scroll target + arming flag for the post-generate scroll —
  // the results populate ABOVE the Generate button's viewport position,
  // so without it the user scrolls up hunting for what they just made.
  // Armed per Generate click; the effect below (after ``genState``)
  // fires it once on ``post``.
  const resultsRef = useRef<HTMLElement | null>(null);
  const scrollPendingRef = useRef(false);
  // #250 (a): the landing check armed by each landing scroll; its
  // settle() runs at the pair's settle, cancel() on unmount.
  const landingRef = useRef<LandingCheck | null>(null);
  useEffect(() => () => landingRef.current?.cancel(), []);

  // #193 (WCAG 4.1.3): the results render without any announcement —
  // the strip's live region covers VERIFICATION states, not generation.
  // This region announces the package itself.  Content derives from
  // the SAME settled deviceBreakdown the hero renders, and only at the
  // armed settle (rule 10: never an announcement for an input the
  // backend hasn't answered).  Cleared at the click so a repeat
  // Generate with identical counts still announces (aria-live fires on
  // change).
  const [genAnnouncement, setGenAnnouncement] = useState("");

  const onGenerate = () => {
    // See `revising`: the revision ends at the click, not at a
    // background flight.
    setRevising(false);
    scrollPendingRef.current = true;
    armClick();
    setGenAnnouncement("");
    setLanded(false);
    // #224 phase 2: a proceed-anyway acknowledgement is never remembered
    // across a fresh Generate (suggest-never-set).
    setProceedFor(null);
    setGenerated(true);
  };
  // #224 phase 2 — the explicit proceed-anyway: acknowledge THIS input.
  // The wire scenario's identity changes, so both fetches refire with
  // ``proceed_if_unavailable: true`` (the debounce's leading edge).
  const onProceedWithoutScan = () => {
    armClick();
    setProceedFor(scenario);
  };

  // #193: reopening swaps the strip out from under the keyboard — the
  // control that was clicked unmounts, so focus is moved deliberately
  // to the Setup zone instead of falling to <body>.  Armed per Reopen
  // click, same shape as the Generate arming above: only the
  // user-initiated swap moves focus, never a background re-render.
  const setupRef = useRef<HTMLElement | null>(null);
  const reopenPendingRef = useRef(false);

  // Reopen the full setup panel from the strip (structural edits).
  const onReopen = () => {
    reopenPendingRef.current = true;
    setStaged([]);
    setGenerated(false);
  };

  // #289 Phase 2 — CHANGE ONE THING, and what separates it from Reopen.
  //
  // `onReopen` was the setup strip's "Edit full setup": it drops
  // `generated`, so the results unmount and the page goes back to its
  // pre-generate shape.  The fact line's verb is not that.  Part 1 §5.4:
  // "The results below dim to 50% under a stale ribbon ... Downloads,
  // quote and save stay live — that is inherited from the current
  // corrections block and is not negotiable: staging must stay
  // abandonable."
  //
  // So re-opening the column post-generate leaves the answer on screen.
  // The band stack mounts above it; the results dim through the path
  // they already dim through (`regenerating` / `stagedDisclose`) as soon
  // as an edit fires a refetch.
  //
  // WHAT THIS IS NOT, YET: S7.  There is no staged field set, no
  // before/after panel and no APPLY here — a value edited in the
  // re-opened band writes and re-generates the way it always has.  The
  // verb and the shape arrive in this commit because deleting the strip
  // (§8.27) deletes the only post-generate edit path, and shipping
  // without one would be a regression dressed as a redesign.  The S7
  // commit gives the re-open its one field and its preview.
  const [revising, setRevising] = useState(false);
  /** Which band the re-opened column should land on, when a setup-line
   *  value asked for one that is not a staged field (defect 2's kind,
   *  location, extent and dates).  Null = the column decides. */
  const [columnOpenOn, setColumnOpenOn] = useState<OpenRequest | null>(null);
  const openPresses = useRef(0);
  /**
   * #289 hand-check, 2026-09-23, defect 2: "The user picks the field."
   *
   * This replaced `onChangeOneThing`, which opened S7 on SPEED for every
   * press — a choice made for the operator, which is the defect.  Each
   * value on the setup fact line is now its own link (rulings.md, "D2 —
   * the choice, recorded") and names what it opens:
   *
   *  · the five staged fields → S7 on THAT field (rule 190's one field);
   *  · kind, location, extent → the column with WHERE open;
   *  · dates → the column with WHAT open.
   *
   * The last two rows open the band that owns the value — none of the
   * four has a staged writer; ruled 2026-09-23, "accepted until Phase 3
   * rebuilds them".  Since the same day these links are ALSO the route
   * away from S7 that CHANGE SOMETHING ELSE was (retired: "the value
   * links replace it") — the staged set survives, as it did there.
   */
  const onChangeValue = (key: SetupSegmentKey) => {
    setRevising(true);
    const field = STAGED_FIELD_OF[key];
    setRevisingField(field ?? null);
    const band: BandId = key === "dates" ? "what" : "where";
    setColumnOpenOn(field ? null : { band, n: ++openPresses.current });
    // Any preview in flight is for the field being left; its answer is
    // nobody's now (the duty the retired link's handler carried).
    previewSeq.current += 1;
    setPreview({ kind: "idle" });
    // Rule 33: "a CHANGE link focuses the band it re-opens."  The zone
    // is the band stack's home and carries the re-homed Zone 1 target
    // (ruling 192); `BandStack` moves focus onto the open band itself on
    // every later transition.  Deferred a frame because the stack mounts
    // in this same commit.
    reopenPendingRef.current = true;
  };

  // Sandbox/public mode: build the deliverable zip on demand by hitting
  // /api/render/bundle (which fans out to all four Modal renderers in
  // parallel and zips the bytes server-side).  Saved/workbench mode just
  // re-uses the existing per-file download links exposed in OutputCards.
  const onDownloadBundle = async () => {
    if (bundling) return;
    setBundling(true);
    setBundleError(null);

    if (mode !== "sandbox") {
      // Workbench mode: OutputCards already serves per-file downloads
      // tied to the saved plan; nothing to bundle here.
      setBundling(false);
      return;
    }

    const endRender = beginRender("MHT package ZIP");
    try {
      const res = await fetch("/api/render/bundle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Thread the live, user-edited quote settings into the bundle so the
        // zipped quote.xlsx matches the on-screen rates. Omitting them made
        // the route coerce defaults, silently ignoring every edit.
        // #224 phase 2: the wire scenario — the zip is the scanned plan.
        body: JSON.stringify({ scenario: wireScenario, settings }),
      });
      if (!res.ok) {
        setBundleError(`Bundle failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFilename(scenario.meta?.project)}_mht_package.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setBundleError("Network error while building bundle");
    } finally {
      endRender();
      setBundling(false);
    }
  };

  const genState: "pre" | "generating" | "post" | "error" = !generated
    ? "pre"
    : deviceBreakdown.state === "loading"
      ? "generating"
      : deviceBreakdown.state === "error"
        ? "error"
        : "post";
  // #192: a regenerate WITH prior results on screen dims and refreshes
  // in place (stale-while-revalidate under an explicit ribbon) instead
  // of unmounting the whole subtree — unmounting destroyed panel-local
  // state and punished the designed post-generate edit path.  The
  // empty-state swap remains only for a first generate with nothing to
  // hold.
  // Any new GENERATE ends the revision: the answer on screen is the one
  // that was just asked for.  That flip lives in `onGenerate` (the
  // click), NOT in an effect on `genState` — `genState` reads
  // "generating" for every background verification too, including the
  // one the revision's own edit opens, so an effect here would close the
  // column under the operator the moment they changed a value.  #252's
  // lock already greys the controls for that flight; the band stays.

  const regenerating =
    genState === "generating" &&
    deviceBreakdown.state === "loading" &&
    (deviceBreakdown.lastReady ?? null) !== null;
  const showResults =
    genState === "post" || genState === "error" || regenerating;

  // #152 E: on successful generation, land the viewport on the Zone-2
  // hero.  Armed per Generate click (never on ordinary edits), fired
  // once when the staged lifecycle reaches ``post``; a failed
  // generation disarms instead — the error ribbon renders in place and
  // yanking the viewport toward it helps nobody.  Reduced-motion users
  // get an instant jump, not an animation.
  // #193: the armed Generate click also owns the next FOCUS move — the
  // sidebar (and the Generate button under the keyboard) unmounts the
  // moment the lifecycle leaves "pre", so without this, focus falls to
  // <body> and the next Tab restarts at the nav.  Focus lands on the
  // results zone on BOTH settles: post (alongside the scroll) and error
  // (no scroll — the #152 E no-yank ruling stands — but the region now
  // holds the failure alert, so focus belongs there too).  preventScroll
  // keeps the focus move from double-scrolling; background settles are
  // excluded by the arming, same as the scroll.
  useEffect(() => {
    // The click nonce, same discipline as the announcement's (see it for
    // why the nonce exists).  A run caused by the ARMING may serve only
    // an already-settled "post" — the repeat Generate, whose answer is
    // already on screen and which therefore lands at the click.  Every
    // other arming click either changes the wire (a first Generate
    // stamps the scan flag) or clicks over a settled error (Retry), and
    // both must wait for the outcome rather than spend the arming on the
    // state the click found.
    const armedNow = clickArm !== lastScrollArmRef.current;
    lastScrollArmRef.current = clickArm;
    if (!scrollPendingRef.current) return;
    if (armedNow && genState !== "post") return;
    if (genState === "post") {
      scrollPendingRef.current = false;
      const reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";
      resultsRef.current?.scrollIntoView({ behavior, block: "start" });
      // #250 (a): check the landing once it settles; re-issue once if off.
      landingRef.current?.cancel();
      landingRef.current = resultsRef.current
        ? armLandingCheck(resultsRef.current, behavior)
        : null;
      resultsRef.current?.focus({ preventScroll: true });
      // #258: the announcement left this branch — it waits for the
      // pair's verdict (the effect after ``planDeclined`` below).
    } else if (genState === "error") {
      // #258 (ruling c2, #152 E re-read): the no-yank rule stands for
      // an error that carries no action — a broken breakdown; a DECLINED
      // pair is a settled answer with two actions and lands exactly as
      // ``post`` does (audit F-S5-3: the refusal whose breakdown also
      // 400s scrolled nowhere and settled under the nav).  The verdict
      // is the stamped audit's, so the arming waits for it: a breakdown
      // error that lands before the audit answers neither scrolls nor
      // disarms until the pair has settled.
      if (!auditSettled) return;
      scrollPendingRef.current = false;
      if (auditDeclined) {
        const reduceMotion =
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";
        resultsRef.current?.scrollIntoView({ behavior, block: "start" });
        // #250 (a): the declined pair's landing is checked the same way.
        landingRef.current?.cancel();
        landingRef.current = resultsRef.current
          ? armLandingCheck(resultsRef.current, behavior)
          : null;
      }
      resultsRef.current?.focus({ preventScroll: true });
      // No status text on failure: the error ribbon is role="alert"
      // and announces itself (assertively, as an error should).
    }
  }, [genState, deviceBreakdown, auditSettled, auditDeclined, clickArm]);

  // #193: the Reopen half — focus the Setup zone once the column is
  // back.  Armed by `onReopen` and, since #289 Phase 2, by CHANGE ONE
  // THING, which is rule 33's "a CHANGE link focuses the band it
  // re-opens".  Ordinary re-renders never re-fire it.
  useEffect(() => {
    if (!reopenPendingRef.current) return;
    if (genState === "pre" || revising) {
      reopenPendingRef.current = false;
      setupRef.current?.focus({ preventScroll: true });
    }
  }, [genState, revising]);

  // Frontend-engine-removal Decision 2: the verdict strip never presents
  // an answer for an input the backend hasn't seen.  The audit effect
  // flips to "loading" only after paint, so on the render where the
  // scenario just changed, ``auditState`` still holds the answer for the
  // PREVIOUS input.  ``forScenario`` (stamped at fetch time) detects
  // that: when it isn't the scenario on screen, the strip gets an
  // explicit checking state instead of the stale verdict.  The check is
  // the #197 idiom (lib/answer-stamp.ts) — this surface is its template.
  // Scope, as narrowed by #187 (recorded decision, Arc 2): AuditTrail
  // keeps its stale-while-revalidate *content* during LOADING only —
  // prose can be visibly mid-refresh under the (refreshing…) cue.  On an
  // audit ERROR the trail blanks its values instead: a prior input's
  // numbers never render under a declined or failed banner.  The strip's
  // verdict itself is governed here as before.
  // (#258: ``auditSettled`` / ``stripAudit`` / ``auditDeclined`` are
  // declared just after ``fetchScenario`` above — the #152 E landing
  // effect reads the verdict and must not reach past its own line.)
  // #196 — the confirm-tick window.  ``refusal`` derives from the
  // stamped view, so it nulls for the whole re-fetch (up to ~5.5 s on a
  // Modal cold start, measured — see SLOW_VERIFY_MS above) and the CTA
  // used to re-enable against a road whose last settled verdict was a
  // 400.  Remember that last settled verdict; the sidebar keeps the CTA
  // gated while the next answer is still in flight.
  const [prevSettled400, setPrevSettled400] = useState(false);
  useEffect(() => {
    if (auditSettled) setPrevSettled400(auditDeclined);
  }, [auditSettled, auditDeclined]);
  // #179 extends the window to the untick's mirror image: undoing a
  // confirm restores refusing relays while the LAST settled verdict was
  // clean, so ``prevSettled400`` alone left the CTA enabled for the
  // whole re-fetch against a road whose incoming verdict is a 400.
  // While any recovery affordance is armed (the mirror predicate the
  // rows already render from) and the verdict is in flight, the CTA
  // waits.  The mirror decides gating-during-flight only — the backend
  // verdict remains authoritative at settle, and the server still
  // re-validates every render call (rule 3 posture unchanged).
  const refusalPending =
    !auditSettled &&
    (prevSettled400 || matchRefusalAffordance(scenario) !== null);
  // #258 (rule 10): a declined plan shows no plan artifacts.  The
  // audit's verdict gates the results, never the breakdown's arrival:
  // the two answer independently and the breakdown can succeed (memo)
  // while the audit refuses — the declined page used to show hero
  // counts, four live download buttons and "Plan generated" (audit
  // F-S5-1).  ``auditDeclined`` is the STAMPED 400 (#187); while the
  // Retry / proceed re-fetch is open after a declined settle the #192
  // carry stays hidden too (``prevSettled400``, the #196 window) — a
  // plan never presented is not a "previous answer".  The breakdown's
  // answer is held, not discarded; downloads return with the verdict.
  const planDeclined = auditDeclined || (!auditSettled && prevSettled400);
  const resultsVisible = showResults && !planDeclined;
  // #288 step 3 — NEEDS YOU, mounted.  Reads the SAME producer section 03
  // reads (lib/tier-sources.ts, step 1) with the SAME inputs the
  // TieredReference mount below passes, so the two surfaces cannot drift:
  // one derivation, two readers (P2).  The mapping to rows is step 2's.
  const needsYouModel = deriveNeedsYou(
    buildNeedsYouItems({
      sources: deriveTierSources({
        jurisdiction: jurisdictionBlock,
        jurisdictionLoading,
        revalidating: jurisdictionRevalidating,
        scenario: wireScenario,
        audit: stripAudit,
        generated: showResults && !auditDeclined,
        showAudit: showResults || auditState.state === "error",
      }),
      siteLabel: (flag) =>
        SITE_ADJUSTMENT_DETAIL[flag as keyof typeof SITE_ADJUSTMENT_DETAIL]?.label ?? flag,
    }),
  );
  // #261: the audit card's "N checks" — assignTiers' ledger.checked over
  // the same inputs TieredReference hands the tier model (the STAMPED
  // audit, the jurisdiction block once it has loaded), so the card and
  // the ✓ chip cannot disagree; the audit-PDF cover prints the same
  // token (tier_ledger.py mirror).  Null while no audit has settled for
  // the input on screen (first load, or a failed audit) — the card
  // prints no number and withholds the download.
  // Not memoised: ``stripAudit`` is a fresh object on every render, so
  // a memo would recompute each time anyway (and lint says so);
  // TieredReference runs the same assignTiers unmemoised.
  const settledForCard =
    showResults || auditState.state === "error" ? settledData(stripAudit) : null;
  // The ledger, computed once: the audit card's "N checks" and clause 4's
  // two promoted tier rows all count from it, so a card and a row can
  // never print different numbers for the same tier (P2).  The audit-PDF
  // cover prints the same token (src/rendering/tier_ledger.py mirror).
  const settledLedger =
    settledForCard === null
      ? null
      : assignTiers({
          jurisdiction: jurisdictionLoading ? null : jurisdictionBlock,
          audit: settledForCard,
          auditFailed: false,
        }).ledger;
  const auditChecked = settledLedger === null ? null : settledLedger.checked;
  // #258 (#193): "Plan generated — …" at the PAIR's settle, and only
  // when the stamped audit is clean.  Any settle consumes the arming
  // (so a later background settle never announces); a declined pair
  // consumes it silently — the refusal container is role=alert and
  // speaks for itself.
  useEffect(() => {
    // Did THIS run happen because the arming changed, rather than
    // because the pair did?  Only one case may be served there: an
    // already-settled, already-clean pair for the very wire the click
    // asks about — the repeat Generate.  Every other click changes the
    // wire (a first Generate stamps the scan flag, an edit changes a
    // value), so `auditSettled` is false at the click and this effect
    // returns below, exactly as it always has.  A Retry, which clicks
    // over a SETTLED error, must not consume its arming here or the
    // recovered plan would never announce (#258).
    const armedNow = clickArm !== lastAnnounceArmRef.current;
    lastAnnounceArmRef.current = clickArm;
    if (!announcePendingRef.current) return;
    if (genState === "generating" || !auditSettled) return;
    if (armedNow && (genState !== "post" || auditDeclined)) return;
    announcePendingRef.current = false;
    // #253: the pair has settled since the click — the strip may render.
    setLanded(true);
    // #250 (a): the pair's settle — the verdict re-mounts into its slot;
    // one more landing check, still under the one-re-issue cap.
    landingRef.current?.settle();
    landingRef.current = null;
    if (genState !== "post" || auditDeclined) return;
    const d = deviceBreakdown.state === "ready" ? deviceBreakdown.data : null;
    setGenAnnouncement(
      d && d.total_devices != null && d.unique_types != null
        ? `Plan generated — ${d.total_devices} devices, ${d.unique_types} types.`
        : "Plan generated — MHT package ready.",
    );
  }, [genState, auditSettled, auditDeclined, deviceBreakdown, clickArm]);

  // UX-21 / engine-removal PR D: the strip's red input-error state.
  // The client checks cover the schema-bound mirrors only — workLen
  // required / 20,000-ft ceiling, and (#184) the lanes/approaches
  // mirrors that already gate the CTA and render inline in the forms.
  // Before #184 only workLen reached the strip: a 4-lane x 14-ft edit
  // showed its inline form error while the strip contradicted it with
  // VERIFICATION UNAVAILABLE (the 422's old 502 collapse).  MUTCD math
  // stays the backend's: the geometry 400 from the per-change audit
  // fetch is THE source for the taper-floor verdict and its message
  // (validators.py WORK_ZONE_SHORTER_THAN_TAPER).  Non-400 audit errors
  // stay "verification unavailable" inside StatusBar.  Reads
  // ``stripAudit`` so a 400 for an already-edited input can't show
  // INVALID INPUT against the new one.
  const wzValidation = validateWorkZone(scenario);
  const lanesValidation = validateLanes(scenario);
  const approachesValidation = validateApproaches(scenario);
  const auditInputError =
    stripAudit.state === "error" && stripAudit.httpStatus === 400
      ? stripAudit.message
      : null;
  // #180 — one refusal, one voice.  The backend 400 is a REFUSAL (the
  // tool declining for a stated reason), kept distinct from the client
  // schema-bounds message (genuinely invalid input) so the two never
  // share a vocabulary.  ``stripAudit`` is stamped for the scenario on
  // screen, so the affordance match below interrogates the same input
  // the 400 answered.  When a confirm affordance matches, ``pointer``
  // carries the short banner line and the full 400 renders nowhere;
  // with no affordance, ``pointer`` is null and the banner renders the
  // full message exactly once.
  const inputError = !wzValidation.ok
    ? wzValidation.message
    : !lanesValidation.ok
      ? lanesValidation.message
      : !approachesValidation.ok
        ? approachesValidation.message
        : null;
  // #224 phase 2: the code-keyed half — when the 400 carried a
  // ``detail.error`` the affordance matches on the code (one entry,
  // matchRefusalCode); the scenario-predicate match stays first and
  // untouched.
  const auditRefusalCode =
    stripAudit.state === "error" && stripAudit.httpStatus === 400
      ? (stripAudit.code ?? null)
      : null;
  const refusal: Refusal | null =
    inputError === null && auditInputError !== null
      ? {
          message: auditInputError,
          pointer:
            matchRefusalAffordance(scenario)?.pointer ??
            matchRefusalCode(auditRefusalCode)?.pointer ??
            null,
          code: auditRefusalCode,
        }
      : null;
  // The refused scan's provenance, from the STAMPED audit view (so a
  // stale refusal for an edited input never renders as current).
  // #288 §8.29 — the next-steps strip is DROPPED, and with it the
  // deriveNextSteps call that fed it (lib/next-steps.ts, retired this
  // commit).  Its three chips pointed at site conditions, pending items
  // and downloads; in Direction A's column all three are visible in the
  // same viewport, so the strip restated what was already on screen.
  // What survives is the reserved first row — rule 28, below.
  // #252 — ONE in-flight derivation for the generated scenario: a
  // request for it is open while the breakdown is loading or the
  // stamped audit view is (the deferred debounce window included, as
  // for every verdict derivation).  Post-generate only: pre-generate
  // the same pair fires per keystroke and must never lock the input
  // under the cursor.  Read off the live request state, never a timer.
  // Spec 34 (#249) reads the same fact for the strip block's disable;
  // the working band mounts on it; the root's write lock keys on it.
  const planInFlight =
    generated &&
    (deviceBreakdown.state === "loading" || stripAudit.state === "loading");
  // Ruling a: a file render is a request too — the band and the lock
  // cover it; the plan pair outranks it in the sentence.
  const inFlight = planInFlight || openRenders.length > 0;
  const scanInFlight = planInFlight;
  const scanHeld = scanInFlight
    ? ((stripAudit.state === "ready" ? stripAudit.data : stripAudit.lastReady)?.sections?.site_scan ?? null)
    : null;
  // #288 clause 3 — the results area's ONE primary, derived once and read
  // by both surfaces (lib/results-primary.ts).  Ruling 185's sum is the
  // input; acceptance line 2 ("one primary per state at both widths") is
  // what the single owner buys.
  const primaryOwner = derivePrimaryOwner(needsYouModel.count);
  // #288 clause 4 — the inputs EVERY tier reader takes.  Assembled once so
  // the reference disclosure and the two promoted tier rows cannot be
  // handed different facts (P2); each reads the same producer with these.
  // The same predicate lib/tier-sources.ts derives for the tiers: a
  // jurisdiction revalidation, or an audit refetch that is holding the
  // last ready answer on screen.
  // The reference mounts with results OR on an audit error — rule 10's
  // contract, unchanged from Zone 3: the verdict strip says "retry
  // below", and the Retry lives inside this panel, so the panel must
  // exist whenever the strip can say it.  Lifted to a named predicate
  // because the disclosure group now reads it too.
  //
  // #289 hand-check, 2026-09-23, correction 2 (Rule 5 — STATED BEHAVIOUR
  // CHANGE): "Pre-generate renders no results zone (Part 1 §2.1) —
  // including under INVALID INPUT."  Before this, a jurisdiction pick
  // alone mounted the reference disclosure in the results stack with no
  // plan on screen, and an audit error mounted it at a pin.  Part 1 §2.1
  // gives the pre-generate column four bands and nothing else.
  //
  // WHERE THE PRE-GENERATE READER GOES INSTEAD, because this must not be
  // a deletion: the jurisdiction's evaluated facts are the WHAT band's
  // jurisdiction cell and its provenance line (authority, tcp_term —
  // ruling 196), and the audit-error recovery is the Generate click
  // itself, which refires both fetches.  The strip's pointer says so in
  // as many words (`preGenerate` on StatusBar) rather than pointing at a
  // panel that is no longer there (rule 10).
  const preGenerate = genState === "pre";
  const referenceMounts =
    !preGenerate &&
    (Boolean(jurisdictionBlock) ||
      Boolean(scenario.jurisdiction_key) ||
      showResults ||
      auditState.state === "error");
  const tiersRefreshing =
    jurisdictionRevalidating || (stripAudit.state === "loading" && stripAudit.lastReady !== null);
  const tierProps = {
    jurisdiction: jurisdictionBlock,
    jurisdictionLoading,
    revalidating: jurisdictionRevalidating,
    streetClass: scenario.street_class ?? null,
    schedule: scenario.schedule ?? null,
    scenario: wireScenario,
    audit: stripAudit,
    onRetry,
    generated: showResults && !auditDeclined,
    showAudit: showResults || auditState.state === "error",
    breakdown: deviceBreakdown,
  };
  // Clause 1: the scan NEEDS YOU's condition rows read.  Spec 34's rule,
  // moved with the block from the strip: the stamped view when settled,
  // the held (last ready) scan while a re-generation is in flight.
  const stampedScan =
    stripAudit.state === "ready" ? (stripAudit.data.sections?.site_scan ?? null) : null;
  const needsYouScan = stampedScan ?? (scanInFlight ? scanHeld : null);
  // The band's sentence, from the two wire objects (lib/working-band.ts):
  // ``prev`` is the answer settled BEFORE this flight — the stamped
  // audit's own ``forScenario`` when that answer predates the wire on
  // screen (the deferred window), else the carried ``lastSettledFor``.
  const auditFor = auditState.state === "loading" ? undefined : auditState.forScenario;
  const bandPrev = (
    auditFor !== undefined && !stampMatches([auditFor], [wireScenario])
      ? auditFor
      : (auditState.lastSettledFor ?? null)
  ) as Scenario | null;
  const bandState = deriveWorkingBand({
    plan: planInFlight,
    render: openRenders[0] ?? null,
    prev: bandPrev,
    next: wireScenario,
  });

  // #252 spec 31: the refusal container renders only once the pair has
  // settled — never in a frame the band is up (the audit can refuse
  // while the breakdown is still open; the strip's PLAN DECLINED verdict
  // is unchanged and still never masked, #192).  The recovery actions it
  // carries are write controls, locked under the band anyway.
  // #254 — disclose, don't lock: with corrections staged and the pair
  // settled, the results are the previous answer (dimmed, the ribbon
  // says so); downloads, quote and save stay live — the lock means "a
  // request is open" (#252) and locking here would make staging
  // non-abandonable (P7).  Under the flight the flight's ribbon speaks.
  const stagedDisclose = staged.length > 0 && !planInFlight && genState === "post";
  const scanRefusal: { message: string; scan: SiteScanProvenance | null } | null =
    !planInFlight &&
    stripAudit.state === "error" &&
    stripAudit.code === SITE_SCAN_UNAVAILABLE_CODE
      ? { message: stripAudit.message, scan: stripAudit.siteScan ?? null }
      : null;

  // Engine-removal PR D: the sidebar's corridor preview reads the
  // backend's zone lengths off the audit response the shell already
  // fetches per change (sections.corridor_spec, PR B).  Falls back to
  // ``lastReady`` during refetch (stale-while-revalidate CONTENT, same
  // pattern as AuditTrail — the verdict strip above is what never goes
  // stale); null before the first audit resolves or when the field is
  // absent (deploy window), in which case the preview shows an explicit
  // unavailable note instead of computing anything locally.
  //
  // #289 finding 1: and null while the kind is unconfirmed.  The lengths
  // are the kind's, and a held answer is the PREVIOUS kind's (a chip
  // re-picked after a confirmation) — showing it would be the stale
  // answer rule 10 forbids.  The WHERE rows say what they wait on.
  const corridorSpecLengths = checksArmed
    ? (currentAudit?.sections?.corridor_spec ?? null)
    : null;

  // Surface B (#152): the interactive jurisdiction + street-class
  // controls, built once here (so the suggestion state and the single
  // setScenario writer stay owned by the shell) and rendered inside the
  // Location step of the setup flow.  The persistent top strip is now a
  // read-only summary of the same choices.
  // #289 Phase 2 — the pin suggestion's three handlers, named once.
  //
  // The WHAT grid's jurisdiction cell hosts the suggestion now (#201:
  // proximity is how a user knows which control a confirm applies to), and
  // the street-class field keeps its own.  Both read these, so there is
  // still exactly ONE writer of `jurisdiction_key` through this path —
  // which is the suggest-never-set contract, and it would have been the
  // first thing to break if the handlers had been re-typed at the new
  // call site.
  const onConfirmJurisdictionSuggestion = (k: string) => {
    // #227: the record carries the value in effect at click (null and
    // ABSENT distinguished) — exactly what undo restores (#179
    // semantics: byte-identical after confirm-then-undo).
    setSuggestResolution({
      resolution: "confirmed",
      prior: scenario.jurisdiction_key ?? null,
      priorPresent: scenario.jurisdiction_key !== undefined,
      suggested: k,
    });
    setScenario({ ...scenario, jurisdiction_key: k });
  };
  const onDismissJurisdictionSuggestion = () => {
    const k = suggestState.data?.suggestion;
    if (k)
      setSuggestResolution({
        resolution: "dismissed",
        prior: scenario.jurisdiction_key ?? null,
        priorPresent: scenario.jurisdiction_key !== undefined,
        suggested: k,
      });
  };
  const onUndoJurisdictionSuggestion = () => {
    if (suggestResolution?.resolution === "confirmed") {
      if (suggestResolution.priorPresent) {
        setScenario({
          ...scenario,
          jurisdiction_key: suggestResolution.prior,
        });
      } else {
        // Absence restores as absence (rule 10) — an explicit null
        // would serialize where no key ever was.
        const next = { ...scenario } as Record<string, unknown>;
        delete next.jurisdiction_key;
        setScenario(next as unknown as Scenario);
      }
    }
    setSuggestResolution(null);
  };

  // #201 — the slot itself, for the WHAT grid's jurisdiction cell.
  const jurisdictionSuggestSlot = (
    <JurisdictionSuggestSlot
      suggest={suggestState.status !== "ready" ? null : suggestState.data}
      loading={suggestState.status === "loading"}
      jurisdictionKey={scenario.jurisdiction_key ?? null}
      resolution={suggestResolution}
      onConfirm={onConfirmJurisdictionSuggestion}
      onDismiss={onDismissJurisdictionSuggestion}
      onUndo={onUndoJurisdictionSuggestion}
    />
  );

  const jurisdictionControls = (
    <JurisdictionControls
      jurisdiction={jurisdictionBlock}
      jurisdictionKey={scenario.jurisdiction_key ?? null}
      setJurisdictionKey={(k) =>
        setScenario({ ...scenario, jurisdiction_key: k })
      }
      streetClass={scenario.street_class ?? null}
      setStreetClass={(c: StreetClass) =>
        setScenario({ ...scenario, street_class: c })
      }
      loading={jurisdictionLoading}
      // #289 §8.21 — the jurisdiction FIELD is the WHAT grid's cell now,
      // where ruling 196 gives it three states and rule 14 takes its
      // skeleton away.  What is left here is the street-class half.
      omitJurisdictionField
      // #289 hand-check, 2026-09-23, fix 2: no boxed panel inside the
      // road-type cell — the record keeps its shape, the box goes.
      bare
      suggest={suggestState.status !== "ready" ? null : suggestState.data}
      suggestLoading={suggestState.status === "loading"}
      suggestResolution={suggestResolution}
      onConfirmSuggestion={onConfirmJurisdictionSuggestion}
      onDismissSuggestion={onDismissJurisdictionSuggestion}
      onUndoSuggestion={onUndoJurisdictionSuggestion}
      classSuggest={classSuggestion}
      classSuggestTier={roadForPin?.candidate.highway_class ?? null}
      classResolution={classResolution}
      onConfirmClassSuggestion={(c: StreetClass) => {
        setClassResolution({
          resolution: "confirmed",
          prior: scenario.street_class ?? null,
          priorPresent: scenario.street_class !== undefined,
          suggested: c,
        });
        setScenario({ ...scenario, street_class: c });
      }}
      onDismissClassSuggestion={() => {
        if (classSuggestion)
          setClassResolution({
            resolution: "dismissed",
            prior: scenario.street_class ?? null,
            priorPresent: scenario.street_class !== undefined,
            suggested: classSuggestion,
          });
      }}
      onUndoClassSuggestion={() => {
        if (classResolution?.resolution === "confirmed") {
          if (classResolution.priorPresent) {
            setScenario({ ...scenario, street_class: classResolution.prior });
          } else {
            const next = { ...scenario } as Record<string, unknown>;
            delete next.street_class;
            setScenario(next as unknown as Scenario);
          }
        }
        setClassResolution(null);
      }}
    />
  );

  return (
    // #252 (ruling b): the root carries the lock class the one dim rule
    // keys on, and the context every write control reads (WriteLock.tsx).
    <WriteLockContext.Provider value={inFlight}>
    <RenderRequestContext.Provider value={beginRender}>
    {/* #250 (c): data-stage drives --pin-h (the rail's budget pre-generate,
        0 after) and the post-generate results landing rule (globals.css). */}
    <div
      className={`workbench min-h-screen${inFlight ? " ws-locked" : ""}`}
      data-stage={genState}
    >
      {/* #289 fidelity F4 (ruled Q2): the orange corner ticks are gone —
          Part 2 rule 20's frame is "1 px #2c3e53 border", and no Part 1
          §8 line keeps the ticks.  The frame's rule stays. */}
      <div className="workbench-frame" aria-hidden />

      <AppNav
        mode={mode}
        // #289 fidelity F4 — rule 23: the TA / sheet citation joins the
        // nav's right slot POST-generate only.  Before a Generate there is
        // no plan to cite, so the slot reads its pre-generate string.
        citation={
          genState !== "pre" && summary?.ta && summary?.cdot_sheet
            ? `${summary.ta} · ${summary.cdot_sheet}`
            : null
        }
        scenario={scenario}
        planId={planId}
        planName={planName}
        onSaved={onSaved}
      />
      {/* #289 fidelity F4 — Part 1 §8.32: "Sheet meta — DROPPED from the
          screen; the TA/sheet citation it carried moves to the nav's right
          edge post-generate."  The MHT / PROJECT / LOCATION / SCALE row is
          gone (its MHT cell was empty before a Generate, and at 380 it ran
          off the right edge).  The project name and location are still the
          WHAT band's fields. */}

      <div>
        {/* #289 fidelity F3 — Part 2 rule 24: "Column. Width 880 px, margin
            0 auto. Page padding 26 px 40 px 0; when the column is the last
            thing on the page, 30 px bottom."  880 + 2 × 40 = 960 outer.
            Rule 160 at the phone width: "page padding 16 px 14 px, column
            width 100%".  It was a 1,100 px column in a 1,180 px shell with
            32 / 40 / 80 padding (24 at the phone). */}
        <main className="px-10 pt-[26px] pb-[30px] max-w-[960px] mx-auto max-md:px-[14px] max-md:py-4">
          {/* #289 fidelity F4 (ruled Q2): the "02 · GENERATOR" eyebrow and
              the visible H1 are removed — Part 1 §1.2's order is nav →
              verdict strip → band stack, and rule 25 leaves no slot for a
              page title.  The H1 STAYS IN THE DOM, visually hidden: it is
              the page's only top-level heading, and removing it would
              leave assistive technology no document title to land on — a
              removal from the SCREEN, not from the page's outline. */}
          <div>
            <h1 className="sr-only">
              Method of Handling Traffic — plan generator
            </h1>
            {/* #260 (1): the intro sentence, the draft notice and the
                read-only jurisdiction bar moved below the Results zone
                (P3 — on load the first viewport held 550 px of preamble
                and the pick CTA sat at 960..1004 in a 1000 px viewport,
                audit F-S1-1).  Every stage: the block is context, not a
                step. */}
          </div>

          {/* The verification strip stays mounted in every stage — it is
              the live per-input verdict surface (rule 10), not
              post-generation chrome; the prototype's hidden-in-pre strip
              had no live verification behind it.

              #289 Phase 2 — MOVED ABOVE THE BAND STACK.  Part 1 §1.2 puts
              it second in source order, in every state: "1. App nav …
              2. Verdict strip (.vd) — always mounted, 4 variants.  3. The
              band stack".  Rule 35 says the same thing about its mounting
              and rule 26 gives it 18 px of air before the first band.
              Below the setup zone it was right for the panel era, where
              the strip summarised a form; above the column it is what the
              column is answering to, and the first thing read. */}
          <StatusBar
            inputError={inputError}
            refusal={refusal}
            locationUnset={!hasLocation(scenario.meta)}
            // #289 finding 1: a pin with no confirmed kind — the strip
            // says only "choose the kind of work" (no verdict for a kind
            // nobody picked; the checks behind it are not fired).
            kindUnconfirmed={hasLocation(scenario.meta) && !checksArmed}
            audit={stripAudit}
            verifySlow={verifySlow}
            // Rule 117 — S4's verdict slot is "mounted and EMPTY, holding
            // its height ... The verdict does not speak for an answer that
            // does not exist yet."  `bandVoice` is #250 f2's mechanism for
            // exactly that, and it was armed only AFTER the first generate
            // (`generated`), so the first S4 still showed VERIFYING.  The
            // working band is mounted for both, so the strip is quiet for
            // both.
            bandVoice={generated || genState === "generating"}
            // Correction 2: with no results zone before Generate, the
            // "retry from the panel below" pointer would name a panel
            // that does not exist.  Pre-generate the retry IS Generate.
            preGenerate={preGenerate}
          />

          {/* ——— Zone 1 · Setup ——— */}
          {/* tabIndex -1: programmatic focus target for the Reopen
              swap (#193) — never in the Tab order. */}
          <section
            ref={setupRef}
            tabIndex={-1}
            className={`zone outline-none${
              genState === "pre" || revising ? " dominant" : ""
            }`}
          >
            {/* #289 Phase 2 / §8.28 — THE SETUP ZONE HEADING IS DROPPED.
                Phase 1 dropped the results heading and left this one,
                because the bands that make "one narrative" true had not
                been built.  They are built now: "The column has one
                narrative, the bands carry step indices, and '02 · RESULTS'
                survives only as the placeholder block's label in S4."
                Ruling 192 confirmed it and re-homed the focus targets —
                `setupRef` stays on this section, which is what the band
                stack now fills, and `BandStack` carries rule 33's own
                target inside it. */}
            {/* #289 Phase 2 — the band stack holds the setup zone up to
                and including the settle, and nothing after it.

                PRE: the column, one band open.
                GENERATING (S4): the same column, LOCKED — rule 60's fact
                  lines at .5 with "locked" in place of their links, no
                  open band, no generate frame.  §2.4: "the two fact lines
                  held their positions from S3", which is why the stack
                  stays mounted rather than being swapped for something
                  else.
                POST: nothing.  Rule 119 collapses setup to ONE fact line
                  and rule 28 puts it in the results stack's first row,
                  which is `ResultsHead` — so the zone is empty and the
                  answer is one row further down the column, where §2.5's
                  reading order puts it.

                The SETUP STRIP is deleted with this commit.  §8.27, and
                #262 "closes by deletion, not by fix": its six inline
                editors, its commit-on-blur and its ⤢ / ✎ split are gone,
                and the way back into a value is the fact line's CHANGE
                ONE THING. */}
            {/* #289 Phase 2, S7 — revision.  The re-opened field and its
                consequence replace the column here: rule 190 re-opens
                ONE field, so the other three bands are not the question
                being asked. */}
            {revisingField !== null ? (
              <RevisionBand
                scenario={scenario}
                field={revisingField}
                stagedTo={stagedFieldValue}
                onStage={(to) =>
                  stageField(
                    {
                      field: revisingField,
                      label: FIELD_LABEL[revisingField],
                      // Defect 2: the field the operator picked, not
                      // speed's value under another field's name.
                      from: fieldCurrentValue(scenario, revisingField),
                      to,
                    },
                    fieldValueLabel(revisingField, to),
                  )
                }
                onDiscard={discardStaged}
                // CHANGE SOMETHING ELSE is retired (Ryan, 2026-09-23):
                // the setup line's value links are the way to the column,
                // and `onChangeValue` keeps the staged set as it did.
                stepIndex="REVISING"
                panel={
                  <RevisionPanel
                    state={preview}
                    settled={
                      deviceBreakdown.state === "ready"
                        ? deviceBreakdown.data
                        : deviceBreakdown.state === "loading"
                          ? (deviceBreakdown.lastReady ?? null)
                          : null
                    }
                    stagedValue={fieldValueLabel(
                      revisingField,
                      stagedFieldValue ??
                        fieldCurrentValue(scenario, revisingField),
                    )}
                    verdict={stripVerdictWord}
                    needsYou={needsYouModel.count}
                    footer={
                      <div className="a-panel-foot">
                        <button
                          type="button"
                          className="a-pri"
                          data-testid="revise-apply"
                          onClick={applyStagedAll}
                          disabled={staged.length === 0}
                        >
                          APPLY
                        </button>
                        <span className="tr-prov" data-testid="revise-sentence">
                          {/* Ruling 191's enumeration, and ruling 202's
                              two blind-apply sentences in 7b and 7d —
                              the button works; the sentence says you are
                              applying blind. */}
                          {blindApplySentence(
                            preview,
                            stagedEnumeration(staged),
                          ) ??
                            (staged.length > 0
                              ? `${stagedEnumeration(staged)} staged · not yet applied`
                              : "nothing staged")}
                        </span>
                      </div>
                    }
                  />
                }
              />
            ) : genState === "pre" || genState === "generating" || revising ? (
              <GeneratorSidebar
                scenario={scenario}
                setScenario={setScenario}
                generating={genState === "generating"}
                onGenerate={onGenerate}
                refusal={refusal}
                refusalPending={refusalPending}
                corridorSpecLengths={corridorSpecLengths}
                jurisdictionControls={jurisdictionControls}
                jurisdictionName={jurisdictionBlock?.name ?? null}
                jurisdictionBlock={jurisdictionBlock}
                // #289 ruling 196 / #276: only the shell can tell "not yet"
                // from "did not answer" — it owns the breakdown fetch — so
                // the WHAT grid's jurisdiction cell is handed both rather
                // than re-deriving either.
                jurisdictionLoading={jurisdictionLoading}
                // #152 D, one derivation: the same flag the reference
                // panel's hours verdict reads.  Correction 2 made the
                // band the only pre-generate home for that verdict.
                jurisdictionRevalidating={jurisdictionRevalidating}
                jurisdictionErrored={deviceBreakdown.state === "error"}
                jurisdictionSuggest={jurisdictionSuggestSlot}
                pendingSuggestions={pendingSuggestions}
                onClassification={(c, at) =>
                  setLastDetection(c ? { classification: c, ...at } : null)
                }
                // #289 hand-check, 2026-09-23, defect 1: the kind choice
                // as a person made it.  A chip returns it to `picked` even
                // after a confirmation — a changed kind is confirmed again.
                kindState={kindState}
                onKindPicked={() => setKindState("picked")}
                onKindConfirmed={() => setKindState("confirmed")}
                // Defect 2: the band a setup-line value asked for.
                openRequest={columnOpenOn}
              />
            ) : null}
          </section>

          {/* #193 — generation-lifecycle announcements (WCAG 4.1.3).
              Visually hidden, persistently mounted; content set only at
              the armed Generate settle, from the settled breakdown. */}
          <div role="status" className="sr-only">
            {genAnnouncement}
          </div>
          {/* Dev-only replication snapshot (Refs #102, TEMPORARY) — renders
              nothing without ?debug=1. Delete with DebugSnapshotButton. */}
          {/* #224 phase 2 follow-up: the snapshot is a replication of the
              plan on screen, so it posts the WIRE scenario (the sender
              6d3baee missed — a generated plan's snapshot read
              not_run/not_requested). */}
          <DebugSnapshotButton
            scenario={wireScenario}
            settings={settings}
            detection={lastDetection}
          />
          {bundleError && (
            <div
              role="alert"
              className="mb-4 px-4 py-3 border-l-2 border-[color:var(--fail)] font-mono text-[12px] text-[color:var(--fail)]"
            >
              {bundleError}
            </div>
          )}

          {/* ——— Zone 2 · Results ——— */}
          {/* tabIndex -1: programmatic focus target for the armed
              Generate settle (#193) — never in the Tab order. */}
          <section
            ref={resultsRef}
            tabIndex={-1}
            // #288 clause 5 / Part 1 §8.28: the zone heading is gone, so
            // the container carries its own name.  `results-stack` is
            // §8.29's own word for it, and it is what the focus target,
            // the arc-28 landing legs and the a11y suites hold onto now
            // that there is no "02 · Results" to find it by.
            className={`zone results results-stack outline-none${
              genState === "post" && resultsVisible ? " dominant" : ""
            }`}
          >
            {/* #288 clause 5 — Part 1 §8.28: the zone headings are
                DROPPED as visible headings.  "The column has one
                narrative, the bands carry step indices", and '02 ·
                RESULTS' survives only as the S4 placeholder's label.
                The stage-direction note goes with the heading it sat in:
                it told the operator which zone was dominant, and a
                column with one narrative has no competing zones to
                choose between.
                What does NOT go: this section's tabIndex -1 and its ref.
                §8.28 says the programmatic focus targets "must be
                re-homed onto the band stack and the results stack" — the
                section IS the results stack, so the target stays exactly
                where the arc-28 legs already point (ruling 184's landing,
                measured at nav-h + 8 + status-h + 24). */}
            {/* #224 phase 2 — the PLAN DECLINED container for a refused
                site scan: the #227 system-event shape (amber rule,
                ⚠ glyph, the backend ``message`` as ONE text node —
                the only place it renders — provenance on line 2) plus
                the two recovery actions.  Retry refires both fetches;
                proceed-anyway is a deliberate, consequence-stating,
                secondary action — never a default.  Precedes the
                generic failure ribbon: a refusal is a stated reason,
                not a broken breakdown.  Rendered OUTSIDE the
                results-stale wrapper: the dimmed stale results are the
                previous answer, but the refusal is current and must
                keep its measured contrast (rule 13). */}
            {/* #288 rule 28 — the results stack's reserved FIRST ROW.
                Mounted from the Generate click, released under a decline,
                --fact-h tall (rule 56's 44 px fact line: a rule, not a
                measurement).  Empty until the stack container places the
                setup fact line in it.  Slot order is unchanged: this slot
                → the refusal container → the plan. */}
            {/* Rule 28 + rule 119 — the reserved row, and the setup fact
                line that occupies it at the settle.  `reserve` is rule
                28's own predicate (mounted from the Generate click,
                released under a decline); `settled` is what tells the
                floor from its occupant. */}
            <ResultsHead
              reserve={genState !== "pre"}
              declined={planDeclined}
              settled={resultsVisible}
              scenario={scenario}
              jurisdictionName={jurisdictionBlock?.name ?? null}
              onChangeValue={onChangeValue}
            />
            {/* #289 Phase 2 — the NOT-CHECKED disclosure, which the setup
                strip carried (§8.27 deletes the strip).  It sits beside
                the refusal container because they are the two halves of
                one story: a scan that refused, and a scan the operator
                proceeded past.  The STAMPED view, so a prior input's
                disclosure never renders as current. */}
            <SiteNotChecked
              siteScan={
                stripAudit.state === "ready"
                  ? (stripAudit.data.sections?.site_scan ?? null)
                  : null
              }
            />
            {scanRefusal && (
              <div role="alert" className="sys-event warn scan-refusal">
                <div className="tr-section mb-1.5">Site scan</div>
                <div className="flex items-start gap-2">
                  <span className="sys-glyph" aria-hidden="true">
                    ⚠
                  </span>
                  <span>{scanRefusal.message}</span>
                </div>
                {/* #258 (P11/P12): the stamp as day · hh:mm utc by the
                    block footer's own formatter (fmtScanStamp: pure
                    slicing, no clock), the full ISO on the <time> for
                    copy and audit — never raw on the surface. */}
                <div className="tr-prov mt-1.5">
                  {scanRefusal.scan?.mode
                    ? `${scanRefusal.scan.mode} scan`
                    : "site scan"}
                  {scanRefusal.scan?.error ? ` · ${scanRefusal.scan.error}` : ""}
                  {scanRefusal.scan?.measured_at ? (
                    <>
                      {" · attempted "}
                      <time
                        dateTime={scanRefusal.scan.measured_at}
                        title={scanRefusal.scan.measured_at}
                      >
                        {fmtScanStamp(scanRefusal.scan.measured_at)}
                      </time>
                    </>
                  ) : null}
                  {scanRefusal.scan?.budget_s != null
                    ? ` · budget ${scanRefusal.scan.budget_s} s`
                    : ""}
                </div>
                {/* #258 (P11/P10/P4): the two recovery actions are the
                    package's own button class — one treatment, one
                    edge, 40 px at desk / 44 at phone (globals.css
                    .scan-actions); Retry first — primary by position,
                    never by weight.  The proceed label states the INPUT
                    ("Generate anyway" = proceed_if_unavailable) and its
                    consequence sits beneath in the provenance role: the
                    scan is tried once more and the plan reports the
                    outcome — never a promised NOT-CHECKED (audit
                    F-S5-7).  Both are write controls under the lock
                    (``inFlight`` = the plan pair or an open render;
                    the container never mounts while the pair is open,
                    so the render half is uniformity, not behaviour). */}
                <div className="scan-actions">
                  <button
                    type="button"
                    className="dl-btn"
                    data-write=""
                    disabled={inFlight}
                    onClick={onRetry}
                  >
                    ↻ Retry scan
                  </button>
                  <button
                    type="button"
                    className="dl-btn"
                    data-write=""
                    disabled={inFlight}
                    onClick={onProceedWithoutScan}
                  >
                    Generate anyway
                  </button>
                </div>
                <div className="tr-prov mt-1.5">
                  tries the scan once more · the plan says whether it ran
                </div>
              </div>
            )}
            {/* Rule 117 — S4's results placeholder.  "A results
                placeholder block: 1 px #2c3e53, ground #101c29, padding
                22 px 16 px, quiet section header '02 · RESULTS' plus 'No
                package yet — the plan is being built.' in body value."

                §8.28 kept exactly one use of the zone label: "'02 ·
                RESULTS' survives only as the placeholder block's label in
                S4."  This is that use, and the only one.

                It renders on a FIRST generate only — `resultsVisible` is
                false just then.  A regenerate keeps the previous answer
                on screen under the stale dim (#192/#252), which is P16's
                rule and not something a placeholder should interrupt. */}
            {genState === "generating" && !resultsVisible && (
              <div className="results-placeholder" data-testid="results-placeholder">
                <span className="tr-section">02 · RESULTS</span>
                <div className="rp-line">
                  No package yet — the plan is being built.
                </div>
              </div>
            )}
            {/* #288 rule 27 — NEEDS YOU, between the reserved first row and
                the rest of the plan.  Gated on resultsVisible: a declined
                plan shows no plan (rule 10), and spec 31 forbids the
                refusal container and the block co-framing.  The block
                renders nothing at zero items, so a clean plan does not
                grow an empty "nothing wants you" panel. */}
            {resultsVisible && (
              <NeedsYou
                model={needsYouModel}
                inFlight={scanInFlight}
                primary={primaryOwner}
                conditions={
                  // Clause 1: the corrections block's rows, as NEEDS YOU's
                  // item rows.  Spec 34's scan choice is unchanged and moved
                  // with them — the STAMPED view when settled, the held
                  // (last ready) scan while a re-generation is in flight,
                  // nothing on a first generate or an error.
                  needsYouScan && hasConditionRows(needsYouScan) ? (
                    <SiteConditionRows
                      scenario={scenario}
                      setScenario={setScenario}
                      siteScan={needsYouScan}
                      inFlight={scanInFlight}
                      staged={staged}
                      setStaged={setStaged}
                      ownsPrimary={primaryOwner === "needs-you"}
                    />
                  ) : null
                }
              />
            )}
            {/* #252: the "Generating…" empty state (a first Generate with
                no prior breakdown to hold) is gone — the band is the one
                working voice; the zone holds the pre-generate cards
                until the answer lands. */}
            {/* #288 clause 6 / rule 102 — THE RIBBON IS NOT DIMMED.
                The three ribbon strings are unchanged and still mutually
                exclusive (rule 101), but they render OUTSIDE the
                `.results-stale` wrapper now, so the dim starts BELOW
                them.  #259: the ribbon's own label sat inside the dim it
                explains and measured 2.39:1 — a line whose job is to say
                "what follows is stale" cannot be the least legible thing
                on the page.  The wrapper's predicate is unchanged; only
                what it encloses is. */}
            {/* role=alert (#193): a failed generation reaches the
                strip's live region never (the breakdown pipeline is
                separate from audit) — the ribbon announces itself. */}
            {/* #258: neither ribbon renders under a declined plan —
                "values below" would point at content the verdict
                hides; the refusal container is the voice. */}
            {genState === "error" && !planDeclined && (
              <div role="alert" className="stale-ribbon">
                ⚠ Device breakdown failed — values below may be stale. Fix
                the input or retry from the plan details panel.
              </div>
            )}
            {/* Deliberately visual-only (#193): the band's live
                region announces the flight; a second polite region
                saying the same thing is noise.  #252: the ribbon is
                the text channel of the results-stale dim (rule 13)
                and says only that — what the system is DOING is the
                band's sentence, spoken once. */}
            {regenerating && !planDeclined && (
              <div className="stale-ribbon">
                Previous answer — values below predate the request in flight.
              </div>
            )}
            {/* #254: the text channel of the staged dim (rule 13) —
                the count in words; the block's Apply row is the
                action.  Never alongside the flight's ribbon. */}
            {stagedDisclose && !planDeclined && !regenerating && (
              <div className="stale-ribbon">
                {/* #289 finding 2: what is staged, in ruling 191's
                    words, from the one list — "1 field", "1 correction",
                    "1 field · 1 correction". */}
                Previous answer — {stagedEnumeration(staged)} staged, not yet applied.
              </div>
            )}
            {
              <div
                className={
                  genState === "error" || regenerating || stagedDisclose ? "results-stale" : ""
                }
              >
                {resultsVisible && (
                  <ResultsHero
                    breakdown={deviceBreakdown}
                    jurisdiction={jurisdictionBlock}
                  />
                )}
                {/* A shell-level anchor around the cards.  ``ns-below``
                    retired with the strip (#288 §8.29): it budgeted the
                    PINNED strip in this target's scroll margin, and there
                    is no pinned strip to budget.  tabIndex -1: a jump
                    focuses it (#193), never in the Tab order. */}
                <div
                  id="downloads"
                  className="jump-anchor outline-none"
                  tabIndex={-1}
                >
                  <OutputCards
                    summary={summary}
                    generated={resultsVisible}
                    declined={planDeclined}
                    mode={
                      mode === "sandbox"
                        ? { kind: "public", scenario: wireScenario }
                        : { kind: "saved", planId, dirty: planDirty }
                    }
                    breakdown={deviceBreakdown}
                    // Zone 2's "All (.zip)" is the bundle download — the
                    // former Generate side effect, same endpoint and
                    // { scenario, settings } body, explicit trigger.
                    onDownloadAll={onDownloadBundle}
                    bundling={bundling}
                    auditChecked={auditChecked}
                    primary={primaryOwner}
                  />
                </div>
                {/* #288 clause 4 — the quote, then the two counted tiers,
                    as rule-87 disclosure rows.  Part 1 §8.11 puts the
                    quote "directly under the downloads"; §8.9 keeps ✓ and
                    ◌ as disclosures, and clause 4 promotes them out of
                    section 03's chips into rows of the stack itself.
                    The i tier stays where it is — uncounted, and already
                    a disclosure (ReferenceDisclosure, clause b). */}
                {/* #187's cue, moved here by clause 4 and stated ONCE.
                    While a refetch holds the previous answer on screen,
                    the values below it — the tier counts and everything
                    inside the rows — are that previous answer, and Rule
                    10 forbids presenting a stale answer as current.  The
                    slot is always in the flow at its reserved height
                    (P1); only the line inside it comes and goes. */}
                {resultsVisible && (
                  <div className="tier-cue">
                    {tiersRefreshing && (
                      <span className="tr-prov">◌ previous answer — refreshing…</span>
                    )}
                  </div>
                )}
              </div>
            }
            {/* ─── #288 · rule 27's DISCLOSURE GROUP ───
                Ryan's hand-check at f44377e, fix 3: the Reference row
                joins the group under Pricing / Passed / Pending.  Rule 27
                names the group and gives it its own internal gap
                ("quote → disclosure group 12 px; within the disclosure
                group 10 px"), so the four rows are one run, not three
                plus a stray in another zone.

                OUTSIDE the `.results-stale` wrapper, deliberately.  The
                group carries the reference's Retry — the panel the
                verdict strip's "retry below" points at (rule 10) — and
                the quote's write controls.  Dimming a recovery action is
                the defect rule 102 fixed for the ribbon; the #187 cue
                above already says the counts are a previous answer.

                The group renders when there are results OR when the
                reference must mount on its own (an audit error), which is
                why it is not simply gated on `resultsVisible`. */}
            {(resultsVisible || referenceMounts) && (
              <div className="results-disc">
                {resultsVisible && (
                  <PricingCard
                    mode={
                      mode === "sandbox"
                        ? { kind: "public", scenario: wireScenario }
                        : { kind: "saved", planId, dirty: planDirty }
                    }
                    settings={settings}
                    setSettings={setSettings}
                    flaggerSource={flaggerSource}
                    setFlaggerSource={setFlaggerSource}
                    delivery={delivery}
                    setDelivery={setDelivery}
                  />
                )}
                {/* Rule 89: a COUNTED tier shows its number.  Both count
                    from the one ledger above; neither renders at all
                    before an audit has settled, because a count with no
                    settled answer behind it would be a number the wire
                    never carried (Rule 10). */}
                {resultsVisible && settledLedger !== null && (
                  <>
                    <CheckedDisclosure
                      count={settledLedger.checked}
                      cited={auditState.state !== "error"}
                      tierProps={tierProps}
                    />
                    <PendingDisclosure
                      count={settledLedger.pending}
                      tierProps={tierProps}
                    />
                  </>
                )}
                {/* #253: chip 2's jump target, and #193's focus target —
                    both moved onto the row with the content they name,
                    because Zone 3's section is gone. */}
                {referenceMounts && (
                  <div id="reference" tabIndex={-1} className="jump-anchor outline-none">
                    <ReferenceDisclosure
                      defaultOpen={auditState.state === "error"}
                      summary={referenceSummary({
                        jurisdiction: jurisdictionBlock,
                        streetClass: scenario.street_class ?? null,
                        loading: jurisdictionLoading,
                      })}
                    >
                      <TieredReference
                        {...tierProps}
                        tiers={["changed", "attention", "reference"]}
                      />
                    </ReferenceDisclosure>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* #288 clause 5 / §8.30: the intro paragraph is DROPPED.
              §8.12 + rule 29: the draft notice is KEPT and is the LAST
              line of the column — Ryan's hand-check moved it here, below
              the disclosure group, where "last line" is literally true.
              Its two sentences are unchanged: the finish ruling lists the
              draft notice in its untouched set, so this commit moves it
              and does not reword it.
              RECORDED: rule 29 also specifies the provenance role, 18 px
              above, and a slightly different wording ("...licensed PE..."
              against §8.12's "same two sentences", which are today's).
              The wording conflict is left to §8.12, which the ruling
              names; the role and spacing wait for the phase that owns
              this block's type. */}
          <div className="mb-6 pl-4 py-3 border-l-2 border-[color:var(--warn)]">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--warn)] mb-1">
              Draft — not a sealed plan
            </div>
            <div className="text-[13px] text-[color:var(--ink-on-dark-faint)] leading-snug max-w-[620px]">
              Output is engineering reference. Requires review and seal by a
              licensed Professional Engineer prior to field use.
            </div>
          </div>
        </main>
      </div>

      <AppFooter />
      {/* #252: the band's room — a spacer sibling after the footer, never
          padding on the root (a scroll-anchoring suppression trigger in
          the settle frame; see globals.css .ws-spacer). */}
      {inFlight ? <div className="ws-spacer" aria-hidden="true" /> : null}
      {/* #252: the one working voice — fixed to the viewport's bottom
          edge, mounted iff a request for the generated scenario is
          open, rendered verbatim from ``bandState``. */}
      <WorkingBand state={bandState} />
    </div>
    </RenderRequestContext.Provider>
    </WriteLockContext.Provider>
  );
}
