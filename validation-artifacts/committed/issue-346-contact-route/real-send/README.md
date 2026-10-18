# #346 real send, 2026-10-18

The two landing forms, filled and submitted in Chromium on a preview with the real env: Resend with conestruct.com verified, and Upstash. Nothing is mocked.

- **Deployment:** `https://conestruct-ht2pelanx-rtmakaturas-projects.vercel.app`. This is `vercel redeploy` of the `1666553` preview (`conestruct-8amtrmisq`), so it picks up the five env vars Ryan added on 2026-10-18. The code is unchanged.
- **Script:** `../real-send.cjs`. Its output is `log.txt`.
- **Test inbox:** Ryan's own, ryan@conestruct.com, through plus-addresses: `ryan+346job@` is the job's submitter and `ryan+346wait@` is the waitlist's. CONTACT_TO's value is hidden in Vercel; the notifications arrived at ryan@conestruct.com.

## The route's answers (log.txt)

| Form | POST /api/contact | What the page showed |
|---|---|---|
| Job | 200 `{"ok":true}` | "Got it. Check your inbox for a confirmation." |
| Waitlist | 200 `{"ok":true}` | "You're on the list." |

## What arrived

The emails were read back through the Gmail API on 2026-10-18. All three were in INBOX, not spam, and all three are dated 2026-10-18T22:04:20Z.

| # | From | To | Subject | Gmail id |
|---|---|---|---|---|
| 1 | ryan@conestruct.com | ryan+346job@conestruct.com | Got your job on E Colfax Ave & N Race St | 1a1510b59ab7dfeb |
| 2 | ryan@conestruct.com | ryan@conestruct.com | Past job: Front Range Traffic · E Colfax Ave & N Race St, Denver | 1a1510b591c67cc4 |
| 3 | ryan@conestruct.com | ryan@conestruct.com | Waitlist: ryan+346wait@conestruct.com | 1a1510b5abbf8e12 |

The three bodies were checked against what the code should produce:
- Each HTML part matches the code's output for this submission. The copies in `received/*.html` are the Gmail API's `htmlBody`, with its CRLF line ends saved as LF.
- Each plain-text part has the same content.
- The due date is right. Sunday Oct 18 plus 3 business days skips nothing but the weekend, so it lands on Wed Oct 21.
- Received times are given in MDT.
- `1,000` passes through as written, and so does the two-line note.
- The missing phone reads "no phone".

## With images blocked (`received/*-images-blocked.png`)

The confirmation shows the signature's alt text ("Ryan Makatura, Founder, Conestruct"). Below it is the 400×200 box that is reserved for the image, so the layout doesn't jump when the image loads. The text signature follows. The two notifications carry no image. The `*.png` copies without `-images-blocked` load the signature from `public/email-signature.png`.

## Not checked here

The Gmail API returns no raw headers, so CC could not check three things:
- the Reply-To header
- the sender's display name, "Ryan at Conestruct"
- the SPF, DKIM and DMARC results

To check them in Gmail, open email 1 or 2 and use ⋮ → "Show original".

**Signature image in production.** `https://conestruct.com/email-signature.png` does not resolve yet:
- Production answers it with 307 to `https://www.conestruct.com/email-signature.png`.
- That URL is a 404 today, because the file ships with this branch.
- After the ship, the image will load through one redirect.

Gmail's image proxy follows redirects. Some other clients may not, and would show the alt text. The URL is the one the spec names (`design/landing-v2/cc-prompt-landing-v2-form.md:43`), so it is unchanged. See rulings.md S13.
