import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isCdkOrder, publicCdkStatus, redactCdkSecret, tokenPreview, validateCdkToken } from "../shared/cdkToken";

describe("CDK token upgrade flow", () => {
  it("validates and redacts customer tokens", () => {
    expect(() => validateCdkToken("short")).toThrow(/Token/);
    const token = "sk-live-abcdefghijklmnopqrstuvwxyz";
    expect(validateCdkToken(token)).toBe(token);
    expect(tokenPreview(token)).toBe("••••wxyz");
    const details = { kind: "partner_service", partnerDeliveryType: "CDK", cdkTokenSubmitted: true, cdkTokenPreview: "••••wxyz", cdkTokenSecret: { t: "plain", v: token } };
    expect(isCdkOrder(details)).toBe(true);
    expect(publicCdkStatus(details, "paid")).toMatchObject({ submitted: true, upgrading: true, upgraded: false });
    expect(redactCdkSecret(details)).not.toHaveProperty("cdkTokenSecret");
  });

  it("shows the paste-token card after payment and lets admin confirm the upgrade", () => {
    const checkout = readFileSync(join(process.cwd(), "client/src/pages/Checkout.tsx"), "utf8");
    const card = readFileSync(join(process.cwd(), "client/src/components/CdkUpgradeCard.tsx"), "utf8");
    const admin = readFileSync(join(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
    const router = readFileSync(join(process.cwd(), "server/routers.ts"), "utf8");
    expect(checkout).toContain("<CdkUpgradeCard");
    expect(checkout).toContain("Paste token");
    expect(card).toContain("ផ្ញើ Token");
    expect(card).toContain("plan កំពុង upgrade");
    expect(admin).toContain("AdminCdkPanel");
    expect(admin).toContain("Plan បាន upgrade");
    expect(router).toContain("submitCdkToken");
    expect(router).toContain("confirmCdkUpgrade");
  });
});
