// The contact route's wire shape and its server-side validation (#346).
// Field names and the required/optional split are
// design/landing-v2/cc-prompt-landing-v2-form.md's; the length caps are
// CHOSEN (Rule 12; rulings.md S6) except notes (≤ 2,000, the prompt) and
// email (254, RFC 5321's path limit less its angle brackets).
//
// Shared by the route and the forms: the forms post exactly these keys.

export const KINDS = [
  "Shoulder work",
  "Flagger lane closure",
  "Lane closure near an intersection",
  "Something else",
] as const;
export const HOURS = ["Daytime", "Night"] as const;

/** The honeypot's field name.  Hidden from people; a bot fills it. */
export const HONEYPOT = "website";
/** Ruling 4: a submission sent under 3 s after the form mounted is refused. */
export const MIN_ELAPSED_MS = 3000;

export const CAPS = {
  name: 100,
  company: 120,
  email: 254,
  phone: 40,
  where: 200,
  city: 80,
  side: 120,
  length_ft: 12,
  notes: 2000,
} as const;

export type JobSubmission = {
  type: "job";
  name: string;
  company: string;
  email: string;
  phone: string; // "" when not given
  where: string;
  city: string;
  kind: (typeof KINDS)[number];
  side: string;
  length_ft: string; // as typed, digits and commas
  hours: (typeof HOURS)[number];
  notes: string; // "" when not given
};
export type WaitlistSubmission = { type: "waitlist"; email: string };
export type Submission = JobSubmission | WaitlistSubmission;

export type Invalid = { ok: false; reason: "invalid" | "bot"; field?: string };
export type Validated = { ok: true; value: Submission } | Invalid;

const JOB_KEYS = new Set([
  "type", HONEYPOT, "elapsed_ms",
  "name", "company", "email", "phone", "where", "city", "kind", "side", "length_ft", "hours", "notes",
]);
const WAITLIST_KEYS = new Set(["type", HONEYPOT, "elapsed_ms", "email"]);

// Every C0/C1 control character (CR and LF included) and the Unicode
// line/paragraph separators.  Single-line fields turn each run of these,
// and of whitespace, into one space (rulings.md S7).
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

export function oneLine(s: string): string {
  return s.replace(CONTROL, " ").replace(/\s+/g, " ").trim();
}

/** Notes keep their line breaks (normalised to \n); other controls go. */
export function multiLine(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]/g, "")
    .trim();
}

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
// A positive integer, with commas allowed as thousands separators.
const LENGTH = /^(\d+|\d{1,3}(,\d{3})+)$/;

type Body = Record<string, unknown>;

function text(body: Body, key: keyof typeof CAPS, required: boolean, multi = false): string | Invalid {
  const raw = body[key];
  if (raw === undefined || raw === null) return required ? { ok: false, reason: "invalid", field: key } : "";
  if (typeof raw !== "string") return { ok: false, reason: "invalid", field: key };
  const v = multi ? multiLine(raw) : oneLine(raw);
  if (v.length > CAPS[key]) return { ok: false, reason: "invalid", field: key };
  if (required && !v) return { ok: false, reason: "invalid", field: key };
  return v;
}

const bad = (x: unknown): x is Invalid => typeof x === "object" && x !== null;

function botCheck(body: Body): Invalid | null {
  const pot = body[HONEYPOT];
  if (pot !== undefined && pot !== "") return { ok: false, reason: "bot" };
  const elapsed = body.elapsed_ms;
  if (typeof elapsed !== "number" || !Number.isFinite(elapsed) || elapsed < MIN_ELAPSED_MS)
    return { ok: false, reason: "bot" };
  return null;
}

function email(body: Body): string | Invalid {
  const v = text(body, "email", true);
  if (bad(v)) return v;
  return EMAIL.test(v) ? v : { ok: false, reason: "invalid", field: "email" };
}

export function validate(input: unknown): Validated {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, reason: "invalid" };
  const body = input as Body;
  const type = body.type;
  const keys = type === "job" ? JOB_KEYS : type === "waitlist" ? WAITLIST_KEYS : null;
  if (!keys) return { ok: false, reason: "invalid", field: "type" };
  for (const k of Object.keys(body)) if (!keys.has(k)) return { ok: false, reason: "invalid", field: k };

  const bot = botCheck(body);
  if (bot) return bot;

  const mail = email(body);
  if (bad(mail)) return mail;
  if (type === "waitlist") return { ok: true, value: { type: "waitlist", email: mail } };

  const fields = {
    name: text(body, "name", true),
    company: text(body, "company", true),
    phone: text(body, "phone", false),
    where: text(body, "where", true),
    city: text(body, "city", true),
    side: text(body, "side", true),
    length_ft: text(body, "length_ft", true),
    notes: text(body, "notes", false, true),
  };
  for (const v of Object.values(fields)) if (bad(v)) return v;
  const f = fields as Record<keyof typeof fields, string>;

  if (!LENGTH.test(f.length_ft) || Number(f.length_ft.replace(/,/g, "")) <= 0)
    return { ok: false, reason: "invalid", field: "length_ft" };
  const kind = KINDS.find((k) => k === body.kind);
  if (!kind) return { ok: false, reason: "invalid", field: "kind" };
  const hours = HOURS.find((h) => h === body.hours);
  if (!hours) return { ok: false, reason: "invalid", field: "hours" };

  return { ok: true, value: { type: "job", ...f, email: mail, kind, hours } };
}
