import { describe, expect, it } from "vitest";
import { khmerDiamondCopy } from "./khmerDiamondCopy";

describe("khmerDiamondCopy", () => {
  it("replaces Diamond wording for shoppers without touching other currencies", () => {
    expect(khmerDiamondCopy("86 Diamonds")).toBe("86 ពេជ្យ");
    expect(khmerDiamondCopy("10 + 1 Diamonds")).toBe("10 + 1 ពេជ្យ");
    expect(khmerDiamondCopy("Diamond")).toBe("ពេជ្យ");
    expect(khmerDiamondCopy("ពេជ្រ")).toBe("ពេជ្យ");
    expect(khmerDiamondCopy("60 UC")).toBe("60 UC");
    expect(khmerDiamondCopy("800 Robux")).toBe("800 Robux");
  });
});
