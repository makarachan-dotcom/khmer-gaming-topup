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

## References

[1] [National Bank of Cambodia — Bakong and KHQR](https://bakong.nbc.gov.kh/en/)

[2] [PPCBank — Online Payment Gateway with KHQR](https://www.ppcbank.com.kh/online-payment-gateway/)
