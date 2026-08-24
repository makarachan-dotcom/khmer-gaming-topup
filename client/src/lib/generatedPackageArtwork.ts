export type GeneratedPackageArtworkKind = "diamonds" | "pass" | "level-up" | "special";

const artworkByKind: Record<GeneratedPackageArtworkKind, string> = {
  diamonds: "/manus-storage/zurs-package-diamonds_06847a89.png",
  pass: "/manus-storage/zurs-package-weekly-pass_43385b10.png",
  "level-up": "/manus-storage/zurs-package-level-up_0f29e76e.png",
  special: "/manus-storage/zurs-package-special_d13e79a7.png",
};

export function generatedPackageArtworkKind(label: string, amountLabel: string): GeneratedPackageArtworkKind {
  const text = `${label} ${amountLabel}`.toLowerCase();
  if (/level\s*up|rank\s*up|upgrade/.test(text)) return "level-up";
  if (/weekly|daily|monthly|elite|membership|subscription|\bpass\b/.test(text)) return "pass";
  if (/bonus|promo|special|event|exclusive|discount|sale|gift|chest/.test(text)) return "special";
  return "diamonds";
}

export function generatedPackageArtworkForPackage(label: string, amountLabel: string) {
  const kind = generatedPackageArtworkKind(label, amountLabel);
  return { kind, url: artworkByKind[kind] };
}
