# Appwrite Migration and Provider Catalog Verification

The Singapore Appwrite project is configured through managed server secrets. Its enabled `zurs_store` database and private `zurs_records` collection were provisioned after a live collection-access test passed. No credential values are recorded here.

On 2026-08-23, the published release at `https://zurs.vercel.app/?release=9f189441&catalog-bypass=1` rendered 12 provider-authorized Game cards. The published SMM storefront at `https://zurs.vercel.app/smm?release=9f189441&catalog-bypass=1` rendered real provider services with purchase controls disabled.

The recovery bypasses optional account-store resolution only for public provider browsing and payment-readiness procedures, preventing an Appwrite account read-limit response from blocking Game or SMM catalog requests. Protected account and Admin procedures retain their normal authentication requirements.

## Package-layout follow-up

The Mobile Legends game detail rendered provider-approved game artwork, verified the supplied ID fields server-side, and retained saved-ID masking without recording an account name in this note. During the local visual check, the subsequent live provider package request returned no usable package list, so no product selection or purchase was attempted. The ticket-style grouping, active-Admin-event gate, provider-art fallback, and compact selected-bar contracts are covered by automated tests; real package cards remain dependent on the provider response.

## Home catalog clarity follow-up

The local Home catalog rendered 12 real provider game cards after the public catalog recovery. Home cards now retain one Cambodia marker over the provider game artwork, with plain text regional metadata below the title. Group headers do not add a second flag, and long titles use overflow-only marquee behavior.

The published `zurs.vercel.app` Home route was checked with the cache-busting release value for checkpoint `2f97d920`. It rendered 12 provider game entries with purchase controls still inactive. The visual card hierarchy kept the regional flag in the artwork and text-only regional metadata outside it; browser accessibility text can include image-overlay content and should not be used to infer a visible duplicate flag.

The attached Vercel project lists both `zurs.me` and `www.zurs.me` and its latest production deployment was `READY`. The custom domain was directly checked with release value `7b50d5f7`; it redirected to `www.zurs.me`, rendered the current Home page, loaded 12 provider game cards, and retained inactive purchase controls.

The published Account recovery release was checked on `https://zurs.me/account?release=600c7539`, which redirected to `www.zurs.me` and rendered the signed-out Account route without a visible frontend or backend error. Authenticated display-name behavior is covered by an automated regression that simulates Appwrite quota exhaustion without submitting customer data in browser verification.
