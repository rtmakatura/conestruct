// #443 ruling 6 / X19: the search box's nicknames, in one small table.
// Each entry names a word people say and the term the plan's text uses.
// reference-nicknames.test.ts ties every entry to real wire text.

export interface Nickname {
  nick: string;
  /** Regex source, matched without case. */
  term: string;
}

export const NICKNAMES: readonly Nickname[] = [
  { nick: "cone", term: "channeliz" },
  { nick: "barrel", term: "channeliz" },
  { nick: "tube", term: "channeliz" },
  // A sign code: R9-9, G20-5P, W21-1A.
  { nick: "sign", term: "\\b[A-Z]{1,2}\\d{1,2}-\\d{1,2}[A-Za-z]*\\b" },
  { nick: "barricade", term: "type iii" },
  { nick: "bike", term: "bicycle" },
  { nick: "ped", term: "pedestrian" },
  { nick: "ticket", term: "fine" },
  { nick: "penalty", term: "fine" },
  { nick: "hours", term: "window" },
  { nick: "fee", term: "permit" },
  { nick: "cost", term: "permit" },
];

/** The nickname terms a typed query reaches.  "cones" and "con" both reach "cone". */
export function nicknameTerms(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];
  return NICKNAMES.filter((n) => q.startsWith(n.nick) || n.nick.startsWith(q)).map((n) => n.term);
}
