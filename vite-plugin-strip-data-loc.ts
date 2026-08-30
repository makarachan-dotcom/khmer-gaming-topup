// Safety-net plugin: strips any leftover data-loc attributes from the
// production build output. The primary fix is making jsxLocPlugin()
// dev-only in vite.config.ts — this plugin guarantees zero source-path
// leaks (e.g. data-loc="client/src/App.tsx:36") even if another tool
// re-introduces them.
import type { Plugin } from "vite";

export function stripDataLoc(): Plugin {
  return {
    name: "strip-data-loc",
    apply: "build",
    enforce: "post",
    transform(code, id) {
      if (!/\.(tsx?|jsx?)($|\?)/.test(id)) return null;
      if (!code.includes("data-loc")) return null;
      return {
        code: code
          .replace(/\s+data-loc\s*=\s*(?:"[^"]*"|\{[^}]*\})/g, "")
          .replace(/,?\s*['"]data-loc['"]\s*:\s*(?:"[^"]*"|'[^']*'|`[^`]*`)\s*,?/g, (m) =>
            m.startsWith(",") && m.endsWith(",") ? "," : "",
          ),
        map: null,
      };
    },
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === "chunk" && file.code.includes("data-loc")) {
          file.code = file.code
            .replace(/\s+data-loc\s*=\s*"[^"]*"/g, "")
            .replace(/,?\s*"data-loc"\s*:\s*"[^"]*"\s*,?/g, (m) =>
              m.startsWith(",") && m.endsWith(",") ? "," : "",
            );
        }
      }
    },
  };
}
