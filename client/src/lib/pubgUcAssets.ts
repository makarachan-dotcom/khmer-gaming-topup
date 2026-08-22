const pubgUcArtworkByAmount: Record<string, string> = {
  "60": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663905831999/uyyNbCjPfviXKQLj.png",
  "120": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663905831999/WuShoFojVABNXNqY.png",
  "325": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663905831999/OAQbSlSfziFrRJNb.png",
  "660": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663905831999/KjFoByxKoXYJspJi.png",
  "1800": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663905831999/bTrtEqvswWdmLDKX.png",
  "3850": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663905831999/WGiWVyEvsGQiKzWT.png",
  "8100": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663905831999/GJJlrzeXsdGEqqXH.png",
};

export function isPubgTopupGame(gameId: string, gameName: string) {
  return /(?:^|[_\s-])pubg(?:$|[_\s-])/i.test(`${gameId} ${gameName}`) || /pubg\s*mobile/i.test(gameName);
}

/** Returns supplied artwork only when the provider amount is exactly one known UC value. */
export function pubgUcArtworkForAmount(amountLabel: string) {
  const match = amountLabel.trim().match(/^(\d[\d,]*)\s*UC$/i);
  if (!match?.[1]) return null;
  const amount = match[1].replace(/,/g, "");
  return pubgUcArtworkByAmount[amount] ?? null;
}

/** Preserve the provider amount text for the dynamic fallback card. */
export function pubgUcDisplayAmount(amountLabel: string) {
  return amountLabel.trim() || "UC";
}
