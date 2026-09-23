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
export async function changeOneThing(key: string = "speed"): Promise<void> {
  // #289 hand-check, 2026-09-23, defect 2: there is no single CHANGE ONE
  // THING link any more — each value on the setup line is its own link,
  // and the operator presses the one they mean.  The helper keeps its
  // name because the suites' claim is unchanged ("a post-generate edit is
  // one field"); it now says WHICH field, defaulting to the speed the old
  // link always opened.
  const link = document.querySelector(`[data-testid="setup-link-${key}"]`);
  if (!link) throw new Error(`no ${key} value link on the setup fact line`);
  await act(async () => {
    fireEvent.click(link);
  });
}

/** The WHAT-grid cell id a suite names → the setup-line value that opens
 *  the same field in S7. */
const REVISE_KEY: Record<string, { key: string; editor: string }> = {
  "what-speed": { key: "speed", editor: "revise-speed" },
  "what-lanes": { key: "lanes", editor: "revise-lanes" },
  "what-lane-width": { key: "laneWidth", editor: "revise-laneWidth" },
  "what-road-type": { key: "roadType", editor: "revise-roadType" },
  "what-jurisdiction": { key: "jurisdiction", editor: "revise-jurisdiction_key" },
};

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
  // Defect 2: the suite names the field, and the field's own value link
  // opens it.  An unknown id still fails loudly rather than editing the
  // wrong field.
  const target = REVISE_KEY[id];
  if (!target) throw new Error(`editAfterGenerate: no S7 field for ${id}`);
  await changeOneThing(target.key);
  const el = document.getElementById(target.editor) as HTMLSelectElement | null;
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
export async function stageRevision(
  value: string,
  id: string = "what-speed",
): Promise<void> {
  const target = REVISE_KEY[id];
  if (!target) throw new Error(`stageRevision: no S7 field for ${id}`);
  await changeOneThing(target.key);
  const el = document.getElementById(target.editor) as HTMLSelectElement | null;
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

/** The way to the pin after a generate — for a suite whose subject is a
 *  band the revision does not render.  CHANGE SOMETHING ELSE is retired
 *  (Ryan, 2026-09-23: "the value links replace it"), so this is the
 *  setup line's LOCATION value, which opens the column on WHERE. */
export async function openWhereAfterGenerate(): Promise<void> {
  await changeOneThing("location");
}

/** DISCARD — un-stages and fires zero requests (Part 1 §5.6). */
export async function discardRevision(): Promise<void> {
  const discard = document.querySelector('[data-testid="revise-discard"]');
  if (!discard) throw new Error("no DISCARD on the revision band");
  await act(async () => {
    fireEvent.click(discard);
  });
}

/**
 * #289 hand-check, 2026-09-23, defect 1 — the WHERE primary, pressed
 * after a chip.  A chip click only SELECTS; the WHAT band and Generate
 * wait on this press.  Fails loudly if the primary is still disabled
 * (no chip clicked), because a suite pressing it then is asserting a
 * confirmation that did not happen.
 */
export async function confirmKind(): Promise<void> {
  const btn = document.querySelector('[data-testid="where-confirm"]');
  if (!btn) throw new Error("no WHERE confirm on screen");
  if (btn.getAttribute("aria-disabled") === "true") {
    throw new Error("WHERE confirm is disabled — no kind chip was clicked");
  }
  await act(async () => {
    fireEvent.click(btn);
  });
}

/** The picker opener, wherever the WHERE band is in its two states. */
export async function clickPicker(): Promise<void> {
  await openWhere();
  await act(async () => {
    fireEvent.click(screen.getByTestId("where-open-picker"));
  });
}
