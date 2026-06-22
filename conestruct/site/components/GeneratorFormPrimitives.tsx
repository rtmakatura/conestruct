"use client";

import type { ReactNode } from "react";

// One numbered scheme across the whole panel (replaces the prior
// 01 / A-C / OPT / DEFINE mix). A section is either a numbered step
// (``step``) or optional metadata (``optional``); the right-hand tag
// reads "STEP n" or "OPTIONAL" accordingly.
export function FieldGroup({
  label,
  step,
  optional = false,
  children,
}: {
  label: string;
  step?: number;
  optional?: boolean;
  children: ReactNode;
}) {
  const tag = optional ? "OPTIONAL" : step !== undefined ? `STEP ${step}` : "";
  return (
    <div>
      <div className="flex justify-between items-center px-6 py-2 border-t border-b border-[color:var(--rule)] bg-[color:var(--canvas)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]">
        <span>{label}</span>
        {tag && <span className="text-[color:var(--cyan)]">{tag}</span>}
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

// Inline field-level validation error (UX audit finding UX-21).  Same
// visual family as the flagger pilot-car hint, but red — these mirror
// backend gates the render API enforces with HTTP 400, not advisories.
export function FieldErrorLine({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--red)] mt-1.5"
    >
      ⚠ {children}
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
//
// ``disabled`` + ``disabledReason`` gate generation on invalid inputs
// (UX-21): the reason renders adjacent below the button (hover-only
// via ``title`` would fail on touch) so a disabled CTA is never
// unexplained.
export function GenerateButton({
  generating,
  onGenerate,
  disabled = false,
  disabledReason,
}: {
  generating: boolean;
  onGenerate: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <>
      <button
        type="button"
        className="generate-btn"
        onClick={onGenerate}
        disabled={generating || disabled}
        title={!generating && disabled ? disabledReason : undefined}
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
      {!generating && disabled && disabledReason && (
        <div
          role="alert"
          className="mt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--red)] text-center"
        >
          {disabledReason}
        </div>
      )}
    </>
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
