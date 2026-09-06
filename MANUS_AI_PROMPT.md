# Manus AI — Prompt to push ZURS STORE fixes to `main`

Copy everything in the code block below into Manus AI. Manus should apply/keep these
changes, validate them, and **push to the `main` branch** (Manus pushes — not the user).

```text
You are working in the ZURS STORE (ZURS.me) repository — a Khmer game top-up storefront
(React 19 + Vite 7 + TypeScript + tRPC + Drizzle/MySQL, pnpm). Apply and keep the code
changes described below, validate them, then COMMIT and PUSH them to the `main` branch
yourself. Do not ask me to push — you push to main.

=========================================================
PART 1 — CRITICAL BUG FIX: “I paid but diamonds never arrived”
=========================================================
Root cause: for `orderType === "topup"`, the KHQR payment worker moved orders from
`awaiting_payment` → `paid` but NEVER submitted a fulfillment order to the game-top-up
provider (FZR / fazercards). Only SMM orders were being fulfilled. So money was captured
but nothing was delivered to the player account.

Fix already implemented in this codebase (verify it is present and correct):

1. server/providerCatalog.ts
   - New exported `submitFzrTopupOrder({ categoryId, offerId, playerId, serverId })`.
     It POSTs to `/api/v2/topups/order` via the existing `fzrRequest(...)` helper
     (X-API-Key auth, 15s timeout) with a JSON body and tolerantly parses the response
     with a zod schema (`fzrTopupOrderSchema` + `coerceFzrOrderPayload`). It never throws:
     returns `{ status: "submitted", providerOrderId }`, `{ status: "unavailable" }`,
     or `{ status: "error" }`. Logs are prefixed `[fzr-order]`.

2. server/db.ts
   - New exported `fulfillTopupOrder(orderId)`:
       * Idempotent (skips if `details.providerOrderId` already set).
       * Skips admin test purchases / `noProviderFulfillment`.
       * Parses the package `providerSource` of the form
         `fzr_cards:<providerGameId>:<offerId>` to recover the offer + game id, and reads
         `playerId` / `zoneId (serverId)` from the order details.
       * On success → sets order status `delivered` and appends a `provider_submitted`
         order-status event with the provider reference.
       * On failure → KEEPS status `paid` (money is safe) and appends a
         `provider_fulfillment_failed` event + flags manual review (Khmer message).
   - Wired in TWO places so it runs no matter how the order becomes paid:
       * `reconcileKhqrWorkerPayment(...)` — after the DB tx, when a topup order is
         credited and it is NOT an admin test purchase.
       * `updateOrderStatus(...)` — when `orderType === "topup"` and status transitions
         into `paid`.

>>> ACTION REQUIRED BY MANUS (IMPORTANT): The FZR `/api/v2/topups/order` REQUEST body
>>> field names could not be confirmed from the repo (no OpenAPI file present). The code
>>> currently sends: { category_id, offer_id, player_id, server_id? }. Please verify the
>>> real field names / endpoint against the FZR (fazercards) API docs or a live sandbox
>>> call, and adjust the body keys in `submitFzrTopupOrder` if they differ (e.g.
>>> categoryId vs category_id, or a different path). Everything else is provider-agnostic.
>>> Also confirm how the provider returns its order id so `providerOrderId` maps correctly.

Note: this fix delivers NEW orders going forward. It does NOT retroactively deliver orders
that are already stuck in `paid`. If there are stuck paid topup orders, run a one-off
backfill that calls `fulfillTopupOrder(orderId)` for each, after the body fields are verified.

=========================================================
PART 2 — FRONTEND: cleaner UI, glitch fix, new animations
=========================================================
3. client/src/components/PaymentSuccessPipeline.tsx  (NEW)
   - Animated “deploy pipeline” style success tracker (framer-motion): 4 stages
     Payment received → Verifying (ledger) → Delivering to account → Complete, with a
     spring progress bar, streaming log lines, and green check animations.
   - It reflects the REAL order status: `delivered` runs to a green celebration; a still
     `paid` order honestly parks on “Delivering…” with a spinner + a Khmer support note
     (so a customer whose provider delivery is pending is never shown a fake “done”).
   - Respects prefers-reduced-motion.

4. client/src/pages/Checkout.tsx  (EDITED)
   - Imports `PaymentSuccessPipeline` and renders it inside `SuccessState` in place of the
     old static 3-item `<ol className="checkout-success-state__steps">` list.

5. client/src/pages/AppwriteLogin.tsx  (REWRITTEN)
   - Redesigned dark glassmorphism (#0f0f13) OTP login for zurs.me/login using the existing
     Appwrite EMAIL-OTP auth (`requestAppwriteEmailOtp` / `completeAppwriteEmailOtp`).
   - Flow: email → six segmented OTP boxes (auto-advance, backspace, arrow keys, paste-fill,
     auto-submit when full) → animated red-glow error / green “Verified ✓” success, then
     redirect to the safe returnTo. IMPORTANT: OTP length is 6 (Appwrite’s real code length) —
     do not change to 4 or real logins break.

6. client/src/styles/zurs-polish.css  (NEW) + imported last in client/src/main.tsx
   - Fixes the reported glitch in the purchase-history / tab-bar area:
       * `html, body { overflow-x: hidden }` + `#root { overflow-x: clip }` so prices like
         “$0.0” are no longer clipped at the right edge.
       * Mobile tab bar gets safe-area padding + a defined z-index; `main` gets bottom
         padding equal to the tab-bar height so content is never hidden behind it; the
         floating scroll-to-top button and the product action bar are lifted above the tab
         bar so they never overlap. Desktop (≥768px) resets these offsets.
   - Package selection area: cleaner container, readable category tabs, and higher-contrast
     price label on the gold package surface.
   - Full styling for the new payment pipeline (`.zurs-pipeline*`) and OTP page (`.zurs-otp*`).

7. client/src/styles/zurs-polish.css (UPDATED) — theme + glitch pass:
   - The app runs in LIGHT theme but storefront-clean.css forced the --z-* shell
     tokens dark (#0a0f1e), which looked "too black". This layer flips --z-* to a
     bright, colourful palette (indigo/cyan accents) matching the light cards, and
     re-skins the hard-coded dark surfaces (tab bar, product action bar, package
     selector) to light + vibrant. The package category title/tabs are colourful now.
   - Glitch fix: mobile content gets bottom padding so the centred tab bar never
     covers the last row; the help button, scroll-to-top and product action bar get
     a clean non-overlapping vertical ladder (via :has()); prices no longer clip.
   >>> Please do a live mobile visual pass on /account (purchase history) and a game
   >>> top-up page (package selector + floating action bar) and nudge the floating
   >>> offsets if a specific device notch needs it.

=========================================================
PART 3 — VALIDATE, THEN PUSH TO MAIN (you do this)
=========================================================
Run, from the repo root:
  pnpm install
  pnpm check          # tsc --noEmit (server single-file tsc already passed here)
  pnpm test           # vitest run
  pnpm build          # vite build

Then do a quick visual QA on: /login (OTP), a checkout success screen (pipeline), the
storefront tab bar + purchase history on mobile widths, and the package selector.

If all green, commit and PUSH to `main`:
  git add -A
  git commit -m "fix(topup): deliver FZR order after payment; redesign OTP login + payment-success pipeline; fix tab-bar/overflow glitch and package/contrast polish"
  git push origin main

Report back: the commit hash, test/build results, and whether the FZR order-endpoint body
fields needed adjusting.
```
