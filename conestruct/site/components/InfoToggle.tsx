"use client";

// #435 rulings 4–5 (checkpoint call C3): the per-field "i details" toggle
// (P19: one click away, never deleted), for the road picker.  Same classes
// and DOM shape as FieldCell's toggle and popover (FieldCell.tsx, the WHAT
// band): `a-lk a-info-toggle` opening an `a-info a-pop` group, closed by a
// click outside or Escape, with focus back on the toggle.  FieldCell keeps
// its own copy because its popover has a second opener (the marker
// triggers) sharing one open state; this one has only the toggle.
//
// Escape is caught in the capture phase while open and stopped there, so
// closing the popover does not also cancel the picker (its Escape handler
// listens on document, LocationPickerModal.tsx).

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { symClass } from "@/lib/design/symbols";

// #436 (call D3): the open state, the outside-click close and the
// capture-phase Escape, shared by InfoToggle and the picked-road row's
// "Details" text button.  `boxRef` goes on the element a click must land
// outside of to close; `triggerRef` on the opener, which takes focus back.
export function useDetailsToggle<B extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const boxRef = useRef<B | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return { open, setOpen, panelId, boxRef, triggerRef };
}

export function InfoToggle({
  label,
  testid,
  className = "",
  children,
}: {
  /** What the details are for: "Details for {label}". */
  label: string;
  testid: string;
  className?: string;
  children: ReactNode;
}) {
  const { open, setOpen, panelId, boxRef, triggerRef } =
    useDetailsToggle<HTMLSpanElement>();

  return (
    <span ref={boxRef} className={`info-toggle-box ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Details for ${label}`}
        onClick={() => setOpen((o) => !o)}
        data-testid={`info-toggle-${testid}`}
        className="a-lk a-info-toggle is-standalone"
      >
        <span className={`a-sym ${symClass("i")}`} aria-hidden>
          i
        </span>
        <span aria-hidden>details</span>
      </button>
      <div
        id={panelId}
        className="a-info a-pop tr-note"
        role="group"
        aria-label={`Details for ${label}`}
        hidden={!open}
        data-testid={`info-${testid}`}
      >
        {children}
      </div>
    </span>
  );
}
