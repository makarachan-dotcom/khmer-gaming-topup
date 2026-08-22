import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerGoogleAuthRoutes } from "./googleAuth";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { sdk } from "./_core/sdk";
import { cleanupExpiredSoldMarketplaceListings } from "./db";
import { deriveProviderNetworkRisk } from "./providerNetworkRisk";
import { registerProviderArtworkRoutes } from "./providerArtwork";
import crypto from "node:crypto";

/**
 * Builds the shared Express application for the local long-running server and
 * Vercel's serverless function runtime. This module deliberately never calls
 * `listen`, which keeps it safe to import in a function invocation.
 */
export function createApp() {
  const app = express();
  app.post("/api/webhooks/didit", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const secret = process.env.DIDIT_WEBHOOK_SECRET; const signature = req.header("x-signature"); const timestamp = req.header("x-timestamp");
      if (!secret || !signature || !timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return res.status(401).json({ error: "invalid webhook" });
      const expected = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
      if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).json({ error: "invalid signature" });
      const event = JSON.parse(req.body.toString("utf8"));
      if (event.webhook_type === "status.updated" && event.session_id) { const state = event.status === "Approved" ? { status: "approved" as const, decision: "pass" as const } : event.status === "Declined" ? { status: "rejected" as const, decision: "fail" as const } : { status: "manual_review" as const, decision: "review" as const }; const networkRisk = deriveProviderNetworkRisk(event.decision); await import("./db").then(({ updateMarketplaceVerificationDecision }) => updateMarketplaceVerificationDecision({ providerSessionId: event.session_id, ...state, networkRisk })); }
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: "webhook processing failed" }); }
  });
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // The managed hosting integration relies on Manus-only credentials. Vercel
  // receives a portable API surface instead of routes that would redirect to
  // an unavailable identity provider. The storage proxy remains enabled in
  // production because it can serve Appwrite-backed marketplace media.
  registerStorageProxy(app);
  registerProviderArtworkRoutes(app);
  if (!process.env.VERCEL) {
    registerOAuthRoutes(app);
  }
  registerGoogleAuthRoutes(app);
  app.post("/api/scheduled/cleanup-sold-listings", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      await cleanupExpiredSoldMarketplaceListings();
      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "cleanup failed", timestamp: new Date().toISOString() });
    }
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  return app;
}
