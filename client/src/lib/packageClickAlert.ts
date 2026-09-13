import { checkoutPackageQuantity, isStackableWeeklyPass, stripWeeklyMultiplierLabel } from "./stackableWeeklyPackages";

export const packageAccountCheckNoticeKh = "សូមពិនិត្យឈ្មោះគណនីជាមុនសិន";
export const weeklyPassCapNoticeKh = "ចំណាំ៖ Weekly Pass សរុបក្នុងអាខោនហ្គេម មិនអាចលើស 70 ថ្ងៃបានទេ។";

type AlertPackage = {
  label: string;
  amountLabel: string;
  priceLabel: string;
  quantity?: number;
};

function packageCopy(item: Pick<AlertPackage, "label" | "amountLabel">) {
  return `${item.label} ${item.amountLabel}`.toLowerCase();
}

export function weeklyPassStackCount(item: AlertPackage) {
  const copy = packageCopy(item);
  const leading = copy.match(/(?:^|\s)([2-5])\s*[x×*]\s*weekly\b/);
  if (leading) return Number(leading[1]);
  const trailing = copy.match(/\bweekly\b[^0-9]{0,12}[x×*]\s*([2-5])\b/);
  if (trailing) return Number(trailing[1]);
  const quantity = checkoutPackageQuantity(item.quantity);
  if (quantity > 1) return quantity;
  const base = { label: stripWeeklyMultiplierLabel(item.label) || item.label, amountLabel: stripWeeklyMultiplierLabel(item.amountLabel) || item.amountLabel };
  return isStackableWeeklyPass(base) ? 1 : 0;
}

export function weeklyPassClickNote(count: number) {
  const weeks = Math.min(9, Math.max(1, count));
  const days = weeks * 7;
  const instant = weeks * 80;
  const total = weeks * 220;
  const remainingCap = 70 - days;
  const headline = `ទទួលបាន ${instant} ពេជ្យ ភ្លាមៗ, ទទួល 20 ពេជ្យ ក្នុងមួយថ្ងៃរយៈពេល ${days} ថ្ងៃ 💥សរុប ${weeks} Weekly Pass = ${total.toLocaleString("en-US")} ពេជ្យ`;
  const buyRule = weeks > 1
    ? `*អាចទិញបាន ប្រសិនបើ Weekly Pass ក្នុងអាខោនហ្គេមអ្នកនៅសល់ក្រោម ${remainingCap} ថ្ងៃ។\nZURS នឹងទិញ Weekly Pass ចំនួន ${weeks} ដង។`
    : "";
  return [headline, buyRule, weeklyPassCapNoticeKh].filter(Boolean).join("\n\n");
}

function bundleClickNote(copy: string) {
  if (/\bweekly\b/.test(copy) && /\belite\b/.test(copy)) {
    return "ទទួលបាន 55 ពេជ្យ, 20 Crystal Aurora, 2 Rare skin Fragment និង កាតកាក់មួយ។";
  }
  if (/\bmonthly\b/.test(copy) && /\b(?:epic|elite|bundle)\b/.test(copy)) {
    return "ទទួលបាន 275 ពេជ្យ, 180 Crystal Aurora, 10 Rare skin Fragment និង កាតកាក់មួយ។";
  }
  return "";
}

export function packageClickAlertCopy(item: AlertPackage) {
  const weeklyCount = weeklyPassStackCount(item);
  const copy = packageCopy(item);
  const note = weeklyCount > 0 ? weeklyPassClickNote(weeklyCount) : bundleClickNote(copy);
  return {
    title: item.label,
    priceLabel: item.priceLabel,
    body: [note, packageAccountCheckNoticeKh].filter(Boolean).join("\n\n"),
  };
}
