# Free Game ID Check Sources

The owner supplied the following no-key game-name validation sources. They are approved only for server-side requests; customer IDs and returned names must not be logged or documented.

| Game family | Endpoint pattern | Required fields | Verified response fields |
|---|---|---|---|
| Free Fire | `https://api.isan.eu.org/nickname/ff?id={userId}` | Player/User ID | `success`, `name` |
| Mobile Legends | `https://api.isan.eu.org/nickname/ml?id={userId}&server={zoneId}` | Player/User ID and Zone/Server ID | `success`, `name`, optional `country` |
| Magic Chess | `https://api.isan.eu.org/nickname/mcgg?id={userId}&server={zoneId}` | Player/User ID and Zone/Server ID | `success`, `name`, optional `country` |
| 8 Ball Pool | `https://api-cek-id-game-ten.vercel.app/api/check-id-game?type_name=eight_ball_pool&userId={userId}&zoneId=` | Player/User ID | `status`, `nickname` |
| Call of Duty Mobile | `https://api.isan.eu.org/nickname/cod?id={userId}` | Player/User ID | `success`, `name`, optional `country` |
| Arena of Valor | `https://api.isan.eu.org/nickname/aov?id={userId}` | Player/User ID | `success`, `name`, optional `country` |

Blood Strike, Honor of Kings, FRAG Pro Shooter, EAFC/FC Mobile, and PUBG Mobile do not use these free adapters. Existing authorized handling and fail-closed ID confirmation rules remain in force for those games.

## Safety and availability rules

Each request must have a bounded timeout and no retry loop. A response only unlocks a package list when its documented success flag and non-empty player-name field validate. Any unexpected response, upstream error, or unavailable endpoint must remain unavailable or require the existing explicit ID-accuracy confirmation where appropriate. Buying and payment controls remain disabled.
