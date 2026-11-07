// #288 Phase 1 (s2-arc33) step 2 — the ▲/⚠ facts as NEEDS YOU item rows.
//
// Authority: validation-artifacts/committed/issue-288-results-stack/rulings.md
// clauses a, b and d, with #281 comment 1 rules 74–79 and ruling 185.
//
// The second half of clause b's transfer.  Step 1 put every ▲/⚠ source
// behind one producer (lib/tier-sources.ts); this file maps those sources
// to the rows rule 74 draws.  It is a re-grouping, not a classification:
// which tier a fact sits in was decided by `assignTiers` and is read here,
// never re-decided (P2).
//
// ORDER.  Within a tier the wire's order is preserved, and the groups run
// in the order section 03 rendered them, so lifting the tiers into NEEDS
// YOU does not silently re-rank anything:
//   ▲  jurisdiction deltas · site adjustments · fines-double
//   ⚠  jurisdiction deltas (conditional/unknown) · Colorado FAILs ·
//      site-scan NOT CHECKED · corridor · geometry · signalized approaches
//
// ACTIONS: ruling d, applied strictly.  Every item here except a
// jurisdiction delta carries `action: null`, so no row renders a button.
// That is not an oversight and not a placeholder:
//   · ACKNOWLEDGE now has a field to write (#297, Ryan 2026-10-14):
//     `meta.acknowledged`, by the item's stable id.  It is offered on the
//     jurisdiction-delta rows only, the items with no other write, and it
//     stages like a correction (`withAck`); Apply writes it.
//   · DISMISS / KEEP and CORRECT IN SETUP are real writes, and they have
//     an owner: NeedsYouConditions.tsx, which absorbed the corrections
//     block WHOLE under Part 1 §8.5 — the staging contract, the standing
//     sentence, the disabled-at-zero button and the dismiss picker,
//     verbatim.  A button on THESE rows would duplicate a write that
//     already has an owner.  An honest item without a control beats a control that writes
//     nothing.
// The rows still carry their provenance and citation, which is what makes
// them worth showing before their actions arrive.

import type { AppliedDelta } from "./jurisdiction";
import { deltaCite, deltaDetail, deltaTitle } from "./delta-words";
import type { SiteAdjustmentRecord, SiteScanCorrection } from "./render-types";
import type { NeedsYouItem, NeedsYouTier } from "./needs-you";
import type { ConditionRow } from "./needs-you-conditions";
import type { ScannedSiteFlag, StagedCorrection } from "./scenarios/types";
import type { ScanBucketWire } from "./tiering";
import type { TierSources } from "./tier-sources";
import { deltaFactId } from "./tiering";
import type { ItemSpec } from "@/components/AuditTrail";

/** R116 / R117: a rule's row, in the words lib/delta-words chooses --
 *  a plain title, one detail line, the source as the citation.  Never a
 *  raw key, never the rule's sentence (that stays in Plan reference). */
function fromDelta(
  d: AppliedDelta,
  i: number,
  tier: NeedsYouTier,
  jurisdictionName: string | null,
): NeedsYouItem {
  return {
    id: deltaFactId(d, i),
    tier,
    title: deltaTitle(d, jurisdictionName),
    result: d.status.toUpperCase(),
    cite: deltaCite(d),
    evidence: deltaDetail(d, jurisdictionName),
    action: null,
  };
}

/** #297: where acknowledgements stand, for the delta rows' controls.
 *  `acknowledged` is the plan's (`meta.acknowledged`); `staged` maps an
 *  item id to its staged intent (true acknowledges, false withdraws). */
export interface AckState {
  acknowledged: readonly string[];
  staged: ReadonlyMap<string, boolean>;
}

/** #297: a delta row with its acknowledgement control and state.  The
 *  row's tier, title and evidence never change: the operator acknowledged
 *  the item, not the condition (rule 10). */
