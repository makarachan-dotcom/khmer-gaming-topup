export const defaultGames = [
  { id: "game-mlbb", slug: "mlbb", titleKh: "Mobile Legends", titleEn: "Mobile Legends", currencyLabel: "Diamonds", iconLabel: "ML", accent: "indigo", requiresZone: true, sortOrder: 10 },
  { id: "game-free-fire", slug: "free-fire", titleKh: "Free Fire", titleEn: "Free Fire", currencyLabel: "Diamonds", iconLabel: "FF", accent: "orange", requiresZone: true, sortOrder: 20 },
  { id: "game-pubg", slug: "pubg", titleKh: "PUBG Mobile", titleEn: "PUBG Mobile", currencyLabel: "UC", iconLabel: "UC", accent: "teal", requiresZone: true, sortOrder: 30 },
  { id: "game-blox", slug: "blox", titleKh: "Blox Fruits", titleEn: "Blox Fruits", currencyLabel: "Robux", iconLabel: "BX", accent: "fuchsia", requiresZone: false, sortOrder: 40 },
] as const;

export const defaultGamePackages = [
  { id: "pkg-ml-86", productId: "game-mlbb", amountLabel: "86", priceUsd: "1.29", sortOrder: 10, featured: false },
  { id: "pkg-ml-172", productId: "game-mlbb", amountLabel: "172", priceUsd: "2.49", sortOrder: 20, featured: false },
  { id: "pkg-ml-344", productId: "game-mlbb", amountLabel: "344", priceUsd: "4.79", sortOrder: 30, featured: true },
  { id: "pkg-ml-706", productId: "game-mlbb", amountLabel: "706", priceUsd: "9.69", sortOrder: 40, featured: false },
  { id: "pkg-ff-100", productId: "game-free-fire", amountLabel: "100", priceUsd: "0.99", sortOrder: 10, featured: false },
  { id: "pkg-ff-310", productId: "game-free-fire", amountLabel: "310", priceUsd: "2.89", sortOrder: 20, featured: false },
  { id: "pkg-ff-520", productId: "game-free-fire", amountLabel: "520", priceUsd: "4.69", sortOrder: 30, featured: true },
  { id: "pkg-ff-1060", productId: "game-free-fire", amountLabel: "1,060", priceUsd: "9.19", sortOrder: 40, featured: false },
  { id: "pkg-pubg-60", productId: "game-pubg", amountLabel: "60", priceUsd: "0.99", sortOrder: 10, featured: false },
  { id: "pkg-pubg-325", productId: "game-pubg", amountLabel: "325", priceUsd: "4.89", sortOrder: 20, featured: false },
  { id: "pkg-pubg-660", productId: "game-pubg", amountLabel: "660", priceUsd: "9.39", sortOrder: 30, featured: true },
  { id: "pkg-pubg-1800", productId: "game-pubg", amountLabel: "1,800", priceUsd: "24.99", sortOrder: 40, featured: false },
  { id: "pkg-blox-400", productId: "game-blox", amountLabel: "400", priceUsd: "4.99", sortOrder: 10, featured: false },
  { id: "pkg-blox-800", productId: "game-blox", amountLabel: "800", priceUsd: "9.69", sortOrder: 20, featured: false },
  { id: "pkg-blox-1700", productId: "game-blox", amountLabel: "1,700", priceUsd: "19.29", sortOrder: 30, featured: true },
  { id: "pkg-blox-4500", productId: "game-blox", amountLabel: "4,500", priceUsd: "49.49", sortOrder: 40, featured: false },
] as const;

export const defaultSmmServices = [
  { id: "smm-ig-follow", slug: "ig-follow", platform: "Instagram", serviceType: "followers", titleKh: "អ្នកតាមដាន", titleEn: "Followers", descriptionKh: "អ្នកតាមដានសម្រាប់គណនីរបស់អ្នក", iconLabel: "IG", sortOrder: 10 },
  { id: "smm-tt-view", slug: "tt-view", platform: "TikTok", serviceType: "views", titleKh: "ការមើលវីដេអូ", titleEn: "Video views", descriptionKh: "បង្កើនការមើលវីដេអូ TikTok", iconLabel: "TT", sortOrder: 20 },
  { id: "smm-fb-like", slug: "fb-like", platform: "Facebook", serviceType: "likes", titleKh: "Likes និង Reactions", titleEn: "Likes & reactions", descriptionKh: "បង្កើនការចូលរួមសម្រាប់ Page និង Post", iconLabel: "FB", sortOrder: 30 },
  { id: "smm-yt-watch", slug: "yt-watch", platform: "YouTube", serviceType: "watch_time", titleKh: "ការមើលវីដេអូ", titleEn: "Watch time", descriptionKh: "ការមើលសម្រាប់វីដេអូ YouTube", iconLabel: "YT", sortOrder: 40 },
  { id: "smm-tg-member", slug: "tg-member", platform: "Telegram", serviceType: "members", titleKh: "សមាជិក Channel", titleEn: "Channel members", descriptionKh: "បង្កើនសមាជិកសម្រាប់ Channel", iconLabel: "TG", sortOrder: 50 },
] as const;

export const defaultSmmTiers = [
  { id: "tier-ig-500", serviceId: "smm-ig-follow", quantity: 500, priceUsd: "4.50", sortOrder: 10 }, { id: "tier-ig-1000", serviceId: "smm-ig-follow", quantity: 1000, priceUsd: "8.20", sortOrder: 20 }, { id: "tier-ig-2500", serviceId: "smm-ig-follow", quantity: 2500, priceUsd: "19.50", sortOrder: 30 },
  { id: "tier-tt-5000", serviceId: "smm-tt-view", quantity: 5000, priceUsd: "2.90", sortOrder: 10 }, { id: "tier-tt-10000", serviceId: "smm-tt-view", quantity: 10000, priceUsd: "5.50", sortOrder: 20 }, { id: "tier-tt-25000", serviceId: "smm-tt-view", quantity: 25000, priceUsd: "12.50", sortOrder: 30 },
  { id: "tier-fb-500", serviceId: "smm-fb-like", quantity: 500, priceUsd: "3.90", sortOrder: 10 }, { id: "tier-fb-1000", serviceId: "smm-fb-like", quantity: 1000, priceUsd: "7.20", sortOrder: 20 }, { id: "tier-fb-2500", serviceId: "smm-fb-like", quantity: 2500, priceUsd: "16.80", sortOrder: 30 },
  { id: "tier-yt-1000", serviceId: "smm-yt-watch", quantity: 1000, priceUsd: "5.40", sortOrder: 10 }, { id: "tier-yt-2500", serviceId: "smm-yt-watch", quantity: 2500, priceUsd: "12.20", sortOrder: 20 }, { id: "tier-yt-5000", serviceId: "smm-yt-watch", quantity: 5000, priceUsd: "22.60", sortOrder: 30 },
  { id: "tier-tg-500", serviceId: "smm-tg-member", quantity: 500, priceUsd: "4.20", sortOrder: 10 }, { id: "tier-tg-1000", serviceId: "smm-tg-member", quantity: 1000, priceUsd: "7.80", sortOrder: 20 }, { id: "tier-tg-2500", serviceId: "smm-tg-member", quantity: 2500, priceUsd: "18.30", sortOrder: 30 },
] as const;
