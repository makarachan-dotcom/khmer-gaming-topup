# Account Mutation JSON Fix

The reported account-page mutation error was traced to an upstream Bakong payment-status request that returned an HTML document. The wallet refresh procedure called the payment-status helper, whose unguarded JSON parsing could throw before tRPC produced its structured response.

The Bakong helper now reads upstream response text defensively. Empty, HTML, and malformed bodies return an `unavailable` payment status instead of throwing a JSON parser error. This keeps the wallet refresh procedure within its normal tRPC response path, so the client receives structured JSON rather than an HTML error page. A regression test covers the HTML response case.
