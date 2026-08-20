import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { fetchProviderGames, fetchProviderPackages } from "./providerCatalog";
import { buildZursMemberDisplayName } from "./storefrontDomain";
import { uploadMarketplaceScreenshot, uploadMarketplaceVerificationEvidence } from "./uploads";
import { storageGet } from "./storage";
import { createDiditHostedSession } from "./didit";
import { disclosureRequestStatuses, fraudReportStatuses } from "./marketplaceSafety";
import { deriveLocationRisk, resolveLocationCountry } from "./marketplaceLocation";

const marketplaceType = z.enum(["sale", "swap", "wanted"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    setMemberDisplayName: protectedProcedure.input(z.object({ name: z.string().trim().max(120).optional() })).mutation(({ ctx, input }) => db.updateUserDisplayName({ userId: ctx.user.id, displayName: buildZursMemberDisplayName(input.name) })),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  catalog: router({
    games: publicProcedure.query(() => db.getGameCatalog()),
    smm: publicProcedure.query(() => db.getSmmCatalog()),
  }),
  provider: router({
    games: publicProcedure.query(() => fetchProviderGames()),
    packages: publicProcedure.input(z.object({ gameId: z.string().trim().min(1).max(120), fields: z.record(z.string().trim().max(64), z.string().trim().min(1).max(256)).refine((fields) => Object.keys(fields).length <= 12, "Too many provider fields") })).mutation(({ input }) => fetchProviderPackages(input)),
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
    mine: protectedProcedure.query(({ ctx }) => db.getSellerMarketplaceListings(ctx.user.id)),
    reportFraud: protectedProcedure.input(z.object({ listingId: z.string().min(4).max(64), details: z.string().trim().min(20).max(5000) })).mutation(({ ctx, input }) => db.createMarketplaceFraudReport({ reporterUserId: ctx.user.id, ...input })),
  }),
  uploads: router({
    marketplaceScreenshot: protectedProcedure.input(z.object({ fileName: z.string().trim().min(1).max(180), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), dataUrl: z.string().min(50).max(7_000_000) })).mutation(async ({ ctx, input }) => { const upload = await uploadMarketplaceScreenshot({ userId: ctx.user.id, ...input }); return { key: upload.key }; }),
  }),
  orders: router({
    createTopup: protectedProcedure.input(z.object({ packageId: z.string().min(4).max(64), playerId: z.string().trim().min(2).max(128), zoneId: z.string().trim().min(1).max(128).optional(), quantity: z.number().int().min(1).max(9) })).mutation(({ ctx, input }) => db.createTopupOrder({ userId: ctx.user.id, ...input })),
    createSmm: protectedProcedure.input(z.object({ tierId: z.string().min(4).max(64), target: z.string().trim().min(3).max(500) })).mutation(({ ctx, input }) => db.createSmmOrder({ userId: ctx.user.id, ...input })),
    beginPayment: protectedProcedure.input(z.object({ orderId: z.string().min(4).max(64) })).mutation(({ ctx, input }) => db.beginStagedPayment({ userId: ctx.user.id, ...input })),
    paymentSession: protectedProcedure.input(z.object({ orderId: z.string().min(4).max(64) })).query(({ ctx, input }) => db.getCustomerPaymentSession({ userId: ctx.user.id, ...input })),
    mine: protectedProcedure.query(({ ctx }) => db.getCustomerOrders(ctx.user.id)),
    savedPlayers: protectedProcedure.query(({ ctx }) => db.getSavedPlayerIds(ctx.user.id)),
    savePlayer: protectedProcedure.input(z.object({ gameProductId: z.string().min(4).max(64), playerId: z.string().trim().min(2).max(128), zoneId: z.string().trim().max(128).optional(), label: z.string().trim().max(80).optional() })).mutation(({ ctx, input }) => db.savePlayerId({ userId: ctx.user.id, ...input })),
    updateSavedPlayer: protectedProcedure.input(z.object({ id: z.string().min(4).max(64), gameProductId: z.string().min(4).max(64), playerId: z.string().trim().min(2).max(128), zoneId: z.string().trim().max(128).optional(), label: z.string().trim().max(80).optional() })).mutation(({ ctx, input }) => db.updateSavedPlayerId({ userId: ctx.user.id, ...input })),
    deleteSavedPlayer: protectedProcedure.input(z.object({ id: z.string().min(4).max(64) })).mutation(({ ctx, input }) => db.deleteSavedPlayerId({ userId: ctx.user.id, ...input })),
  }),
  admin: router({
    overview: adminProcedure.query(() => db.getAdminOverview()),
    orders: adminProcedure.query(() => db.getAdminOrders()),
    updateOrderStatus: adminProcedure.input(z.object({ orderId: z.string().min(4).max(64), status: z.enum(["pending", "awaiting_payment", "paid", "delivered", "failed", "expired", "refunded"]) })).mutation(({ input }) => db.updateOrderStatus(input)),
    listings: adminProcedure.input(z.object({ status: z.enum(["draft", "pending", "approved", "rejected", "closed", "sold"]).optional() }).optional()).query(({ input }) => db.getAdminMarketplaceListings(input?.status)),
    reviewListing: adminProcedure.input(z.object({ listingId: z.string().min(4).max(64), status: z.enum(["approved", "rejected", "closed"]), reviewNote: z.string().trim().max(1000).optional() })).mutation(({ ctx, input }) => db.reviewMarketplaceListing({ reviewerUserId: ctx.user.id, ...input })),
    verifications: adminProcedure.input(z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }).optional()).query(({ input }) => db.getAdminMarketplaceVerifications(input?.status)),
    verificationEvidence: adminProcedure.input(z.object({ verificationId: z.string().min(4).max(64) })).query(({ input }) => db.getAdminVerificationEvidence(input.verificationId)),
    openVerificationEvidence: adminProcedure.input(z.object({ evidenceId: z.string().min(4).max(64), reason: z.string().trim().min(5).max(500) })).mutation(async ({ ctx, input }) => { const evidence = await db.logMarketplaceEvidenceAccess({ evidenceId: input.evidenceId, adminUserId: ctx.user.id, action: "view", reason: input.reason }); return storageGet(evidence.storageKey); }),
    removeVerificationEvidence: adminProcedure.input(z.object({ evidenceId: z.string().min(4).max(64), reason: z.string().trim().min(10).max(500) })).mutation(({ ctx, input }) => db.removeMarketplaceEvidenceReference({ evidenceId: input.evidenceId, adminUserId: ctx.user.id, reason: input.reason })),
    reviewVerification: adminProcedure.input(z.object({ verificationId: z.string().min(4).max(64), status: z.enum(["approved", "rejected"]), verificationNote: z.string().trim().max(1000).optional() })).mutation(({ ctx, input }) => db.reviewMarketplaceVerification({ reviewerUserId: ctx.user.id, ...input })),
    fraudReports: adminProcedure.query(() => db.getAdminMarketplaceFraudReports()),
    updateFraudReport: adminProcedure.input(z.object({ reportId: z.string().min(4).max(64), status: z.enum(fraudReportStatuses), adminNote: z.string().trim().max(5000).optional() })).mutation(({ ctx, input }) => db.updateMarketplaceFraudReport({ reviewerUserId: ctx.user.id, ...input })),
    disclosureRequests: adminProcedure.query(() => db.getAdminMarketplaceDisclosureRequests()),
    createDisclosureRequest: adminProcedure.input(z.object({ fraudReportId: z.string().min(4).max(64), requestBasis: z.string().trim().min(10).max(500) })).mutation(({ input }) => db.createMarketplaceDisclosureRequest(input)),
    reviewDisclosureRequest: adminProcedure.input(z.object({ requestId: z.string().min(4).max(64), status: z.enum(disclosureRequestStatuses), reviewNote: z.string().trim().max(5000).optional() })).mutation(({ ctx, input }) => db.reviewMarketplaceDisclosureRequest({ reviewerUserId: ctx.user.id, ...input })),
    evidenceAccessLogs: adminProcedure.query(() => db.getAdminMarketplaceEvidenceAccessLogs()),
    catalog: adminProcedure.query(async () => ({ games: await db.getGameCatalog(), smm: await db.getSmmCatalog() })),
    updateGamePackage: adminProcedure.input(z.object({ packageId: z.string().min(4).max(64), priceUsd: z.string().regex(/^\d+(\.\d{1,2})?$/), isActive: z.boolean(), featured: z.boolean() })).mutation(({ input }) => db.updateGamePackage(input)),
    updateSmmTier: adminProcedure.input(z.object({ tierId: z.string().min(4).max(64), priceUsd: z.string().regex(/^\d+(\.\d{1,2})?$/), isActive: z.boolean() })).mutation(({ input }) => db.updateSmmTier(input)),
    payments: adminProcedure.query(() => db.getPaymentTransactions()),
    users: adminProcedure.query(() => db.getAdminUsers()),
    content: adminProcedure.query(() => db.getSiteContent()),
    saveContent: adminProcedure.input(z.object({ contentKey: z.string().trim().min(2).max(100), titleKh: z.string().trim().max(240).optional(), bodyKh: z.string().trim().max(5000).optional(), mediaUrl: z.string().url().max(2048).optional(), isActive: z.boolean() })).mutation(({ ctx, input }) => db.saveSiteContent({ updatedByUserId: ctx.user.id, ...input })),
  }),
});

export type AppRouter = typeof appRouter;
