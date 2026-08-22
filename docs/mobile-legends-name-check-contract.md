# Mobile Legends Name-Check Contract

The provider chain is server-only. FZR Cards is attempted for categories it supports. For Mobile Legends categories where FZR reports no ID-validation capability, the application uses the owner-approved RapidAPI Game ID Checker route first, then the direct Neferbyte route only when RapidAPI is unavailable, and finally the owner-approved Isan fallback. A provider response is accepted only when it includes an explicit success value and a non-empty username. No key, player ID, server ID, or returned nickname is recorded in source control or this document.

Neferbyte documents the direct Mobile Legends endpoint as `GET https://api.neferbyte.com/game-id-checker/mobile-legends/{id}/{server}` with a server-side `x-api-key` header. It documents a `success: true` response carrying `data.username`; its supplied direct credential currently reports an inactive subscription. RapidAPI’s Game ID Checker route has been separately validated with its owner-supplied server-only credential and returns a username for the owner-provided Mobile Legends identifier.

The UI keeps Diamond packages hidden unless the server receives a verified name. The game catalog presents a provider-derived country marker where one is known, and a globe labelled `Global` otherwise.

## Local verification record

The local dedicated Mobile Legends page rendered the provider-supplied game cover, Player ID and Server ID inputs, the identity-check loading state, and a disabled package reveal control before verification. A direct call to the local validation procedure for the owner-approved test account returned HTTP 200 with `status: verified` and a non-empty name; the name itself was intentionally not recorded. The browser form was then populated with the same test account to exercise the debounced customer path. After the debounce completed, the page displayed the gold verified-account panel and enabled package browsing while leaving purchase controls subject to the existing payment-security restriction. A temporary provider request did not initially render packages, but the guarded request resolved successfully on retry and displayed provider packages with every purchase button still disabled. No name, test identifier, or provider pricing is retained in these notes.

## References

1. [Neferbyte Game ID Checker API documentation](https://neferbyte.com/docs/)
2. [LottieFlow Success category](https://finsweet.com/lottieflow/category/success)
