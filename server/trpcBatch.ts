import type { NextFunction, Request, Response } from "express";

/** tRPC HTTP batch: procedure names are comma-separated in the path. */
export const TRPC_MAX_BATCH = 10;

export function countTrpcBatchProcedures(url: string): number {
  const path = url.split("?")[0] ?? "";
  const marker = "/api/trpc/";
  const idx = path.indexOf(marker);
  const procedures = decodeURIComponent(idx >= 0 ? path.slice(idx + marker.length) : path.replace(/^\//, "")).replace(/\/+$/, "");
  if (!procedures) return 0;
  return procedures.split(",").filter((name) => name.trim().length > 0).length;
}

export function capTrpcBatch(req: Request, res: Response, next: NextFunction) {
  const count = countTrpcBatchProcedures(req.originalUrl || req.url || "");
  if (count > TRPC_MAX_BATCH) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(413).json({
      error: { message: "Batch too large", code: -32005, data: { code: "PAYLOAD_TOO_LARGE", httpStatus: 413 } },
    });
  }
  return next();
}
