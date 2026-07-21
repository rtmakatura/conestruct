"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import { validateWorkZone } from "@/lib/scenarios/validation";
import type { AuditResponse, AuditState } from "@/lib/render-types";
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
import { AuditTrail } from "./AuditTrail";
import {
  DeviceBreakdown,
  type DeviceBreakdownData,
  type DeviceBreakdownState,
} from "./DeviceBreakdown";
import { AppFooter } from "./AppFooter";
import {
  DebugSnapshotButton,
  type SnapshotDetection,
} from "./DebugSnapshotButton";
import {
  JurisdictionContextBar,
  JurisdictionSection,
} from "./JurisdictionSection";
import type { StreetClass, WorkScheduleInput } from "@/lib/jurisdiction";

type Mode = "sandbox" | "workbench";

// Cold-start honesty (Refs #122, rule 10): a warm audit round-trip
// measures 0.5–0.7 s; past 2 s the wait is almost certainly the Modal
// container cold-starting (~5.5 s measured), and an unexplained
// VERIFYING reads as a hang.  The strip can't know a call will be cold
// — it can only observe one running long — so after this threshold it
// escalates to copy that says the server is waking up.  Presentation
// only: a timer and a flag, no frontend computation.
const SLOW_VERIFY_MS = 2000;

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

  const onSaved = (id: string, name: string) => {
    setPlanId(id);
    setPlanName(name);
  };

  // OutputCards stay visible from first paint (original behavior); the
  // Generate button now performs a real bundled-zip download rather than
  // gating visibility.
  const [bundleError, setBundleError] = useState<string | null>(null);

  // Both Plan Details and AuditTrail are server-driven: fetch from the
  // matching Modal endpoint so the panels read from the same placements
  // list that feeds the PDF, XLSX, and crew narrative.  Refetch on every
  // scenario change; ``retryNonce`` lets a single Retry button re-trigger
  // both effects (shared by design — an underlying network failure
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

  useEffect(() => {
    const controller = new AbortController();
    setDeviceBreakdown({ state: "loading" });
    (async () => {
      try {
        const res = await fetch("/api/render/device-breakdown", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenario }),
          signal: controller.signal,
        });
        if (!res.ok) {
          let detail = "";
          try {
            const body = await res.json();
            detail =
              typeof body?.detail?.message === "string"
                ? body.detail.message
                : typeof body?.detail === "string"
                  ? body.detail
                  : "";
          } catch {
            detail = await res.text().catch(() => "");
          }
          setDeviceBreakdown({
            state: "error",
            message: detail || `HTTP ${res.status}`,
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
  }, [scenario, retryNonce]);

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
          body: JSON.stringify({ scenario }),
          signal: controller.signal,
        });
        clearTimeout(slowTimer);
        setVerifySlow(false);
        if (!res.ok) {
          let detail = "";
          try {
            const body = await res.json();
            detail =
              typeof body?.detail?.message === "string"
                ? body.detail.message
                : typeof body?.detail === "string"
                  ? body.detail
                  : "";
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
            lastReady: prev.state === "ready" ? prev.data : prev.lastReady,
            forScenario: scenario,
          }));
          return;
        }
        const data = (await res.json()) as AuditResponse;
        setAuditState({ state: "ready", data, forScenario: scenario });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        clearTimeout(slowTimer);
        setVerifySlow(false);
        setAuditState((prev) => ({
          state: "error",
          message: "Network error",
          lastReady: prev.state === "ready" ? prev.data : prev.lastReady,
          forScenario: scenario,
        }));
      }
    })();
    return () => {
      controller.abort();
      clearTimeout(slowTimer);
    };
  }, [scenario, retryNonce]);

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

  // The evaluated jurisdiction block rides the device-breakdown response
  // (spec §3.2) — present only when the scenario names a jurisdiction_key.
  const jurisdictionBlock =
    deviceBreakdown.state === "ready"
      ? (deviceBreakdown.data.jurisdiction ?? null)
      : null;

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
  const onGenerate = () => {
    setGenerated(true);
  };

  // Reopen the full setup panel from the strip (structural edits).
  const onReopen = () => {
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
        body: JSON.stringify({ scenario, settings }),
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
  const showResults = genState === "post" || genState === "error";
  const status: Status = genState === "generating" ? "generating" : "done";

  // Frontend-engine-removal Decision 2: the verdict strip never presents
  // an answer for an input the backend hasn't seen.  The audit effect
  // flips to "loading" only after paint, so on the render where the
  // scenario just changed, ``auditState`` still holds the answer for the
  // PREVIOUS input.  ``forScenario`` (stamped at fetch time) detects
  // that: when it isn't the scenario on screen, the strip gets an
  // explicit checking state instead of the stale verdict.  This governs
  // the StatusBar only — AuditTrail deliberately keeps its
  // stale-while-revalidate *content* (prose can be visibly mid-refresh;
  // a verdict presented as current cannot).
  const auditSettled =
    (auditState.state === "ready" || auditState.state === "error") &&
    auditState.forScenario === scenario;
  const stripAudit: AuditState = auditSettled
    ? auditState
    : {
        state: "loading",
        lastReady:
          auditState.state === "ready"
            ? auditState.data
            : auditState.lastReady,
      };

  // UX-21 / engine-removal PR D: the strip's red input-error state.
  // The client check covers only the schema bounds (workLen required /
  // 20,000-ft ceiling — validateWorkZone no longer carries a MUTCD
  // floor); the backend geometry 400 from the per-change audit fetch is
  // THE source for the taper-floor verdict and its message
  // (validators.py WORK_ZONE_SHORTER_THAN_TAPER).  Non-400 audit errors
  // stay "verification unavailable" inside StatusBar.  Reads
  // ``stripAudit`` so a 400 for an already-edited input can't show
  // INVALID INPUT against the new one.
  const wzValidation = validateWorkZone(scenario);
  const auditInputError =
    stripAudit.state === "error" && stripAudit.httpStatus === 400
      ? stripAudit.message
      : null;
  const inputError = !wzValidation.ok ? wzValidation.message : auditInputError;

  // Engine-removal PR D: the sidebar's corridor preview reads the
  // backend's zone lengths off the audit response the shell already
  // fetches per change (sections.corridor_spec, PR B).  Falls back to
  // ``lastReady`` during refetch (stale-while-revalidate CONTENT, same
  // pattern as AuditTrail — the verdict strip above is what never goes
  // stale); null before the first audit resolves or when the field is
  // absent (deploy window), in which case the preview shows an explicit
  // unavailable note instead of computing anything locally.
  const corridorSpecLengths = currentAudit?.sections?.corridor_spec ?? null;

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
          <div className="mb-7">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--act)] inline-flex items-center gap-2.5 mb-3 before:content-[''] before:w-6 before:h-px before:bg-[color:var(--act)] before:inline-block">
              02 · GENERATOR
            </div>
            <h1 className="text-[28px] font-bold tracking-tighter text-white m-0 mb-1.5 leading-[1.1]">
              Method of Handling Traffic — plan generator
            </h1>
            <p className="text-[14px] m-0 max-w-[620px] text-[color:var(--ink-on-dark-faint)]">
              Generate a CDOT-compliant MHT package: PDF plan sheet, device
              list, and crew instructions. Every dimension cited to MUTCD or
              the Colorado Supplement.
            </p>
          </div>

          <div className="mb-7 pl-4 py-3 border-l-2 border-[color:var(--warn)]">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--warn)] mb-1">
              Draft — not a sealed plan
            </div>
            <div className="text-[13px] text-[color:var(--ink-on-dark-faint)] leading-snug max-w-[620px]">
              Output is engineering reference. Requires review and seal by a
              licensed Professional Engineer prior to field use.
            </div>
          </div>

          {/* Persistent jurisdiction bar — the single source for
              jurisdiction + street class, mounted above the zones in
              every stage. */}
          <JurisdictionContextBar
            jurisdiction={jurisdictionBlock}
            jurisdictionKey={scenario.jurisdiction_key ?? null}
            setJurisdictionKey={(k) =>
              setScenario({ ...scenario, jurisdiction_key: k })
            }
            streetClass={scenario.street_class ?? null}
            setStreetClass={(c: StreetClass) =>
              setScenario({ ...scenario, street_class: c })
            }
            loading={
              Boolean(scenario.jurisdiction_key) &&
              deviceBreakdown.state === "loading"
            }
          />

          {/* ——— Zone 1 · Setup ——— */}
          <section className={`zone${genState === "pre" ? " dominant" : ""}`}>
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
                auditInputError={auditInputError}
                corridorSpecLengths={corridorSpecLengths}
                onClassification={(c, at) =>
                  setLastDetection(c ? { classification: c, ...at } : null)
                }
              />
            ) : (
              <SetupStrip
                scenario={scenario}
                setScenario={setScenario}
                onReopen={onReopen}
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
            audit={stripAudit}
            verifySlow={verifySlow}
          />
          {/* Dev-only replication snapshot (Refs #102, TEMPORARY) — renders
              nothing without ?debug=1. Delete with DebugSnapshotButton. */}
          <DebugSnapshotButton
            scenario={scenario}
            settings={settings}
            detection={lastDetection}
          />
          {bundleError && (
            <div className="mb-5 px-4 py-3 border-l-2 border-[color:var(--fail)] font-mono text-[12px] text-[color:var(--fail)]">
              {bundleError}
            </div>
          )}

          {/* ——— Zone 2 · Results ——— */}
          <section className={`zone${genState === "post" ? " dominant" : ""}`}>
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
            {genState === "generating" ? (
              <div className="empty-state">
                <span className="big text-[color:var(--act)]">Generating…</span>
                Computing taper, buffer, device spacing, and sign placement.
              </div>
            ) : (
              <div className={genState === "error" ? "results-stale" : ""}>
                {genState === "error" && (
                  <div className="stale-ribbon">
                    ⚠ Device breakdown failed — values below may be stale. Fix
                    the input or retry from the plan details panel.
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
                      ? { kind: "public", scenario }
                      : { kind: "saved", planId }
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
                        ? { kind: "public", scenario }
                        : { kind: "saved", planId }
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
              <JurisdictionSection
                jurisdiction={jurisdictionBlock}
                loading={
                  Boolean(scenario.jurisdiction_key) &&
                  deviceBreakdown.state === "loading"
                }
                streetClass={scenario.street_class ?? null}
                schedule={scenario.schedule ?? null}
                setSchedule={(s: WorkScheduleInput | null) =>
                  setScenario({ ...scenario, schedule: s })
                }
              />
              {/* Plan-verification chips join the zone with results —
                  plus the pre-generation audit-error case, because the
                  strip's "retry from the audit trail panel below" must
                  always point at a panel that exists (rule 10). */}
              {(showResults || auditState.state === "error") && (
                <div className="ref-group mt-6">
                  <div className="ref-group-label">
                    Plan verification &amp; details
                  </div>
                  <div className="ref-stack">
                    <AuditTrail
                      scenario={scenario}
                      audit={auditState}
                      onRetry={onRetry}
                      generated={showResults || auditState.state === "error"}
                    />
                    {showResults && (
                      <DeviceBreakdown
                        state={deviceBreakdown}
                        onRetry={onRetry}
                      />
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      <AppFooter />
    </div>
  );
}
