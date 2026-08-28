import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { isSingleAdminEmail } from '../storefrontDomain';
import { getDelegatedAdminPermissions } from "../db";
import { hasDelegatedAdminPermission, type DelegatedAdminPermission } from "../adminPermissions";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { checkRateLimit, rateLimitConstants, retryAfterSeconds } from "../rateLimiting";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const publicRateLimitedProcedure = publicProcedure.use(
  t.middleware(async ({ ctx, next }) => {
    const result = await checkRateLimit(ctx.req, "trpc-public", rateLimitConstants.publicTrpc.requests, "1 m");
    if (!result.success) {
      ctx.res.setHeader("Retry-After", String(retryAfterSeconds(result.reset)));
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests" });
    }
    return next();
  }),
);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || (ctx.user.role !== "admin" && !isSingleAdminEmail(ctx.user.email))) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export function scopedAdminProcedure(requiredPermission: DelegatedAdminPermission) {
  return t.procedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;
      if (!ctx.user || (ctx.user.role !== "admin" && !isSingleAdminEmail(ctx.user.email))) {
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      }
      if (!isSingleAdminEmail(ctx.user.email)) {
        const permissions = await getDelegatedAdminPermissions(ctx.user.id);
        if (!hasDelegatedAdminPermission(permissions, requiredPermission)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "The owner has not granted access to this Admin section." });
        }
      }
      return next({ ctx: { ...ctx, user: ctx.user } });
    }),
  );
}

export const ownerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || !isSingleAdminEmail(ctx.user.email)) throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);
