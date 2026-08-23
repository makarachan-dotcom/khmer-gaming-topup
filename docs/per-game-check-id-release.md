# Per-Game Package and Check-ID Release Verification

## Published behavior

The published ZURS STORE flow keeps each game's own public, special, pass, bonus, and active-event packages together in a single ordered list. Separate games remain separate storefront choices.

Mobile Legends and Honor of Kings continue to use the server-only VPS Worker name-check route. Other ID-based games use FZR Cards only; when FZR reports that name checking is unsupported, the customer must explicitly confirm that the entered ID is correct before package browsing is allowed. Forms that do not contain an ID-style field remain browsable after their required fields are complete. Buying and payment controls remain disabled.

## Custom-domain check

On 2026-08-23, the published custom-domain storefront at `https://www.zurs.me/?release=08b82eca` loaded successfully after its provider request settled. The verified page showed the game catalog and the grouped Mobile Legends variants while retaining separate cards for other games. No credentials, player IDs, or player names are recorded here.