export function withAck(item: NeedsYouItem, acks: AckState): NeedsYouItem {
  const intent = acks.staged.get(item.id);
  if (intent === true) return { ...item, ack: "staged", action: { kind: "undo", label: "Undo" } };
  if (intent === false) {
    return { ...item, ack: "withdrawal-staged", action: { kind: "undo", label: "Undo" } };
  }
  if (acks.acknowledged.includes(item.id)) {
    return { ...item, ack: "acknowledged", action: { kind: "withdraw", label: "Withdraw" } };
  }
  return { ...item, action: { kind: "acknowledge", label: "Acknowledge" } };
}

/** A site adjustment's device counts, as the record carried them ("6
 *  devices added", "3 modified"), or "" when it added and modified none.
 *  Shared with the merged condition row (NeedsYouConditions.tsx, R99) so
 *  the fact reads the same wherever it renders (P2). */
export function siteAdjustmentCounts(rec: SiteAdjustmentRecord): string {
  const added = rec.devices_added;
  const modified = rec.devices_modified ?? 0;
  // Counts come from the record; the sentence is assembled from them and
  // never rounded, inferred or summed across records.
  return [
    added > 0 ? `${added} device${added === 1 ? "" : "s"} added` : null,
    modified > 0 ? `${modified} modified` : null,
  ].filter(Boolean).join(" · ");
}

function fromSiteAdjustment(rec: SiteAdjustmentRecord, label: string): NeedsYouItem {
  const counts = siteAdjustmentCounts(rec);
  return {
    id: `audit:site:${rec.flag}`,
    tier: "changed",
    title: label,
    result: "APPLIED",
    cite: rec.citation,
    evidence: counts || undefined,
    action: null,
  };
}

function fromItemSpec(spec: ItemSpec, id: string, tier: NeedsYouTier): NeedsYouItem {
  return {
    id,
    tier,
    title: spec.title,
    result: spec.result,
    cite: spec.cite,
    action: null,
  };
}

export interface NeedsYouItemsInput {
  sources: TierSources;
  /** SITE_ADJUSTMENT_DETAIL, injected so this module stays free of the
   *  component layer's copy table. */
  siteLabel: (flag: string) => string;
  /** #297: the acknowledgements, for the delta rows' control.  Absent:
   *  no delta row renders one (the pre-#297 rendering). */
  acks?: AckState;
}

export function buildNeedsYouItems({ sources, siteLabel, acks }: NeedsYouItemsInput): NeedsYouItem[] {
  const {
    deltas, jurisdictionName,
    deltasChanged, siteChanged, finesItem, finesApplicable,
    deltasAttention, coloradoFails, siteScanItem, corridorItem, geometryItem,
    approachesSpec, approachesSignalized,
  } = sources;

  // A delta's id is its index over the FULL applied_deltas array, which is
  // what lib/tiering.ts uses and what src/rendering/tier_ledger.py mirrors.
  // Indexing over the filtered group instead gave the same fact a different
  // id AND collided `jur:delta:0` between the two tiers -- caught by this
  // module's own id-uniqueness test, not by review.
  const deltaIndex = new Map(deltas.map((d, i) => [d, i] as const));

  // #297: a delta row offers ACKNOWLEDGE only when it has the backend's
  // stable key; a position-based id would move the acknowledgement onto
  // another rule when an earlier one stopped firing.
  const ackable = (d: AppliedDelta, item: NeedsYouItem): NeedsYouItem =>
    acks && d.key ? withAck(item, acks) : item;

  const items: NeedsYouItem[] = [];

  // ── ▲ changed — this plan is different because of these ──
  deltasChanged.forEach((d) =>
    items.push(ackable(d, fromDelta(d, deltaIndex.get(d) ?? -1, "changed", jurisdictionName))),
  );
  siteChanged.forEach((rec) => items.push(fromSiteAdjustment(rec, siteLabel(rec.flag))));
  if (finesItem && finesApplicable) {
    items.push(fromItemSpec(finesItem, "audit:fines_double", "changed"));
  }

  // ── ⚠ attention — obligations the tool cannot discharge ──
  deltasAttention.forEach((d) =>
    items.push(ackable(d, fromDelta(d, deltaIndex.get(d) ?? -1, "attention", jurisdictionName))),
  );
  // #297: keyed by the check's own label, not its position among the
  // FAILs -- a check that starts passing must not move the next one's id.
  coloradoFails.forEach((c) =>
    items.push({
      id: `audit:colorado:fail:${c.label}`,
      tier: "attention",
      title: c.label,
      result: "FAIL",
      cite: c.citation,
      evidence: c.detail || undefined,
      action: null,
    }),
  );
  if (siteScanItem) items.push(fromItemSpec(siteScanItem, "audit:scan:not_checked", "attention"));
  if (corridorItem) items.push(fromItemSpec(corridorItem, "audit:corridor", "attention"));
  if (geometryItem) items.push(fromItemSpec(geometryItem, "audit:geometry", "attention"));
  if (approachesSpec && approachesSignalized) {
    items.push(fromItemSpec(approachesSpec, "audit:approaches", "attention"));
  }

  return items;
}

