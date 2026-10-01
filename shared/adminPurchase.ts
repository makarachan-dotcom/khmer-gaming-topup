/**
 * Shared constants for the admin $0.01 purchase feature.
 *
 * The price is enforced SERVER-SIDE in server/adminPurchases.ts (the client
 * never sends a price). These constants live in shared/ only so the admin UI
 * can display the same fixed price and quota the server enforces.
 */

/** Fixed price (USD) charged for every admin purchase. */
export const ADMIN_PURCHASE_PRICE_USD = "0.01";

/** Max admin purchases per admin user per rolling 24 hours (server-enforced). */
export const ADMIN_PURCHASE_DAILY_LIMIT = 20;
