# Design Instructions for Conestruct

## What I need designed

I'm building a traffic control plan generation tool called **Conestruct** (conestruct.com). I need a landing page and overall web design system. The tool is currently a Streamlit app — I need the design to either inform a future rebuild in Next.js/React or to guide Streamlit theming as closely as possible.

## Priority deliverables

### 1. Landing page design
A single-page marketing site at conestruct.com with:
- **Hero section:** Bold headline, one-sentence value prop, orange CTA button ("Try the Generator" or "Generate a Plan Now"), subtle illustration or visual showing a schematic road with cones/drums
- **How it works:** 3-step visual (Describe → Generate → Download)
- **Features/value props:** 3 cards — "Instant MHT Packages", "Full Audit Trail", "CDOT Compliant"
- **Social proof placeholder:** "Built for Colorado TCS professionals" + logos/badges area
- **CTA section:** Repeat the main call to action
- **Footer:** Links, legal, "Conestruct © 2026"

### 2. App UI mockup (optional, lower priority)
How the generator tool should look if rebuilt as a custom web app (not Streamlit):
- Left panel: scenario input form
- Right panel: generated output with tabs (Plan Sheet / Device List / Crew Instructions / Audit Trail)
- Download bar at top of output panel

## Brand context
See the attached brand brief (conestruct_brand_brief.md) for full color palette, typography, tone, and competitive positioning.

## Key constraints
- Mobile-responsive (TCS may access from a phone on the job site)
- Fast-loading (minimal images, no heavy frameworks)
- Accessible (high contrast, readable at arm's length)
- The orange (#E8710A) should be prominent but not overwhelming — use it for CTAs and key accents, not as a background color on large areas
- Dark navy (#1B2838) for text and header/nav backgrounds
- Warm beige (#F5F0EB) for the page background — distinguishes from generic white SaaS sites

## What NOT to do
- No generic SaaS template feel (gradient blobs, abstract illustrations)
- No clipart or stock photos of construction workers
- No overly playful tone — this is a professional tool
- No dark mode for V1 (focus on light theme only)

## Reference files attached
- conestruct_brand_brief.md — full brand system
- test_plan_v3.pdf — example generated plan sheet (shows the product output)
- test_plan_flagger_v1.pdf — second example (different scenario)
- device_list.xlsx — example device list output
