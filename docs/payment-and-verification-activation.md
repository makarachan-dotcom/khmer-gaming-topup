# Payment and Marketplace Verification Activation

## KHQR and Cambodian bank payments

The customer interface can offer a **KHQR** option and a bank-payment option, but payment collection must remain disabled until a merchant relationship and the selected gateway credentials are configured server-side. Bakong describes KHQR as a standardized QR format capable of accepting payments through participating payment operators. PPCBank’s online payment gateway is one merchant route that supports Bakong KHQR and describes an application, account-opening, agreement, integration/testing, and go-live process.[1][2]

## Provider-driven game data

The website must not ship default game names, packages, required account fields, quantities, or prices. The authorized supplier must provide those data through an API contract. The planned response contains the following elements:

| Provider response field | Purpose in the storefront |
|---|---|
| `games` | Populate the first game-selection step. |
| `requiredFields` | Render only the account ID, zone, server, nickname, or other fields required for the selected game. |
| `packages` | Render live package name, credit/diamond quantity, currency, price, and provider identifier. |
| `paymentMethods` | Determine which payment actions are enabled for the selected package. |

The server, not the browser, holds provider credentials. The browser receives only validated display data.

## Marketplace eligibility verification

For sell, buy, or swap listings, customers should consent to a verification session with a specialized identity-verification provider. ID images must be submitted directly to that provider’s hosted verification flow rather than stored in the storefront database. The application should retain only the verification session ID, status, completion time, and a coarse Cambodia-eligibility result. The administrator sees those minimum status fields and controls whether marketplace activity is approved, suspended, or rejected.

Location checks should be an explicit, one-time consent request. A missing, denied, or non-Cambodia result must block marketplace listing submission rather than silently collecting location data.

## Expanded marketplace evidence and fraud controls

Identity-document images, selfie/face captures, and precise location are sensitive evidence. They must be stored as private object references, never as public listing media or database blobs. Only the designated administrator may open evidence through a logged access event, and ordinary users must never receive another person’s identity or location data. A fraud report can create an administrator case record, while a lawful-information request must remain administrator-only and require the appropriate legal basis before any disclosure decision.

The verification vendor—not the storefront—should perform document authenticity checks, document-to-face comparison, liveness detection, and its own anti-spoofing controls. Automated vendor approval can publish a listing only when the configured policy explicitly permits it; inconclusive, risky, or failed results remain pending for the administrator. NIST notes that remote proofing requires document validation, a live facial capture, and liveness detection to mitigate presentation attacks.[3]

The browser location request is used only with explicit consent, in HTTPS, to obtain a current device position and accuracy. The server should retain a coarse country result and verification timestamp by default; precise coordinates are evidence available only when a policy requires it. Browser location and IP/VPN signals are risk indicators, not proof: an actual VPN can alter IP-based location, while user-permitted device geolocation is separate. A mismatch, proxy/VPN indication, implausible location, or weak accuracy should require manual review rather than automatically accusing a customer.

| Control | Implementation decision |
|---|---|
| National ID front/back | Private evidence objects with application-generated keys; no public URLs and no direct database image storage. |
| Face verification | Vendor-hosted document-to-selfie/liveness session; store only result, score band, provider session ID, and timestamps. |
| Current location | Explicit consent; derive Cambodia eligibility server-side and retain coarse result by default. |
| VPN / proxy | A non-guaranteed risk signal combined with device-location and verification evidence; never a sole rejection or fraud finding. |
| AI trust | Policy-driven automatic approval only from a verified vendor outcome; unclear or risky outcome requires administrator review. |
| Fraud request | Administrator case workflow; no automatic sharing of personal evidence with a reporter. |
| Listing media | Up to 20 separate public-safe account screenshots; identity evidence is never included. |
| Sold out | Seller may mark the listing sold; server assigns an expiry timestamp five hours later and removes it from public results. |

OWASP advises allowlisting needed file types, generating safe names, applying upload limits and authorization, storing files away from public delivery, and applying layered checks rather than trusting the submitted content type.[4]

## Active marketplace cleanup schedule

The project-level Heartbeat job `zurs-sold-listing-cleanup` uses task UID `JFEJY8beN6xJsQgKvaX4vG`. It calls `/api/scheduled/cleanup-sold-listings` every five minutes. The handler is idempotent and deletes only listings whose seller-selected `cleanupAt` timestamp is more than five hours after the Sold out action.

## Hosted identity verification provider

The marketplace uses a server-created Didit hosted session for customer-facing ID-document and face-liveness capture. Didit documents this as the recommended pattern for user-facing verification: the server creates `POST /v3/session/` with a published workflow ID and receives a hosted URL; the customer completes document capture and liveness in the provider’s interface, and the merchant receives a decision through retrieval or webhook.[6] The selected workflow must require a Cambodian National ID, a selfie/face match, and liveness. The storefront retains a private provider session reference and an outcome only; no user-facing route exposes the provider key or private evidence URL.

[6] [Didit — Create Session API Reference](https://docs.didit.me/sessions-api/create-session)

## References

[1] [National Bank of Cambodia — Bakong and KHQR](https://bakong.nbc.gov.kh/en/)

[2] [PPCBank — Online Payment Gateway with KHQR](https://www.ppcbank.com.kh/online-payment-gateway/)

[3] [NIST SP 800-63A — IAL2 Remote Identity Proofing](https://pages.nist.gov/800-63-3-Implementation-Resources/63A/ial2remote/)

[4] [OWASP Cheat Sheet Series — File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

[5] [MDN Web Docs — Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
