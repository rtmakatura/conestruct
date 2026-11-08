// #443 rulings 6-8: the search over the sections' data model (X4).  Pure,
// on the page, no backend call.  It reads the same strings the rows draw.

import { nicknameTerms } from "./reference-nicknames";
import { detailLists, type RowDetail } from "./row-detail";

export interface SearchableRow {
  id: string;
  title: string;
  result?: string;
  detail: RowDetail;
}
export interface SearchableSection {
  id: string;
  name: string;
  groups: { rows: SearchableRow[] }[];
}

export interface RowHit {
  /** X20: a match in a sentence, value or list opens the row. */
  inside: boolean;
  /** A match in the source shows the Source line under the title. */
  inSource: boolean;
  /** Which lines of `detail.list` match; null when no line does. */
  listLines: number[] | null;
  /** #453 ruling 2: the matching lines of every list (`detailLists` order). */
  lists: number[][];
  /** #453 ruling 2 (repair 1): the matching sentences and label-value rows. */
  sentences: number[];
  pairs: number[];
}

export interface SectionHit {
  rows: Map<string, RowHit>;
  total: number;
}

export interface SearchResult {
  matcher: RegExp;
  sections: Map<string, SectionHit>;
  count: number;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The one matcher: the typed text, any case, part of a word, plus its nicknames. */
export function buildMatcher(query: string): RegExp | null {
  const q = query.trim();
  if (!q) return null;
  return new RegExp([escapeRegExp(q), ...nicknameTerms(q)].join("|"), "gi");
}

function hits(matcher: RegExp, text: string | undefined): boolean {
  if (!text) return false;
  matcher.lastIndex = 0;
  return matcher.test(text);
}

function searchRow(row: SearchableRow, m: RegExp): RowHit | null {
  const d = row.detail;
  const lineText = (l: { text: string; value?: string; sub?: string }) =>
    hits(m, l.text) || hits(m, l.value) || hits(m, l.sub);
  const lists = detailLists(d).map((list) => list.lines.flatMap((l, i) => (lineText(l) ? [i] : [])));
  const first = d.list ? lists[0] : [];
  const listLines = first.length > 0 ? first : null;
  const sentences = (d.sentences ?? []).flatMap((s, i) => (hits(m, s) ? [i] : []));
  // X10: the label and value are one wire line, and the whole line stays findable.
  const pairs = (d.pairs ?? []).flatMap((p, i) =>
    hits(m, p.label) || hits(m, p.value) || hits(m, `${p.label} = ${p.value}`) ? [i] : [],
  );
  const inside =
    lists.some((l) => l.length > 0) ||
    sentences.length > 0 ||
    pairs.length > 0 ||
    (d.links ?? []).some((l) => hits(m, l.label));
  const inSource = hits(m, d.source);
  if (!inside && !inSource && !hits(m, row.title) && !hits(m, row.result)) return null;
  return { inside, inSource, listLines, lists, sentences, pairs };
}

export function searchSections(
  sections: readonly SearchableSection[],
  query: string,
): SearchResult | null {
  const matcher = buildMatcher(query);
  if (!matcher) return null;
  const out = new Map<string, SectionHit>();
  let count = 0;
  for (const s of sections) {
    const rows = new Map<string, RowHit>();
    let total = 0;
    for (const g of s.groups) {
      for (const row of g.rows) {
        total += 1;
        const h = searchRow(row, matcher);
        if (h) rows.set(row.id, h);
      }
    }
    out.set(s.id, { rows, total });
    count += rows.size;
  }
  return { matcher, sections: out, count };
}

/** Ruling 7's status line.  X1: a line is one row. */
export function statusLine(
  sections: readonly SearchableSection[],
  result: SearchResult,
): { lead: string; where: string | null } {
  const n = result.count;
  const lead = `${n} matching line${n === 1 ? "" : "s"}`;
  const withHits = sections.filter((s) => (result.sections.get(s.id)?.rows.size ?? 0) > 0);
  if (withHits.length === 1) {
    return { lead: n === 1 ? `${lead}, in ` : `${lead}, all in `, where: withHits[0].name };
  }
  return { lead: `${lead}, in ${withHits.length} sections`, where: null };
}

/** X18: the candidates, in order; only those that hit this plan; first 5. */
export const CHIP_CANDIDATES = [
  "taper",
  "buffer",
  "sidewalk",
  "work hours",
  "fines",
  "permit",
  "spacing",
  "signs",
] as const;

export function planChips(sections: readonly SearchableSection[]): string[] {
  return CHIP_CANDIDATES.filter((c) => (searchSections(sections, c)?.count ?? 0) > 0).slice(0, 5);
}
