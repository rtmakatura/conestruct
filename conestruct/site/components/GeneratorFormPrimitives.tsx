"use client";

import type { ReactNode } from "react";

export function FieldGroup({
  label,
  ix,
  children,
}: {
  label: string;
  ix: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex justify-between items-center px-6 py-2 border-t border-b border-[color:var(--rule)] bg-[color:var(--canvas)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
        <span>{label}</span>
        <span className="text-[color:var(--cyan)]">{ix}</span>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

export function Field({ children }: { children: ReactNode }) {
  return <div className="mb-3.5 last:mb-0">{children}</div>;
}

export function CheckRow({
  on,
  label,
  desc,
  onToggle,
}: {
  on: boolean;
  label: string;
  desc?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`check-row ${on ? "on" : ""}`}
      onClick={onToggle}
    >
      <span className="check-box" />
      <span className="check-lbl">{label}</span>
      {desc && <span className="check-desc">{desc}</span>}
    </button>
  );
}

export function ChipRow<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ v: T; l: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="chip-row">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          className={`chip ${value === o.v ? "on" : ""}`}
          onClick={() => onChange(o.v)}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

// Primary CTA — the only button that runs generation. Labeled with the
// generate verb, not a download verb (UX audit finding UX-17): per-file
// download buttons live on the output cards, and in workbench mode this
// button downloads nothing at all (sandbox additionally auto-downloads
// the zip as a side effect). Extracted here (Mapbox-free module) so the
// label is unit-testable via renderToStaticMarkup — same pattern as
// AuditTrail.test.tsx / lib/scenarios/overrides.ts.
export function GenerateButton({
  generating,
  onGenerate,
}: {
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <button
      type="button"
      className="generate-btn"
      onClick={onGenerate}
      disabled={generating}
    >
      {generating ? (
        <>
          <span className="inline-block w-3 h-3 rounded-full border-[1.5px] border-white/40 border-t-white animate-spin" />
          Generating plan…
        </>
      ) : (
        <>Generate plan</>
      )}
    </button>
  );
}

export function LabelRow({
  children,
  value,
}: {
  children: ReactNode;
  value?: ReactNode;
}) {
  return (
    <div className="field-label-row">
      <span>{children}</span>
      {value !== undefined && (
        <span className="field-val text-[color:var(--cyan)]">{value}</span>
      )}
    </div>
  );
}
