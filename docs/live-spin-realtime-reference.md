# Live Spin Realtime Reference

Ably official documentation states that token authentication lets a trusted server issue short-lived tokens with narrowly scoped capabilities to browser clients, so the API key remains off the client. The chosen design grants viewer tokens only the `subscribe` capability on exactly one event channel and leaves all publishing to the server.

The current Ably pricing page lists a Free tier with $0 package price, 200 concurrent connections, 6 million messages per month, and 500 messages per second. This is a suitable initial deployment target for a 30–60 minute weekly event, with production capacity and actual usage requiring ongoing monitoring.

Sources:

1. https://ably.com/docs/auth/token
2. https://ably.com/pricing
3. https://ably.com/docs/channels
