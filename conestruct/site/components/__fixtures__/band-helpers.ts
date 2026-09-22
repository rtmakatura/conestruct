// #289 Phase 2 — the two steps the band stack added to every mounted test.
//
// Authority: validation-artifacts/committed/issue-289-band-stack/rulings.md (g).
//
// The setup panel rendered every step at once, so a mounted test could
// reach any control the moment the shell rendered.  The column renders ONE
// band open (rule 65), so a test that wants a control in a different band
// has to open that band first — exactly as a user does, through the fact
// line's CHANGE link (rule 58).
//
// These helpers are that click, named, so the suites say WHY they are
// clicking rather than carrying a selector each.  They are deliberately
// no-ops when the band is already open: a test should not have to know
// which band the column chose, only which one it needs.

import { act, fireEvent, screen } from "@testing-library/react";

/** Which band the column currently has open, per `data-open-band`. */
export function openBand(): string | null {
  return (
    document
      .querySelector('[data-testid="band-stack"]')
      ?.getAttribute("data-open-band") ?? null
  );
}

async function openVia(testid: string, want: string): Promise<void> {
  if (openBand() === want) return;
  const link = document.querySelector(`[data-testid="${testid}"]`);
  if (!link) throw new Error(`no ${testid} on screen (open band: ${openBand()})`);
  await act(async () => {
    fireEvent.click(link);
  });
}

/**
 * Open the WHERE band — the picker opener, the move ledger, the extent
 * field and the kind chips.
 *
 * Pre-pin the column already has it open, so this is a no-op there.
 */
export async function openWhere(): Promise<void> {
  await openVia("fact-link-where", "where");
}

/**
 * Open the WHAT band — the 3 × 2 grid, its provenance lines, the street
 * class and the schedule.
 */
export async function openWhat(): Promise<void> {
  await openVia("fact-link-what", "what");
}

/** The picker opener, wherever the WHERE band is in its two states. */
export async function clickPicker(): Promise<void> {
  await openWhere();
  await act(async () => {
    fireEvent.click(screen.getByTestId("where-open-picker"));
  });
}
