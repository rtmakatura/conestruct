"use client";

import { useEffect, useMemo, useState } from "react";
import {
  compute,
  DEFAULT_SCENARIO,
  type Scenario,
} from "@/lib/scenarios";
import { AppNav } from "./AppNav";
import { AppSheetMeta } from "./AppSheetMeta";
import { GeneratorSidebar } from "./GeneratorSidebar";
import { StatusBar, type Status } from "./StatusBar";
import { OutputCards } from "./OutputCards";
import { QuotePanel } from "./QuotePanel";
import { AuditTrail } from "./AuditTrail";
import {
  DeviceBreakdown,
  type DeviceBreakdownData,
  type DeviceBreakdownState,
} from "./DeviceBreakdown";
import { AppFooter } from "./AppFooter";

type Mode = "sandbox" | "workbench";

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
  const [status, setStatus] = useState<Status>("done");
  const [planId, setPlanId] = useState<string | null>(initialPlanId);
  const [planName, setPlanName] = useState<string | null>(initialPlanName);

  const onSaved = (id: string, name: string) => {
    setPlanId(id);
    setPlanName(name);
  };

  const results = useMemo(() => compute(scenario), [scenario]);
  // OutputCards stay visible from first paint (original behavior); the
  // Generate button now performs a real bundled-zip download rather than
  // gating visibility.
  const [bundleError, setBundleError] = useState<string | null>(null);

  // Plan Details panel is server-driven: fetch the aggregated device list
  // from /api/render/device-breakdown so the panel reads from the same
  // placements list that feeds the PDF, XLSX, and crew narrative.  Refetch
  // whenever the scenario changes; retryNonce lets the panel's Retry button
  // re-trigger the effect on an error.
  const [deviceBreakdown, setDeviceBreakdown] = useState<DeviceBreakdownState>({
    state: "loading",
  });
  const [retryNonce, setRetryNonce] = useState(0);

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

  const onRetryDeviceBreakdown = () => setRetryNonce((n) => n + 1);

  const safeFilename = (name: string | undefined): string => {
    const cleaned = (name ?? "")
      .trim()
      .replace(/[^a-zA-Z0-9 _-]+/g, "_")
      .replace(/\s+/g, "_");
    return cleaned || "plan";
  };

  // Sandbox/public mode: build the deliverable zip on demand by hitting
  // /api/render/bundle (which fans out to all four Modal renderers in
  // parallel and zips the bytes server-side).  Saved/workbench mode just
  // re-uses the existing per-file download links exposed in OutputCards.
  const onGenerate = async () => {
    if (status === "generating") return;
    setStatus("generating");
    setBundleError(null);

    if (mode !== "sandbox") {
      // Workbench mode: OutputCards already serves per-file downloads
      // tied to the saved plan; nothing to bundle here.
      setStatus("done");
      return;
    }

    try {
      const res = await fetch("/api/render/bundle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      if (!res.ok) {
        setBundleError(`Bundle failed (${res.status})`);
        setStatus("done");
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
      setStatus("done");
    }
  };

  const generated = status === "done";

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
        ta={results.ta}
        cdotSheet={results.cdotSheet}
        scenario={scenario}
        planId={planId}
        planName={planName}
        onSaved={onSaved}
      />
      <AppSheetMeta
        project={scenario.meta.project}
        address={scenario.meta.address}
        cdotSheet={results.cdotSheet}
      />

      <div className="grid grid-cols-1 md:grid-cols-[360px_1fr]">
        <GeneratorSidebar
          scenario={scenario}
          setScenario={setScenario}
          generating={status === "generating"}
          onGenerate={onGenerate}
        />

        <main className="px-10 pt-8 pb-20 max-w-[1100px] max-md:px-6 max-md:pt-6">
          <div className="mb-7">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--cyan)] inline-flex items-center gap-2.5 mb-3 before:content-[''] before:w-6 before:h-px before:bg-[color:var(--cyan)] before:inline-block">
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

          <div className="mb-7 pl-4 py-3 border-l-2 border-[color:var(--orange)]">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--orange)] mb-1">
              Draft — not a sealed plan
            </div>
            <div className="text-[13px] text-[color:var(--ink-on-dark-faint)] leading-snug max-w-[620px]">
              Output is engineering reference. Requires review and seal by a
              licensed Professional Engineer prior to field use.
            </div>
          </div>

          <StatusBar status={status} />
          {bundleError && (
            <div className="mb-5 px-4 py-3 border-l-2 border-[color:var(--orange)] font-mono text-[12px] text-[color:var(--orange)]">
              {bundleError}
            </div>
          )}
          <OutputCards
            results={results}
            generated={generated}
            mode={
              mode === "sandbox"
                ? { kind: "public", scenario }
                : { kind: "saved", planId }
            }
            breakdown={deviceBreakdown}
          />
          {generated && (
            <QuotePanel
              mode={
                mode === "sandbox"
                  ? { kind: "public", scenario }
                  : { kind: "saved", planId }
              }
            />
          )}
          <AuditTrail
            scenario={scenario}
            results={results}
            generated={generated}
          />
          {generated && (
            <DeviceBreakdown
              state={deviceBreakdown}
              onRetry={onRetryDeviceBreakdown}
            />
          )}
        </main>
      </div>

      <AppFooter />
    </div>
  );
}
