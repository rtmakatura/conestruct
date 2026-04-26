# Conestruct marketing site

Next.js 14 (App Router) + Tailwind. Lives at `conestruct.com`.

## Local dev

```bash
cd conestruct/site
npm install
npm run dev
```

Opens at http://localhost:3000.

## Stack

- Next.js 14 (App Router, RSC where possible — only Hero and MathSection are `"use client"` for animations and slider state).
- Tailwind v3 with design tokens from `tailwind.config.ts` mirroring `prototypes/styles.css`.
- `Inter` + `JetBrains Mono` via `next/font/google`, exposed as CSS vars `--font-sans` / `--font-mono`.
- Custom CSS in `app/globals.css` for the blueprint grid background, the orange-square range slider thumbs, the `.eyebrow` tick prefix, and `.btn-primary`.

## Deploy to Vercel

1. Push to GitHub.
2. In Vercel, "Add New… → Project" and select the repo.
3. **Set the Root Directory** to `conestruct/site` (the project lives in a subdirectory of the monorepo).
4. Framework preset: Next.js (auto-detected). Build command: `next build`. Install: `npm install`.
5. After the first deploy, Settings → Domains → add `conestruct.com` and `www.conestruct.com`.
6. Update DNS at your registrar:
   - `A` record `@` → `76.76.21.21`
   - `CNAME` record `www` → `cname.vercel-dns.com`

(Or use Vercel-managed nameservers if the domain is registered there.)

## Files ported

- `prototypes/landing.html` + `app.jsx` → `app/page.tsx` + `components/{Nav,SheetMeta,Hero,DimStrip,FinalCTA,Footer}.tsx`
- `prototypes/hero-anim.jsx` → `components/{ScenarioCard,PlanSheet}.tsx` (animation state lives in `Hero.tsx`)
- `prototypes/math-section.jsx` → `components/{MathSection,TaperViz}.tsx`
- `prototypes/styles.css` → `tailwind.config.ts` (tokens) + `app/globals.css` (custom CSS that's awkward in Tailwind)

## Not ported (intentional)

- `tweaks-panel.jsx` — design-time variant switcher. Defaults are baked in (tagline = "Plan. Generate. Go.", logo = wordmark plain, hero = split, color intensity = balanced). Wire as A/B variants or CMS knobs later if needed.
- Generator UI (`gen-*.jsx`, `generator.html`, `app-styles.css`) — separate workstream.
