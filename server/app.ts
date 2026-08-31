import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerGoogleAuthRoutes } from "./googleAuth";
import { registerAppwriteAuthRoutes } from "./appwriteAuth";
import { registerStorageProxy } from "./_core/storageProxy";
import { cleanupExpiredSoldMarketplaceListings } from "./db";
import { fetchProviderGames, fetchSmmProviderServices } from "./providerCatalog";
import { deriveProviderNetworkRisk } from "./providerNetworkRisk";
import { registerProviderArtworkRoutes } from "./providerArtwork";
import crypto from "node:crypto";
import { parseKhqrWorkerCallback, verifyKhqrWorkerSignature } from "./khqrWorkerWebhook";
import { getKhqrWorkerCredentials } from "./khqrWorkerSecrets";
import { registerSecurePaymentLinkRoutes } from "./paymentLinkRoutes";
import { clientIpFromRequest, consumeRateLimit, rateLimitBuckets, rateLimitMiddleware, sendRateLimited } from "./rateLimit";
import { consumeWebhookNonce, isFreshWebhookTimestamp, releaseWebhookNonce, webhookReplayKey } from "./paymentSecurity";

/**
 * Builds the shared Express application for the local long-running server and
 * Vercel's serverless function runtime. This module deliberately never calls
 * `listen`, which keeps it safe to import in a function invocation.
 */
export function createApp() {
  const app = express();
  // Vercel terminates TLS in front of the function, so the real client address
  // arrives in a forwarded header. Rate limiting depends on reading it.
  app.set("trust proxy", 1);
  const khqrWorkerWebhookHandler = async (req: express.Request, res: express.Response) => {
    // Defence in depth for the only unauthenticated endpoint that can move
    // money. Each layer assumes the one before it may have been defeated:
    //   1. volume cap        — bounded work per source
    //   2. HMAC over raw bytes — authenticity
    //   3. schema            — shape and range
    //   4. freshness window  — a captured body keeps a valid signature forever
    //   5. single-use nonce  — blocks concurrent and rapid replay
    //   6. ledger guards     — amount/currency/md5/status re-checked in the DB
    // Bad callbacks additionally burn a tight reject budget, so signature
    // probing is throttled long before it becomes useful.
    const sourceIp = clientIpFromRequest(req);
    const penalise = async () => {
      const budget = await consumeRateLimit({ bucket: rateLimitBuckets.khqrWebhookReject, identifier: sourceIp, mode: "lenient" });
      return budget.retryAfterSeconds;
    };
    let claimedNonce: string | null = null;
    try {
      const volume = await consumeRateLimit({ bucket: rateLimitBuckets.khqrWebhook, identifier: sourceIp, mode: "lenient" });
      if (!volume.allowed) return sendRateLimited(res, volume.retryAfterSeconds);
      if (!verifyKhqrWorkerSignature(req.body, req.header("x-khqr-signature") ?? undefined, getKhqrWorkerCredentials().callbackSecret ?? undefined)) { await penalise(); return res.status(401).json({ success: false, error: "invalid signature" }); }
      const callback = parseKhqrWorkerCallback(req.body);
      if (!callback) { await penalise(); return res.status(400).json({ success: false, error: "invalid callback" }); }
      if (!isFreshWebhookTimestamp(callback.timestamp)) { await penalise(); return res.status(401).json({ success: false, error: "stale callback" }); }
      const nonce = webhookReplayKey(callback);
      if (!(await consumeWebhookNonce(nonce))) { await penalise(); return res.status(409).json({ success: false, error: "callback already processed" }); }
      claimedNonce = nonce;
      if (callback.event === "payment.paid") {
        const result = await import("./db").then(async ({ reconcileKhqrWorkerPayment, settleSecurePaymentLinks }) => { const reconciliation = await reconcileKhqrWorkerPayment(callback); await settleSecurePaymentLinks(callback.orderId, "paid"); return reconciliation; });
        return res.json({ success: true, idempotent: result.idempotent });
      }
      if (callback.event === "payment.expired") {
        const result = await import("./db").then(async ({ recordKhqrWorkerPaymentExpired, settleSecurePaymentLinks }) => { const expiry = await recordKhqrWorkerPaymentExpired(callback); await settleSecurePaymentLinks(callback.orderId, "expired"); return expiry; });
        return res.json({ success: true, idempotent: result.idempotent });
      }
      const result = await import("./db").then(({ recordKhqrWorkerVerificationDeferred }) => recordKhqrWorkerVerificationDeferred(callback));
      return res.json({ success: true, recorded: result.recorded });
    } catch (error) {
      // Release the claim so the worker's retry is not permanently blocked by a
      // transient failure. Double-crediting is still impossible: the ledger
      // transition is conditional on the row still being pending.
      if (claimedNonce) await releaseWebhookNonce(claimedNonce);
      console.error("[khqrWebhook] reconciliation rejected", error);
      return res.status(409).json({ success: false, error: "payment reconciliation rejected" });
    }
  };
  const khqrWorkerWebhookBody = express.raw({ type: "application/json", limit: "32kb" });
  app.post("/api/webhooks/khqr-worker", khqrWorkerWebhookBody, khqrWorkerWebhookHandler);
  app.post("/api/webhooks/bakong", khqrWorkerWebhookBody, khqrWorkerWebhookHandler);
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
  // Rate limiting is mounted before the route registrations below so a
  // throttled caller is rejected ahead of any authentication, provider or
  // database work. Session endpoints fail closed, public traffic fails open.
  app.use("/api/auth", rateLimitMiddleware({ bucket: rateLimitBuckets.auth, mode: "strict" }));
  app.use("/api/trpc", rateLimitMiddleware({ bucket: rateLimitBuckets.trpcPublic, mode: "lenient" }));
  registerSecurePaymentLinkRoutes(app);
  // The managed hosting integration relies on Manus-only credentials. Vercel
  // receives a portable API surface instead of routes that would redirect to
  // an unavailable identity provider. The storage proxy remains enabled in
  // production because it can serve Appwrite-backed marketplace media.
  registerStorageProxy(app);
  registerProviderArtworkRoutes(app);
  registerAppwriteAuthRoutes(app);
  registerGoogleAuthRoutes(app);
  app.post("/api/scheduled/cleanup-sold-listings", async (req, res) => {
    try {
      const { sdk } = await import("./_core/sdk");
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      await cleanupExpiredSoldMarketplaceListings();
      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "cleanup failed", timestamp: new Date().toISOString() });
    }
  });
  app.post("/api/scheduled/bank-review-readiness", async (req, res) => {
    try {
      const { sdk } = await import("./_core/sdk");
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const [games, smm] = await Promise.all([fetchProviderGames(), fetchSmmProviderServices()]);
      const report = {
        gameCatalog: games.status,
        gameCount: games.status === "ready" ? games.games.length : 0,
        smmCatalog: smm.status,
        smmServiceCount: smm.status === "ready" ? smm.services.length : 0,
        paymentMode: "disabled-by-policy",
        timestamp: new Date().toISOString(),
      };
      if (games.status !== "ready" || smm.status !== "ready") return res.status(503).json({ ok: false, error: "provider_catalog_not_ready", report });
      return res.json({ ok: true, report });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "readiness check failed", timestamp: new Date().toISOString() });
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
