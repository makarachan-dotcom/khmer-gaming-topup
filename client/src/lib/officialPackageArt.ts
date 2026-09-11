const art = {
  ffDiamondXs: "/package-art/ff-diamond-xs.jpg",
  ffDiamondS: "/package-art/ff-diamond-s.jpg",
  ffDiamondM: "/package-art/ff-diamond-m.jpg",
  ffDiamondL: "/package-art/ff-diamond-l.jpg",
  ffDiamondXl: "/package-art/ff-diamond-xl.jpg",
  ffWeekly: "/package-art/ff-weekly.jpg",
  ffMonthly: "/package-art/ff-monthly.jpg",
  mlbbDiamondXs: "/package-art/mlbb-diamond-xs.jpg",
  mlbbDiamonds: "/package-art/mlbb-diamonds.jpg",
  mlbbBag: "/package-art/mlbb-bag.jpg",
  mlbbPouch: "/package-art/mlbb-pouch.jpg",
  mlbbChest: "/package-art/mlbb-chest.jpg",
  mlbbVault: "/package-art/mlbb-vault.jpg",
  mlbbPile: "/package-art/mlbb-pile.jpg",
  mlbbWeekly: "/package-art/mlbb-weekly.jpg",
  mlbbTwilight: "/package-art/mlbb-twilight.jpg",
  pubgUc: "/package-art/pubg-uc.jpg",
  hokTokens: "/package-art/hok-tokens.jpg",
  specialCrate: "/package-art/special-crate.jpg",
  telegramStars: "/package-art/telegram-stars.jpg",
  telegramPremium: "/package-art/telegram-premium.jpg",
  robuxXs: "/package-art/robux-xs.jpg",
  robuxS: "/package-art/robux-s.jpg",
  robuxM: "/package-art/robux-m.jpg",
  robuxL: "/package-art/robux-l.jpg",
  robux: "/package-art/robux.jpg",
} as const;

function packageCopy(gameId: string, gameName: string, label: string, amountLabel: string) {
  return `${gameId} ${gameName} ${label} ${amountLabel}`.toLowerCase();
}

function largestAmount(label: string, amountLabel: string) {
  const values = `${label} ${amountLabel}`.match(/\d[\d,]*/g) ?? [];
  return values.map((value) => Number(value.replace(/,/g, ""))).filter(Number.isFinite).sort((left, right) => right - left)[0] ?? 0;
}

export function officialPackageArtFor(gameId: string, gameName: string, label: string, amountLabel: string) {
  const text = packageCopy(gameId, gameName, label, amountLabel);
  const amount = largestAmount(label, amountLabel);
  const isMlbb = /mobile[\s_-]*legends|\bmlbb\b/.test(text);
  const isPubg = /pubg/.test(text) || /\buc\b/.test(`${label} ${amountLabel}`.toLowerCase());
  const isHok = /honor[\s_-]*of[\s_-]*kings/.test(text);

  if (/telegram/.test(text) && /premium|month/.test(text)) return art.telegramPremium;
  if (/telegram/.test(text) || /\bstars?\b/.test(`${label} ${amountLabel}`.toLowerCase())) return art.telegramStars;
  if (/roblox|robux/.test(text)) {
    if (amount >= 4000) return art.robux;
    if (amount >= 1200) return art.robuxL;
    if (amount >= 400) return art.robuxM;
    if (amount >= 80) return art.robuxS;
    return art.robuxXs;
  }
  if (/twilight/.test(text)) return art.mlbbTwilight;
  if (/weekly\s*lite/.test(text)) return art.ffWeekly;
  if (/weekly/.test(text) && /pass|membership|card/.test(text)) return isMlbb ? art.mlbbWeekly : art.ffWeekly;
  if (/monthly|vip\s*pass|elite\s*pass|season\s*pass|premium\s*pass/.test(text)) return art.ffMonthly;
  if (/\b(?:crate|lucky\s*bag|chest|bundle|event pack|promo)\b/.test(text) && !/\bdiamonds?\b/.test(text)) return art.specialCrate;
  if (isPubg) return art.pubgUc;
  if (isHok) return art.hokTokens;
  if (isMlbb) {
    if (amount >= 4000) return art.mlbbPile;
    if (amount >= 2200) return art.mlbbVault;
    if (amount >= 1200) return art.mlbbChest;
    if (amount >= 700) return art.mlbbPouch;
    if (amount >= 300) return art.mlbbBag;
    if (amount >= 80) return art.mlbbDiamonds;
    return art.mlbbDiamondXs;
  }
  if (amount >= 4000) return art.ffDiamondXl;
  if (amount >= 1000) return art.ffDiamondL;
  if (amount >= 300) return art.ffDiamondM;
  if (amount >= 80) return art.ffDiamondS;
  return art.ffDiamondXs;
}