// ─── #437 (UX group 2, Option B): NEEDS YOU as one question at a time ───
//
// Authority: validation-artifacts/committed/ux-group2-needs-you/rulings.md,
// rulings 3-7 with Ryan's checkpoint rulings S1-S5.
//
// S5: only a DETECTED scanned condition is a yes/no question, because only
// it has a write that answers one: "Yes" stages `confirmMarker` (S1), "No"
// stages `notThereMarker` (S2).  Ruling 4's order is derived HERE and
// nowhere else: questions whose wire says they changed the plan (their own
// site-adjustment record added or modified devices) first, then the ones
// that only flag; ties keep the scan's bucket order (SCAN_BUCKET_TO_FLAG).
//
// Every consequence line is traced at the checkpoint (§ 2, S3, S4):
//   · a confirm changes nothing (site_scan.py `confirmed`, no pending item);
//   · a dismiss pops the flag, so the adjustment does not run and its
//     `devices_added` come off (site_adjustments.py:366-387);
//   · the intersection and the interchange add 0 devices and leave their
//     layout with the TCS (audit.py:2646-2678).
// The device count is the record's own `devices_added` (Rule 3: no total
// is computed here; S4 dropped the total clause).

export type QuestionAnswer = "yes" | "no";

export interface NeedsYouQuestion {
  flag: ScannedSiteFlag;
  /** The 19 px heading. */
  question: string;
  /** #438 item 2: the short topic the answered row leads with
   *  ("Sidewalks: yes, they're there"). */
  topic: string;
  /** The "Next: …" row's plain title. */
  title: string;
  /** One 13.5 px sentence: what the map showed and what the plan did. */
  explanation: string;
  /** #447 ruling 3: the chip on the map's dashed line. */
  mapLabel: string;
  /** #447 ruling 4: the key's line for it. */
  mapKey: string;
  yes: { label: string; consequence: string };
  no: { label: string; consequence: string };
  /** The site-adjustment record's citation, or null (Rule 10). */
  citation: string | null;
  bucket: ScanBucketWire | null;
  /** Ruling 4: the wire says it changed the plan. */
  changesPlan: boolean;
  /** The answer on screen: staged first, then the applied record. */
  answer: QuestionAnswer | null;
  /** Where the answer lives: staged (not applied yet), applied (the
   *  backend record), or null when unanswered. */
  answerSource: "staged" | "applied" | null;
  /** The applied record, when there is one. */
  record: SiteScanCorrection | null;
}

