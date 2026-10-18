# cc-prompt-landing-v2-start.md: bring in the landing v2 design, then build the page

**Lane:** light lane (`/` only; copy, layout, CSS, SVG). Build and preview; **do not ship.**

## 1. Bring the design files into the repo
Copy the folder `%USERPROFILE%\conestruct-captures\landing-2026-10-17\landing-v2\` into the repo as `design/landing-v2/`, keeping its `public/` subfolder. Don't move anything into `app/` or `public/` yet; step 2 decides what goes where. Confirm these 10 files arrived:

- `cc-prompt-landing-v2-page.md`, `cc-prompt-landing-v2-form.md`
- `landing-v2-reference.html`, `motion.css`, `illus.py`
- `hero-plan.svg`, `hero-plan-narrow.svg`, `step1-plan.svg`
- `public/colfax-plan-dark.jpg`, `public/email-signature.png`

Commit `design/landing-v2/` on its own branch as reference material, with a message saying it's the approved design from the Oct 17 canvas.

## 2. Build the page
Then run `design/landing-v2/cc-prompt-landing-v2-page.md` in full. It has the source of truth, the spacing system, the interaction rules, the motion ruling to record, the three prerequisites that hold the ship, and the report format.

## 3. Stop there
Don't start `cc-prompt-landing-v2-form.md` in this session. It's a full arc that needs its own issue and a 📋 plan checkpoint. Ryan starts it after reviewing the page preview.

## Report
The `page` prompt's report, plus one line confirming the 10 files landed in `design/landing-v2/` and the commit sha.
