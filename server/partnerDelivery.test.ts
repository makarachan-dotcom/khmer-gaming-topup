import { describe, expect, it } from "vitest";
import { buildPartnerDelivery, publicPartnerDelivery } from "../shared/partnerDelivery";

describe("partner delivery payload", () => {
  it("requires a coupon, https link, or email/password depending on method", () => {
    expect(() => buildPartnerDelivery({ method: "COUPON", deliveredByUserId: 1 })).toThrow(/Coupon/);
    const coupon = buildPartnerDelivery({ method: "COUPON", coupon: "ABCD-1234", deliveredByUserId: 7 });
    expect(coupon.coupon).toBe("ABCD-1234");
    const cdk = buildPartnerDelivery({ method: "CDK", coupon: "CDK-9988", deliveredByUserId: 7 });
    expect(cdk.method).toBe("CDK");
    expect(cdk.coupon).toBe("CDK-9988");
    const link = buildPartnerDelivery({ method: "LINK", link: "https://chat.openai.com/invite/x", deliveredByUserId: 7 });
    expect(link.link).toContain("https://");
    const account = buildPartnerDelivery({ method: "READY_ACCOUNT", accountEmail: "a@b.com", accountPassword: "secret1", deliveredByUserId: 7 });
    expect(account.accountEmail).toBe("a@b.com");
  });

  it("only exposes the vault after the order is delivered", () => {
    const delivery = buildPartnerDelivery({ method: "COUPON", coupon: "ZX-99", deliveredByUserId: 1 });
    expect(publicPartnerDelivery({ delivery }, "paid")).toBeNull();
    expect(publicPartnerDelivery({ delivery }, "delivered")?.coupon).toBe("ZX-99");
  });
});
