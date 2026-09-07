import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, ownerProcedure, protectedProcedure, publicProcedure, router, scopedAdminProcedure } from "./_core/trpc";
import * as db from "./db";
import { addOwnerLiveSpinTestEntry, announceLiveSpinEvent, createLiveSpinEvent, createOwnerLiveSpinTestEvent, endLiveSpinEvent, getLiveSpinAuditLog, getLiveSpinEvents, getLiveSpinOwnerEventDetail, getLiveSpinPrizeTiers, lockLiveSpinParticipants, revealLiveSpinPrize, saveLiveSpinConsolationGift, saveLiveSpinPrizeTier, saveLiveSpinSettings, skipLiveSpinWeek, startLiveSpinLobby } from "./liveSpinStore";
import { advanceLiveSpinSequence, runLiveSpinSequence } from "./liveSpinSequence";
import { fetchFzrProviderSyncSnapshot, fetchProviderGameDetails, fetchProviderGames, fetchProviderPackages, fetchProviderPreviewPackages, fetchPublicProviderPackagePreview, getProviderAvailabilityCatalog, getProviderCatalogStatus, setProviderAvailability, validateProviderPlayerIdentity } from "./providerCatalog";
import { toPublicPlayerIdentityResponse } from "./playerIdentityPrivacy";
import { getProviderCredentialStatus } from "./providerCredentialStatus";
import { encryptCredential } from "./credentialEnvelope";
import { activateEncryptedProviderCredential, getProviderCredentialHistory, recordProviderCredentialValidationRejected, rollbackProviderCredential } from "./providerCredentialStore";
import { validateProviderCredentialCandidate } from "./providerCredentialValidation";
import { resetBakongMerchantPreflightCache } from "./bakongKhqr";
import { buildZursMemberDisplayName, isSingleAdminEmail } from "./storefrontDomain";
import { uploadAdminLiveSpinMedia, uploadAdminMediaImage, uploadAdminPaymentMethodIcon, uploadMarketplaceScreenshot, uploadMarketplaceVerificationEvidence } from "./uploads";
import { storageGet } from "./storage";
import { createDiditHostedSession } from "./didit";
import { disclosureRequestStatuses, fraudReportStatuses } from "./marketplaceSafety";
import { deriveLocationRisk, resolveLocationCountry } from "./marketplaceLocation";
import { createZursSession, getZursSessionCookieOptions, ZURS_SESSION_COOKIE } from "./zursSession";
import { enforceRateLimitOrThrow, rateLimitBuckets } from "./rateLimit";
import { getPartnerCatalog, getPartnerProduct, getPartnerUsage, toPublicPartnerPreview, toPublicPartnerProduct, PartnerServiceError, getAdminPartnerCatalog, applyPartnerPriceOverride } from "./partnerCatalog";
import { createPartnerServiceOrder, deliverPartnerService, submitCdkToken, confirmCdkUpgrade } from "./partnerOrders";
import { getPartnerOverride, listPartnerOverrides, savePartnerOverride } from "./partnerOverrides";

const marketplaceType = z.enum(["sale", "swap", "wanted"]);

function isTransientAccountStoreQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /Appwrite user store request failed with HTTP (?:402|429)|limit[_\s-]*databases?_reads_exceeded/i.test(message);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    setMemberDisplayName: protectedProcedure.input(z.object({ name: z.string().trim().max(120).optional() })).mutation(async ({ ctx, input }) => {
      const displayName = buildZursMemberDisplayName(input.name);
      let persisted = true;
      try {
        await db.updateUserDisplayName({ user: ctx.user, displayName });
      } catch (error) {
        if (!isTransientAccountStoreQuotaError(error)) throw error;
        persisted = false;
        console.warn("[Account] Profile persistence deferred while Appwrite is rate-limited");
      }
      if (ctx.user.email) {
        const session = await createZursSession(ctx.user.openId, { email: ctx.user.email, name: ctx.user.name, displayName, loginMethod: ctx.user.loginMethod });
        ctx.res.cookie(ZURS_SESSION_COOKIE, session, getZursSessionCookieOptions(ctx.req));
      }
      return { displayName, persisted };
    }),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); ctx.res.clearCookie(ZURS_SESSION_COOKIE, { ...getZursSessionCookieOptions(ctx.req), maxAge: -1 }); return { success: true } as const; }),
  }),
  catalog: router({
    games: publicProcedure.query(() => db.getGameCatalog()),
  }),
  payments: router({
    readiness: publicProcedure.query(() => db.getPublicPaymentAvailability()),
    gate: publicProcedure.query(async () => ({ enabled: (await db.getPaymentControl()).enabled })),
    methods: publicProcedure.query(() => db.getPaymentMethods()),
  }),
  wallet: router({
    summary: protectedProcedure.query(({ ctx }) => db.getCustomerWalletSummary(ctx.user.id)),
    topupAvailability: protectedProcedure.query(() => db.getWalletTopupAvailability()),
    beginTopup: protectedProcedure.input(z.object({ amountKhr: z.string().regex(/^\d+$/) })).mutation(({ ctx, input }) => db.beginWalletTopup({ userId: ctx.user.id, ...input })),
    topupSession: protectedProcedure.input(z.object({ topupId: z.string().min(4).max(64) })).query(({ ctx, input }) => db.getWalletTopupSession({ userId: ctx.user.id, ...input })),
    refreshTopup: protectedProcedure.input(z.object({ topupId: z.string().min(4).max(64) })).mutation(({ ctx, input }) => db.refreshWalletTopup({ userId: ctx.user.id, ...input })),
  }),
  liveSpin: router({
    state: publicProcedure.query(() => ({ retired: true as const, event: null })),
    realtimeAuth: publicProcedure.input(z.object({ eventId: z.string().min(4).max(64) })).query(() => ({ retired: true as const, token: null })),
    account: protectedProcedure.query(() => ({ retired: true as const })),
    beginConnection: protectedProcedure.input(z.object({ eventId: z.string().min(4).max(64) })).mutation(() => { throw new Error("Live Spin giveaway ត្រូវបានបិទ។"); }),
    heartbeatConnection: protectedProcedure.input(z.object({ eventId: z.string().min(4).max(64) })).mutation(() => ({ retired: true as const })),
  }),
  partner: router({
    catalog: publicProcedure.query(async () => {
      try {
        const products = await getPartnerCatalog();
        const overrides = await listPartnerOverrides();
        return { products: products.map((product) => toPublicPartnerProduct(product, overrides.get(product.slug) ?? null)), etaMinutes: { min: 5, max: 10 }, configured: true as const };
      } catch (error) {
        if (error instanceof PartnerServiceError && error.code === "NOT_CONFIGURED") return { products: [], etaMinutes: { min: 5, max: 10 }, configured: false as const };
        throw error;
      }
    }),
    preview: publicProcedure.input(z.object({ slug: z.string().trim().min(2).max(120), quantity: z.number().int().min(1).max(50).optional() })).query(async ({ input }) => {
      const product = await getPartnerProduct(input.slug);
      const override = await getPartnerOverride(input.slug);
      return toPublicPartnerPreview(product, input.quantity ?? 1, override);
    }),
    usage: ownerProcedure.query(() => getPartnerUsage()),
  }),
  provider: router({
    games: publicProcedure.query(() => fetchProviderGames()),
    gameDetails: publicProcedure.input(z.object({ gameId: z.string().trim().min(1).max(120) })).query(({ input }) => fetchProviderGameDetails(input.gameId)),
    packageArtwork: publicProcedure.input(z.object({ gameId: z.string().trim().min(1).max(120) })).query(({ input }) => db.getProviderPackageArtworkOverrides(input.gameId)),
    packageCategories: publicProcedure.input(z.object({ gameId: z.string().trim().min(1).max(120) })).query(({ input }) => db.getProviderPackageCategoryOverrides(input.gameId)),
    packageBadges: publicProcedure.input(z.object({ gameId: z.string().trim().min(1).max(120) })).query(({ input }) => db.getPackageBadgeOverrides(input.gameId)),
    gameImages: publicProcedure.query(() => db.getProviderGameImageOverrides()),
    packagePreview: publicProcedure.input(z.object({ gameId: z.string().trim().min(1).max(120) })).query(({ input }) => fetchPublicProviderPackagePreview(input.gameId)),
    packages: publicProcedure.input(z.object({ gameId: z.string().trim().min(1).max(120), fields: z.record(z.string().trim().max(64), z.string().trim().min(1).max(256)).refine((fields) => Object.keys(fields).length <= 12, "Too many provider fields"), idAccuracyConfirmed: z.boolean().optional().default(false) })).mutation(({ input }) => fetchProviderPackages(input)),
    validatePlayerId: publicProcedure.input(z.object({ gameId: z.string().trim().min(1).max(120), fields: z.record(z.string().trim().max(64), z.string().trim().min(1).max(256)).refine((fields) => Object.keys(fields).length <= 12, "Too many provider fields") })).mutation(async ({ input }) => toPublicPlayerIdentityResponse(await validateProviderPlayerIdentity(input))),
  }),
  marketplace: router({
    list: publicProcedure.input(z.object({ listingType: marketplaceType.optional(), game: z.string().max(120).optional(), search: z.string().max(120).optional() }).optional()).query(async ({ input }) => Promise.all((await db.listMarketplace(input ?? {})).map(async (listing) => {
      const screenshotKeys = Array.isArray(listing.screenshots) ? listing.screenshots.filter((item): item is string => typeof item === "string") : [];
      const screenshots = (await Promise.all(screenshotKeys.map(async (key) => { if (key.startsWith("http://") || key.startsWith("https://")) return key; try { return (await storageGet(key)).url; } catch { return null; } }))).filter((url): url is string => Boolean(url));
      return { ...listing, screenshots };
    }))),
    eligibility: protectedProcedure.query(({ ctx }) => db.getMarketplaceEligibility(ctx.user.id)),
    beginVerification: protectedProcedure.mutation(({ ctx }) => db.beginMarketplaceVerification(ctx.user.id)),
    startHostedVerification: protectedProcedure.mutation(async ({ ctx }) => { const verification = await db.beginMarketplaceVerification(ctx.user.id); const session = await createDiditHostedSession({ vendorData: `zurs-user-${ctx.user.id}`, verificationId: verification.id }); await db.linkMarketplaceVerificationProvider({ verificationId: verification.id, userId: ctx.user.id, providerSessionId: session.session_id }); return { verificationId: verification.id, url: session.url }; }),
    attestLocation: protectedProcedure.input(z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180), accuracyMeters: z.number().finite().min(0).max(50_000) })).mutation(async ({ ctx, input }) => { const locationCountry = await resolveLocationCountry(input.latitude, input.longitude); return db.recordMarketplaceLocationAttestation({ userId: ctx.user.id, locationCountry, locationAccuracyMeters: input.accuracyMeters, networkRisk: deriveLocationRisk(input.accuracyMeters) }); }),
    uploadVerificationEvidence: protectedProcedure.input(z.object({ verificationId: z.string().min(4).max(64), evidenceType: z.enum(["national_id_front", "national_id_back", "selfie_liveness"]), fileName: z.string().trim().min(1).max(180), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), dataUrl: z.string().min(50).max(7_000_000) })).mutation(async ({ ctx, input }) => { const upload = await uploadMarketplaceVerificationEvidence({ userId: ctx.user.id, ...input }); return db.addMarketplaceVerificationEvidence({ verificationId: input.verificationId, userId: ctx.user.id, evidenceType: input.evidenceType, storageKey: upload.key, mimeType: input.contentType, byteSize: upload.byteSize }); }),
    submit: protectedProcedure.input(z.object({ listingType: marketplaceType, game: z.string().trim().min(2).max(120), title: z.string().trim().min(4).max(180), rankLevel: z.string().trim().min(2).max(180), priceUsd: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(), description: z.string().trim().min(20).max(5000), contactMethod: z.string().trim().min(3).max(180), telegramUsername: z.string().trim().regex(/^@?[a-zA-Z0-9_]{5,32}$/).optional(), screenshots: z.array(z.string().trim().min(8).max(512)).max(20).optional() })).mutation(({ ctx, input }) => db.submitMarketplaceListing({ sellerUserId: ctx.user.id, ...input })),
    contact: protectedProcedure.input(z.object({ listingId: z.string().min(4).max(64), message: z.string().trim().min(4).max(1000) })).mutation(({ ctx, input }) => db.initiateMarketplaceContact({ initiatorUserId: ctx.user.id, ...input })),
    markSold: protectedProcedure.input(z.object({ listingId: z.string().min(4).max(64) })).mutation(({ ctx, input }) => db.markMarketplaceListingSold({ sellerUserId: ctx.user.id, ...input })),
    favorites: protectedProcedure.query(({ ctx }) => db.getMarketplaceFavorites(ctx.user.id)),
    addFavorite: protectedProcedure.input(z.object({ listingId: z.string().min(4).max(64) })).mutation(({ ctx, input }) => db.addMarketplaceFavorite({ userId: ctx.user.id, ...input })),
    removeFavorite: protectedProcedure.input(z.object({ listingId: z.string().min(4).max(64) })).mutation(({ ctx, input }) => db.removeMarketplaceFavorite({ userId: ctx.user.id, ...input })),
    mine: protectedProcedure.query(({ ctx }) => db.getSellerMarketplaceListings(ctx.user.id)),
    reportFraud: protectedProcedure.input(z.object({ listingId: z.string().min(4).max(64), details: z.string().trim().min(20).max(5000) })).mutation(({ ctx, input }) => db.createMarketplaceFraudReport({ reporterUserId: ctx.user.id, ...input })),
  }),
  uploads: router({
    marketplaceScreenshot: protectedProcedure.input(z.object({ fileName: z.string().trim().min(1).max(180), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), dataUrl: z.string().min(50).max(7_000_000) })).mutation(async ({ ctx, input }) => { const upload = await uploadMarketplaceScreenshot({ userId: ctx.user.id, ...input }); return { key: upload.key }; }),
    adminMediaImage: scopedAdminProcedure("media").input(z.object({ fileName: z.string().trim().min(1).max(180), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), dataUrl: z.string().min(50).max(7_000_000) })).mutation(async ({ ctx, input }) => uploadAdminMediaImage({ adminUserId: ctx.user.id, ...input })),
    adminLiveSpinMedia: ownerProcedure.input(z.object({ fileName: z.string().trim().min(1).max(180), contentType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]), dataUrl: z.string().min(50).max(5_600_000) })).mutation(async ({ ctx, input }) => uploadAdminLiveSpinMedia({ adminUserId: ctx.user.id, ...input })),
    adminPaymentMethodIcon: ownerProcedure.input(z.object({ fileName: z.string().trim().min(1).max(180), contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]), dataUrl: z.string().min(50).max(3_000_000) })).mutation(async ({ ctx, input }) => uploadAdminPaymentMethodIcon({ adminUserId: ctx.user.id, ...input })),
  }),
  content: router({
    active: publicProcedure.query(() => db.getPublicSiteContent()),
  }),
  support: router({
    contactAdmins: publicProcedure.query(() => db.getContactAdmins()),
  }),
  orders: router({
    createAdminKhqrTest: ownerProcedure.mutation(({ ctx }) => db.createAdminKhqrTestOrder({ userId: ctx.user.id })),
    pendingPaymentCount: protectedProcedure.query(async ({ ctx }) => ({ count: await db.countPendingKhqrPayments(ctx.user.id), limit: db.pendingKhqrPaymentLimit })),
    createService: protectedProcedure.input(z.object({ slug: z.string().trim().min(2).max(120), quantity: z.number().int().min(1).max(50).optional(), customerNote: z.string().trim().max(400).optional() })).mutation(async ({ ctx, input }) => {
      await enforceRateLimitOrThrow({ bucket: rateLimitBuckets.createTopup, identifier: `user:service:${ctx.user.id}`, mode: "strict" });
      return createPartnerServiceOrder({ userId: ctx.user.id, slug: input.slug, quantity: input.quantity, customerNote: input.customerNote });
    }),
    createTopup: protectedProcedure.input(z.object({ packageId: z.string().min(4).max(64), playerId: z.string().trim().min(2).max(128), zoneId: z.string().trim().min(1).max(128).optional(), quantity: z.number().int().min(1).max(9) })).mutation(async ({ ctx, input }) => {
      // Ten orders per hour per account. Checked before the order is written so
      // an abusive account cannot flood the provider queue.
      await enforceRateLimitOrThrow({ bucket: rateLimitBuckets.createTopup, identifier: `user:${ctx.user.id}`, mode: "strict" });
      return db.createTopupOrder({ userId: ctx.user.id, ...input });
    }),
    beginPayment: protectedProcedure.input(z.object({ orderId: z.string().min(4).max(64) })).mutation(({ ctx, input }) => db.beginStagedPayment({ userId: ctx.user.id, ...input })),
    paymentSession: protectedProcedure.input(z.object({ orderId: z.string().min(4).max(64) })).query(({ ctx, input }) => db.getCustomerPaymentSession({ userId: ctx.user.id, ...input })),
    refreshPayment: protectedProcedure.input(z.object({ orderId: z.string().min(4).max(64) })).mutation(({ ctx, input }) => db.refreshBakongPayment({ userId: ctx.user.id, ...input })),
    tracking: protectedProcedure.input(z.object({ trackingCode: z.string().trim().min(12).max(48) })).query(({ ctx, input }) => db.getCustomerOrderTracking({ userId: ctx.user.id, ...input })),
    submitCdkToken: protectedProcedure.input(z.object({ orderId: z.string().min(4).max(64), token: z.string().min(20).max(8000) })).mutation(async ({ ctx, input }) => {
      await enforceRateLimitOrThrow({ bucket: rateLimitBuckets.createTopup, identifier: `user:cdk:${ctx.user.id}`, mode: "strict" });
      return submitCdkToken({ userId: ctx.user.id, orderId: input.orderId, token: input.token });
    }),
    createTicket: protectedProcedure.input(z.object({ trackingCode: z.string().trim().min(12).max(48), subject: z.string().trim().min(4).max(180), message: z.string().trim().min(10).max(5000) })).mutation(({ ctx, input }) => db.createOrderSupportTicket({ userId: ctx.user.id, ...input })),
    mine: protectedProcedure.query(({ ctx }) => db.getCustomerOrders(ctx.user.id)),
    paymentHistory: protectedProcedure.query(({ ctx }) => db.getCustomerPaymentHistory(ctx.user.id)),
    savedPlayers: protectedProcedure.query(({ ctx }) => db.getSavedPlayerIds(ctx.user.id)),
    savePlayer: protectedProcedure.input(z.object({ gameProductId: z.string().min(4).max(64), playerId: z.string().trim().min(2).max(128), zoneId: z.string().trim().max(128).optional(), label: z.string().trim().max(80).optional() })).mutation(({ ctx, input }) => db.savePlayerId({ userId: ctx.user.id, ...input })),
    updateSavedPlayer: protectedProcedure.input(z.object({ id: z.string().min(4).max(64), gameProductId: z.string().min(4).max(64), playerId: z.string().trim().min(2).max(128), zoneId: z.string().trim().max(128).optional(), label: z.string().trim().max(80).optional() })).mutation(({ ctx, input }) => db.updateSavedPlayerId({ userId: ctx.user.id, ...input })),
    deleteSavedPlayer: protectedProcedure.input(z.object({ id: z.string().min(4).max(64) })).mutation(({ ctx, input }) => db.deleteSavedPlayerId({ userId: ctx.user.id, ...input })),
  }),
  admin: router({
    overview: scopedAdminProcedure("dashboard").query(() => db.getAdminOverview()),
    orders: scopedAdminProcedure("orders").query(() => db.getAdminOrders()),
    updateOrderStatus: scopedAdminProcedure("orders").input(z.object({ orderId: z.string().min(4).max(64), status: z.enum(["pending", "awaiting_payment", "paid", "delivered", "failed", "expired", "refunded"]) })).mutation(({ ctx, input }) => db.updateOrderStatus({ ...input, actorUserId: ctx.user.id })),
    deliverPartnerService: scopedAdminProcedure("orders").input(z.object({
      orderId: z.string().min(4).max(64),
      method: z.enum(["CDK", "COUPON", "LINK", "READY_ACCOUNT", "NOTE"]),
      coupon: z.string().trim().max(400).optional(),
      link: z.string().trim().max(2000).optional(),
      accountEmail: z.string().trim().max(320).optional(),
      accountPassword: z.string().trim().max(400).optional(),
      note: z.string().trim().max(2000).optional(),
      instructions: z.string().trim().max(4000).optional(),
    })).mutation(({ ctx, input }) => deliverPartnerService({ ...input, actorUserId: ctx.user.id })),
    confirmCdkUpgrade: scopedAdminProcedure("orders").input(z.object({ orderId: z.string().min(4).max(64) })).mutation(({ ctx, input }) => confirmCdkUpgrade({ orderId: input.orderId, actorUserId: ctx.user.id })),
    orderSupportTickets: scopedAdminProcedure("orders").query(() => db.getAdminOrderSupportTickets()),
    reviewOrderSupportTicket: scopedAdminProcedure("orders").input(z.object({ ticketId: z.string().min(4).max(64), status: z.enum(["open", "reviewing", "resolved", "closed"]), adminReply: z.string().trim().max(5000).optional() })).mutation(({ ctx, input }) => db.reviewOrderSupportTicket({ reviewerUserId: ctx.user.id, ...input })),
    listings: scopedAdminProcedure("marketplace").input(z.object({ status: z.enum(["draft", "pending", "approved", "rejected", "closed", "sold"]).optional() }).optional()).query(({ input }) => db.getAdminMarketplaceListings(input?.status)),
    reviewListing: scopedAdminProcedure("marketplace").input(z.object({ listingId: z.string().min(4).max(64), status: z.enum(["approved", "rejected", "closed"]), reviewNote: z.string().trim().max(1000).optional() })).mutation(({ ctx, input }) => db.reviewMarketplaceListing({ reviewerUserId: ctx.user.id, ...input })),
    deleteListing: scopedAdminProcedure("marketplace").input(z.object({ listingId: z.string().min(4).max(64) })).mutation(({ input }) => db.deleteMarketplaceListingByAdmin(input)),
    verifications: scopedAdminProcedure("marketplace").input(z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }).optional()).query(({ input }) => db.getAdminMarketplaceVerifications(input?.status)),
    verificationEvidence: scopedAdminProcedure("marketplace").input(z.object({ verificationId: z.string().min(4).max(64) })).query(({ input }) => db.getAdminVerificationEvidence(input.verificationId)),
    openVerificationEvidence: scopedAdminProcedure("marketplace").input(z.object({ evidenceId: z.string().min(4).max(64), reason: z.string().trim().min(5).max(500) })).mutation(async ({ ctx, input }) => { const evidence = await db.logMarketplaceEvidenceAccess({ evidenceId: input.evidenceId, adminUserId: ctx.user.id, action: "view", reason: input.reason }); return storageGet(evidence.storageKey); }),
    removeVerificationEvidence: scopedAdminProcedure("marketplace").input(z.object({ evidenceId: z.string().min(4).max(64), reason: z.string().trim().min(10).max(500) })).mutation(({ ctx, input }) => db.removeMarketplaceEvidenceReference({ evidenceId: input.evidenceId, adminUserId: ctx.user.id, reason: input.reason })),
    reviewVerification: scopedAdminProcedure("marketplace").input(z.object({ verificationId: z.string().min(4).max(64), status: z.enum(["approved", "rejected"]), verificationNote: z.string().trim().max(1000).optional() })).mutation(({ ctx, input }) => db.reviewMarketplaceVerification({ reviewerUserId: ctx.user.id, ...input })),
    fraudReports: scopedAdminProcedure("marketplace").query(() => db.getAdminMarketplaceFraudReports()),
    updateFraudReport: scopedAdminProcedure("marketplace").input(z.object({ reportId: z.string().min(4).max(64), status: z.enum(fraudReportStatuses), adminNote: z.string().trim().max(5000).optional() })).mutation(({ ctx, input }) => db.updateMarketplaceFraudReport({ reviewerUserId: ctx.user.id, ...input })),
    disclosureRequests: scopedAdminProcedure("marketplace").query(() => db.getAdminMarketplaceDisclosureRequests()),
    createDisclosureRequest: scopedAdminProcedure("marketplace").input(z.object({ fraudReportId: z.string().min(4).max(64), requestBasis: z.string().trim().min(10).max(500) })).mutation(({ input }) => db.createMarketplaceDisclosureRequest(input)),
    reviewDisclosureRequest: scopedAdminProcedure("marketplace").input(z.object({ requestId: z.string().min(4).max(64), status: z.enum(disclosureRequestStatuses), reviewNote: z.string().trim().max(5000).optional() })).mutation(({ ctx, input }) => db.reviewMarketplaceDisclosureRequest({ reviewerUserId: ctx.user.id, ...input })),
    evidenceAccessLogs: scopedAdminProcedure("marketplace").query(() => db.getAdminMarketplaceEvidenceAccessLogs()),
    catalog: scopedAdminProcedure("catalog").query(async () => ({ games: await db.getGameCatalog() })),
    partnerCatalog: scopedAdminProcedure("catalog").query(async () => {
      try {
        const rows = await getAdminPartnerCatalog();
        return {
          configured: true as const,
          products: rows.map(({ product, override }) => {
            const live = applyPartnerPriceOverride(product, override);
            const publicProduct = toPublicPartnerProduct(live, override);
            return {
              ...publicProduct,
              apiPriceUsd: product.priceUsd,
              hidden: Boolean(override?.hidden),
              sourceDescription: product.description.slice(0, 4000),
              sourceInstructions: product.instructions.slice(0, 4000),
            };
          }),
        };
      } catch (error) {
        if (error instanceof PartnerServiceError && error.code === "NOT_CONFIGURED") return { configured: false as const, products: [] };
        throw error;
      }
    }),
    savePartnerService: scopedAdminProcedure("catalog").input(z.object({
      slug: z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,89}$/),
      priceUsd: z.string().regex(/^\d{1,6}(?:\.\d{1,2})?$/).optional(),
      nameEn: z.string().trim().max(180).optional(),
      nameKh: z.string().trim().max(180).optional(),
      descriptionEn: z.string().trim().max(6000).optional(),
      descriptionKh: z.string().trim().max(6000).optional(),
      instructionsEn: z.string().trim().max(6000).optional(),
      instructionsKh: z.string().trim().max(6000).optional(),
      hidden: z.boolean().optional(),
    })).mutation(({ ctx, input }) => savePartnerOverride({ slug: input.slug, override: input, updatedByUserId: ctx.user.id })),
    fullCatalog: scopedAdminProcedure("catalog").query(() => db.getAdminCatalog()),
    providerCatalogStatus: scopedAdminProcedure("catalog").query(() => getProviderCatalogStatus()),
    previewGamePackages: scopedAdminProcedure("catalog").input(z.object({ gameId: z.string().trim().min(1).max(120) })).query(({ input }) => fetchProviderPreviewPackages(input.gameId)),
    providerAvailability: scopedAdminProcedure("catalog").query(() => getProviderAvailabilityCatalog()),
    setProviderAvailability: scopedAdminProcedure("catalog").input(z.object({ kind: z.literal("game"), providerId: z.string().trim().min(1).max(120), isActive: z.boolean() })).mutation(({ ctx, input }) => setProviderAvailability({ ...input, updatedByUserId: ctx.user.id })),
    syncTopupCatalog: scopedAdminProcedure("catalog").mutation(async () => { const snapshot = await fetchFzrProviderSyncSnapshot(); if (snapshot.status !== "ready") throw new Error("FZR Cards catalog is currently unavailable"); return db.syncFzrCatalog(snapshot); }),
    updateGamePackage: scopedAdminProcedure("catalog").input(z.object({ packageId: z.string().min(4).max(64), priceUsd: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(), basePriceUsd: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(), profitMarginPercent: z.string().regex(/^\d+(\.\d{1,2})?$/).refine((value) => Number(value) <= 1000).optional(), isActive: z.boolean(), featured: z.boolean() }).refine((input) => Boolean(input.priceUsd ?? input.basePriceUsd), "A base price is required")).mutation(({ input }) => db.updateGamePackage({ ...input, basePriceUsd: input.basePriceUsd ?? input.priceUsd!, profitMarginPercent: input.profitMarginPercent ?? "0.00" })),
    savePackageCategory: scopedAdminProcedure("catalog").input(z.object({ gameId: z.string().trim().min(1).max(120), offerId: z.string().trim().min(1).max(180), categoryLabel: z.string().trim().min(1).max(80) })).mutation(({ ctx, input }) => db.saveProviderPackageCategoryOverride({ ...input, updatedByUserId: ctx.user.id })),
    resetPackageCategory: scopedAdminProcedure("catalog").input(z.object({ gameId: z.string().trim().min(1).max(120), offerId: z.string().trim().min(1).max(180) })).mutation(({ ctx, input }) => db.resetProviderPackageCategoryOverride({ ...input, updatedByUserId: ctx.user.id })),
    setPackageBadge: scopedAdminProcedure("catalog").input(z.object({ gameId: z.string().trim().min(1).max(120), offerId: z.string().trim().min(1).max(180), label: z.string().trim().min(1).max(40), tone: z.enum(["discount", "hot", "new", "best", "gold"]).optional() })).mutation(({ ctx, input }) => db.savePackageBadgeOverride({ ...input, updatedByUserId: ctx.user.id })),
    resetPackageBadge: scopedAdminProcedure("catalog").input(z.object({ gameId: z.string().trim().min(1).max(120), offerId: z.string().trim().min(1).max(180) })).mutation(({ input }) => db.resetPackageBadgeOverride(input)),
    deleteGamePackage: scopedAdminProcedure("catalog").input(z.object({ packageId: z.string().min(4).max(64) })).mutation(({ input }) => db.deleteGamePackage(input.packageId)),
    payments: scopedAdminProcedure("operations").query(() => db.getPaymentTransactions()),
    operationUsers: scopedAdminProcedure("operations").query(() => db.getAdminUsers()),
    liveSpinEvents: ownerProcedure.query(() => getLiveSpinEvents()),
    liveSpinEventDetail: ownerProcedure.input(z.object({ eventId: z.string().min(4).max(64) })).query(({ input }) => getLiveSpinOwnerEventDetail(input.eventId)),
    liveSpinPrizeTiers: ownerProcedure.input(z.object({ eventId: z.string().min(4).max(64) })).query(({ input }) => getLiveSpinPrizeTiers(input.eventId)),
    liveSpinAuditLog: ownerProcedure.input(z.object({ eventId: z.string().min(4).max(64).optional() }).optional()).query(({ input }) => getLiveSpinAuditLog(input?.eventId)),
    createLiveSpinEvent: ownerProcedure.input(z.object({ scheduledAt: z.coerce.date(), announcementStartsAt: z.coerce.date(), entryCutoffAt: z.coerce.date(), lobbyStartsAt: z.coerce.date(), adMediaUrl: z.string().trim().max(2048).refine((value) => value.startsWith("/api/media/") || value.startsWith("/manus-storage/") || /^https:\/\//i.test(value), "Use a managed media URL or HTTPS video URL").nullable().optional(), adDurationSeconds: z.number().int().min(0).max(7_200).optional(), minParticipantCount: z.number().int().min(100).max(100_000).optional(), winnerCount: z.number().int().min(1).max(10).optional(), consolationGiftCount: z.number().int().min(0).max(10).optional(), spinEnabled: z.boolean().optional() })).mutation(({ ctx, input }) => createLiveSpinEvent({ actorUserId: ctx.user.id, ...input })),
    createOwnerLiveSpinTestEvent: ownerProcedure.mutation(({ ctx }) => createOwnerLiveSpinTestEvent({ actorUserId: ctx.user.id })),
    addOwnerLiveSpinTestEntry: ownerProcedure.input(z.object({ eventId: z.string().min(4).max(64) })).mutation(({ ctx, input }) => addOwnerLiveSpinTestEntry({ actorUserId: ctx.user.id, ...input })),
    saveLiveSpinSettings: ownerProcedure.input(z.object({ eventId: z.string().min(4).max(64), spinEnabled: z.boolean(), minParticipantCount: z.number().int().min(100).max(100_000), winnerCount: z.number().int().min(1).max(10), consolationGiftCount: z.number().int().min(0).max(10) })).mutation(({ ctx, input }) => saveLiveSpinSettings({ actorUserId: ctx.user.id, ...input })),
    saveLiveSpinConsolationGift: ownerProcedure.input(z.object({ eventId: z.string().min(4).max(64), slotNumber: z.number().int().min(1).max(10), nameKh: z.string().trim().min(1).max(180), valueLabel: z.string().trim().min(1).max(180), descriptionKh: z.string().trim().max(500).nullable().optional(), mediaUrl: z.string().trim().max(2048).nullable().optional(), isActive: z.boolean() })).mutation(({ ctx, input }) => saveLiveSpinConsolationGift({ actorUserId: ctx.user.id, ...input })),
    announceLiveSpinEvent: ownerProcedure.input(z.object({ eventId: z.string().min(4).max(64) })).mutation(({ ctx, input }) => announceLiveSpinEvent({ actorUserId: ctx.user.id, ...input })),
    lockLiveSpinParticipants: ownerProcedure.input(z.object({ eventId: z.string().min(4).max(64) })).mutation(({ ctx, input }) => lockLiveSpinParticipants({ actorUserId: ctx.user.id, ...input })),
    startLiveSpinLobby: ownerProcedure.input(z.object({ eventId: z.string().min(4).max(64) })).mutation(({ ctx, input }) => startLiveSpinLobby({ actorUserId: ctx.user.id, ...input })),
    startLiveSpin: ownerProcedure.input(z.object({ eventId: z.string().min(4).max(64) })).mutation(({ ctx, input }) => runLiveSpinSequence({ actorUserId: ctx.user.id, ...input })),
    advanceLiveSpinPhase: ownerProcedure.input(z.object({ eventId: z.string().min(4).max(64) })).mutation(({ ctx, input }) => advanceLiveSpinSequence({ actorUserId: ctx.user.id, ...input })),
    revealLiveSpinPrize: ownerProcedure.input(z.object({ eventId: z.string().min(4).max(64) })).mutation(({ ctx, input }) => revealLiveSpinPrize({ actorUserId: ctx.user.id, ...input })),
    endLiveSpinEvent: ownerProcedure.input(z.object({ eventId: z.string().min(4).max(64), reason: z.string().trim().min(10).max(500) })).mutation(({ ctx, input }) => endLiveSpinEvent({ actorUserId: ctx.user.id, ...input })),
    skipLiveSpinWeek: ownerProcedure.input(z.object({ eventId: z.string().min(4).max(64), reason: z.string().trim().min(10).max(500) })).mutation(({ ctx, input }) => skipLiveSpinWeek({ actorUserId: ctx.user.id, ...input })),
    saveLiveSpinPrizeTier: ownerProcedure.input(z.object({ eventId: z.string().min(4).max(64), tierNumber: z.number().int().min(1).max(10), nameKh: z.string().trim().min(2).max(180), valueLabel: z.string().trim().min(1).max(180), descriptionKh: z.string().trim().max(500).nullable().optional(), mediaUrl: z.string().trim().max(2048).refine((value) => value.startsWith("/api/media/") || value.startsWith("/manus-storage/") || /^https:\/\//i.test(value), "Use a managed media URL or HTTPS image URL").nullable().optional(), isGrandPrize: z.boolean(), isActive: z.boolean() })).mutation(({ ctx, input }) => saveLiveSpinPrizeTier({ actorUserId: ctx.user.id, ...input })),
    paymentControl: ownerProcedure.query(() => db.getPaymentControl()),
    paymentMethods: ownerProcedure.query(() => db.getPaymentMethods(true)),
    savePaymentMethod: ownerProcedure.input(z.object({ id: z.string().trim().min(2).max(48), name: z.string().trim().min(2).max(120), descriptionKh: z.string().trim().min(2).max(240), iconUrl: z.string().trim().max(2048).refine((value) => value.startsWith("/api/media/") || value.startsWith("/manus-storage/") || /^https:\/\//i.test(value), "Use managed storage or an HTTPS icon URL").nullable().optional(), providerKey: z.enum(["bakong_khqr", "manual"]), isActive: z.boolean(), sortOrder: z.number().int().min(0).max(10_000) })).mutation(({ ctx, input }) => db.savePaymentMethod({ ...input, updatedByUserId: ctx.user.id })),
    providerCredentialStatus: ownerProcedure.query(async () => getProviderCredentialStatus()),
    providerCredentialHistory: ownerProcedure.query(() => getProviderCredentialHistory()),
    rotateProviderCredential: ownerProcedure.input(z.object({ provider: z.enum(["fazercards", "bakong"]), credential: z.string().trim().min(8).max(4096), confirmation: z.string().trim().max(40), reason: z.string().trim().min(10).max(240) })).mutation(async ({ ctx, input }) => {
      const expectedConfirmation = input.provider === "fazercards" ? "ROTATE FAZERCARDS" : "ROTATE BAKONG";
      if (input.confirmation !== expectedConfirmation) throw new Error("Confirmation text does not match the selected provider");
      const validation = await validateProviderCredentialCandidate(input.provider, input.credential);
      if (validation !== "validated") {
        await recordProviderCredentialValidationRejected({ provider: input.provider, actorUserId: ctx.user.id, reason: validation === "unavailable" ? "Provider validation unavailable; no credential stored" : "Candidate validation rejected; no credential stored" });
        throw new Error(validation === "unavailable" ? "Provider validation is temporarily unavailable; no credential was stored" : "Credential validation failed; no credential was stored");
      }
      const result = await activateEncryptedProviderCredential({ provider: input.provider, envelope: encryptCredential(input.credential), actorUserId: ctx.user.id, reason: input.reason });
      if (input.provider === "bakong") resetBakongMerchantPreflightCache();
      return { provider: input.provider, rotated: true, versionId: result.versionId };
    }),
    rollbackProviderCredential: ownerProcedure.input(z.object({ provider: z.enum(["fazercards", "bakong"]), targetVersionId: z.string().min(4).max(64).optional(), confirmation: z.string().trim().max(40), reason: z.string().trim().min(10).max(240) })).mutation(async ({ ctx, input }) => {
      const expectedConfirmation = input.provider === "fazercards" ? "ROLLBACK FAZERCARDS" : "ROLLBACK BAKONG";
      if (input.confirmation !== expectedConfirmation) throw new Error("Confirmation text does not match the selected provider");
      const result = await rollbackProviderCredential({ provider: input.provider, targetVersionId: input.targetVersionId, actorUserId: ctx.user.id, reason: input.reason });
      if (input.provider === "bakong") resetBakongMerchantPreflightCache();
      return { provider: input.provider, rolledBack: true, activeVersionId: result.activeVersionId };
    }),
    setPaymentControl: ownerProcedure.input(z.object({ enabled: z.boolean() })).mutation(({ ctx, input }) => db.setPaymentControl({ ...input, updatedByUserId: ctx.user.id })),
    users: ownerProcedure.query(() => db.getAdminUsers()),
    roleAudits: ownerProcedure.query(() => db.getAdminRoleAudits()),
    setUserRole: ownerProcedure.input(z.object({ targetUserId: z.number().int().positive(), nextRole: z.enum(["user", "admin"]), confirmationEmail: z.string().trim().email().max(320), reason: z.string().trim().min(10).max(500) })).mutation(({ ctx, input }) => db.setAdminUserRole({ actorUserId: ctx.user.id, ...input })),
    grantUserAdminAccess: ownerProcedure.input(z.object({ targetUserId: z.number().int().positive(), permissions: z.array(z.enum(["dashboard", "orders", "catalog", "media", "support", "marketplace", "payments", "operations"])).min(1).max(8), confirmationEmail: z.string().trim().email().max(320), reason: z.string().trim().min(10).max(500) })).mutation(({ ctx, input }) => db.grantDelegatedAdminAccess({ actorUserId: ctx.user.id, ...input })),
    myPermissions: protectedProcedure.query(async ({ ctx }) => ({ isOwner: isSingleAdminEmail(ctx.user.email), permissions: isSingleAdminEmail(ctx.user.email) ? db.getOwnerAdminPermissions() : ctx.user.role === "admin" ? await db.getDelegatedAdminPermissions(ctx.user.id) : [] })),
    userPermissions: ownerProcedure.input(z.object({ targetUserId: z.number().int().positive() })).query(({ input }) => db.getDelegatedAdminPermissions(input.targetUserId)),
    setUserPermissions: ownerProcedure.input(z.object({ targetUserId: z.number().int().positive(), permissions: z.array(z.enum(["dashboard", "orders", "catalog", "media", "support", "marketplace", "payments", "operations"])).max(8) })).mutation(({ ctx, input }) => db.setDelegatedAdminPermissions({ actorUserId: ctx.user.id, ...input })),
    content: scopedAdminProcedure("media").query(() => db.getSiteContent()),
    saveContent: scopedAdminProcedure("media").input(z.object({ contentKey: z.string().trim().min(2).max(100), titleKh: z.string().trim().max(240).optional(), bodyKh: z.string().trim().max(5000).optional(), mediaUrl: z.string().trim().max(2048).refine((value) => value.startsWith("/api/media/") || value.startsWith("/manus-storage/") || /^https?:\/\//i.test(value), "Use a secure media URL").optional(), isActive: z.boolean() })).mutation(({ ctx, input }) => db.saveSiteContent({ updatedByUserId: ctx.user.id, ...input })),
    contactAdmins: scopedAdminProcedure("support").query(() => db.getContactAdmins(true)),
    saveContactAdmin: scopedAdminProcedure("support").input(z.object({ id: z.string().trim().min(4).max(64), displayName: z.string().trim().min(2).max(120), telegramUsername: z.string().trim().regex(/^@?[a-zA-Z0-9_]{5,32}$/, "Telegram username must use letters, numbers, or underscores"), workingHoursStart: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), workingHoursEnd: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), replyTimeText: z.string().trim().min(2).max(160), photoUrl: z.string().trim().max(2048).refine((value) => value.startsWith("/api/media/") || value.startsWith("/manus-storage/") || /^https:\/\//i.test(value), "Use managed storage or an HTTPS photo URL").nullable().optional(), isVisible: z.boolean(), sortOrder: z.number().int().min(0).max(10_000) })).mutation(({ ctx, input }) => db.saveContactAdmin({ ...input, updatedByUserId: ctx.user.id })),
    gameImages: scopedAdminProcedure("media").query(() => db.getProviderGameImageOverrides()),
    saveGameImages: scopedAdminProcedure("media").input(z.object({ gameId: z.string().trim().min(1).max(120), logoUrl: z.string().trim().max(2048).refine((value) => value.startsWith("/api/media/") || value.startsWith("/manus-storage/") || /^https:\/\//i.test(value), "Use managed storage or an HTTPS logo URL").nullable().optional(), cardArtworkUrl: z.string().trim().max(2048).refine((value) => value.startsWith("/api/media/") || value.startsWith("/manus-storage/") || /^https:\/\//i.test(value), "Use managed storage or an HTTPS artwork URL").nullable().optional() })).mutation(({ ctx, input }) => db.saveProviderGameImageOverride({ ...input, updatedByUserId: ctx.user.id })),
    resetGameImage: scopedAdminProcedure("media").input(z.object({ gameId: z.string().trim().min(1).max(120), slot: z.enum(["logo", "cardArtwork"]) })).mutation(({ input }) => db.resetProviderGameImageSlot(input)),
    packageArtwork: scopedAdminProcedure("media").input(z.object({ gameId: z.string().trim().min(1).max(120).optional() }).optional()).query(({ input }) => db.getProviderPackageArtworkOverrides(input?.gameId)),
    savePackageArtwork: scopedAdminProcedure("media").input(z.object({ gameId: z.string().trim().min(1).max(120), offerId: z.string().trim().min(1).max(180), mediaUrl: z.string().trim().min(1).max(2048).refine((value) => value.startsWith("/api/media/") || value.startsWith("/manus-storage/") || /^https:\/\//i.test(value), "Use managed storage or an HTTPS artwork URL") })).mutation(({ ctx, input }) => db.saveProviderPackageArtworkOverride({ ...input, updatedByUserId: ctx.user.id })),
    resetPackageArtwork: scopedAdminProcedure("media").input(z.object({ gameId: z.string().trim().min(1).max(120), offerId: z.string().trim().min(1).max(180) })).mutation(({ ctx, input }) => db.resetProviderPackageArtworkOverride({ ...input, updatedByUserId: ctx.user.id })),
    packageArtworkAudits: scopedAdminProcedure("media").input(z.object({ gameId: z.string().trim().min(1).max(120).optional() }).optional()).query(({ input }) => db.getProviderPackageArtworkAudits(input?.gameId)),
  }),
});

export type AppRouter = typeof appRouter;
