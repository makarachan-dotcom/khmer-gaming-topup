import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const project = process.cwd();
const read = (path: string) => readFileSync(resolve(project, path), "utf8");

/**
 * `vite.config.ts` exports a *function* (`defineConfig(({ mode }) => ({...}))`).
 * Spreading that function into the inline options of `createViteServer` yields an
 * empty object, which silently drops `root`, the Tailwind plugin and the `@`
 * alias — every `/src/*.tsx` request then fails and the dev storefront never
 * boots. The embedded dev server must therefore let Vite read the real config
 * file itself.
 */
describe("embedded dev server", () => {
  it("loads the real vite config instead of spreading the config function", () => {
    const viteServer = read("server/_core/vite.ts");
    const config = read("vite.config.ts");

    expect(config).toContain("export default defineConfig(({ mode }) => ({");
    expect(viteServer).toContain('configFile: path.resolve(import.meta.dirname, "../../vite.config.ts")');
    expect(viteServer).not.toContain("...viteConfig");
    expect(viteServer).not.toContain('configFile: false');
    // Proxy preview hosts must stay allowed.
    expect(viteServer).toContain("allowedHosts: true as const");
  });
});
