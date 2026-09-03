"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_SCENARIO, hasLocation, type Scenario } from "@/lib/scenarios";
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
import { AppSheetMeta } from "./AppSheetMeta";
import { GeneratorSidebar } from "./GeneratorSidebar";
import { SetupStrip } from "./SetupStrip";
import { StatusBar, type Status } from "./StatusBar";
import { OutputCards } from "./OutputCards";
import { type DeliveryStatus, type FlaggerSource } from "./QuotePanel";
import { PricingCard } from "./PricingCard";
import { ResultsHero } from "./ResultsHero";
import { TieredReference } from "./TieredReference";
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
  JurisdictionContextBar,
  JurisdictionControls,
  type SuggestionResolution,
} from "./JurisdictionSection";
import type {
  JurisdictionBlock,
  JurisdictionSuggestion,
  StreetClass,
} from "@/lib/jurisdiction";

type Mode = "sandbox" | "workbench";

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
  const wireScenario = useMemo(
    () =>
      generated ? withSiteScan(scenario, proceedFor === scenario) : scenario,
    [scenario, generated, proceedFor],
  );
  const fetchScenario = useDebouncedScenario(wireScenario, FETCH_DEBOUNCE_MS);

  useEffect(() => {
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
  }, [fetchScenario, retryNonce]);

  useEffect(() => {
    const controller = new AbortController();
    setVerifySlow(false);
    const slowTimer = setTimeout(() => setVerifySlow(true), SLOW_VERIFY_MS);
    setAuditState((prev) => ({
      state: "loading",
      lastReady: prev.state === "ready" ? prev.data : prev.lastReady,
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
          }));
          return;
        }
        const data = (await res.json()) as AuditResponse;
        setAuditState({ state: "ready", data, forScenario: fetchScenario });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        clearTimeout(slowTimer);
        setVerifySlow(false);
        setAuditState((prev) => ({
          state: "error",
          message: "Network error",
          lastReady: prev.state === "ready" ? prev.data : prev.lastReady,
          forScenario: fetchScenario,
        }));
      }
    })();
    return () => {
      controller.abort();
      clearTimeout(slowTimer);
    };
  }, [fetchScenario, retryNonce]);

  // Shared retry: a single click refires BOTH fetches unconditionally.
  // No smart-retry that targets only the failed call — a network
  // failure usually affects both, and a coordinated retry keeps the two
  // panels' "last refresh" timestamps aligned.
  const onRetry = () => setRetryNonce((n) => n + 1);

  // Derive the current "best known" audit summary for components that
  // need scalar fields (AppNav, AppSheetMeta, OutputCards).  Reads from
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
    scrollPendingRef.current = true;
    setGenAnnouncement("");
    // #224 phase 2: a proceed-anyway acknowledgement is never remembered
    // across a fresh Generate (suggest-never-set).
    setProceedFor(null);
    setGenerated(true);
  };
  // #224 phase 2 — the explicit proceed-anyway: acknowledge THIS input.
  // The wire scenario's identity changes, so both fetches refire with
  // ``proceed_if_unavailable: true`` (the debounce's leading edge).
  const onProceedWithoutScan = () => setProceedFor(scenario);

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
    setGenerated(false);
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
  const regenerating =
    genState === "generating" &&
    deviceBreakdown.state === "loading" &&
    (deviceBreakdown.lastReady ?? null) !== null;
  const showResults =
    genState === "post" || genState === "error" || regenerating;
  const status: Status = genState === "generating" ? "generating" : "done";

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
    if (!scrollPendingRef.current) return;
    if (genState === "post") {
      scrollPendingRef.current = false;
      const reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resultsRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      resultsRef.current?.focus({ preventScroll: true });
      const d =
        deviceBreakdown.state === "ready" ? deviceBreakdown.data : null;
      setGenAnnouncement(
        d && d.total_devices != null && d.unique_types != null
          ? `Plan generated — ${d.total_devices} devices, ${d.unique_types} types.`
          : "Plan generated — MHT package ready.",
      );
    } else if (genState === "error") {
      scrollPendingRef.current = false;
      resultsRef.current?.focus({ preventScroll: true });
      // No status text on failure: the error ribbon is role="alert"
      // and announces itself (assertively, as an error should).
    }
  }, [genState, deviceBreakdown]);

  // #193: the Reopen half — focus the Setup zone once the sidebar is
  // back.  Armed by onReopen only; ordinary re-renders in "pre" never
  // re-fire it.
  useEffect(() => {
    if (!reopenPendingRef.current) return;
    if (genState === "pre") {
      reopenPendingRef.current = false;
      setupRef.current?.focus({ preventScroll: true });
    }
  }, [genState]);

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
  const scanRefusal: { message: string; scan: SiteScanProvenance | null } | null =
    stripAudit.state === "error" && stripAudit.code === SITE_SCAN_UNAVAILABLE_CODE
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
  const corridorSpecLengths = currentAudit?.sections?.corridor_spec ?? null;

  // Surface B (#152): the interactive jurisdiction + street-class
  // controls, built once here (so the suggestion state and the single
  // setScenario writer stay owned by the shell) and rendered inside the
  // Location step of the setup flow.  The persistent top strip is now a
  // read-only summary of the same choices.
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
      suggest={suggestState.status !== "ready" ? null : suggestState.data}
      suggestLoading={suggestState.status === "loading"}
      suggestResolution={suggestResolution}
      onConfirmSuggestion={(k) => {
        // #227: the record carries the value in effect at click (null
        // and ABSENT distinguished) — exactly what undo restores
        // (#179 semantics: byte-identical after confirm-then-undo).
        setSuggestResolution({
          resolution: "confirmed",
          prior: scenario.jurisdiction_key ?? null,
          priorPresent: scenario.jurisdiction_key !== undefined,
          suggested: k,
        });
        setScenario({ ...scenario, jurisdiction_key: k });
      }}
      onDismissSuggestion={() => {
        const k = suggestState.data?.suggestion;
        if (k)
          setSuggestResolution({
            resolution: "dismissed",
            prior: scenario.jurisdiction_key ?? null,
            priorPresent: scenario.jurisdiction_key !== undefined,
            suggested: k,
          });
      }}
      onUndoSuggestion={() => {
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
      }}
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
    <div className="workbench min-h-screen">
      <div className="workbench-frame" aria-hidden>
        <span className="ftick tl" />
        <span className="ftick tr" />
        <span className="ftick bl" />
        <span className="ftick br" />
      </div>

      <AppNav
        mode={mode}
        ta={summary?.ta ?? ""}
        cdotSheet={summary?.cdot_sheet ?? ""}
        scenario={scenario}
        planId={planId}
        planName={planName}
        onSaved={onSaved}
      />
      <AppSheetMeta
        project={scenario.meta.project}
        address={scenario.meta.address}
        cdotSheet={summary?.cdot_sheet ?? ""}
      />

      <div>
        <main className="px-10 pt-8 pb-20 max-w-[1180px] mx-auto max-md:px-6 max-md:pt-6">
          <div className="mb-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--act)] inline-flex items-center gap-2.5 mb-3 before:content-[''] before:w-6 before:h-px before:bg-[color:var(--act)] before:inline-block">
              02 · GENERATOR
            </div>
            <h1 className="text-[28px] font-bold tracking-tighter text-white m-0 mb-1.5 leading-[1.1]">
              Method of Handling Traffic — plan generator
            </h1>
            <p className="text-[14px] m-0 max-w-[620px] text-[color:var(--ink-on-dark-faint)]">
              Generate a CDOT-compliant MHT package: PDF plan sheet, device
              list, and crew instructions. Every dimension cited to MUTCD or
              CDOT standards.
            </p>
          </div>

          <div className="mb-6 pl-4 py-3 border-l-2 border-[color:var(--warn)]">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--warn)] mb-1">
              Draft — not a sealed plan
            </div>
            <div className="text-[13px] text-[color:var(--ink-on-dark-faint)] leading-snug max-w-[620px]">
              Output is engineering reference. Requires review and seal by a
              licensed Professional Engineer prior to field use.
            </div>
          </div>

          {/* Persistent jurisdiction summary — READ-ONLY (Surface B).
              The interactive dropdown, pills, and suggestions moved into
              the Location step below (pre-gen) and the strip's inline
              edit (post-gen), so this strip never reads as a dead
              control above the pin it depends on. */}
          <JurisdictionContextBar
            jurisdiction={jurisdictionBlock}
            jurisdictionKey={scenario.jurisdiction_key ?? null}
            streetClass={scenario.street_class ?? null}
            loading={jurisdictionLoading}
          />

          {/* ——— Zone 1 · Setup ——— */}
          {/* tabIndex -1: programmatic focus target for the Reopen
              swap (#193) — never in the Tab order. */}
          <section
            ref={setupRef}
            tabIndex={-1}
            className={`zone outline-none${genState === "pre" ? " dominant" : ""}`}
          >
            <div className="zone-head">
              <span className="zone-tag">
                <span className="n">01</span>Setup
              </span>
              <h2 className="zone-title">
                {genState === "pre" ? "Describe the work zone" : "Scenario"}
              </h2>
            </div>
            {genState === "pre" ? (
              <GeneratorSidebar
                scenario={scenario}
                setScenario={setScenario}
                generating={false}
                onGenerate={onGenerate}
                refusal={refusal}
                refusalPending={refusalPending}
                corridorSpecLengths={corridorSpecLengths}
                jurisdictionControls={jurisdictionControls}
                jurisdictionName={jurisdictionBlock?.name ?? null}
                jurisdictionBlock={jurisdictionBlock}
                pendingSuggestions={pendingSuggestions}
                onClassification={(c, at) =>
                  setLastDetection(c ? { classification: c, ...at } : null)
                }
              />
            ) : (
              <SetupStrip
                scenario={scenario}
                setScenario={setScenario}
                onReopen={onReopen}
                // #224 phase 2: the STAMPED view — null mid-refetch.
                siteScan={
                  stripAudit.state === "ready"
                    ? (stripAudit.data.sections?.site_scan ?? null)
                    : null
                }
                jurisdiction={jurisdictionBlock}
                setJurisdictionKey={(k) =>
                  setScenario({ ...scenario, jurisdiction_key: k })
                }
                setStreetClass={(c) =>
                  setScenario({ ...scenario, street_class: c })
                }
              />
            )}
          </section>

          {/* The verification strip stays mounted in every stage — it is
              the live per-input verdict surface (rule 10), not
              post-generation chrome; the prototype's hidden-in-pre strip
              had no live verification behind it. */}
          <StatusBar
            status={status}
            inputError={inputError}
            refusal={refusal}
            locationUnset={!hasLocation(scenario.meta)}
            audit={stripAudit}
            verifySlow={verifySlow}
            scanning={generated}
          />
          {/* #193 — generation-lifecycle announcements (WCAG 4.1.3).
              Visually hidden, persistently mounted; content set only at
              the armed Generate settle, from the settled breakdown. */}
          <div role="status" className="sr-only">
            {genAnnouncement}
          </div>
          {/* Dev-only replication snapshot (Refs #102, TEMPORARY) — renders
              nothing without ?debug=1. Delete with DebugSnapshotButton. */}
          <DebugSnapshotButton
            scenario={scenario}
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
            className={`zone outline-none${genState === "post" ? " dominant" : ""}`}
          >
            <div className="zone-head">
              <span className="zone-tag">
                <span className="n">02</span>Results
              </span>
              <h2 className="zone-title">MHT package</h2>
              {genState === "post" && (
                <span className="zone-note">
                  device &amp; type counts drive your estimate
                </span>
              )}
            </div>
            {genState === "generating" && !regenerating ? (
              <div className="empty-state">
                <span className="big text-[color:var(--act)]">Generating…</span>
                {/* #224 phase 2: the scan is part of generation; one
                    sentence, no fabricated stage progress (one request,
                    no signal of which stage the backend is in). */}
                Scanning site conditions along the corridor (OpenStreetMap,
                up to 20 s), then computing taper, buffer, device spacing,
                and sign placement.
              </div>
            ) : (
              <div
                className={
                  genState === "error" || regenerating ? "results-stale" : ""
                }
              >
                {/* role=alert (#193): a failed generation reaches the
                    strip's live region never (the breakdown pipeline is
                    separate from audit) — the ribbon announces itself. */}
                {/* #224 phase 2 — the PLAN DECLINED container for a refused
                    site scan: the #227 system-event shape (amber rule,
                    ⚠ glyph, the backend ``message`` as ONE text node —
                    the only place it renders — provenance on line 2) plus
                    the two recovery actions.  Retry refires both fetches;
                    proceed-anyway is a deliberate, consequence-stating,
                    secondary action — never a default.  Precedes the
                    generic failure ribbon: a refusal is a stated reason,
                    not a broken breakdown. */}
                {scanRefusal && (
                  <div role="alert" className="sys-event warn scan-refusal">
                    <div className="tr-section mb-1.5">Site scan</div>
                    <div className="flex items-start gap-2">
                      <span className="sys-glyph" aria-hidden="true">
                        ⚠
                      </span>
                      <span>{scanRefusal.message}</span>
                    </div>
                    <div className="tr-prov mt-1.5">
                      {[
                        scanRefusal.scan?.mode
                          ? `${scanRefusal.scan.mode} scan`
                          : "site scan",
                        scanRefusal.scan?.error ?? null,
                        scanRefusal.scan?.measured_at
                          ? `attempted ${scanRefusal.scan.measured_at}`
                          : null,
                        scanRefusal.scan?.budget_s != null
                          ? `budget ${scanRefusal.scan.budget_s} s`
                          : null,
                      ]
                        .filter((p): p is string => p !== null)
                        .join(" · ")}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                      <button
                        type="button"
                        onClick={onRetry}
                        className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--act)] hover:underline cursor-pointer"
                      >
                        ↻ Retry scan
                      </button>
                      <button
                        type="button"
                        onClick={onProceedWithoutScan}
                        className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] border border-[color:var(--rule)] px-2 py-1 hover:border-[color:var(--warn)] hover:text-[color:var(--ink-on-dark)] cursor-pointer transition-colors"
                      >
                        Generate without site check — the plan will say SITE
                        CONDITIONS NOT CHECKED
                      </button>
                    </div>
                  </div>
                )}
                {genState === "error" && !scanRefusal && (
                  <div role="alert" className="stale-ribbon">
                    ⚠ Device breakdown failed — values below may be stale. Fix
                    the input or retry from the plan details panel.
                  </div>
                )}
                {/* Deliberately visual-only (#193): the strip already
                    announces COMPUTING for this state; a second polite
                    region saying the same thing is noise. */}
                {regenerating && (
                  <div className="stale-ribbon">
                    {/* #224 phase 2: a first Generate lands here, not in
                        the empty state — the pre-generate loop already
                        holds a breakdown — so this ribbon is the wait
                        the user actually sees during the scan.  Name it. */}
                    {generated
                      ? "⟳ Recomputing — scanning site conditions along the corridor (OpenStreetMap, up to 20 s); values below are the previous answer until this settles."
                      : "⟳ Recomputing for the edited input — values below are the previous answer until this settles."}
                  </div>
                )}
                {showResults && (
                  <ResultsHero
                    breakdown={deviceBreakdown}
                    jurisdiction={jurisdictionBlock}
                  />
                )}
                <OutputCards
                  summary={summary}
                  generated={showResults}
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
                />
                {showResults && (
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
              </div>
            )}
          </section>

          {/* ——— Zone 3 · Reference ——— */}
          {(jurisdictionBlock ||
            Boolean(scenario.jurisdiction_key) ||
            showResults ||
            auditState.state === "error") && (
            <section className="zone">
              <div className="zone-head">
                <span className="zone-tag">
                  <span className="n">03</span>Reference
                </span>
                <h2 className="zone-title">Rules, permit &amp; audit</h2>
              </div>
              {/* #219 — the triage tiers replace the flat family stack.
                  The verification facts join with results OR on an
                  audit error (rule 10: the strip's "retry below" must
                  always land on a panel that exists); #196: the
                  STAMPED audit view — the same one the strip reads —
                  so panel and strip cannot disagree on declined; #187:
                  a declined/failed audit renders "—" rows, never a
                  prior input's numbers presented as current. */}
              <TieredReference
                jurisdiction={jurisdictionBlock}
                jurisdictionLoading={jurisdictionLoading}
                revalidating={jurisdictionRevalidating}
                streetClass={scenario.street_class ?? null}
                schedule={scenario.schedule ?? null}
                scenario={wireScenario}
                audit={stripAudit}
                onRetry={onRetry}
                generated={showResults && !auditDeclined}
                showAudit={showResults || auditState.state === "error"}
                breakdown={deviceBreakdown}
              />
            </section>
          )}
        </main>
      </div>

      <AppFooter />
    </div>
  );
}
