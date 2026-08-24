export type GeneratedPackageArtworkKind = "diamonds" | "pass" | "level-up" | "special" | "deal" | "bc" | "lucky-bag" | "preorder";

const artworkByKind: Record<GeneratedPackageArtworkKind, string> = {
  diamonds: "/manus-storage/zurs-package-diamonds-v3_cab01777.png",
  pass: "/manus-storage/zurs-package-pass-v3_8618d9b1.png",
  "level-up": "/manus-storage/zurs-package-level-up-v3_386e737b.png",
  special: "/manus-storage/zurs-package-special-v3_7ca8db63.png",
  deal: "/manus-storage/zurs-package-deal_65405e11.png",
  bc: "/manus-storage/zurs-package-bc_b78eea01.png",
  "lucky-bag": "/manus-storage/zurs-package-lucky-bag_5c099d05.png",
  preorder: "/manus-storage/zurs-package-preorder_ce50e39f.png",
};

export function generatedPackageArtworkKind(label: string, amountLabel: string): GeneratedPackageArtworkKind {
  const text = `${label} ${amountLabel}`.toLowerCase();
  if (/pre[\s-]*order/.test(text)) return "preorder";
  if (/lucky\s*(?:bag|chest)|\blucky\b/.test(text)) return "lucky-bag";
  if (/\b\d+[\s-]*bc\b|\bbc\b/.test(text)) return "bc";
  if (/\bdeal\b/.test(text)) return "deal";
  if (/level\s*up|rank\s*up|upgrade/.test(text)) return "level-up";
  if (/weekly|daily|monthly|elite|membership|subscription|\bpass\b/.test(text)) return "pass";
  if (/bonus|promo|special|event|exclusive|discount|sale|gift|chest|cornucopia/.test(text)) return "special";
  return "diamonds";
}

export function generatedPackageArtworkForPackage(label: string, amountLabel: string) {
  const kind = generatedPackageArtworkKind(label, amountLabel);
  return { kind, url: artworkByKind[kind] };
}
