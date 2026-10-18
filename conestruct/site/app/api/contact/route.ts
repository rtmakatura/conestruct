import { NextRequest } from "next/server";
import { confirmation, notification, waitlistNotification } from "@/lib/contact/emails";
import { readConfig, send } from "@/lib/contact/send";
import { validate } from "@/lib/contact/validate";
import { rateLimitStrict } from "@/lib/rate-limit";

// The landing page's two forms post here (#346): `type=job` sends Ryan's
// notification and then the submitter's confirmation; `type=waitlist`
// sends Ryan one notification.  Public through the gate (lib/gate.ts).
// Every refusal is a non-2xx with a short JSON reason; the page shows
// the same honest inline error for each (ruling 5).  Nothing is stored.

const MAX_BODY_BYTES = 16 * 1024; // CHOSEN (rulings.md S6)
// Ruling 5: 5 an hour per IP, 50 a day across everyone, shared by both
// form types (rulings.md S3).
const CAPS = { perIp: { limit: 5, window: "1 h" }, global: { limit: 50, window: "1 d" } } as const;

const refuse = (status: number, reason: string) => Response.json({ ok: false, reason }, { status });

export async function POST(req: NextRequest) {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return refuse(415, "json only");
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY_BYTES) return refuse(413, "too large");

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return refuse(400, "invalid");
  }
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return refuse(413, "too large");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return refuse(400, "invalid");
  }

  const v = validate(body);
  if (!v.ok) return refuse(400, v.field ? `${v.reason}: ${v.field}` : v.reason);

  const config = readConfig();
  if (!config) {
    console.error("contact: config missing or malformed; refusing");
    return refuse(503, "unavailable");
  }

  const limit = await rateLimitStrict(req, "contact", CAPS);
  if (!limit.ok) return limit.reason === "limited" ? refuse(429, "limited") : refuse(503, "unavailable");

  const at = new Date();
  const s = v.value;
  if (s.type === "waitlist") {
    if (!(await send(waitlistNotification(s, config, at), config.apiKey))) return refuse(502, "send failed");
    return Response.json({ ok: true });
  }
  // Ryan's notification first: nothing is stored, so it is the record
  // (rulings.md S2).  Either send failing answers 502.
  if (!(await send(notification(s, config, at), config.apiKey))) return refuse(502, "send failed");
  if (!(await send(confirmation(s, config), config.apiKey))) return refuse(502, "send failed");
  return Response.json({ ok: true });
}
