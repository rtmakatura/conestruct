"use client";

// Zone 3's chip primitive — THE DENSITY CONTRACT (design deliverable 4):
// every reference family is one collapsed summary chip; one click
// reveals full detail; ONLY plan-invalidating chips auto-expand; empty
// families render nothing (the caller returns null — this component
// never fakes an empty state).
//
// ``autoExpand`` opens the chip when it becomes true (e.g. the backend
// hours verdict arrives as "outside"), but a user's manual collapse is
// respected until the flag transitions false → true again.

import { useEffect, useState, type ReactNode } from "react";

// #219: "changed" (▲ — count/method-affecting, --dim accent) and
// "pending" (◌ — chromeless) join the ramp for the tier containers.
export type ChipSeverity = "info" | "warn" | "hazard" | "changed" | "pending";

interface Props {
  sev?: ChipSeverity;
  glyph: string;
  label: string;
  summary: ReactNode;
  badge?: ReactNode;
  autoExpand?: boolean;
  children: ReactNode;
}

export function ReferenceChip({
  sev = "info",
  glyph,
  label,
  summary,
  badge,
  autoExpand = false,
  children,
}: Props) {
  const [open, setOpen] = useState(autoExpand);
  useEffect(() => {
    if (autoExpand) setOpen(true);
  }, [autoExpand]);
  return (
    <div
      className={`refchip sev-${sev}${open ? " open" : ""}${
        autoExpand ? " auto-expand" : ""
      }`}
    >
      <button
        type="button"
        className="chip-sum"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="gl" aria-hidden>
          {glyph}
        </span>
        <span className="label">{label}</span>
        <span className="detail">{summary}</span>
        {badge}
        <span className="caret" aria-hidden>
          ›
        </span>
      </button>
      {open && <div className="chip-body">{children}</div>}
    </div>
  );
}
