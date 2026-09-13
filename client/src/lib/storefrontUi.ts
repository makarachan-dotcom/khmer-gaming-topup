import {
  isDarkStorefrontUi,
  parseStorefrontUi,
  type StorefrontUiSkin,
} from "@shared/storefrontUi";

export {
  STOREFRONT_UI_META,
  STOREFRONT_UI_SKINS,
  isDarkStorefrontUi,
  isStorefrontUiSkin,
  parseStorefrontUi,
} from "@shared/storefrontUi";
export type { StorefrontUiSkin } from "@shared/storefrontUi";

export function applyStorefrontUi(next: StorefrontUiSkin) {
  const dark = isDarkStorefrontUi(next);
  const root = document.documentElement;
  root.setAttribute("data-ui", next);
  root.setAttribute("data-ui-family", dark ? "dark" : "light");
  try {
    document.cookie = `zurs-ui=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    /* private mode */
  }
  let theme: "dark" | "light" = dark ? "dark" : "light";
  if (next === "gamer") {
    try {
      const saved = localStorage.getItem("zurs-theme");
      if (saved === "light" || saved === "dark") theme = saved;
    } catch {
      /* private mode */
    }
  }
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  const color =
    theme === "dark"
      ? ["night", "midnight", "obsidian"].includes(next)
        ? "#08090d"
        : next === "aurora" || next === "solar"
          ? "#07130f"
          : "#101020"
      : next === "ios"
        ? "#f2f2f7"
        : next === "material"
          ? "#f7f2fa"
          : "#f4f4f1";
  if (meta) meta.setAttribute("content", color);
}

export function readStorefrontUi(): StorefrontUiSkin {
  if (typeof document === "undefined") return "classic";
  return parseStorefrontUi(document.documentElement.getAttribute("data-ui"));
}
