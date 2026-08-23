import { describe, expect, it } from "vitest";
import { accountRecoveryMessage } from "./accountRecovery";

describe("accountRecoveryMessage", () => {
  it("hides Appwrite database-read quota details from customers", () => {
    const message = accountRecoveryMessage("Appwrite user store request failed with HTTP 402 (limit_databases_reads_exceeded)");
    expect(message).toContain("ចរាចរណ៍ខ្ពស់");
    expect(message).not.toContain("Appwrite");
    expect(message).not.toContain("402");
  });
});
