# Release Verification Notes

- On 2026-08-26, Vercel reported production deployment `dpl_GoW8BFNgntoMuatELrPfYeHv6DsN` for GitHub commit `25b310d8` as `READY`.
- Official URL checked: `https://www.zurs.me/?release=25b310d`.
- The rendered homepage showed the compact banner image and only the two accessible slide-dot controls; the former Sign in and Sign up banner buttons were absent.
- The Banner 2 slide was selected and visibly rendered on the same official release; it also retained only the slide dots and had no banner action buttons.
- Root `zurs.me` redirected to `www.zurs.me` for release `25b310d`; Banner 1 and Banner 2 were each visibly rendered after that redirect.
- Earlier official production rollout `86e284d` used CDN banner paths and Vercel deployment aliases included `zurs.me` and `www.zurs.me`.

## Catalog environment check

Vercel project `zurs` already contains `FZR_CARDS_API_KEY` scoped to both Production and Preview. A duplicate add attempt was rejected by the dashboard, so the pending credential rotation must update that existing secret rather than create a second variable. No secret values are recorded here.

The existing secret editor is open with the current owner-supplied rotation value and retains the existing Production-and-Preview scope. Saving this rotation remains pending at the time of this note.

The existing secret was subsequently updated successfully and Vercel created a new Production deployment for the current source using that environment configuration. No secret values are recorded here.

## AI deployment check

The local AI stream probe completed with a delta, recommendations, and a completion marker. Vercel's Environment Variables view has no `IAMHC_API_KEY` entry, which explains why the official deployment cannot make its server-side AI provider request. No provider credential values are recorded here.
