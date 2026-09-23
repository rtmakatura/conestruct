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

/**
 * A post-generate edit, the way the column offers one.
 *
 * #289 Phase 2 / §8.27: the setup strip and its six inline editors are
 * deleted, and #262 closes by deletion rather than by fix.  Where a suite
 * used to click "Edit Speed" and pick from the strip's own select, the
 * operator now presses CHANGE ONE THING on the setup fact line (rule 58's
 * verb), which re-opens the column, and edits the value in the WHAT
 * grid's cell.
 *
 * Two clicks instead of one, and the trade is ruling 190's: "CHANGE ONE
 * THING re-opens one field, in place, with its consequence shown."  S7
 * makes the re-open land on ONE field with a before/after panel; until
 * then it re-opens the band.
 */
export async function changeOneThing(): Promise<void> {
  const link = document.querySelector('[data-testid="fact-link-setup"]');
  if (!link) throw new Error("no CHANGE ONE THING on the setup fact line");
  await act(async () => {
    fireEvent.click(link);
  });
}

/**
 * CHANGE ONE THING, then set a WHAT-grid cell.  `id` is the cell's own
 * id (`what-speed`, `what-lanes`, `what-lane-width`, `what-road-type`,
 * `what-jurisdiction`).
 */
export async function editAfterGenerate(
  id: string,
  value: string,
): Promise<void> {
  // #289 Phase 2, S7 (ruling e): a post-generate edit IS a revision now.
  // CHANGE ONE THING re-opens ONE field (rule 190), the edit STAGES —
  // "nothing is written until APPLY" (§1.1) — and APPLY folds the staged
  // set into one write and one generate.
  //
  // So the helper is three steps instead of two, and the suites that
  // call it keep their claim: an edit after a generate still ends in one
  // refetch of the pair, because that is what APPLY does.  What changed
  // is that the write now happens at a moment the operator chose.
  //
  // `id` is kept in the signature because the suites name the field they
  // mean, and because S7 opens on speed today: a caller asking for
  // another field should fail loudly here rather than silently edit the
  // wrong one.
  if (id !== "what-speed") {
    throw new Error(
      `editAfterGenerate: S7 re-opens the speed field; asked for ${id}`,
    );
  }
  await changeOneThing();
  const el = document.getElementById("revise-speed") as HTMLSelectElement | null;
  if (!el) throw new Error("no revision editor on screen");
  await act(async () => {
    fireEvent.change(el, { target: { value } });
  });
  await applyRevision();
}

/** Stage a revision WITHOUT applying it: CHANGE ONE THING, then commit a
 *  value.  This is the half that writes nothing (§1.1) and fires only a
 *  preview (a read) — the half a suite wants when its claim is about
 *  what an edit does NOT do. */
export async function stageRevision(value: string): Promise<void> {
  await changeOneThing();
  const el = document.getElementById("revise-speed") as HTMLSelectElement | null;
  if (!el) throw new Error("no revision editor on screen");
  await act(async () => {
    fireEvent.change(el, { target: { value } });
  });
}

/** APPLY — the one write, and the one generate (ruling e). */
export async function applyRevision(): Promise<void> {
  const apply = document.querySelector('[data-testid="revise-apply"]');
  if (!apply) throw new Error("no APPLY on the revision panel");
  await act(async () => {
    fireEvent.click(apply);
  });
}

/** The way back to the whole column from S7 — for a suite whose subject
 *  is a band the revision does not render (the pin, the extent, the
 *  kind).  See the prop's note in bands/RevisionBand.tsx. */
export async function openColumnFromRevision(): Promise<void> {
  await changeOneThing();
  const link = document.querySelector('[data-testid="revise-open-column"]');
  if (!link) throw new Error("no CHANGE SOMETHING ELSE on the revision band");
  await act(async () => {
    fireEvent.click(link);
  });
}

/** DISCARD — un-stages and fires zero requests (Part 1 §5.6). */
export async function discardRevision(): Promise<void> {
  const discard = document.querySelector('[data-testid="revise-discard"]');
  if (!discard) throw new Error("no DISCARD on the revision band");
  await act(async () => {
    fireEvent.click(discard);
  });
}

/** The picker opener, wherever the WHERE band is in its two states. */
export async function clickPicker(): Promise<void> {
  await openWhere();
  await act(async () => {
    fireEvent.click(screen.getByTestId("where-open-picker"));
  });
}
