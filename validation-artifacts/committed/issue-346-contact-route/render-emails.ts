// #346: write the three emails, exactly as the route builds them, to
// <out>/ as .html and .txt, from one sample submission and the prompt's
// env values.  Bundled with esbuild (see README.md), so it runs the real
// lib/contact code; nothing is sent.
//
//   node render-emails.cjs <out>

import fs from "node:fs";
import path from "node:path";
import { confirmation, notification, waitlistNotification, type Config } from "../../../conestruct/site/lib/contact/emails";
import { validate } from "../../../conestruct/site/lib/contact/validate";

const out = process.argv[2];
if (!out) throw new Error("usage: node render-emails.cjs <out>");
fs.mkdirSync(out, { recursive: true });

const C: Config = {
  to: "ryan@conestruct.com",
  from: "Ryan at Conestruct <ryan@conestruct.com>",
  turnaround: "2 to 3 business days",
  dueDays: 3,
};
// The sample goes through the real validator first, like a submission.
const job = validate({
  type: "job",
  website: "",
  elapsed_ms: 9000,
  name: "Dana Ortiz",
  company: "Front Range Traffic <script>",
  email: "dana@frtraffic.com",
  phone: "",
  where: "E Colfax Ave & N Race St",
  city: "Denver",
  kind: "Shoulder work",
  side: "South side, eastbound",
  length_ft: "1,000",
  hours: "Daytime",
  notes: "35 mph posted.\nTwo lanes each way; the approved plan closed the curb lane.",
});
const wait = validate({ type: "waitlist", website: "", elapsed_ms: 9000, email: "pat@example.com" });
if (!job.ok || job.value.type !== "job" || !wait.ok || wait.value.type !== "waitlist") throw new Error("sample refused");

const at = new Date("2026-10-17T17:05:00Z"); // Sat 11:05 AM in Denver
for (const [name, e] of [
  ["1-confirmation", confirmation(job.value, C)],
  ["2-notification", notification(job.value, C, at)],
  ["3-waitlist", waitlistNotification(wait.value, C, at)],
] as const) {
  const head = `From: ${e.from}\nTo: ${e.to}\nReply-To: ${e.replyTo}\nSubject: ${e.subject}\n\n`;
  fs.writeFileSync(path.join(out, `${name}.txt`), head + e.text, "utf-8");
  fs.writeFileSync(path.join(out, `${name}.html`), e.html, "utf-8");
  console.log(`${name}: subject ${JSON.stringify(e.subject)} (${[...e.subject].length} chars)`);
}
