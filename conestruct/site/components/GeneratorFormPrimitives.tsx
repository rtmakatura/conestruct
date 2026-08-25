"use client";

import type { ReactNode } from "react";

// One numbered scheme across the whole panel (replaces the prior
// 01 / A-C / OPT / DEFINE mix). A section is either a numbered step
// (``step``) or optional metadata (``optional``); the right-hand tag
// reads "STEP n" or "OPTIONAL" accordingly.
// ``anchorId`` (#221): the header row becomes the progress rail's jump
// target — id + tabIndex -1 so a rail click (a user-initiated armed
// action per the #193 focus policy) can land focus on the section
// heading; never in the Tab order.
export function FieldGroup({
  label,
  step,
  optional = false,
  anchorId,
  children,
}: {
  label: string;
  step?: number;
  optional?: boolean;
  anchorId?: string;
  children: ReactNode;
}) {
  const tag = optional ? "OPTIONAL" : step !== undefined ? `STEP ${step}` : "";
  return (
    <div>
      <div
        id={anchorId}
        tabIndex={anchorId !== undefined ? -1 : undefined}
        className="flex justify-between items-center px-6 py-2 border-t border-b border-[color:var(--rule)] bg-[color:var(--canvas)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] outline-none"
      >
        <span>{label}</span>
        {tag && <span className="text-[color:var(--act)]">{tag}</span>}
      </div>
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}

export function Field({ children }: { children: ReactNode }) {
  return <div className="mb-3 last:mb-0">{children}</div>;
}

export function CheckRow({
  on,
  label,
  desc,
  evidence,
  onToggle,
}: {
  on: boolean;
  label: string;
  desc?: string;
  // #16 — backend-relayed detection evidence ("2 found, nearest ~122 m"
  // + detail lines).  Rendered inside the row (as extra check-desc
  // spans) rather than as a sibling element so the #200 junction rule
  // (.check-row + :not(.check-row)) never fires mid-list, and the
  // margin is part of the checkbox's announced content rather than
  // hidden from AT.  Absent ⇒ nothing renders (#186).
  evidence?: string[];
  onToggle: () => void;
}) {
  return (
    // fix-spec-02 P1·05·02: the toggle exposes checkbox semantics —
    // without them a screen reader hears an unnamed state-free button
    // and the on/off state exists only as a fill color (hue-alone).
    // The native <button> keeps Space/Enter activation and tab focus.
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      className={`check-row ${on ? "on" : ""}`}
      onClick={onToggle}
    >
      <span className="check-box" />
      <span className="check-lbl">{label}</span>
      {desc && <span className="check-desc">{desc}</span>}
      {evidence?.map((line, i) => (
        <span key={i} className="check-desc">
          {line}
        </span>
      ))}
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
        // fix-spec-02 P1·05·02: aria-pressed carries the selection state
        // the cyan fill shows visually.
        <button
          key={String(o.v)}
          type="button"
          aria-pressed={value === o.v}
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
      className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--fail)] mt-1.5"
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
            <span className="inline-block w-3 h-3 rounded-full border-[1.5px] border-[#06222F]/40 border-t-[#06222F] animate-spin" />
            Generating plan…
          </>
        ) : (
          <>Generate plan</>
        )}
      </button>
      {!generating && disabled && disabledReason && (
        <div
          role="alert"
          className="mt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--fail)] text-center"
        >
          {disabledReason}
        </div>
      )}
    </>
  );
}

// fix-spec-02 P1·05·03: pass ``htmlFor`` (with a matching ``id`` on the
// control) to render a real <label> — the row was a bare <div>, so
// every workbench select/slider/input had no programmatic name and no
// click-to-focus.  Rows that caption a button group (ChipRow) stay
// <div>s: a <label> may only name one form control.
export function LabelRow({
  children,
  value,
  htmlFor,
}: {
  children: ReactNode;
  value?: ReactNode;
  htmlFor?: string;
}) {
  const body = (
    <>
      <span>{children}</span>
      {value !== undefined && (
        <span className="field-val text-[color:var(--act)]">{value}</span>
      )}
    </>
  );
  return htmlFor ? (
    <label className="field-label-row" htmlFor={htmlFor}>
      {body}
    </label>
  ) : (
    <div className="field-label-row">{body}</div>
  );
}
