import { describe, expect, it } from "vitest";
import { getAppwriteCustomerOrders, getAppwriteCustomerPaymentHistory, isAppwriteStoreConfigured, shouldRetryAppwriteCreateAsUpdate } from "./appwriteStore";
import { isSingleAdminEmail } from "./storefrontDomain";

describe("Appwrite user store", () => {
  it("uses server-only Appwrite credentials when they are available", () => {
    expect(isAppwriteStoreConfigured()).toBe(true);
  });

  it("exports account-history readers for Appwrite-backed Vercel sessions", () => {
    expect(typeof getAppwriteCustomerOrders).toBe("function");
    expect(typeof getAppwriteCustomerPaymentHistory).toBe("function");
  });

  it("recognizes the owner email as the single ZURS STORE administrator", () => {
    expect(isSingleAdminEmail("ChanMakara672@gmail.com")).toBe(true);
  });

  it("retries an Appwrite duplicate-document create as an idempotent update", () => {
    expect(shouldRetryAppwriteCreateAsUpdate(new Error("Appwrite user store request failed with HTTP 409"))).toBe(true);
    expect(shouldRetryAppwriteCreateAsUpdate(new Error("Appwrite user store request failed with HTTP 500"))).toBe(false);
  });
});
