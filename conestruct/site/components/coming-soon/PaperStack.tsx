"use client";

import { useState } from "react";

// 02's paper stack (coming-soon-gate R15): the sheets fan out while a
// mouse or pen is over the card.  A class toggle, so the fan is static on
// touch (a tap never leaves it fanned) and testable without a browser.
// The transition itself lives in globals.css, only under
// prefers-reduced-motion: no-preference — with reduced motion the sheets
// jump to the fan and back, no movement between.
export function PaperStack({ children }: { children: React.ReactNode }) {
  const [fanned, setFanned] = useState(false);
  return (
    <div
      className={fanned ? "cs-stack is-fanned" : "cs-stack"}
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") setFanned(true);
      }}
      onPointerLeave={() => setFanned(false)}
    >
      {children}
    </div>
  );
}
