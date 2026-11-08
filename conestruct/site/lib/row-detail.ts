// #443 ruling 2: what a row's opened detail holds, as data.
//
// A sentence or two, then label-value rows, then one "Source: ..." line.
// Nothing here opens again.  Plain strings so the search box can read a
// closed row without rendering it (X4); `extra` and `actions` are the two
// slots search doesn't read.

import type { ReactNode } from "react";

export interface DetailPair {
  label: string;
  value: string;
  /** Numbers read in mono (ruling 2). */
  mono?: boolean;
}

/** One line of a long list: a device type, a sign, a rule. */
export interface DetailLine {
  text: string;
  value?: string;
  /** The line's own source or evidence. */
  sub?: string;
}

export interface DetailList {
  /** "2 of 11 device types shown" / "Show all 11 types". */
  noun: { one: string; many: string };
  lines: DetailLine[];
}

export interface DetailLink {
  href: string;
  label: string;
}

export interface RowDetail {
  sentences?: string[];
  pairs?: DetailPair[];
  list?: DetailList;
  /** #453 X7: lists after `list` (the Permit's notices, then its fees). */
  lists?: DetailList[];
  links?: DetailLink[];
  /** The text after "Source: ", read off the wire. */
  source?: string;
  /** A drawing that holds no text search needs (the hours bars, X15). */
  extra?: ReactNode;
  /** A signpost or Retry: navigates or recovers, never opens a level (X17). */
  actions?: ReactNode;
}

/**
 * X10: a wire formula line as a label-value row.  The label is the wire's
 * own symbol left of the first " = "; a display split, no arithmetic
 * (Rule 3).  A line with no " = " draws value-only.
 */
export function formulaPairs(lines: readonly string[]): DetailPair[] {
  return lines.map((line) => {
    const at = line.indexOf(" = ");
    return at === -1
      ? { label: "", value: line, mono: true }
      : { label: line.slice(0, at), value: line.slice(at + 3), mono: true };
  });
}

/** X10: "L/3 = 50 ft" reads "50 ft" in the row; the full line stays in the detail. */
export function resultValue(result: string): string {
  const at = result.indexOf(" = ");
  return at === -1 ? result : result.slice(at + 3);
}

/** #453: every list in a detail, `list` first. */
export function detailLists(d: RowDetail): DetailList[] {
  return [...(d.list ? [d.list] : []), ...(d.lists ?? [])];
}
