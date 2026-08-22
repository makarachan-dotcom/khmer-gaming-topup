# Bakong KHQR Integration Notes

## Verified sources

- [Bakong Open API documentation](https://api-bakong.nbc.gov.kh/document) documents dynamic QR deeplink generation and transaction checks by MD5, full hash, short hash, instruction reference, and external reference.
- [Bakong JavaScript KHQR SDK](https://www.npmjs.com/package/bakong-khqr) is published from `gitlab.nbc.gov.kh:khqr/sdk-javascript.git` and is used server-side for compliant QR payload creation and MD5 generation.
- [Bakong-KHQR Python reference](https://github.com/bsthen/bakong-khqr) confirms the merchant flow: create a dynamic QR, derive its MD5, then treat payment as complete only after the official payment-status API confirms it.

## Implementation decision

Create dynamic, exact-amount USD or KHR QR data server-side. Store the QR MD5 and payment reference with the pending transaction. The client may request a fresh status check while the checkout is open, but order status changes to `paid` only after a server-side official Bakong response matches the order amount and currency. No token belongs in the client, QR URL, logs, or database payload.
