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

export function GeneratorShell() {
  const [params, setParams] = useState<ScenarioParams>(DEFAULT_PARAMS);
  const [status, setStatus] = useState<Status>("done");

  const setParam = <K extends keyof ScenarioParams>(
    key: K,
    value: ScenarioParams[K],
  ) => {
    setParams((p) => ({ ...p, [key]: value }));
  };

  const results = useMemo(() => compute(params), [params]);

  const onGenerate = () => {
    setStatus("generating");
    setTimeout(() => setStatus("done"), 1100);
  };

  const generated = status === "done";

  return (
    <>
      <AppNav />
      <AppSheetMeta project={params.project} address={params.address} />

      <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] min-h-[calc(100vh-60px)]">
        <GeneratorSidebar
          params={params}
          setParam={setParam}
          generating={status === "generating"}
          onGenerate={onGenerate}
        />

        <main className="px-10 pt-8 pb-20 max-w-[1100px] max-md:px-6 max-md:pt-6">
          <div className="mb-7">
            <div className="eyebrow mb-3">02 · MHT GENERATOR · COLORADO</div>
            <h1 className="text-[36px] font-bold tracking-tighter text-navy m-0 mb-2 leading-[1.05]">
              Method of Handling Traffic — plan generator
            </h1>
            <p className="text-ink-mute text-[15px] m-0 max-w-[620px]">
              Generate a CDOT-compliant MHT package: PDF plan sheet, device
              list, and crew instructions. Every dimension cited to MUTCD or
              the Colorado Supplement.
            </p>
          </div>

          <StatusBar status={status} />
          <OutputCards results={results} generated={generated} />
          <AuditTrail params={params} results={results} generated={generated} />
          {generated && <DeviceBreakdown results={results} />}
        </main>
      </div>

      <AppFooter />
    </>
  );
}
