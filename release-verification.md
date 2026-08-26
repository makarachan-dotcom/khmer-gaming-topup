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

## Latest production rollout

Vercel marked the GitHub main deployment for checkpoint `be1f15e5` as `READY` in Production. The deployment URL is `https://zurs-mxvu63gxa-makarachan-dotcoms-projects.vercel.app`; its Git metadata references the `be1f15e569aae39c1b05e5dcac3b5833158999bd` commit.

The official `https://www.zurs.me/?release=be1f15e` page completed its catalog request and visibly rendered the public catalog. Its extracted content listed 9 of 9 games, including 8 Ball Pool, Blood Strike, EAFC Mobile, FRAG Pro Shooter, Free Fire, Honor of Kings, Magic Chess Go Go, Mobile Legends, and PUBG Mobile.

The official AI stream endpoint returned HTTP 200 with `text/event-stream`. Using the server's actual framing, the privacy-safe probe observed one non-empty delta, one recommendations frame, a `[DONE]` marker, and no error frame. This confirms the no-IAMHC catalog fallback is active in Production without disclosing assistant content or provider credentials.

## Current release-candidate local review

On 2026-08-26, the local desktop and 375px mobile review showed the rounded sticky header, the two-item Home/Account mobile control, deep-blue staggered particle background, and visible public game catalog. The MLBB top-up page loaded the game card and Player ID/Server ID form after catalog data resolved. These observations are local candidate evidence only and do not yet confirm production deployment.

## Checkpoint bf544633 production verification

On 2026-08-26, `https://www.zurs.me/?release=bf544633` completed its initial catalog request and visibly rendered 9 of 9 public games: 8 Ball Pool, Blood Strike, EAFC Mobile (KH), FRAG Pro Shooter, Free Fire (MY/SG), Honor of Kings, Magic Chess Go Go (Global), Mobile Legends, and PUBG Mobile (Auto). The official page rendered the compact banner, showed the payment-disabled customer notice, and did not expose public AI navigation. No credential, player ID, QR, or merchant data was recorded.

The requested Jeenastore fallback could not be authorized from public information: a public search found no Jeenastore MLBB verification API documentation, and `https://jeenastore.com/` did not resolve during text extraction. It remains disabled pending a documented/owner-authorized HTTPS endpoint and provider contract.
