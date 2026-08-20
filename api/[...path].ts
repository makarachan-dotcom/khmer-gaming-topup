import { createApp } from "../server/app";

/**
 * Vercel discovers this catch-all API function automatically. It shares the
 * same API routes as local development but does not open its own listener.
 */
export default createApp();
