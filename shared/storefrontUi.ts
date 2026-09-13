export const STOREFRONT_UI_SKINS = [
  "classic",
  "soft",
  "luxe",
  "ios",
  "material",
  "editorial",
  "zen",
  "commerce",
  "gamer",
  "night",
  "neon",
  "midnight",
  "aurora",
  "arcade",
  "obsidian",
  "solar",
] as const;
export type StorefrontUiSkin = (typeof STOREFRONT_UI_SKINS)[number];
export type StorefrontPlatform = "universal" | "ios" | "android" | "desktop";

export const STOREFRONT_UI_META: Array<{
  id: StorefrontUiSkin;
  name: string;
  kh: string;
  hint: string;
  family: "light" | "dark";
  platform: StorefrontPlatform;
  badge?: string;
}> = [
  {
    id: "classic",
    name: "Classic",
    kh: "សាមញ្ញ",
    hint: "ទម្រង់ដើម ស្អាត និងស្គាល់ងាយ",
    family: "light",
    platform: "universal",
  },
  {
    id: "soft",
    name: "Guide",
    kh: "អានងាយ",
    hint: "កាតជួរដេក អក្សរធំ សម្រាប់គ្រប់វ័យ",
    family: "light",
    platform: "universal",
  },
  {
    id: "luxe",
    name: "Boutique",
    kh: "ប្រណីត",
    hint: "ហាង premium កណ្ដាល និងស្ងប់",
    family: "light",
    platform: "desktop",
  },
  {
    id: "ios",
    name: "Cupertino",
    kh: "iOS",
    hint: "Glass និង motion ទន់ដូច native iPhone",
    family: "light",
    platform: "ios",
    badge: "NEW",
  },
  {
    id: "material",
    name: "Material You",
    kh: "Android",
    hint: "Tonal cards និង touch targets ធំ",
    family: "light",
    platform: "android",
    badge: "NEW",
  },
  {
    id: "editorial",
    name: "Editorial",
    kh: "Desktop",
    hint: "Grid បែប studio សម្រាប់អេក្រង់ធំ",
    family: "light",
    platform: "desktop",
    badge: "NEW",
  },
  {
    id: "zen",
    name: "Zen Market",
    kh: "Minimal",
    hint: "ស្ងប់ ស្រួលមើល និង white space ច្រើន",
    family: "light",
    platform: "universal",
    badge: "NEW",
  },
  {
    id: "commerce",
    name: "Commerce Pro",
    kh: "Shop",
    hint: "Product-first grid និងតម្លៃច្បាស់",
    family: "light",
    platform: "desktop",
    badge: "NEW",
  },
  {
    id: "gamer",
    name: "Gamer",
    kh: "Navy",
    hint: "ងងឹត ៣ ជំហាន top-up ច្បាស់",
    family: "dark",
    platform: "universal",
    badge: "NEW",
  },
  {
    id: "night",
    name: "Split",
    kh: "ពីរផ្ទាំង",
    hint: "ID ខាងឆ្វេង កញ្ចប់ខាងស្ដាំ",
    family: "dark",
    platform: "desktop",
    badge: "NEW",
  },
  {
    id: "neon",
    name: "Showcase",
    kh: "Cinematic",
    hint: "Featured card ធំ និង neon highlight",
    family: "dark",
    platform: "desktop",
    badge: "NEW",
  },
  {
    id: "midnight",
    name: "Midnight",
    kh: "iOS Dark",
    hint: "Dark glass ស្ងប់ និង blur ដូច iOS",
    family: "dark",
    platform: "ios",
    badge: "NEW",
  },
  {
    id: "aurora",
    name: "Aurora",
    kh: "Android Dark",
    hint: "Material dark ជាមួយ aurora accent",
    family: "dark",
    platform: "android",
    badge: "NEW",
  },
  {
    id: "arcade",
    name: "Arcade Pro",
    kh: "Esports",
    hint: "Bold gaming grid បែប premium",
    family: "dark",
    platform: "desktop",
    badge: "NEW",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    kh: "Luxury Dark",
    hint: "Black luxury ជាមួយ gold detail",
    family: "dark",
    platform: "desktop",
    badge: "NEW",
  },
  {
    id: "solar",
    name: "Solar Punk",
    kh: "Vibrant",
    hint: "Dark green និង warm energy accents",
    family: "dark",
    platform: "universal",
    badge: "NEW",
  },
];

const SKIN_SET = new Set<string>(STOREFRONT_UI_SKINS);
export function isStorefrontUiSkin(
  value: string | null | undefined
): value is StorefrontUiSkin {
  return Boolean(value && SKIN_SET.has(value));
}
export function parseStorefrontUi(
  value: string | null | undefined
): StorefrontUiSkin {
  return isStorefrontUiSkin(value) ? value : "classic";
}
export function isDarkStorefrontUi(ui: StorefrontUiSkin) {
  return [
    "gamer",
    "night",
    "neon",
    "midnight",
    "aurora",
    "arcade",
    "obsidian",
    "solar",
  ].includes(ui);
}

export const PACKAGE_UI_DENSITIES = ["compact", "cozy", "roomy"] as const;
export type PackageUiDensity = (typeof PACKAGE_UI_DENSITIES)[number];
export const PACKAGE_UI_META: Array<{
  id: PackageUiDensity;
  name: string;
  kh: string;
  hint: string;
}> = [
  {
    id: "compact",
    name: "Compact",
    kh: "តូចល្មម",
    hint: "កាតតូច ស្រួលចុច និងអូសមើលកញ្ចប់ច្រើន",
  },
  {
    id: "cozy",
    name: "Cozy",
    kh: "ស្មើ",
    hint: "ទំហំកណ្ដាល សម្រាប់អានស្លាក និងតម្លៃ",
  },
  {
    id: "roomy",
    name: "Roomy",
    kh: "ធំ",
    hint: "កាតធំ រូបច្បាស់ សម្រាប់អេក្រង់ធំ",
  },
];
const PKG_SET = new Set<string>(PACKAGE_UI_DENSITIES);
export function parsePackageUi(
  value: string | null | undefined
): PackageUiDensity {
  return value && PKG_SET.has(value) ? (value as PackageUiDensity) : "compact";
}
