import { describe, expect, it } from "vitest";
import { packageCardHeader } from "./packageCardHeader";

describe("package card header", () => {
  it("uses Kagura-style diamond titles", () => {
    expect(packageCardHeader({ label: "86 Diamonds", amountLabel: "86 Diamonds" })).toBe("💎86 ពេជ្យ");
    expect(packageCardHeader({ label: "250 + 25 Diamonds", amountLabel: "250 + 25 Diamonds" })).toBe("💎275 ពេជ្យ");
  });

  it("uses Weekly / Nx Weekly for pass cards", () => {
    expect(packageCardHeader({ label: "Weekly Pass", amountLabel: "Weekly Pass", quantity: 1 })).toBe("Weekly");
    expect(packageCardHeader({ label: "2x Weekly", amountLabel: "2x Weekly", quantity: 2 })).toBe("2x Weekly");
  });

  it("keeps bundle and currency titles clean", () => {
    expect(packageCardHeader({ label: "Weekly Elite Bundle", amountLabel: "Weekly Elite Bundle" })).toBe("Weekly Elite Bundle");
    expect(packageCardHeader({ label: "60 UC", amountLabel: "60 UC" })).toBe("60 UC");
    expect(packageCardHeader({ label: "800 Robux", amountLabel: "800 Robux" })).toBe("800 Robux");
  });
});
