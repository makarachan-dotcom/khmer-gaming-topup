import { khmerDiamondCopy } from "./khmerDiamondCopy";
import { isDiamondPackage } from "./packageCategories";
import { weeklyPassStackCount } from "./packageClickAlert";
import { packageAmountAndUnit } from "@shared/packagePriceLadder";

type HeaderPackage = {
  label: string;
  amountLabel: string;
  quantity?: number;
};

const unitDisplay: Record<string, string> = {
  diamond: "ពេជ្យ",
  uc: "UC",
  robux: "Robux",
  star: "Stars",
  token: "Tokens",
  coin: "Coins",
};

function formatAmount(amount: number) {
  return Math.round(amount).toLocaleString("en-US");
}

/** Kagura-style title on each package card. One header, no duplicate amount line. */
export function packageCardHeader(item: HeaderPackage) {
  const weeklyCount = weeklyPassStackCount(item);
  if (weeklyCount > 1) return `${weeklyCount}x Weekly`;
  if (weeklyCount === 1) return "Weekly";

  const measure = packageAmountAndUnit(item.label, item.amountLabel);
  if (measure?.unit === "diamond" || isDiamondPackage(item)) {
    const amount = measure?.unit === "diamond" ? measure.amount : Number(`${item.label} ${item.amountLabel}`.match(/\d[\d,]*/)?.[0]?.replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) return `💎${formatAmount(amount)} ពេជ្យ`;
  }
  if (measure && unitDisplay[measure.unit]) {
    return `${formatAmount(measure.amount)} ${unitDisplay[measure.unit]}`;
  }

  return khmerDiamondCopy(item.label) || khmerDiamondCopy(item.amountLabel);
}
