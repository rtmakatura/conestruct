# #346 checkpoint (the issue body, posted 2026-10-18)

Source: https://github.com/rtmakatura/conestruct/issues/346 (body, verbatim).

## What's wrong

The landing v2 page (branch `landing-v2-page`, not yet shipped) has a "Send us a past job" form whose button is disabled and reads "Opening soon". Nothing receives a submission. The design (`design/landing-v2/cc-prompt-landing-v2-form.md`) asks for one route that validates, rate-limits, and sends two emails: a confirmation to the submitter and a notification to Ryan. No uploads, no store.

## What the investigation found

- **No email provider in the stack.** No Resend, SendGrid, Postmark or SMTP package; no mail env var.
- **conestruct.com mail is Google Workspace** (MX `smtp.google.com`). The domain has **no SPF and no DMARC record** (only a google-site-verification TXT). Mail sent as `ryan@conestruct.com` from any service will land in spam, or be rejected, until DNS records are added.
- **Rate limiting exists.** `lib/rate-limit.ts` (Upstash, per IP) offers per-minute caps only, and **fails open** by design (#145) so the sandbox never goes down.
- **The gate blocks every `/api/*` path** not in `PUBLIC_EXACT` (`lib/gate.ts:19`). The new route has to be added there, which is a gate change.
- **The ship's env check** reads `scripts/production-env.txt`; a `required` name missing from Production stops the ship (#303).
- **`/privacy`** covers account and plan data only. It says nothing about the form, email, or plans sent by reply.
- `design/landing-v2/public/email-signature.png` is 800×400, as the prompt wants. The middleware matcher skips `.png`, so `/email-signature.png` is served without the gate.

## 📋 Plan (checkpoint: needs Ryan's rulings before any code)

**Rulings needed (R145 stops: outside service, money, DNS, legal)**
1. **Provider.** Recommend **Resend**: an HTTP API (no SMTP from serverless), free tier 3,000 a month / 100 a day, and it verifies conestruct.com with DKIM plus an SPF record on a `send.` subdomain, so Google Workspace MX is untouched. Alternative: Google Workspace SMTP through nodemailer with an app password (no new vendor; sent mail appears in Ryan's Sent folder; needs 2-step verification, app passwords allowed in the admin console, and Google DKIM turned on).
2. **DNS, either way.** Add SPF for Google (`v=spf1 include:_spf.google.com ~all`), the provider's DKIM record, and a DMARC record (start at `p=none`). Ryan does this at the registrar.
3. **Sender.** `CONTACT_FROM="Ryan at Conestruct <ryan@conestruct.com>"` once the domain verifies. Replies go to Ryan's real inbox either way.
4. **Bot check.** Recommend a **honeypot field plus a time-to-submit floor (3 s)**. No outside service, no cookie, nothing new for `/privacy`. Turnstile is stronger, but it adds Cloudflare as a processor and a script on `/`. Revisit if spam shows up.
5. **Rate limit fails closed on this route.** 5 an hour per IP, plus a global ceiling (e.g. 50 a day) so a botnet can't burn the provider quota or the domain's reputation. If Upstash is unreachable, this route refuses with the honest error, unlike the sandbox routes. This needs a per-hour, fail-closed option added to `lib/rate-limit.ts` without changing the existing callers.

**Build (after the rulings)**
- `app/api/contact/route.ts`: POST JSON only, reject unknown fields, trim and cap every string, validate per the prompt (`length_ft` a positive integer with commas allowed, `notes` ≤ 2,000), honeypot and time check, then the rate limit, then two sends. If either send fails, it answers 502 and the page shows the error (no silent success).
- `lib/contact/`: the field schema and validator, HTML escaping, both emails' HTML and plain-text bodies, subjects capped at 80 characters, and a business-day due-date helper (America/Denver, weekends skipped; **holidays are not skipped**, as written in the prompt).
- `lib/gate.ts`: add `/api/contact` to `PUBLIC_EXACT`.
- `components/landing/CompareForm.tsx`: enable the submit, post, show the inline error ("That didn't send. Try again, or email ryan@conestruct.com.") or swap in the confirmation ("Got it. Check your inbox for a confirmation."). The waitlist form stays "Opening soon"; it's not in this prompt.
- `public/email-signature.png` from `design/landing-v2/public/`.
- Env: `CONTACT_TO`, `CONTACT_FROM`, `REPLY_TURNAROUND`, `REPLY_DUE_BUSINESS_DAYS` and the provider key are added as `required` in `scripts/production-env.txt` and `.env.example`. `REPLY_TURNAROUND` has no default in code; unset, the route refuses.
- Tests: validator, escaping, subject caps, the business-day helper, a mounted route test (rate limit, fail-closed, unknown field, bot checks, send failure gives 502), and the mounted form flow (error and success states).
- Evidence: one real submission to a test inbox showing both emails, HTML and plain text, with images blocked.

**Privacy: gaps and proposed wording (Ryan rules; CC doesn't edit legal text)**
- Gap: what the form collects. Proposed: "If you send us a past job through the form on our home page, we collect your name, company, email, phone (if you give it), the job's location, and the job details you enter."
- Gap: how it's used. Proposed: "That submission is emailed to Conestruct and used only to draft your comparison plan. We don't store it in our database."
- Gap: approved plans by reply. Proposed: "If you reply with your approved plan attached, it reaches us by email and is used only for the comparison."
- Gap: the email provider as a service provider. The existing "service providers" line should name email delivery once the provider is ruled.

## Stacking

This arc builds on `landing-v2-page` (preview only, held), so both ship together.

Refs: `design/landing-v2/cc-prompt-landing-v2-form.md`

