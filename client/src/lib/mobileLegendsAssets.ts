import { packageAmountAndUnit } from "@shared/packagePriceLadder";

export const goldDiamondChestArtworkUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663905831999/ynsfRvMWPhvlHFjn.png";
export const khqrLogoUrl = "/khqr-logo.svg";

export function isMobileLegendsGlobalGame(gameId: string) {
  const normalized = gameId.trim().toLowerCase();
  return normalized === "mobile_legends" || normalized === "mobile_legends_global";
}

export function mobileLegendsDiamondAmount(label: string, amountLabel: string) {
  const measure = packageAmountAndUnit(label, amountLabel);
  if (measure?.unit === "diamond") return measure.amount;
  const values = `${label} ${amountLabel}`.match(/\d[\d,]*/g) ?? [];
  if (!values.length) return null;
  return values.map((value) => Number(value.replace(/,/g, ""))).filter(Number.isFinite).sort((left, right) => right - left)[0] ?? null;
}

export function mobileLegendsDiamondLabel(label: string, amountLabel: string) {
  // Preserve bonus format: if the API says "86+8", show "86+8 ពេជ្យ" — never sum it.
  const raw = `${label} ${amountLabel}`;
  const bonusMatch = raw.match(/(\d[\d,]*)\s*\+\s*(\d[\d,]*)/);
  if (bonusMatch) {
    const base = bonusMatch[1].replace(/,/g, "");
    const bonus = bonusMatch[2].replace(/,/g, "");
    if (Number.isFinite(Number(base)) && Number.isFinite(Number(bonus))) {
      return `${Number(base).toLocaleString("en-US")}+${Number(bonus).toLocaleString("en-US")} ពេជ្យ`;
    }
  }
  const amount = mobileLegendsDiamondAmount(label, amountLabel);
  return amount ? `${amount.toLocaleString("en-US")} ពេជ្យ` : amountLabel || label;
}

export type MobileLegendsPackageTone = "diamonds" | "bonus" | "pass" | "special";

export function mobileLegendsPackageTone(label: string, amountLabel: string): MobileLegendsPackageTone {
  const packageCopy = `${label} ${amountLabel}`.toLowerCase();
  if (/\b(?:weekly|monthly|twilight)\b.*\b(?:elite\s*)?pack\b|\b(?:weekly|monthly|twilight)\s+pass\b/.test(packageCopy)) return "pass";
  if (/\bfirst\s*top[\s-]*up\b|\bbonus\b/.test(packageCopy)) return "bonus";
  if (/\b(?:promo|special|event|exclusive)\b/.test(packageCopy)) return "special";
  return "diamonds";
}
