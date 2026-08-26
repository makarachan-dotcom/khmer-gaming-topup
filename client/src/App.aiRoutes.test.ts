import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("retired customer surface routes", () => {
  it("removes public AI routes and redirects legacy customer paths without touching the protected admin safety route", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    expect(source).toContain('<Route path="/ai"><Redirect to="/" /></Route>');
    expect(source).toContain('<Route path={"/smm"}><Redirect to="/" /></Route>');
    expect(source).toContain('<Route path={"/marketplace"}><Redirect to="/" /></Route>');
    expect(source).toContain('<Route path={"/favorites"}><Redirect to="/account" /></Route>');
    expect(source).toContain('path="/admin/marketplace-safety" component={AdminMarketplaceSafety}');
    expect(source).not.toContain("ZursAiChat");
  });
});
