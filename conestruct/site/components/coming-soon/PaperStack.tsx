"use client";

import { useState } from "react";
import type { StackMove } from "./stack-moves";

// 02's paper stack (coming-soon-gate R15, R21): while a mouse or pen is
// over the card it takes its own move (`data-move`).  A class toggle, so
// the stack is static on touch (a tap never leaves it moved) and testable
// without a browser.  The movement itself lives in globals.css, only
// under prefers-reduced-motion: no-preference — with reduced motion the
// sheets change place with no movement between and every mark stays in
// place.
export function PaperStack({ move, children }: { move: StackMove; children: React.ReactNode }) {
  const [fanned, setFanned] = useState(false);
  return (
    <div
      className={fanned ? "cs-stack is-fanned" : "cs-stack"}
      data-move={move}
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") setFanned(true);
      }}
      onPointerLeave={() => setFanned(false)}
    >
      {children}
    </div>
  );
}
