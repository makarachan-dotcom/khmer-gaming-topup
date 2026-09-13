/** Buyer-facing Diamond → ពេជ្យ. Provider keys stay English. */
export function khmerDiamondCopy(value: string) {
  if (!value) return value;
  return value
    .replace(/\bDiamonds\b/gi, "ពេជ្យ")
    .replace(/\bDiamond\b/gi, "ពេជ្យ")
    .replace(/ពេជ្រ/g, "ពេជ្យ");
}
