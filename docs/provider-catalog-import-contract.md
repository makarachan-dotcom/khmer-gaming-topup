# Provider-Synchronized Catalog Import Contract

ZURS STORE already treats the provider as the sole source of games, required player fields, and purchasable packages. The importer must remain disabled until an authorized vendor supplies an HTTPS endpoint and server-only credential. No admin screen may create a public offer from typed product data.

| Import requirement | Accepted behavior | Rejected behavior |
|---|---|---|
| Provider identity | Persist the vendor name returned in `provider` as `providerSource`. | Let an administrator type or alter a provider name. |
| Game source | Create or update games only from the validated `games` response. | Seed games or enable legacy/default records. |
| Package source | Create or update packages only from the validated package response for its parent game. | Create a package solely from an admin form. |
| Authorization | Set `providerAuthorized=true` only in the successful importer transaction. | Allow the pricing or activation UI to mark an offer authorized. |
| Pricing | Preserve the provider base price and derive the storefront price from the owner-set profit margin. | Accept a customer-facing price without a provider base price. |
| Safety | Deactivate missing or changed remote offers before publishing a replacement snapshot. | Delete historical orders or alter their recorded offer details. |

The current adapter requires the vendor’s documented request/response mapping. It supports a server-only `PROVIDER_CATALOG_URL` plus `PROVIDER_CATALOG_API_KEY` and validates the received game/package payloads before rendering. Before activation, the provider must supply the request authentication method, games response, packages response, pricing currency, availability status, and any webhook signature specification.
