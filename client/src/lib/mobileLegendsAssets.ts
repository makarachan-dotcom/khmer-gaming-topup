export const goldDiamondChestArtworkUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663905831999/ynsfRvMWPhvlHFjn.png";
export const khqrLogoUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663905831999/mnJpaWeYfuTtadpv.svg";

export function isMobileLegendsGlobalGame(gameId: string) {
  const normalized = gameId.trim().toLowerCase();
  return normalized === "mobile_legends" || normalized === "mobile_legends_global";
}

export function mobileLegendsDiamondAmount(label: string, amountLabel: string) {
  const values = `${label} ${amountLabel}`.match(/\d[\d,]*/g) ?? [];
  if (!values.length) return null;
  return values.map((value) => Number(value.replace(/,/g, ""))).filter(Number.isFinite).sort((left, right) => right - left)[0] ?? null;
}

export function mobileLegendsDiamondLabel(label: string, amountLabel: string) {
  const amount = mobileLegendsDiamondAmount(label, amountLabel);
  return amount ? `${amount.toLocaleString("en-US")} Diamonds` : amountLabel || label;
}
