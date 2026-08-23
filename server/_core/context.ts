import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getUserByOpenId } from "../db";
import { readZursSession, readZursSessionFallbackProfile } from "../zursSession";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export function isPublicProviderCatalogRequest(req: Pick<CreateExpressContextOptions["req"], "originalUrl" | "url">) {
  const path = req.originalUrl || req.url || "";
  return /\/api\/trpc\/provider\.(?:games|gameDetails|packages|playerIdentity|smmServices)(?:[/?]|$)/.test(path)
    || /\/api\/trpc\/payments\.readiness(?:[/?]|$)/.test(path);
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  if (isPublicProviderCatalogRequest(opts.req)) {
    return { req: opts.req, res: opts.res, user };
  }

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    try {
      const fallbackProfile = await readZursSessionFallbackProfile(opts.req);
      if (fallbackProfile) user = fallbackProfile;
      else {
        const openId = await readZursSession(opts.req);
        user = openId ? await getUserByOpenId(openId) ?? null : null;
      }
    } catch (error) {
      // A temporary fallback-account-store failure must not make public provider
      // catalog routes fail for an otherwise anonymous request.
      console.warn("[Auth] Optional fallback session lookup unavailable", error instanceof Error ? error.message : error);
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
