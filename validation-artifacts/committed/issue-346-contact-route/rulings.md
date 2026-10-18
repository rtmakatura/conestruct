# #346 rulings

## Ryan's rulings on the checkpoint (2026-10-18), verbatim

Source: https://github.com/rtmakatura/conestruct/issues/346#issuecomment-6252595415

## Rulings on the checkpoint (Ryan, 2026-10-18)

1. **Email service: Resend.** Not Google SMTP: an app password grants the whole mailbox, read access included, and it would sit in Vercel env. A Resend key can only send.
2. **DNS:** Ryan adds SPF, DKIM and DMARC at the registrar, and turns on Google Workspace DKIM as well. Build and test against Resend's test sender; the verified domain gates the ship, not the build. DMARC starts at `p=none` with reports to ryan@conestruct.com, to be tightened later.
3. **Sending address:** "Ryan at Conestruct <ryan@conestruct.com>", Reply-To ryan@conestruct.com.
4. **Bot check:** honeypot + 3-second minimum. No Turnstile unless spam appears.
5. **Rate limit:** 5 an hour per IP, 50 a day global, and this route refuses when the limiter is down. Every refusal (limit, limiter down, send failure) shows the honest inline error with ryan@conestruct.com as the fallback.
6. **/privacy:** Ryan reviews the proposed wording before it ships. CC makes no edits to legal text.

**Scope addition: the waitlist is in.** Same route, `type=waitlist`, with one email field and the same guardrails. It sends one notification to `CONTACT_TO` (subject `Waitlist: {email}`) and no confirmation email. On success the form is replaced by "You're on the list." No "Opening soon" ships on the page.

**Accepted as proposed:** no holiday calendar in the due date; the gate allowlist covers the new route only; the new env vars go on the ship's required list.

Next: `/start 346` in a fresh session.


## R145 self-ruled (CC, 2026-10-18)

S1. **Resend through plain `fetch`, no SDK.** One POST to `https://api.resend.com/emails` per email. It adds no dependency and is easy to stub in tests. Fits ruling 1.

S2. **Notification first, then confirmation.** Nothing is stored, so Ryan's notification is the only record. If it fails, the submitter gets no confirmation and the page shows the error. If the confirmation fails after the notification went out, the route still answers 502 (the prompt: "If either send fails, it answers 502"). A retry can then send Ryan a duplicate. That is the honest failure.

S3. **One limiter bucket for both form types.** The job form and the waitlist share the 5-an-hour per-IP and 50-a-day global counts (ruling 5's "same guardrails"). The global ceiling exists to protect the provider quota and the domain, and both types spend it.

S4. **The 3-second floor is measured on the client.** The form sends `elapsed_ms`, the time since the form mounted, and the route refuses anything under 3,000. No clock is shared, so there's no skew. A bot can forge it; ruling 4 accepts that ("No Turnstile unless spam appears").

S5. **Bot-check failures answer 400 with the same inline error.** No fake success (ruling 5: every refusal shows the honest error; the prompt: no silent success).

S6. **Length caps (CHOSEN, Rule 12).** name 100, company 120, email 254 (RFC 5321's path limit), phone 40, where 200, city 80, side 120, length_ft 12 characters, notes 2,000 (the prompt). Body cap 16 KB. Subjects 80 (the prompt), cut with "…".

S7. **Single-line fields collapse whitespace.** Every control character, CR/LF included, becomes one space. Notes keep their line breaks; other control characters are dropped.

S8. **Native `required` on the required fields.** The browser points to the missing field before the request is sent. The server validates either way.

S9. **Button labels are the reference's.** "Send us the job" and "Join the waitlist" (`design/landing-v2/landing-v2-reference.html:332`, `:354`). While a request is in flight the button reads "Sending…" and is disabled.

S10. **Waitlist notification Reply-To is the submitter.** This matches Email 2's "Hitting reply goes straight to them."

S11. **Config missing answers 503 with the inline error.** Missing means any of the five env vars unset, or `REPLY_DUE_BUSINESS_DAYS` not a positive integer. Nothing has a default in code.

S12. **The env-check fixtures gain five synthetic rows.** `tests/fixtures/vercel-env/*.txt` is the real `vercel env ls production` listing of 2026-09-28. Once the five #346 names are `required`, the "real listing passes" tests need them present. They were added by hand, and the test's docstring says they did not come from a real listing. The real ship still checks the live Production listing, so it stops until Ryan adds them in Vercel.
