// R21: each of 02's four cards has its own hover move (globals.css,
// `.cs-stack[data-move=…]`).  A plain module, not PaperStack's: a value
// exported from a "use client" file reaches a server component as a
// client reference, not as the array.
export const STACK_MOVES = ["plan", "quote", "audit", "crew"] as const;
export type StackMove = (typeof STACK_MOVES)[number];
