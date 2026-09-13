export const STOREFRONT_UI_SKINS = ["classic", "soft", "luxe", "gamer", "night", "neon"] as const;
export type StorefrontUiSkin = (typeof STOREFRONT_UI_SKINS)[number];

export const STOREFRONT_UI_META: Array<{
  id: StorefrontUiSkin;
  name: string;
  kh: string;
  hint: string;
  family: "light" | "dark";
}> = [
  { id: "classic", name: "Classic", kh: "ចាស់", hint: "ទម្រង់ដើមដែលអតិថិជនស្គាល់", family: "light" },
  { id: "soft", name: "Guide", kh: "បញ្ជី", hint: "កាតជួរដេក អក្សរធំ អានងាយ", family: "light" },
  { id: "luxe", name: "Boutique", kh: "កណ្ដាល", hint: "ជួរកណ្ដាល ប្រណីត ស្អាត", family: "light" },
  { id: "gamer", name: "Gamer", kh: "Navy", hint: "ងងឹត ៣ជំហាន top-up", family: "dark" },
  { id: "night", name: "Split", kh: "ពីរផ្ទាំង", hint: "ID ឆ្វេង · កញ្ចប់ស្ដាំ", family: "dark" },
  { id: "neon", name: "Showcase", kh: "ធំ", hint: "កាតធំនាំមុខ ស្អាតជាងគេ", family: "dark" },
];

const SKIN_SET = new Set<string>(STOREFRONT_UI_SKINS);

export function isStorefrontUiSkin(value: string | null | undefined): value is StorefrontUiSkin {
  return Boolean(value && SKIN_SET.has(value));
}

export function parseStorefrontUi(value: string | null | undefined): StorefrontUiSkin {
  return isStorefrontUiSkin(value) ? value : "classic";
}

export function isDarkStorefrontUi(ui: StorefrontUiSkin) {
  return ui === "gamer" || ui === "night" || ui === "neon";
}
