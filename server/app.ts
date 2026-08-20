import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerGoogleAuthRoutes } from "./googleAuth";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";

/**
 * Builds the shared Express application for the local long-running server and
 * Vercel's serverless function runtime. This module deliberately never calls
 * `listen`, which keeps it safe to import in a function invocation.
 */
export function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // The managed hosting integration relies on Manus-only credentials. Vercel
  // receives a portable API surface instead of routes that would redirect to
  // an unavailable identity provider or storage proxy.
  if (!process.env.VERCEL) {
    registerStorageProxy(app);
    registerOAuthRoutes(app);
  }
  registerGoogleAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  return app;
}