interface FlagWords {
  question: string;
  topic: string;
  title: string;
  /** "sidewalks" / "an intersection", for the explanation sentence. */
  noun: string;
  plural: boolean;
  /** Why the devices are there; read only when the record added some. */
  purpose: string;
  /** What stays with the TCS when the plan adds no devices (audit.py's
   *  pending-item labels for the two 0-device flags). */
  tcs: string | null;
}

/** #447 ruling 3 and 4 (X5): "<noun> on the map", "<noun> the map knows
 *  about"; "Sidewalk" is the ruling's own word, "Crossing" ruling 2's. */
const MAP_NOUN: Record<ScannedSiteFlag, string> = {
  pedestrian_facility: "Sidewalk",
  adjacent_intersection: "Crossing",
  adjacent_interchange: "Interchange",
  bicycle_facility: "Bike lane",
  school_zone: "School",
};

const FLAG_WORDS: Record<ScannedSiteFlag, FlagWords> = {
  pedestrian_facility: {
    topic: "Sidewalks",
    question: "Are there sidewalks along the work zone?",
    title: "sidewalks along the work zone",
    noun: "sidewalks",
    plural: true,
    purpose: "to protect people walking",
    tcs: null,
  },
  adjacent_intersection: {
    topic: "Intersection",
    question: "Is there an intersection next to the work?",
    title: "an intersection next to the work",
    noun: "an intersection",
    plural: false,
    purpose: "for it",
    tcs: "the cross-street layout stays with your TCS",
  },
  adjacent_interchange: {
    topic: "Highway interchange",
    question: "Is there a highway interchange next to the work?",
    title: "a highway interchange next to the work",
    noun: "a highway interchange",
    plural: false,
    purpose: "for it",
    tcs: "the ramp layout stays with your TCS",
  },
  bicycle_facility: {
    topic: "Bike lane",
    question: "Is there a bike lane along the work zone?",
    title: "a bike lane along the work zone",
    noun: "a bike lane",
    plural: false,
    purpose: "for people on bikes",
    tcs: null,
  },
  school_zone: {
    topic: "School zone",
    question: "Is there a school zone along the work?",
    title: "a school zone along the work",
    noun: "a school zone",
    plural: false,
    purpose: "for the school zone",
    tcs: null,
  },
};

const devicesWord = (n: number) => `${n} device${n === 1 ? "" : "s"}`;

function questionWords(
  flag: ScannedSiteFlag,
  bucket: ScanBucketWire | null,
  rec: SiteAdjustmentRecord | undefined,
): Pick<NeedsYouQuestion, "question" | "topic" | "title" | "explanation" | "yes" | "no"> {
  const w = FLAG_WORDS[flag];
  const ft =
    bucket && typeof bucket.nearest_distance_ft === "number" ? bucket.nearest_distance_ft : null;
  const shows = `The map shows ${w.noun}${ft === null ? " near the work" : ` ${ft} ft from the work`}`;
  const yes = w.plural ? "Yes, they're there" : "Yes, it's there";
  const no = w.plural ? "No, there aren't any" : "No, there isn't one";
  const added = rec ? rec.devices_added : null;
  let explanation: string;
  let yesLine: string;
  let noLine: string;
  if (added !== null && added > 0) {
    const d = devicesWord(added);
    explanation = `${shows}, so we added ${d} ${w.purpose}. Your answer decides whether they stay.`;
    yesLine = `The ${d} ${added === 1 ? "stays" : "stay"} in the plan.`;
    noLine = `The ${d} ${added === 1 ? "comes" : "come"} off the plan.`;
  } else if (added === 0) {
    explanation = w.tcs
      ? `${shows}. The plan adds no devices for it; ${w.tcs}.`
      : `${shows}. The plan adds no devices for it.`;
    yesLine =
      flag === "adjacent_intersection"
        ? "Nothing changes. The TCS still lays out the cross street."
        : "Nothing changes on the plan.";
    noLine = "No devices change. Your answer goes in the audit trail for the TCS to check.";
  } else {
    // No adjustment record on the wire: no device count is stated (Rule 10).
    explanation = `${shows}.`;
    yesLine = "The plan stays as it is.";
    noLine = "The plan is built again without it.";
  }
  return {
    question: w.question,
    topic: w.topic,
    title: w.title,
    explanation,
    yes: { label: yes, consequence: yesLine },
    no: { label: no, consequence: noLine },
  };
}

