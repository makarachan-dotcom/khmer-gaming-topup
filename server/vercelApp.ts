import { createApp } from "./app";

// This module is bundled during the Vercel build. It deliberately exports an
// Express handler without opening a listener, so it is safe in serverless use.
export default createApp();
