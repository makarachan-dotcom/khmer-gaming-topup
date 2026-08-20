# Backend Activation Checklist

The frontend is intentionally in **live-catalog waiting mode**. It does not display default game packages, SMM services, or prices while MongoDB Atlas and the approved supplier connection are unavailable.

## What to provide when ready

1. A MongoDB Atlas connection string (`MONGODB_URI`) for a dedicated production database.
2. The supplier name, API documentation URL, permitted endpoints, and product-data authorization scope.
3. The supplier API base URL and authentication method. The key must be provided through the project secret manager, never pasted into frontend code or committed to GitHub.
4. Confirmation of whether the administrator should press **Sync Products** manually after reviewing each update.

## Safe activation sequence

1. Add the MongoDB connection string as a server-side secret.
2. Configure the supplier API URL and key as server-side secrets.
3. Test the supplier response against its documented sandbox or permitted production endpoint.
4. Import the catalog into MongoDB only after validating names, prices, availability, and currency.
5. Enable the live catalog flag. The top-up and SMM cards will then appear only from validated supplier data.

> No supplier token, MongoDB URI, payment credential, or private API response should be put in the browser bundle, a public page, a Git commit, or a client-side configuration file.