/** A staged marker's answer: undefined when nothing is staged for the
 *  flag (or it is not a confirm / dismiss), null for a staged Undo. */
function stagedAnswer(s: StagedCorrection | undefined): QuestionAnswer | null | undefined {
  if (!s || !("marker" in s)) return undefined;
  if (s.marker === null) return null;
  if (s.marker.action === "confirm") return "yes";
  if (s.marker.action === "dismiss") return "no";
  return undefined;
}

/** S5 + ruling 4: the questions, in order, from the ONE condition
 *  classification (lib/needs-you-conditions.ts).  A scanned flag is a
 *  question when the scan detected it, or, with no ok scan, when its
 *  applied record is a confirm or a dismiss (only a detected flag takes
 *  either). */
export function buildQuestions(
  rows: readonly ConditionRow[],
  adjustments: readonly SiteAdjustmentRecord[],
  corrections: readonly SiteScanCorrection[] = [],
): NeedsYouQuestion[] {
  const adj = new Map(adjustments.map((r) => [r.flag, r] as const));
  const applied = new Map(corrections.map((c) => [c.flag, c] as const));
  const out: NeedsYouQuestion[] = [];
  for (const r of rows) {
    if (!(r.flag in FLAG_WORDS)) continue;
    const flag = r.flag as ScannedSiteFlag;
    let bucket: ScanBucketWire | null = null;
    let staged: StagedCorrection | undefined;
    if (r.kind === "detected") bucket = r.bucket;
    else if (r.kind === "staged") {
      bucket = r.staged && "marker" in r.staged ? (r.bucket ?? null) : null;
      staged = r.staged;
    } else if (r.kind !== "record") continue;
    // A staged row hides its applied record; the record is still on the scan.
    const record = applied.get(flag) ?? (r.kind === "record" ? r.correction : null);
    const isQuestion =
      bucket?.detected === true ||
      (bucket === null &&
        record !== null &&
        (record.action === "confirm" || record.action === "dismiss"));
    if (!isQuestion) continue;
    const st = stagedAnswer(staged);
    const recAnswer: QuestionAnswer | null =
      record && record.status !== "moot"
        ? record.action === "confirm"
          ? "yes"
          : record.action === "dismiss"
            ? "no"
            : null
        : null;
    const answer = st !== undefined ? st : recAnswer;
    const answerSource: NeedsYouQuestion["answerSource"] =
      st !== undefined ? (st === null ? null : "staged") : recAnswer ? "applied" : null;
    const rec = adj.get(flag);
    out.push({
      flag,
      ...questionWords(flag, bucket, rec),
      mapLabel: `${MAP_NOUN[flag]} on the map`,
      mapKey: `${MAP_NOUN[flag]} the map knows about`,
      citation: rec?.citation || null,
      bucket,
      changesPlan: rec ? rec.devices_added > 0 || (rec.devices_modified ?? 0) > 0 : false,
      answer,
      answerSource,
      record,
    });
  }
  // Ruling 4: changed-the-plan first.  Array.prototype.sort is stable, so
  // ties keep the scan's order.
  return out.sort((a, b) => Number(b.changesPlan) - Number(a.changesPlan));
}

/** The questions still waiting on the plan: unanswered, or answered but
 *  not applied yet.  The verdict strip's N (ruling 2) and, in branch 3,
 *  the downloads' warning row (ruling 11, D6) read this one number. */
export function openQuestionCount(questions: readonly NeedsYouQuestion[]): number {
  return questions.filter((q) => q.answerSource !== "applied").length;
}
