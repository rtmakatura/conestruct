import Link from "next/link";

// #289 fidelity F4 — Part 2 rule 22: the wordmark "conestruct." is Inter
// 600 14.5 px #eaf0f7, letter-spacing −.01em, the period #ff8a2e (it was
// 700 / 16 px / #ffffff).  The v0.4 tag is gone (ruled Q2).  One drawing,
// shared by the generator's nav (AppNav) and the public chrome
// (coming-soon-gate C-Q8) — P11: reused, not re-drawn.
export function Wordmark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 px-5 border-r border-[color:var(--rule)] font-sans font-semibold text-[14.5px] tracking-[-0.01em] text-[color:var(--ink)] hover:text-[color:var(--act)] transition-colors"
    >
      <span>
        conestruct<span className="text-[color:var(--dim)]">.</span>
      </span>
    </Link>
  );
}
