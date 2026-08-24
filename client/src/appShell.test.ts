import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("storefront artwork loading hints", () => {
  it("warms the provider artwork connection without changing package records or card markup", () => {
    const html = readFileSync(join(process.cwd(), "client/index.html"), "utf8");
    expect(html).toContain('<link rel="dns-prefetch" href="https://reseller.fazercards.com" />');
    expect(html).toContain('<link rel="preconnect" href="https://reseller.fazercards.com" crossorigin />');
  });
});
