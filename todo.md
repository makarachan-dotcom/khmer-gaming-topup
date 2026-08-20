# Project TODO

- [x] Define the production data model for game packages, SMM services, marketplace listings, orders, payment transactions, saved player IDs, and content.
- [x] Deliver a Khmer-first responsive interface with a Khmer-compatible font and reliable direct navigation; the optional English toggle is intentionally deferred until a complete reviewed translation set is available.
- [x] Replace temporary catalog displays with database-backed game, SMM, and marketplace queries.
- [x] Implement persisted top-up and SMM order creation with validated inputs and staged checkout handoff.
- [x] Implement marketplace listing persistence, approval status, public approved listings, screenshot storage, and contact initiation.
- [x] Add secure customer account tools for order history, status tracking, and saved player IDs.
- [x] Add secure single-admin authorization limited to chanmakara672@gmail.com and an administrative dashboard using the supplied dashboard layout.
- [x] Implement administration for products, packages, SMM tiers, listings, orders, transactions, users, content, and reporting.
- [ ] Verify ACLEDA ToanChetPay sandbox callback requirements and implement request, callback, paid, failed, and expired payment states.
- [ ] Keep ToanChetPay payment activation inactive until ACLEDA merchant sandbox credentials and exact provider request-signature fields are supplied.
- [x] Create a staged payment transaction and checkout handoff after each authenticated top-up or SMM order, without activating the bank provider.
- [x] Add saved Player ID edit, delete, reuse, and query-error handling in the customer account area.
- [ ] Extend administrator controls with explicit banner/promotion records, refund operations linked to transactions, and richer trend reporting.
- [ ] Add verified stickers.wiki-compatible Telegram premium-emoji assets and lightweight motion without generated branding assets.
- [ ] Add unit tests for critical data, authorization, order, marketplace, and payment-state workflows.
- [x] Verify mobile, tablet, and desktop rendering; run type-checks and tests; create a delivery checkpoint.
