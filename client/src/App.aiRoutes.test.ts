import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("retired customer surface routes", () => {
  it("redirects legacy customer paths to AI while retaining the protected admin safety route", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    expect(source).toContain('<Route path={"/smm"}><Redirect to="/ai" /></Route>');
    expect(source).toContain('<Route path={"/marketplace"}><Redirect to="/ai" /></Route>');
    expect(source).toContain('<Route path={"/favorites"}><Redirect to="/ai" /></Route>');
    expect(source).toContain('path="/admin/marketplace-safety" component={AdminMarketplaceSafety}');
    expect(source).toContain("return <ZursAiChat initialOpen />");
  });
});
