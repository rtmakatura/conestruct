# cc-prompt-landing-v2-form.md: "Send us a past job" submissions + emails

**Lane:** full arc. This adds an API route and sends email, so it needs its own issue and a 📋 plan checkpoint before any code. Investigate first: which email provider (if any) the stack already uses, and how Vercel env vars are set (remember #303: the ship stops when Production lacks a needed variable).

## What it does
The landing page form posts to one route. The route validates, rate-limits, then sends two emails: a confirmation to the submitter and a notification to Ryan. **No file uploads.** Nothing is stored beyond what email providers keep. If you think a store is needed (for retries, say), raise it at the checkpoint.

## The form fields (from `design/landing-v2/landing-v2-reference.html`, section 07)
`name` (required) · `company` (required) · `email` (required, valid) · `phone` (optional) · `where` (required, "address or cross streets") · `city` (required) · `kind` (required: Shoulder work | Flagger lane closure | Lane closure near an intersection | Something else) · `side` (required) · `length_ft` (required, positive integer, allow commas) · `hours` (required: Daytime | Night) · `notes` (optional, ≤ 2,000 chars).

## Guardrails
- Server-side validation of every field; trim; cap every string's length; reject unknown fields.
- Rate limit per IP (e.g. 5 an hour) and a bot check (Cloudflare Turnstile or a honeypot plus a time-to-submit check). Say which at the checkpoint.
- Escape every user value before it goes into HTML email. Never put user input in a subject line unescaped or unbounded (cap at 80 chars).
- Errors: an honest inline message on the page ("That didn't send. Try again, or email ryan@conestruct.com."). No silent success.
- On success: replace the form with a short confirmation in place: "Got it. Check your inbox for a confirmation."

## Config (env; the ship must stop if any are missing in Production)
`CONTACT_TO=ryan@conestruct.com` · `CONTACT_FROM="Ryan at Conestruct <ryan@conestruct.com>"` (or a verified sending address you recommend) · `REPLY_TURNAROUND="2 to 3 business days"` (set by Ryan, Oct 17; required, no fallback default in code). The confirmation email promises it. `REPLY_DUE_BUSINESS_DAYS=3` drives the due date in Ryan's notification, counted in business days from receipt, America/Denver, skipping weekends.

## Email 1: confirmation, to the submitter
From `CONTACT_FROM` · Reply-To `ryan@conestruct.com` · Subject: `Got your job on {where}`

```
Hi {first name},

Thanks for sending over {where} in {city}. We'll draft it from the road and send back the plan sheet, device list, crew sheet and audit within {REPLY_TURNAROUND}.

Have the approved plan for this job? Reply to this email with it attached, and we'll send ours back beside it.

Here's what you sent us:
Kind of work: {kind}
Side of the road: {side}
Length: {length_ft} ft
Hours: {hours}
Notes: {notes, or "none"}

If anything's off, just reply and tell me.

[signature]
```

**Signature:** the image `https://conestruct.com/email-signature.png` (ship `design/landing-v2/public/email-signature.png` to `public/`), exported at 800×400 and shown at 400×200 so it stays sharp on high-resolution screens, with alt text "Ryan Makatura, Founder, Conestruct". Under it, always include the plain-text version, because many inboxes block images:
```
Ryan Makatura
Founder, Conestruct
407-252-2385 · conestruct.com · ryan@conestruct.com
```
Send both an HTML part and a plain-text part. The plain-text part uses the text signature only.

## Email 2: notification, to Ryan
To `CONTACT_TO` · Reply-To = the submitter's email · Subject: `Past job: {company} · {where}, {city}`

```
{name}, {company}
{email} · {phone, or "no phone"}

Where: {where}, {city}
Kind of work: {kind}
Side: {side} · Length: {length_ft} ft · Hours: {hours}
Notes: {notes}

Received {date and time, America/Denver}. Due back by {receipt + REPLY_DUE_BUSINESS_DAYS business days, e.g. "Wed Oct 21"} ({REPLY_TURNAROUND}).
Hitting reply goes straight to them.
```
No signature on this one.

## Privacy
`/privacy` must cover: what the form collects, that it's emailed to Conestruct and used only to draft the comparison, and that approved plans arrive by email reply. Flag the gaps and propose wording for Ryan. Don't edit legal text yourself.

## Report
The checkpoint plan first (provider, bot check, env vars, files touched). After the build: one real test submission to a test inbox showing both emails (HTML + plain text, with images blocked), the rate-limit and validation tests, and the privacy gaps list.
