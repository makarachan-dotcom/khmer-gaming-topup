import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
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
    // Owner-controlled ZURS sessions (including Appwrite Auth) take priority.
    // This prevents a missing external OAuth configuration from interrupting
    // authenticated Admin mutations on the official domain.
    const fallbackProfile = await readZursSessionFallbackProfile(opts.req);
    if (fallbackProfile) user = fallbackProfile;
    else {
      const openId = await readZursSession(opts.req);
      user = openId ? await getUserByOpenId(openId) ?? null : null;
    }
  } catch (error) {
    // A temporary account-store failure must not make public provider catalog
    // routes fail for an otherwise anonymous request.
    console.warn("[Auth] Optional session lookup unavailable", error instanceof Error ? error.message : error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
