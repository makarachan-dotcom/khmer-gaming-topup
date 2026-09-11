import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { countTrpcBatchProcedures, TRPC_MAX_BATCH } from "./trpcBatch";

describe("tRPC batch cap", () => {
  it("counts comma-separated procedures and caps at 10", () => {
    expect(TRPC_MAX_BATCH).toBe(10);
    expect(countTrpcBatchProcedures("/api/trpc/auth.me")).toBe(1);
    expect(countTrpcBatchProcedures("/api/trpc/auth.me?batch=1")).toBe(1);
    const fifty = Array.from({ length: 50 }, () => "auth.me").join(",");
    expect(countTrpcBatchProcedures(`/api/trpc/${fifty}?batch=1`)).toBe(50);
    expect(countTrpcBatchProcedures(`/api/trpc/${Array.from({ length: 10 }, () => "auth.me").join(",")}`)).toBe(10);
    expect(countTrpcBatchProcedures(`/api/trpc/${Array.from({ length: 11 }, () => "auth.me").join(",")}`)).toBe(11);
  });

  it("is mounted on /api/trpc before the router", () => {
    const app = readFileSync(resolve(process.cwd(), "server/app.ts"), "utf8");
    expect(app).toContain("capTrpcBatch");
    expect(app.indexOf("capTrpcBatch")).toBeLessThan(app.indexOf("createExpressMiddleware({"));
  });
});
