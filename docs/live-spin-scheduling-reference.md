# Live Spin Scheduling Reference

Vercel Cron performs HTTP GET requests to a configured production path. The platform sends `Authorization: Bearer <CRON_SECRET>` when the `CRON_SECRET` environment variable is configured, so the endpoint must reject all other callers.

Cron expressions use UTC. Sunday at 3:00 PM in Asia/Phnom_Penh is Sunday at 08:00 UTC, so the weekly schedule expression is `0 8 * * 0`.

Vercel's documentation states that cron delivery is best effort and may be missed or duplicated. Live Spin lifecycle automation must therefore be idempotent, database-backed, and use a transaction/row lock for each event. The Vercel Hobby plan only supports one cron invocation per day and can execute at any point within its scheduled hour; this cannot guarantee a 3:00 PM live start. The running production plan must be verified before enabling a timed weekly cron.

Sources:

1. https://vercel.com/docs/cron-jobs
2. https://vercel.com/docs/cron-jobs/manage-cron-jobs
3. https://vercel.com/docs/cron-jobs/usage-and-pricing
