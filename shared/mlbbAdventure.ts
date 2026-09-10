function packageCopy(item: { id?: string; label?: string; amountLabel?: string; name?: string }) {
  return `${item.id ?? ""} ${item.label ?? ""} ${item.amountLabel ?? ""} ${item.name ?? ""}`.toLowerCase();
}

export function isMobileLegendsAdventureGame(gameId: string, name = "") {
  return /adventure/i.test(`${gameId} ${name}`);
}

export function isRegularMobileLegendsVariant(gameId: string, name = "") {
  return /^mobile[_-]?legends(?:[_-]|$)/i.test(gameId.trim()) && !isMobileLegendsAdventureGame(gameId, name);
}

export function isMlbbMcashPackage(item: { id?: string; label?: string; amountLabel?: string; name?: string }) {
  return /m[\s_-]*cash|\bmcash\b/i.test(packageCopy(item));
}

export function withoutMlbbAdventurePackages<T extends { id?: string; label?: string; amountLabel?: string; name?: string }>(packages: T[]) {
  return packages.filter((item) => !isMlbbMcashPackage(item));
}
