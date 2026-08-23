# Appwrite Migration and Provider Catalog Verification

The Singapore Appwrite project is configured through managed server secrets. Its enabled `zurs_store` database and private `zurs_records` collection were provisioned after a live collection-access test passed. No credential values are recorded here.

On 2026-08-23, the published release at `https://zurs.vercel.app/?release=9f189441&catalog-bypass=1` rendered 12 provider-authorized Game cards. The published SMM storefront at `https://zurs.vercel.app/smm?release=9f189441&catalog-bypass=1` rendered real provider services with purchase controls disabled.

The recovery bypasses optional account-store resolution only for public provider browsing and payment-readiness procedures, preventing an Appwrite account read-limit response from blocking Game or SMM catalog requests. Protected account and Admin procedures retain their normal authentication requirements.

## Package-layout follow-up

The Mobile Legends game detail rendered provider-approved game artwork, verified the supplied ID fields server-side, and retained saved-ID masking without recording an account name in this note. During the local visual check, the subsequent live provider package request returned no usable package list, so no product selection or purchase was attempted. The ticket-style grouping, active-Admin-event gate, provider-art fallback, and compact selected-bar contracts are covered by automated tests; real package cards remain dependent on the provider response.
