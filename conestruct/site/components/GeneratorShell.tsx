"use client";

import { useMemo, useState } from "react";
import {
  compute,
  DEFAULT_PARAMS,
  type ScenarioParams,
} from "@/lib/compute";
import { AppNav } from "./AppNav";
import { AppSheetMeta } from "./AppSheetMeta";
import { GeneratorSidebar } from "./GeneratorSidebar";
import { StatusBar, type Status } from "./StatusBar";
import { OutputCards } from "./OutputCards";
import { AuditTrail } from "./AuditTrail";
import { DeviceBreakdown } from "./DeviceBreakdown";
import { AppFooter } from "./AppFooter";

type Mode = "sandbox" | "workbench";

interface Props {
  mode?: Mode;
  initialParams?: ScenarioParams;
  initialPlanId?: string | null;
  initialPlanName?: string | null;
}

export function GeneratorShell({
  mode = "workbench",
  initialParams,
  initialPlanId = null,
  initialPlanName = null,
}: Props = {}) {
  const [params, setParams] = useState<ScenarioParams>(
    initialParams ?? DEFAULT_PARAMS,
  );
  const [status, setStatus] = useState<Status>("done");
  const [planId, setPlanId] = useState<string | null>(initialPlanId);
  const [planName, setPlanName] = useState<string | null>(initialPlanName);

  const setParam = <K extends keyof ScenarioParams>(
    key: K,
    value: ScenarioParams[K],
  ) => {
    setParams((p) => ({ ...p, [key]: value }));
  };

  const onSaved = (id: string, name: string) => {
    setPlanId(id);
    setPlanName(name);
  };

  const results = useMemo(() => compute(params), [params]);

  const onGenerate = () => {
    setStatus("generating");
    setTimeout(() => setStatus("done"), 1100);
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
        caseId={results.caseId}
        params={params}
        planId={planId}
        planName={planName}
        onSaved={onSaved}
      />
      <AppSheetMeta project={params.project} address={params.address} />

      <div className="grid grid-cols-1 md:grid-cols-[360px_1fr]">
        <GeneratorSidebar
          params={params}
          setParam={setParam}
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
          <OutputCards results={results} generated={generated} />
          <AuditTrail params={params} results={results} generated={generated} />
          {generated && <DeviceBreakdown results={results} />}
        </main>
      </div>

      <AppFooter />
    </div>
  );
}
