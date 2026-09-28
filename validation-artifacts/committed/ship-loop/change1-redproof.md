# ship-loop Change 1 — red-proof: a preview Ryan can sign into (R6, R18–R22)

Measured 2026-09-28. Plan: `checkpoint-1.md`. Rulings: `rulings.md` (R18–R22).
No gate, backend, `ship.ps1` or hook code changed; the only product-side change is Vercel
env scoping, done by Ryan in the dashboard (the 12 steps in `checkpoint-1.md`).

## Throwaway branch

`ship-loop-1-redproof`, cut from `ship-loop-1` at `bfd93f9`. Two commits, each one comment
line in `conestruct/site/lib/rate-limit.ts` so Vercel builds a preview:

- `e272091009fd749d1f29ff23c079b3c986dae9cd`: first build.
- `6846e34`: rebuild after the Clerk rows were fixed (below). Recovery sha of the branch tip.

Ryan deletes `origin/ship-loop-1-redproof` (R22).

## Dashboard answers (Ryan)

- Step 9: `MODAL_RENDER_URL`, `MODAL_RENDER_SECRET`, `MAPBOX_TOKEN`, `NEXT_PUBLIC_MAPBOX_TOKEN`
  were all already on Preview; none needed ticking.
- Step 11: Git Fork Protection is on. Whether it was already on is unrecorded.
- The `vercel env ls` read was not done (no CLI login on this machine; Ryan said skip the env pulls).

## Run 1: `e272091`, RED (the dashboard change had not taken)

`preview-url.ps1 -Branch ship-loop-1-redproof`, exit 0:

    preview: https://conestruct-7zpz6gnts-rtmakaturas-projects.vercel.app -- serves e272091 = branch tip (checked in the bundle); frontend-only: no

| Check | Expected | Measured |
|---|---|---|
| signed-out `/sandbox` | 307 → `/` | 307 → `/` |
| signed-out `/api/render/audit` | 401 | 401 |
| Clerk key on `/sign-in` | `pk_test_` | **`pk_live_`**, host `clerk.conestruct.com` |
| `GET https://clerk.conestruct.com/v1/environment`, `Origin:` the preview | not rejected | **400** (`www.conestruct.com` origin: 200) |

The preview still carried the production Clerk key, so sign-in there could not work. Ryan fixed
the two Clerk rows (live keys Production only, dev keys Preview only). This is the red half: the
check catches a preview that is not on the dev instance.

## Run 2: `6846e34`, GREEN

`preview-url.ps1 -Branch ship-loop-1-redproof`, exit 0 (about 2.5 min):

    preview: https://conestruct-ifiw9w7i6-rtmakaturas-projects.vercel.app -- serves 6846e34 = branch tip (checked in the bundle); frontend-only: no

| Check | Expected | Measured |
|---|---|---|
| signed-out `/sandbox` | 307 → `/` (gate closed) | 307 → `/` |
| signed-out `/sign-in` | 200 | 200 |
| signed-out `/api/render/audit` | 401 | 401 |
| Clerk key on `/sign-in` | `pk_test_` | `pk_test_`, host `causal-polliwog-91.clerk.accounts.dev` |
| dev instance `/v1/environment`, `Origin:` the preview | no origin rejection | 401 `dev_browser_unauthenticated` (a cookie-less request; not `origin_invalid`) |

Ryan, by hand on that preview: **sign-in PASS, `/sandbox` PASS (the builder, past the gate), plan
PASS** (a real Modal call through Preview-scoped `MODAL_RENDER_URL` / `MODAL_RENDER_SECRET`).
No page crashed without `DATABASE_URL` (R19).

`frontend-only: no` is correct: the branch is cut from `ship-loop-1`, which changes `scripts/`,
`tests/` and `validation-artifacts/`.

## Refusal: an older preview is not shown for the tip

The live bundle of the run-1 preview, read with the script's method (40-hex strings in the `/`
chunks that are commits), fed to `preview-url.ps1 -DecideFromJson` with tip `6846e34`:

    served by old preview: e272091009fd749d1f29ff23c079b3c986dae9cd
    WAIT: https://conestruct-7zpz6gnts-rtmakaturas-projects.vercel.app serves e272091, not the tip 6846e34; frontend-only: no
    exit=3

No `preview:` URL is printed; in live mode this keeps polling and ends in `PREVIEW NOT VERIFIED`
after 10 min. (Live mode also only asks GitHub for deployments of the tip's sha, so an older
deployment is never a candidate.) The skip refusal was measured live on `bfd93f9` (docs-only
tip): `preview: none -- Vercel skipped the build of bfd93f9 ...`, exit 0, no URL.

## Prod unchanged

| Check | 16:50 UTC baseline | After run 1 | After run 2 |
|---|---|---|---|
| `www` `/sandbox` signed out | 307 | 307 | 307 |
| `www` `/api/render/audit` | 401 | 401 | 401 |
| `www` Clerk key | `pk_live_` | `pk_live_` | `pk_live_` |
| Modal `/healthz` sha | `7dee3db` | `7dee3db` | `7dee3db` |

Ryan: prod sign-in PASS. His words: "Prod Clerk publishable row is back on Production", which
implies it was off Production for a time (when and how long is unrecorded). No prod build ran in between (`main` and `healthz` stayed
at `7dee3db`), and `www` served `pk_live_` throughout. The next prod build is the first to read
the row as it now stands; the R7 smoke's step 2 (`/sandbox` loads signed in) would catch it.
