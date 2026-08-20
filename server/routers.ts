import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { uploadMarketplaceScreenshot } from "./uploads";

const marketplaceType = z.enum(["sale", "swap", "wanted"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  catalog: router({
    games: publicProcedure.query(() => db.getGameCatalog()),
    smm: publicProcedure.query(() => db.getSmmCatalog()),
  }),
  marketplace: router({
    list: publicProcedure.input(z.object({ listingType: marketplaceType.optional(), game: z.string().max(120).optional(), search: z.string().max(120).optional() }).optional()).query(({ input }) => db.listMarketplace(input ?? {})),
    submit: protectedProcedure.input(z.object({ listingType: marketplaceType, game: z.string().trim().min(2).max(120), title: z.string().trim().min(4).max(180), rankLevel: z.string().trim().min(2).max(180), priceUsd: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(), description: z.string().trim().min(20).max(5000), contactMethod: z.string().trim().min(3).max(180), screenshots: z.array(z.string().url()).max(8).optional() })).mutation(({ ctx, input }) => db.submitMarketplaceListing({ sellerUserId: ctx.user.id, ...input })),
    contact: protectedProcedure.input(z.object({ listingId: z.string().min(4).max(64), message: z.string().trim().min(4).max(1000) })).mutation(({ ctx, input }) => db.initiateMarketplaceContact({ initiatorUserId: ctx.user.id, ...input })),
  }),
  uploads: router({
    marketplaceScreenshot: protectedProcedure.input(z.object({ fileName: z.string().trim().min(1).max(180), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), dataUrl: z.string().min(50).max(7_000_000) })).mutation(({ ctx, input }) => uploadMarketplaceScreenshot({ userId: ctx.user.id, ...input })),
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
    listings: adminProcedure.input(z.object({ status: z.enum(["draft", "pending", "approved", "rejected", "closed"]).optional() }).optional()).query(({ input }) => db.getAdminMarketplaceListings(input?.status)),
    reviewListing: adminProcedure.input(z.object({ listingId: z.string().min(4).max(64), status: z.enum(["approved", "rejected", "closed"]), reviewNote: z.string().trim().max(1000).optional() })).mutation(({ ctx, input }) => db.reviewMarketplaceListing({ reviewerUserId: ctx.user.id, ...input })),
    catalog: adminProcedure.query(async () => ({ games: await db.getGameCatalog(), smm: await db.getSmmCatalog() })),
    updateGamePackage: adminProcedure.input(z.object({ packageId: z.string().min(4).max(64), priceUsd: z.string().regex(/^\d+(\.\d{1,2})?$/), isActive: z.boolean(), featured: z.boolean() })).mutation(({ input }) => db.updateGamePackage(input)),
    updateSmmTier: adminProcedure.input(z.object({ tierId: z.string().min(4).max(64), priceUsd: z.string().regex(/^\d+(\.\d{1,2})?$/), isActive: z.boolean() })).mutation(({ input }) => db.updateSmmTier(input)),
    payments: adminProcedure.query(() => db.getPaymentTransactions()),
    users: adminProcedure.query(() => db.getAdminUsers()),
    content: adminProcedure.query(() => db.getSiteContent()),
    saveContent: adminProcedure.input(z.object({ contentKey: z.string().trim().min(2).max(100), titleKh: z.string().trim().max(240).optional(), bodyKh: z.string().trim().max(5000).optional(), isActive: z.boolean() })).mutation(({ ctx, input }) => db.saveSiteContent({ updatedByUserId: ctx.user.id, ...input })),
  }),
});

export type AppRouter = typeof appRouter;
