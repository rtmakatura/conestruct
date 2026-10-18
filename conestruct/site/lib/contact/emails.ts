// The contact route's emails (#346).  Wording, subjects and the signature
// are design/landing-v2/cc-prompt-landing-v2-form.md's; the waitlist
// notification is ruling "Scope addition" (subject `Waitlist: {email}`,
// no confirmation).  Every message has an HTML part and a plain-text part.
// Every user value is escaped before it enters HTML; every subject is
// capped at 80 characters.

import { dueBy, receivedAt } from "./dates";
import type { JobSubmission, WaitlistSubmission } from "./validate";

export type Config = {
  to: string; // CONTACT_TO
  from: string; // CONTACT_FROM
  turnaround: string; // REPLY_TURNAROUND
  dueDays: number; // REPLY_DUE_BUSINESS_DAYS
};

export type Email = { from: string; to: string; replyTo: string; subject: string; html: string; text: string };

export const REPLY_TO = "ryan@conestruct.com";
export const SUBJECT_MAX = 80;
export const SIGNATURE_URL = "https://conestruct.com/email-signature.png";
export const SIGNATURE_ALT = "Ryan Makatura, Founder, Conestruct";
export const SIGNATURE_TEXT = "Ryan Makatura\nFounder, Conestruct\n407-252-2385 · conestruct.com · ryan@conestruct.com";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Cut to 80 characters, the last one an ellipsis when anything was cut. */
export function subject(s: string): string {
  const chars = [...s];
  return chars.length <= SUBJECT_MAX ? s : chars.slice(0, SUBJECT_MAX - 1).join("") + "…";
}

// Plain text is the source of truth; the HTML part is the same lines,
// escaped, one <p> per paragraph and <br> inside one.
function toHtml(text: string): string {
  return text
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function page(inner: string): string {
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a">\n${inner}\n</body></html>`;
}

const firstName = (name: string) => name.split(" ")[0];
const orNone = (s: string) => s || "none";

export function confirmation(s: JobSubmission, c: Config): Email {
  const body = [
    `Hi ${firstName(s.name)},`,
    `Thanks for sending over ${s.where} in ${s.city}. We'll draft it from the road and send back the plan sheet, device list, crew sheet and audit within ${c.turnaround}.`,
    `Have the approved plan for this job? Reply to this email with it attached, and we'll send ours back beside it.`,
    [
      `Here's what you sent us:`,
      `Kind of work: ${s.kind}`,
      `Side of the road: ${s.side}`,
      `Length: ${s.length_ft} ft`,
      `Hours: ${s.hours}`,
      `Notes: ${orNone(s.notes)}`,
    ].join("\n"),
    `If anything's off, just reply and tell me.`,
  ].join("\n\n");
  const signatureHtml =
    `<img src="${SIGNATURE_URL}" width="400" height="200" alt="${escapeHtml(SIGNATURE_ALT)}" style="display:block;border:0;width:400px;height:200px">\n` +
    toHtml(SIGNATURE_TEXT);
  return {
    from: c.from,
    to: s.email,
    replyTo: REPLY_TO,
    subject: subject(`Got your job on ${s.where}`),
    html: page(`${toHtml(body)}\n${signatureHtml}`),
    text: `${body}\n\n${SIGNATURE_TEXT}\n`,
  };
}

export function notification(s: JobSubmission, c: Config, at: Date): Email {
  const text = [
    [`${s.name}, ${s.company}`, `${s.email} · ${s.phone || "no phone"}`].join("\n"),
    [
      `Where: ${s.where}, ${s.city}`,
      `Kind of work: ${s.kind}`,
      `Side: ${s.side} · Length: ${s.length_ft} ft · Hours: ${s.hours}`,
      `Notes: ${orNone(s.notes)}`,
    ].join("\n"),
    [
      `Received ${receivedAt(at)}. Due back by ${dueBy(at, c.dueDays)} (${c.turnaround}).`,
      `Hitting reply goes straight to them.`,
    ].join("\n"),
  ].join("\n\n");
  return {
    from: c.from,
    to: c.to,
    replyTo: s.email,
    subject: subject(`Past job: ${s.company} · ${s.where}, ${s.city}`),
    html: page(toHtml(text)),
    text: `${text}\n`,
  };
}

export function waitlistNotification(s: WaitlistSubmission, c: Config, at: Date): Email {
  const text = [
    `${s.email} joined the waitlist.`,
    [`Received ${receivedAt(at)}.`, `Hitting reply goes straight to them.`].join("\n"),
  ].join("\n\n");
  return {
    from: c.from,
    to: c.to,
    replyTo: s.email,
    subject: subject(`Waitlist: ${s.email}`),
    html: page(toHtml(text)),
    text: `${text}\n`,
  };
}
