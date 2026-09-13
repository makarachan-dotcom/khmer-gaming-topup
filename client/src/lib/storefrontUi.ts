import {
  isDarkStorefrontUi,
  parsePackageUi,
  parseStorefrontUi,
  type PackageUiDensity,
  type StorefrontUiSkin,
} from "@shared/storefrontUi";

export {
  PACKAGE_UI_DENSITIES,
  PACKAGE_UI_META,
  STOREFRONT_UI_META,
  STOREFRONT_UI_SKINS,
  isDarkStorefrontUi,
  isStorefrontUiSkin,
  parsePackageUi,
  parseStorefrontUi,
} from "@shared/storefrontUi";
export type { PackageUiDensity, StorefrontUiSkin } from "@shared/storefrontUi";

export function applyStorefrontUi(next: StorefrontUiSkin) {
  const dark = isDarkStorefrontUi(next);
  const root = document.documentElement;
  if (root.getAttribute("data-ui") === next && root.getAttribute("data-ui-family") === (dark ? "dark" : "light")) {
    try {
      localStorage.setItem("zurs-ui", next);
    } catch {
      /* private mode */
    }
    return;
  }
  root.setAttribute("data-ui", next);
  root.setAttribute("data-ui-family", dark ? "dark" : "light");
  try {
    document.cookie = `zurs-ui=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    localStorage.setItem("zurs-ui", next);
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

export function applyPackageUi(next: PackageUiDensity) {
  const density = parsePackageUi(next);
  document.documentElement.setAttribute("data-pkg-ui", density);
  try {
    document.cookie = `zurs-pkg=${density}; Path=/; Max-Age=31536000; SameSite=Lax`;
    localStorage.setItem("zurs-pkg", density);
  } catch {
    /* private mode */
  }
}

export function readStorefrontUi(): StorefrontUiSkin {
  if (typeof document === "undefined") return "classic";
  return parseStorefrontUi(document.documentElement.getAttribute("data-ui"));
}

export function dismissStorefrontBoot() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (root.classList.contains("zurs-ready")) {
    document.getElementById("zurs-boot")?.remove();
    return;
  }
  const slide = () => {
    root.classList.add("zurs-ready");
    const boot = document.getElementById("zurs-boot");
    if (!boot) return;
    boot.classList.add("is-out");
    window.setTimeout(() => boot.remove(), 240);
  };
  window.requestAnimationFrame(() => window.requestAnimationFrame(slide));
}
