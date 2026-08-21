# Authorized Provider API Contracts

## FZR Cards — Top-up

The FZR Cards public API uses the `https://api.fzr.cards/api/v2` namespace. Its reseller credential is sent server-side as `X-API-Key` or Bearer authorization. Public responses use an `{ ok, ... }` envelope. The integration will use documented catalog and order operations only after schema validation.

Live validation confirmed `GET /api/v2/topups` returns `{ ok: true, kind: "topup", items: [...] }`. Each catalog item includes the official `category_id`, human-readable `name`, and a provider delivery `note`. The OpenAPI specification also documents `/api/v2/topups/offers`, `/api/v2/topups/order`, and `/api/v2/topups/validate-id` for category-specific offers, ordering, and account validation.

## SMMGlob — SMM Services

SMMGlob documents a form-encoded API at `POST https://smmglob.com/api/v2`. Requests include `key` and an `action` value. The `services` action returns service id, name, category, USD rate, min/max quantity, and support flags. The `add` action requires a provider service id, target link, and quantity; it returns the provider order id, status, charge, counts, and currency. Status, bulk status, refill, and balance actions are also documented.

Provider credentials are server-only secrets. This document intentionally contains no API key, account identifier, balance, order, or webhook secret.
