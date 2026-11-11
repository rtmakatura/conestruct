"use client";

// #517 ruling 6 (Ryan, 2026-11-11, board D part 1): "Replace the native
// lists in this section with one shared listbox component.  It uses Inter
// at 15, options at least 44 px, the selected option on --pri-off with a
// check, and keyboard support (arrows, Enter, Esc, type-ahead).  Trace
// whether the page already has a listbox."  None did (checkpoint.md), so
// this is the one (S7).
//
// THE SHAPE.  A 44 px button carrying the old control's `id`, so the
// field's `<label htmlFor>` still names it; `aria-haspopup="listbox"` and
// `aria-expanded`.  Open, focus moves to the popup (`role="listbox"`),
// which tracks the active option with `aria-activedescendant`; each option
// is `role="option"` with `aria-selected` and its own `data-value`.
// Keyboard: ArrowDown / ArrowUp / Home / End move, Enter or Space picks,
// Esc closes and returns focus to the button, Tab closes, and typed letters
// jump to the next option starting with them.  A click outside closes.
// `disabled` is the write lock (the button keeps `data-write=""`).
//
// Picking the value already held still calls `onChange` (S2: picking a
// guess's own value is the check).

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export interface ListboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function Listbox({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Not set",
  invalid = false,
  className = "",
  dataAttrs = {},
}: {
  /** The old control's id: `<label htmlFor>` names the button. */
  id: string;
  /** The field's name, for the popup and the button's accessible name. */
  label: string;
  /** The selected value, or null for unset (the placeholder shows). */
  value: string | null;
  options: ReadonlyArray<ListboxOption>;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** What the button reads with no value. */
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  /** Extra `data-*` attributes for the button (e.g. the jurisdiction's
   *  `data-jurisdiction-state`). */
  dataAttrs?: Record<`data-${string}`, string>;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const typed = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const listId = `${id}-list`;
  const nameId = `${id}-name`;
  const optId = (i: number) => `${id}-opt-${uid}-${i}`;

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const enabledIndex = (from: number, step: 1 | -1): number => {
    const n = options.length;
    for (let k = 0; k < n; k++) {
      const i = from + step * k;
      if (i < 0 || i >= n) break;
      if (!options[i].disabled) return i;
    }
    return -1;
  };

  const openList = () => {
    if (disabled) return;
    const start = selectedIndex >= 0 ? selectedIndex : enabledIndex(0, 1);
    setActive(Math.max(start, 0));
    setOpen(true);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const pick = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    close(true);
  };

  // Open: the popup takes focus (it owns aria-activedescendant).
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  // Keep the active option in view.
  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(optId(active));
    el?.scrollIntoView?.({ block: "nearest" });
    // optId is stable for this render's id/uid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  // A click outside closes (never refocusing: the click went elsewhere).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent | MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const typeAhead = (ch: string) => {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at > 700 ? ch : t.text + ch;
    t.at = now;
    const q = t.text.toLowerCase();
    const n = options.length;
    // A single repeated letter cycles; a longer string matches from here.
    const startAt = q.length === 1 ? active + 1 : active;
    for (let k = 0; k < n; k++) {
      const i = (startAt + k) % n;
      const o = options[i];
      if (!o.disabled && o.label.toLowerCase().startsWith(q)) {
        setActive(i);
        return;
      }
    }
  };

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openList();
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const i = enabledIndex(active + 1, 1);
        if (i >= 0) setActive(i);
        return;
      }
      case "ArrowUp": {
        e.preventDefault();
        const i = enabledIndex(active - 1, -1);
        if (i >= 0) setActive(i);
        return;
      }
      case "Home": {
        e.preventDefault();
        const i = enabledIndex(0, 1);
        if (i >= 0) setActive(i);
        return;
      }
      case "End": {
        e.preventDefault();
        const i = enabledIndex(options.length - 1, -1);
        if (i >= 0) setActive(i);
        return;
      }
      case "Enter":
      case " ":
        e.preventDefault();
        pick(active);
        return;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close(true);
        return;
      case "Tab":
        close(false);
        return;
      default:
        if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
          typeAhead(e.key);
        }
    }
  };

  return (
    <div className={`lb${className ? ` ${className}` : ""}`} ref={wrapRef}>
      <span id={nameId} hidden>
        {label}
      </span>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        className={`lb-btn${selected ? "" : " is-unset"}`}
        data-write=""
        disabled={disabled}
        // The name is the field's and then the value ("Speed 30 mph"), as a
        // native select announces both; the label element still points here.
        aria-labelledby={`${nameId} ${id}-val`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        onClick={() => (open ? close(true) : openList())}
        onKeyDown={onButtonKey}
        {...dataAttrs}
      >
        <span className="lb-val" id={`${id}-val`}>{selected ? selected.label : placeholder}</span>
        <span className="lb-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="lb-pop"
          aria-labelledby={nameId}
          aria-activedescendant={optId(active)}
          // axe scrollable-region-focusable (#517 walk): a long list
          // scrolls, so the list itself is keyboard-focusable.
          tabIndex={0}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => {
            const isSel = i === selectedIndex;
            return (
              <li
                key={`${o.value}:${i}`}
                id={optId(i)}
                role="option"
                aria-selected={isSel}
                aria-disabled={o.disabled || undefined}
                data-value={o.value}
                data-active={i === active || undefined}
                className={`lb-opt${isSel ? " is-selected" : ""}`}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onClick={() => pick(i)}
              >
                <span className="lb-check" aria-hidden>
                  {isSel ? "✓" : ""}
                </span>
                <span>{o.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
