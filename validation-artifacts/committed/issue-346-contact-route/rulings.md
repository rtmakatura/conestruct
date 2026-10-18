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

## Real send (2026-10-18, second session)

Ryan, 2026-10-18 (the `/start 346` message): "Resend is set up: conestruct.com is Verified, and SPF, DKIM (Resend + Workspace) and DMARC p=none are live. All five env vars are now in Vercel, in Production and Preview. … The landing-v2-page holds block only the ship, so they don't block this session. Finish the form and run the real test submission. Don't ship."

S13. **R145 self-ruled: the test inbox is Ryan's own, by plus-address, and the signature URL stays as the spec names it.**
- `ryan+346job@` and `ryan+346wait@conestruct.com` deliver to the inbox that also gets CONTACT_TO. One mailbox therefore shows all three emails, and no outside address receives test mail.
- `https://conestruct.com/email-signature.png` answers 307 to `www` in production. Changing it would depart from `design/landing-v2/cc-prompt-landing-v2-form.md:43`, so it is flagged to Ryan, not changed (real-send/README.md).

## Ryan's rulings, 2026-10-18 (after the real send)

1. "Signature image: change the URL to https://www.conestruct.com/email-signature.png. Record it as a ruling that amends cc-prompt-landing-v2-form.md:43."
2. "/privacy: add this section as written, with no rewording" (the section text is in `conestruct/site/app/privacy/page.tsx`, pinned by `app/privacy/page.test.tsx`). "First check the Upstash sentence against lib/rate-limit.ts … If my wording is wrong, stop and tell me before you add it."
3. "Header check is done: From, Reply-To, SPF, DKIM and DMARC pass on both emails (Ryan checked the raw headers). Mark that item closed. Don't ship."

S14. **Ruling 1 amends `design/landing-v2/cc-prompt-landing-v2-form.md:43`.** The signature image is `https://www.conestruct.com/email-signature.png`. Production sends the apex to `www` with a 307, so this drops the redirect hop that some mail clients won't follow. `SIGNATURE_URL` (`lib/contact/emails.ts:22`) and its test now use it. The prompt file is unchanged; this entry is the amendment. `emails/1-confirmation.html` was re-rendered from the code, and the other fixtures and all PNGs came out byte-identical. `real-send/received/` keeps the apex URL, because that is what was sent on 2026-10-18.

S15. **R145 self-ruled: how the /privacy section is placed.** It is checked first, then placed.
- **The Upstash sentence is accurate.** The limiter keys on the raw client IP, not a hash: the first `x-forwarded-for` entry (`lib/rate-limit.ts:125-131`), passed to `.limit()` at `:204`. Upstash stores it in the key name `ratelimit:contact:ip:<IP>:<bucket>` and sets `PEXPIRE` to the window on the bucket's first hit (`@upstash/ratelimit` 2.0.8, `dist/index.js:198-202`). The contact window is 1 hour, so each key lives at most 1 hour. Analytics are off (`:184`). "keeps your IP address for a short time" is true, and nothing in it claims hashing.
- **Placement.** The text is one string constant, rendered as one plain paragraph after the placeholder's interim list. It has no bold or heading of its own, because the page has no section headings to match.
- **Left unchanged:** the DRAFT label and `TERMS_VERSION`. `TERMS_VERSION` is shared with /terms, so changing it is not CC's call.
- **Flagged to Ryan, not changed:** /privacy names no contact address anywhere else, and its interim line "You may request deletion…" gives no address. `safety@conestruct.com` appears nowhere in the code. Every address the site shows is `ryan@conestruct.com` (`components/landing/Landing.tsx:18`, `components/landing/useContactSubmit.ts:14`, `lib/coming-soon-copy.ts:13`, the emails' Reply-To and signature).

S16. **The header check is closed (ruling 3).** Ryan read the raw headers on both emails: From, Reply-To, SPF, DKIM and DMARC all pass. `real-send/README.md` marks it closed.

## Ryan's address ruling, 2026-10-18

"safety@conestruct.com is the privacy/deletion contact only. Everything else stays ryan@conestruct.com. No changes outside /privacy. In /privacy: 1. Make the existing "You may request deletion…" line name safety@conestruct.com. 2. In the form section, change "for a short time" to "for up to an hour". Record it as one ruling. Don't ship."

S17. **Applied as ruled, and only on /privacy.**
- The interim line now reads "You may request deletion of your account and plan data at any time by emailing safety@conestruct.com." Ryan's ruling named the address but not the words, so "by emailing" is CC's.
- The form section now says "keeps your IP address for up to an hour". That matches S15: each limiter key expires within the 1-hour window.
- `app/privacy/page.test.tsx` pins both.
- `ryan@conestruct.com` is unchanged everywhere else.
