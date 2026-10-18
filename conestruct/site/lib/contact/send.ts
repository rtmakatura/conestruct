// The contact route's config and its one outside call, Resend (#346
// ruling 1), over plain fetch (rulings.md S1).  Every env var is required
// and none has a default in code: unset or malformed, `readConfig`
// answers null and the route refuses (rulings.md S11).

import { sanitizeEnv } from "@/lib/rate-limit";
import type { Config, Email } from "./emails";

export const RESEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000; // CHOSEN (Rule 12): well past a normal send

export type SendConfig = Config & { apiKey: string };

export function readConfig(): SendConfig | null {
  const apiKey = sanitizeEnv(process.env.RESEND_API_KEY);
  const to = sanitizeEnv(process.env.CONTACT_TO);
  const from = sanitizeEnv(process.env.CONTACT_FROM);
  const turnaround = sanitizeEnv(process.env.REPLY_TURNAROUND);
  const days = sanitizeEnv(process.env.REPLY_DUE_BUSINESS_DAYS);
  if (!apiKey || !to || !from || !turnaround || !days || !/^[1-9]\d*$/.test(days)) return null;
  return { apiKey, to, from, turnaround, dueDays: Number(days) };
}

/** True when Resend accepted the email; false on any error or non-2xx. */
export async function send(email: Email, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: email.from,
        to: [email.to],
        reply_to: email.replyTo,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) console.error(`contact: Resend answered ${res.status}`, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("contact: Resend call failed", err);
    return false;
  }
}
