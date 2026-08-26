export type OriginalGameArtwork = {
  src: string;
  accent: string;
  position?: string;
};

const artwork: Record<string, OriginalGameArtwork> = {
  "8_ball_pool": {
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663894579180/OXUKhMpehmajBzUz.jpg",
    accent: "#27c7ff",
    position: "center right",
  },
  blood_strike: {
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663894579180/gGmqEnHNZPHhbxsL.jpg",
    accent: "#d64cff",
    position: "center right",
  },
  eafc_mobile: {
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663894579180/GYKqIUKxGCzPITii.jpg",
    accent: "#2aa8ff",
    position: "center right",
  },
  frag_pro_shooter: {
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663894579180/OIkdsEyrZHvMwFFa.jpg",
    accent: "#ff7a2d",
    position: "center right",
  },
  free_fire_my_sg: {
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663894579180/HGhSuHzjkcWbnAyb.jpg",
    accent: "#3fdde9",
    position: "center right",
  },
  honor_of_kings: {
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663894579180/nkVxTeNuSIqttIAK.jpg",
    accent: "#49e5b3",
    position: "center right",
  },
  magic_chess_gogo_global: {
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663894579180/AfSUMbEzPCtekCzF.jpg",
    accent: "#a678ff",
    position: "center right",
  },
  mobile_legends: {
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663894579180/LYOrXWxEiomJpsfp.jpg",
    accent: "#46d8ff",
    position: "center right",
  },
  pubg_mobile: {
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663894579180/jhaJVjEdycgAAzLx.jpg",
    accent: "#ffb64c",
    position: "center right",
  },
  pubg_mobile_auto: {
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663894579180/jhaJVjEdycgAAzLx.jpg",
    accent: "#ffb64c",
    position: "center right",
  },
  pubg_mobile_fast: {
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663894579180/jhaJVjEdycgAAzLx.jpg",
    accent: "#ffb64c",
    position: "center right",
  },
};

function slugFromName(name: string) {
  return name
    .trim()
    .toLocaleLowerCase()
    .replace(/\bgo\s+go\b/g, "gogo")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function providerGameImageKey(gameId: string, gameName = "") {
  const id = gameId.trim().toLocaleLowerCase();
  if (artwork[id]) return id;
  const slug = slugFromName(gameName);
  if (artwork[slug]) return slug;
  if (/mobile[\s_-]*legends/i.test(gameName)) return "mobile_legends";
  if (/free[\s_-]*fire/i.test(gameName)) return "free_fire_my_sg";
  if (/pubg/i.test(gameName)) return "pubg_mobile";
  if (/honor[\s_-]*of[\s_-]*kings/i.test(gameName)) return "honor_of_kings";
  if (/magic[\s_-]*chess/i.test(gameName)) return "magic_chess_gogo_global";
  if (/8[\s_-]*ball/i.test(gameName)) return "8_ball_pool";
  if (/blood[\s_-]*strike/i.test(gameName)) return "blood_strike";
  if (/eafc|football/i.test(gameName)) return "eafc_mobile";
  if (/frag/i.test(gameName)) return "frag_pro_shooter";
  return id;
}

export function originalGameArtworkFor(gameId: string, gameName = ""): OriginalGameArtwork | null {
  return artwork[providerGameImageKey(gameId, gameName)] ?? null;
}

export type ProviderGameImageOverride = { gameId: string; logoUrl: string | null; cardArtworkUrl: string | null };

export function resolvedGameArtworkFor(gameId: string, gameName = "", override?: ProviderGameImageOverride | null): OriginalGameArtwork | null {
  const defaultArtwork = originalGameArtworkFor(gameId, gameName);
  return override?.cardArtworkUrl ? { ...(defaultArtwork ?? { accent: "#46d8ff" }), src: override.cardArtworkUrl } : defaultArtwork;
}

export function isPopularStorefrontGame(gameId: string, gameName = "") {
  return gameId === "mobile_legends" || gameId === "free_fire_my_sg" || /^(mobile legends|free fire)$/i.test(gameName.trim());
}
