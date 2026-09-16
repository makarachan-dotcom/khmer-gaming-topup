import { z } from "zod";
import { createHash } from "node:crypto";
import { resolveProviderCredential } from "./providerCredentialResolver";
import { getAppwriteProviderAvailability, getAppwriteProviderCatalog, isAppwriteStoreConfigured, type AppwriteProviderCatalog, updateAppwriteProviderAvailability } from "./appwriteStore";
import { getActiveProviderPackageIds, getAdminSyncedProviderPackages, getPublicSyncedProviderPackages } from "./db";
import { applyShopPriceLadder, keepCheapestEquivalentPackages } from "@shared/packagePriceLadder";
import { isMobileLegendsAdventureGame, isRegularMobileLegendsVariant, withoutMlbbAdventurePackages } from "@shared/mlbbAdventure";

export const providerFieldSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-zA-Z0-9_]{0,63}$/),
  label: z.string().trim().min(1).max(120),
  placeholder: z.string().trim().max(160).optional(),
  required: z.boolean(),
  kind: z.enum(["text", "number", "password"]),
});

export const providerGameSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  logoUrl: z.string().url().refine((url) => url.startsWith("https://"), "Game logo must use HTTPS").optional(),
  region: z.string().trim().min(1).max(80).optional(),
  provider: z.string().trim().min(1).max(120),
  requiredFields: z.array(providerFieldSchema).max(12),
});

export const providerPackageSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(160),
  amountLabel: z.string().trim().min(1).max(160),
  priceLabel: z.string().trim().min(1).max(80),
  provider: z.string().trim().min(1).max(120),
  paymentMethods: z.array(z.enum(["khqr", "bank"])).min(1).max(2),
});

const fzrTopupItemSchema = z.object({ category_id: z.string().trim().min(1).max(120), name: z.string().trim().min(1).max(200), note: z.string().optional() });
const fzrTopupsSchema = z.object({
  ok: z.literal(true),
  kind: z.literal("topup"),
  // Tolerant: keep every valid game even if one item on a page is malformed, so a single
  // bad entry can never drop an entire page of ~100 games from the catalog.
  items: z.array(fzrTopupItemSchema.nullable().catch(null)).max(5000).transform((items) => items.filter((item): item is Exclude<typeof item, null> => item !== null)),
  meta: z.object({ next_cursor: z.string().trim().min(1).nullable().optional(), has_more: z.boolean().optional() }).optional(),
});

// Tolerant provider offer schema. The provider occasionally returns numeric prices,
// numeric/blank offer IDs, long names, extra UI fields, or a non-HTTPS image URL. Instead
// of dropping the WHOLE game when one entry is imperfect, we coerce common shapes and drop
// only the individual bad offer/field. This schema is shared by both the live storefront
// (fetchProviderGameDetails) and the admin catalog sync (fetchFzrProviderSyncSnapshot), so
// loosening it fixes both "no packages on storefront" and "0/0 packages in admin" at once.
// FazerCards is inconsistent across game types. Direct-topup games (Free Fire, 8 Ball Pool)
// return offer_id/name/price_usd, while ID-verified games (Mobile Legends, PUBG, Magic Chess,
// Honor of Kings, Call of Duty) frequently return the SAME denominations under different keys.
// We coerce every common alias so those games stop importing as 0 packages.
function coerceRawOffer(raw: unknown) {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  return {
    offer_id: o.offer_id ?? o.offerId ?? o.id ?? o.sku ?? o.code ?? o.product_id ?? o.productId ?? o.denom_id,
    name: o.name ?? o.title ?? o.label ?? o.denom ?? o.description,
    price_usd: o.price_usd ?? o.priceUsd ?? o.price ?? o.amount ?? o.usd ?? o.price_amount ?? o.value,
  };
}
const fzrOfferSchema = z.preprocess(coerceRawOffer, z.object({
  offer_id: z.union([z.string(), z.number()]).transform((value) => String(value).trim()).pipe(z.string().min(1).max(160)).nullable().catch(null),
  name: z.union([z.string(), z.number()]).transform((value) => String(value).trim()).pipe(z.string().min(1).max(200)),
  price_usd: z.union([z.string(), z.number()]).transform((value) => String(value).trim().replace(/[^0-9.]/g, "")).pipe(z.string().regex(/^\d+(\.\d+)?$/)),
}));
const fzrOfferFieldSchema = z.object({ key: z.string().trim().regex(/^[a-z][a-zA-Z0-9_]{0,63}$/), label: z.string().trim().min(1).max(120), type: z.string().trim().max(40).optional(), placeholder: z.string().trim().max(160).optional(), required: z.boolean().optional() });
// Coalesce the offers/fields arrays from any key FazerCards uses, including payloads nested
// under data/result/payload. Shared by the storefront (fetchProviderGameDetails) and the admin
// sync (fetchFzrProviderSyncSnapshot), so loosening it fixes empty storefront AND 0/0 admin.
function coerceRawOffersPayload(raw: unknown) {
  if (!raw || typeof raw !== "object") return raw;
  let o = raw as Record<string, unknown>;
  for (const key of ["data", "result", "payload"]) {
    const nested = o[key];
    if ((!Array.isArray(o.offers) || o.offers.length === 0) && nested && typeof nested === "object" && !Array.isArray(nested)) {
      o = { ...o, ...(nested as Record<string, unknown>) };
    }
  }
  const offersCandidate = o.offers ?? o.packages ?? o.products ?? o.denominations ?? o.denoms ?? o.list ?? o.items ?? o.data;
  const fieldsCandidate = o.fields ?? o.ui ?? o.inputs ?? o.form;
  return { ...o, offers: Array.isArray(offersCandidate) ? offersCandidate : [], fields: Array.isArray(fieldsCandidate) ? fieldsCandidate : [] };
}
const fzrOffersSchema = z.preprocess(coerceRawOffersPayload, z.object({
  // ok/kind are NOT gates: ID-verified games sometimes return ok:1 or kind:"topup_id"/"verify".
  ok: z.unknown().optional(),
  kind: z.union([z.string(), z.number(), z.boolean()]).optional(),
  category_id: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  offers: z.array(fzrOfferSchema.nullable().catch(null)).max(5000).transform((offers) => offers.filter((offer): offer is Exclude<typeof offer, null> => offer !== null)).default([]),
  fields: z.array(fzrOfferFieldSchema.nullable().catch(null)).max(64).transform((fields) => fields.filter((field): field is Exclude<typeof field, null> => field !== null)).default([]),
  imageurl: z.string().trim().url().refine((url) => url.startsWith("https://")).optional().catch(undefined),
}));

const smmGlobServiceSchema = z.object({
  service: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1).max(80)),
  name: z.string().trim().min(1).max(500),
  type: z.string().trim().max(80).optional().default("default"),
  category: z.string().trim().max(180).optional().default("Social Media"),
  rate: z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^\d+(\.\d+)?$/)),
  min: z.union([z.string(), z.number()]).transform((value) => Number(value)).pipe(z.number().int().nonnegative().max(10_000_000)),
  max: z.union([z.string(), z.number()]).transform((value) => Number(value)).pipe(z.number().int().nonnegative().max(100_000_000)),
  dripfeed: z.union([z.boolean(), z.number(), z.string()]).optional(),
  refill: z.union([z.boolean(), z.number(), z.string()]).optional(),
  cancel: z.union([z.boolean(), z.number(), z.string()]).optional(),
});

export type ProviderGameResponse =
  | { status: "ready"; games: z.infer<typeof providerGameSchema>[] }
  | { status: "unavailable"; games: [] }
  | { status: "error"; games: [] };

export type ProviderGameDetailsResponse =
  | { status: "ready"; game: z.infer<typeof providerGameSchema>; packages: z.infer<typeof providerPackageSchema>[] }
  | { status: "unavailable"; game: null; packages: [] }
  | { status: "error"; game: null; packages: [] };

export type ProviderPackageRequest = { gameId: string; fields: Record<string, string>; idAccuracyConfirmed?: boolean };
export type ProviderPackageResponse =
  | { status: "ready"; packages: z.infer<typeof providerPackageSchema>[] }
  | { status: "verification_required"; packages: [] }
  | { status: "unavailable"; packages: [] }
  | { status: "error"; packages: [] };

export type ProviderPlayerIdentityResponse =
  | { status: "verified"; playerName: string; playerId: string | null; region: string | null; photoUrl?: string | null }
  | { status: "invalid"; playerName: null; playerId: null; region: null }
  | { status: "not_supported"; playerName: null; playerId: null; region: null }
  | { status: "unavailable"; playerName: null; playerId: null; region: null }
  | { status: "error"; playerName: null; playerId: null; region: null };

export type SmmProviderCatalogResponse =
  | { status: "ready"; services: Array<{ providerServiceId: string; name: string; category: string; serviceType: string; rateUsdPerThousand: string; min: number; max: number; refill: boolean; cancel: boolean; dripfeed: boolean }> }
  | { status: "unavailable"; services: [] }
  | { status: "error"; services: [] };

export type ProviderAvailabilityCatalog = { games: Array<{ id: string; name: string; isActive: boolean }>; smm: Array<{ id: string; name: string; category: string; isActive: boolean }> };

const socialPlatformOrder = ["facebook", "instagram", "tiktok", "youtube", "telegram"] as const;
type ProviderAvailabilitySnapshot = { hiddenGameIds: string[]; hiddenSmmServiceIds: string[]; activeGameIds?: string[] };
let providerAvailabilitySnapshot: ProviderAvailabilitySnapshot | null = null;
let providerAvailabilityRetryAt = 0;

export function isThailandProviderProduct(text: string) {
  return /(?:\bthailand\b|\bthai\b|ไทย|ประเทศไทย|🇹🇭|(?:^|[_\s(])th(?:$|[_\s)]))/i.test(text);
}

// Owner curation: the storefront AND the admin sync only expose these game families. Matching is
// by provider category_id OR display name, so every regional variant (mobile_legends_global,
// mobile_legends_ph, pubg_mobile_auto, free_fire_sg, ...) is included automatically. Edit this
// list to add or remove games.
const WANTED_PROVIDER_GAME_PATTERNS: RegExp[] = [
  /mobile[\s_]*legends/i,
  /free[\s_]*fire/i,
  /honor[\s_]*of[\s_]*kings/i,
  /call[\s_]*of[\s_]*duty|(?:^|[_\s])codm(?:$|[_\s])/i,
  /magic[\s_]*chess/i,
  /(?:^|[_\s(])pubg/i,
  /(?:8|eight)[\s_]*ball[\s_]*pool/i,
  /(?:^|[_\s(])(?:eafc|ea[\s_]*fc|ea[\s_]*sports[\s_]*fc|fc[\s_]*mobile)/i,
  /frag[\s_]*pro[\s_]*shooter/i,
  // Telegram service (Stars + Premium) from the FazerCards Telegram panel.
  // The provider slug may be "telegram_stars" or the short form "tg_stars".
  // Every id-only gate below runs these patterns against the category_id ALONE
  // (not the display name), so a short slug missing from this list makes the
  // service invisible on the storefront even after the owner enables it in Admin.
  /(?:^|[_\s(])telegram/i,
  /(?:^|[_\s(])tg(?:[_\s)]|$)/i,
  // Round 10 fix: Roblox Robux (FazerCards manual services, id `roblox_robux`).
  // It matched NO pattern in this list, so `publicProviderGameIds` below filtered it
  // straight back out of the owner-approved set and the storefront never rendered it,
  // even though Admin correctly reported it as "showing in store". This is precisely
  // the failure mode the Telegram note above warns about. Do not remove this line.
  /(?:^|[_\s(])(?:roblox|robux)/i,
];

/**
 * Telegram Stars / Premium are delivered to a public @username, never to a game
 * player id, so both the identity field and the order payload differ from every
 * game family above. Matching is by provider category_id OR display name.
 */
export function isTelegramProviderProduct(text: string) {
  const normalized = text.replace(/-/g, "_");
  return /(?:^|[_\s(])telegram/i.test(normalized) || /(?:^|[_\s(])tg(?:[_\s)]|$)/i.test(normalized);
}

/** The single identity field a Telegram top-up needs. */
export function telegramUsernameField() {
  return { key: "username", label: "Telegram Username", placeholder: "@username", required: true, kind: "text" as const };
}

/** Accept "@name", "name", "t.me/name" or a full profile link and return the bare handle. */
export function normalizeTelegramUsername(raw: string) {
  return raw.trim().replace(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)\//i, "").replace(/^@+/, "").replace(/[^A-Za-z0-9_]/g, "");
}

/*
 * ---------------------------------------------------------------------------
 * Telegram Stars & Premium
 * ---------------------------------------------------------------------------
 * FazerCards does NOT publish Telegram inside GET /api/v2/topups. It is served
 * from a dedicated endpoint family:
 *   GET  /api/v2/telegram/stars       -> { price_per_star, min_amount, max_amount }
 *   GET  /api/v2/telegram/premium     -> { plans: [{ months, price_usd }] }
 *   POST /api/v2/telegram/stars/buy      { telegram_username, quantity }
 *   POST /api/v2/telegram/premium/buy    { telegram_username, months }
 * Because the /topups category list never contains a Telegram category_id, NO
 * amount of allowlisting could ever make the service appear on the storefront.
 * Both products are therefore built here and injected into the same catalog,
 * detail, sync and order paths every game already uses, so admin pricing and
 * margin, KHQR checkout and provider fulfilment all keep working unchanged.
 */
export const telegramStarsGameId = "telegram_stars";
export const telegramPremiumGameId = "telegram_premium";
const telegramStarPacks = [50, 75, 100, 150, 250, 350, 500, 750, 1000, 1500, 2500, 5000, 10000];
const telegramPremiumMonths = [3, 6, 12];
const TELEGRAM_CATALOG_CACHE_MS = 60_000;

/** Telegram Stars / Premium only. These two use the /telegram/../buy endpoints. */
export function isTelegramServiceGameId(gameId: string) {
  const normalized = gameId.trim().toLowerCase();
  return normalized === telegramStarsGameId || normalized === telegramPremiumGameId;
}

/**
 * Every service that is BUILT in this file instead of arriving from GET /topups.
 * These ids must bypass the /topups allowlist gates, still appear in the admin
 * availability list, and remain importable by the catalog sync.
 */
export function isBuiltInProviderGameId(gameId: string) {
  const normalized = gameId.trim().toLowerCase();
  return isTelegramServiceGameId(normalized) || normalized === robloxRobuxGameId;
}

/** Default retail markup used until the owner sets a margin in Admin -> Pricing. */
function telegramRetailPrice(costUsd: number, envValue: string | undefined = process.env.TELEGRAM_MARGIN_PERCENT) {
  const configured = Number(envValue);
  const margin = Number.isFinite(configured) && configured >= 0 && configured <= 300 ? configured : 20;
  return (costUsd * (1 + margin / 100)).toFixed(2);
}

const fzrTelegramStarsSchema = z.object({
  price_per_star: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().positive().max(10)),
  min_amount: z.union([z.string(), z.number()]).transform(Number).optional(),
  max_amount: z.union([z.string(), z.number()]).transform(Number).optional(),
});

const fzrTelegramPremiumSchema = z.object({
  plans: z.array(z.object({
    months: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().int().positive().max(36)),
    price_usd: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().positive().max(1000)),
  })).max(24),
});

type TelegramSnapshotGame = {
  providerGameId: string;
  name: string;
  logoUrl?: string;
  requiredFields: z.infer<typeof providerFieldSchema>[];
  offers: Array<{ providerOfferId: string; name: string; priceUsd: string }>;
};

let telegramCatalogCache: { at: number; games: TelegramSnapshotGame[] } | null = null;

/**
 * Reads the live Telegram quotes and returns them in the exact shape the provider
 * sync snapshot uses. Offer ids are minted as stars_<quantity> / premium_<months>
 * so the quantity survives the round trip through the order row's providerSource
 * and can be replayed at fulfilment time.
 */
async function fetchTelegramCatalogGames(): Promise<TelegramSnapshotGame[]> {
  const now = Date.now();
  if (telegramCatalogCache && now - telegramCatalogCache.at < TELEGRAM_CATALOG_CACHE_MS) return telegramCatalogCache.games;
  const games: TelegramSnapshotGame[] = [];
  try {
    const response = await fzrRequest("/api/v2/telegram/stars");
    const quote = response ? fzrTelegramStarsSchema.safeParse(response) : null;
    if (quote?.success) {
      const min = Number.isFinite(quote.data.min_amount) ? Number(quote.data.min_amount) : 50;
      const max = Number.isFinite(quote.data.max_amount) ? Number(quote.data.max_amount) : 10_000;
      const offers = telegramStarPacks
        .filter((quantity) => quantity >= min && quantity <= max)
        .map((quantity) => ({ providerOfferId: `stars_${quantity}`, name: `${quantity.toLocaleString("en-US")} Stars`, priceUsd: (quote.data.price_per_star * quantity).toFixed(2) }));
      if (offers.length) games.push({ providerGameId: telegramStarsGameId, name: "Telegram Stars", requiredFields: [telegramUsernameField()], offers });
    } else if (response) {
      console.warn(`[telegram] stars quote unparseable keys=${Object.keys((response ?? {}) as Record<string, unknown>).join(",")} raw=${JSON.stringify(response).slice(0, 300)}`);
    }
  } catch (error) {
    console.warn(`[telegram] stars quote failed ${(error as Error)?.message ?? String(error)}`);
  }
  try {
    const response = await fzrRequest("/api/v2/telegram/premium");
    const quote = response ? fzrTelegramPremiumSchema.safeParse(response) : null;
    if (quote?.success) {
      const offers = quote.data.plans
        .filter((plan) => telegramPremiumMonths.includes(plan.months))
        .map((plan) => ({ providerOfferId: `premium_${plan.months}`, name: `${plan.months} Months`, priceUsd: plan.price_usd.toFixed(2) }));
      if (offers.length) games.push({ providerGameId: telegramPremiumGameId, name: "Telegram Premium", requiredFields: [telegramUsernameField()], offers });
    } else if (response) {
      console.warn(`[telegram] premium quote unparseable keys=${Object.keys((response ?? {}) as Record<string, unknown>).join(",")} raw=${JSON.stringify(response).slice(0, 300)}`);
    }
  } catch (error) {
    console.warn(`[telegram] premium quote failed ${(error as Error)?.message ?? String(error)}`);
  }
  // Cache failures too: without this a 403 (product not enabled for the key) would
  // be retried on every single storefront render.
  telegramCatalogCache = { at: now, games };
  return games;
}

/** The game-list projection, matching asProviderGames so both merge cleanly. */
async function telegramStorefrontGames() {
  return (await fetchBuiltInProviderGames()).map((game) => ({ id: game.providerGameId, name: game.name, region: "Global", provider: "FZR Cards", requiredFields: [] as z.infer<typeof providerFieldSchema>[] }));
}

/**
 * Package rows for a Telegram service. Before the owner runs a catalog sync these
 * carry the default markup; afterwards the admin-managed sale price wins, exactly
 * like every synced provider package.
 */
async function telegramProviderPackages(game: TelegramSnapshotGame) {
  const livePackages = game.offers.map((offer) => ({
    id: providerPackageRecordId(game.providerGameId, offer.providerOfferId),
    label: offer.name,
    amountLabel: offer.name,
    priceLabel: `$${telegramRetailPrice(Number(offer.priceUsd), game.providerGameId === robloxRobuxGameId ? process.env.ROBLOX_MARGIN_PERCENT : undefined)}`,
    provider: "FZR Cards",
    paymentMethods: ["khqr", "bank"] as Array<"khqr" | "bank">,
  }));
  try {
    const { getAdminCatalog } = await import("./db");
    const adminCatalog = await getAdminCatalog();
    const rows = new Map<string, { amountLabel: string; priceUsd: string }>();
    adminCatalog.games.forEach((product: { packages: Array<{ id: string; amountLabel: string; priceUsd: string; isActive: boolean; providerSource?: string | null }> }) => {
      product.packages.forEach((item) => {
        if (item.isActive && String(item.providerSource ?? "").startsWith(`fzr_cards:${game.providerGameId}:`)) rows.set(item.id, { amountLabel: item.amountLabel, priceUsd: item.priceUsd });
      });
    });
    if (!rows.size) return applyShopPriceLadder(livePackages);
    return applyShopPriceLadder(livePackages.map((item) => {
      const row = rows.get(item.id);
      return row ? { ...item, label: row.amountLabel, amountLabel: row.amountLabel, priceLabel: `$${Number(row.priceUsd).toFixed(2)}` } : item;
    }));
  } catch {
    return applyShopPriceLadder(livePackages);
  }
}

async function telegramProviderGameDetails(gameId: string): Promise<ProviderGameDetailsResponse> {
  const normalized = gameId.trim().toLowerCase();
  const availability = await providerAvailability();
  if (availability.hiddenGameIds.includes(normalized)) return { status: "unavailable", game: null, packages: [] };
  const game = (await fetchBuiltInProviderGames()).find((item) => item.providerGameId === normalized);
  if (game) {
    const packages = await telegramProviderPackages(game);
    if (packages.length) {
      return {
        status: "ready",
        game: { id: game.providerGameId, name: game.name, region: "Global", provider: "FZR Cards", requiredFields: game.requiredFields },
        packages,
      };
    }
  }
  const cached = await cachedProviderGameDetails(normalized);
  if (cached) {
    if (normalized === robloxRobuxGameId) {
      return { ...cached, game: { ...cached.game, requiredFields: robloxAccountFields() } };
    }
    return cached;
  }
  if (normalized === robloxRobuxGameId) {
    return {
      status: "ready",
      game: { id: robloxRobuxGameId, name: "Roblox Robux", region: "Global", provider: "FZR Cards", requiredFields: robloxAccountFields() },
      packages: [],
    };
  }
  return { status: "unavailable", game: null, packages: [] };
}

/*
 * ---------------------------------------------------------------------------
 * Roblox Robux (FazerCards manual services)
 * ---------------------------------------------------------------------------
 * Robux is an operator-fulfilled SKU, so it comes from a THIRD endpoint family -
 * neither /topups nor /telegram:
 *   GET  /api/v2/manual-services              -> categories enabled for this key
 *   GET  /api/v2/manual-services/:id/offers   -> offers with price_usd
 *   POST /api/v2/manual-services/order          { manual_service_id, product_id }
 * The offer id is minted as manual_<serviceId>~<productId> so a PAID order can be
 * replayed to the provider later with no extra bookkeeping. `~` is used because
 * the order row's providerSource is parsed as fzr_cards:<gameId>:<offerId>.
 */
export const robloxRobuxGameId = "roblox_robux";
const ROBLOX_CATALOG_CACHE_MS = 60_000;

function robloxAccountFields() {
  return [
    { key: "username", label: "Roblox Username", placeholder: "e.g. builderman", required: true, kind: "text" as const },
    { key: "password", label: "Roblox Password", placeholder: "Account password", required: true, kind: "password" as const },
  ];
}

const fzrManualCategorySchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1).max(120)),
  name: z.string().trim().min(1).max(180),
  kind: z.string().trim().max(80).optional(),
  info: z.string().max(2000).optional(),
});

const fzrManualOfferSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1).max(160)),
  name: z.string().trim().min(1).max(180),
  price_usd: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().positive().max(10_000)),
});

function manualServiceItems(response: unknown) {
  const items = (response as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? items.slice(0, 500) : [];
}

let robloxCatalogCache: { at: number; games: TelegramSnapshotGame[] } | null = null;

/** Matched by NAME, because the manual-service id differs per reseller key. */
function isRobloxManualCategory(text: string) {
  return /roblox|robux/i.test(text);
}

async function fetchRobloxCatalogGames(): Promise<TelegramSnapshotGame[]> {
  const now = Date.now();
  if (robloxCatalogCache && now - robloxCatalogCache.at < ROBLOX_CATALOG_CACHE_MS) return robloxCatalogCache.games;
  const games: TelegramSnapshotGame[] = [];
  try {
    const categories = manualServiceItems(await fzrRequest("/api/v2/manual-services"))
      .map((item) => fzrManualCategorySchema.safeParse(item))
      .filter((item): item is z.ZodSafeParseSuccess<z.infer<typeof fzrManualCategorySchema>> => item.success)
      .map((item) => item.data)
      .filter((category) => isRobloxManualCategory(`${category.id} ${category.name} ${category.info ?? ""}`));
    const offers: TelegramSnapshotGame["offers"] = [];
    for (const category of categories.slice(0, 4)) {
      const response = await fzrRequest(`/api/v2/manual-services/${encodeURIComponent(category.id)}/offers`);
      manualServiceItems(response)
        .map((item) => fzrManualOfferSchema.safeParse(item))
        .filter((item): item is z.ZodSafeParseSuccess<z.infer<typeof fzrManualOfferSchema>> => item.success)
        .forEach((item) => {
          offers.push({ providerOfferId: `manual_${category.id}~${item.data.id}`, name: item.data.name, priceUsd: item.data.price_usd.toFixed(2) });
        });
    }
    if (offers.length) games.push({ providerGameId: robloxRobuxGameId, name: "Roblox Robux", requiredFields: robloxAccountFields(), offers: offers.slice(0, 60) });
    else if (categories.length) console.warn("[roblox] a Roblox manual service exists but exposed no parseable offers");
    else console.warn("[roblox] no Roblox manual-service category is enabled for this API key");
  } catch (error) {
    console.warn(`[roblox] manual-service catalog failed ${(error as Error)?.message ?? String(error)}`);
  }
  // Failures are cached too, so a 403 is not retried on every storefront render.
  robloxCatalogCache = { at: now, games };
  return games;
}

/** Telegram + Roblox, in the exact shape the provider sync snapshot expects. */
export async function fetchBuiltInProviderGames(): Promise<TelegramSnapshotGame[]> {
  const [telegram, roblox] = await Promise.all([fetchTelegramCatalogGames(), fetchRobloxCatalogGames()]);
  return [...telegram, ...roblox];
}

/**
 * Roblox fulfilment. manual_<serviceId>~<productId> is unpacked back into the two
 * ids the provider needs. FazerCards operators fulfil Robux through the order
 * CHAT (multipart `body`), not the undocumented fields map — posting only
 * `{ manual_service_id, product_id }` left paid orders sitting with no login,
 * which is why customers paid and never received Robux.
 */
async function submitRobloxProviderOrder(input: { categoryId: string; offerId: string; username: string; password: string; idempotencyKey?: string | null; existingOrderId?: string | null }): Promise<{ status: "submitted"; providerOrderId: string } | { status: "unavailable" } | { status: "error" }> {
  const username = input.username.trim().replace(/^@+/, "").replace(/\s+/g, "");
  const password = input.password.trim();
  // Roblox usernames are 3-20 characters of letters, digits and underscore.
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username) || password.length < 4 || password.length > 200) return { status: "error" };
  const parsed = /^manual_([^~]+)~(.+)$/.exec(input.offerId);
  if (!parsed) return { status: "error" };
  try {
    let providerOrderId = input.existingOrderId?.trim() || "";
    if (!providerOrderId) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (input.idempotencyKey) headers["Idempotency-Key"] = input.idempotencyKey.slice(0, 120);
      const response = await fzrRequest("/api/v2/manual-services/order", {
        method: "POST",
        headers,
        body: JSON.stringify({
          manual_service_id: parsed[1],
          product_id: parsed[2],
          fields: {
            username,
            roblox_username: username,
            login: username,
            password,
            roblox_password: password,
          },
        }),
      });
      if (!response) return { status: "unavailable" };
      const order = fzrTopupOrderSchema.safeParse(response);
      if (!order.success) {
        console.warn(`[roblox-order] ${input.categoryId}/${input.offerId}: unexpected response keys=${Object.keys((response ?? {}) as Record<string, unknown>).join(",")}`);
        return { status: "error" };
      }
      providerOrderId = order.data.order_id;
    }
    const chat = await sendRobloxOperatorChat(providerOrderId, username, password);
    if (chat === "unavailable") return { status: "unavailable" };
    if (chat === "error") return { status: "error" };
    return { status: "submitted", providerOrderId };
  } catch (error) {
    const status = error instanceof FzrRequestError ? error.status : 0;
    console.warn(`[roblox-order] ${input.categoryId}/${input.offerId}: request failed status=${status}`);
    return status && status !== 429 && status < 500 ? { status: "error" } : { status: "unavailable" };
  }
}

/** Operator chat is how FazerCards actually receives the Roblox login. Never log the body. */
async function sendRobloxOperatorChat(providerOrderId: string, username: string, password: string): Promise<"ok" | "unavailable" | "error"> {
  const form = new FormData();
  form.append("body", `Roblox username: ${username}\nRoblox password: ${password}`);
  try {
    const response = await fzrFormRequest(`/api/v2/manual-services/orders/${encodeURIComponent(providerOrderId)}/chat`, form);
    if (!response) return "unavailable";
    return "ok";
  } catch (error) {
    const status = error instanceof FzrRequestError ? error.status : 0;
    if (status === 404) {
      try {
        const retry = await fzrFormRequest(`/api/v2/manual-services/order/${encodeURIComponent(providerOrderId)}/chat`, form);
        if (!retry) return "unavailable";
        return "ok";
      } catch (retryError) {
        const retryStatus = retryError instanceof FzrRequestError ? retryError.status : 0;
        console.warn(`[roblox-order] chat fallback failed status=${retryStatus}`);
        return retryStatus && retryStatus !== 429 && retryStatus < 500 ? "error" : "unavailable";
      }
    }
    console.warn(`[roblox-order] chat failed status=${status}`);
    return status && status !== 429 && status < 500 ? "error" : "unavailable";
  }
}

async function fzrFormRequest(path: string, form: FormData) {
  const baseUrl = process.env.FZR_CARDS_API_BASE_URL;
  const apiKey = await resolveProviderCredential("fazercards", process.env.FZR_CARDS_API_KEY);
  if (!baseUrl || !apiKey) return null;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new FzrRequestError(response.status);
  const text = await response.text();
  if (!text.trim()) return { ok: true };
  try { return JSON.parse(text) as unknown; } catch { return { ok: true }; }
}

export function isWantedProviderProduct(text: string) {
  return WANTED_PROVIDER_GAME_PATTERNS.some((pattern) => pattern.test(text.replace(/-/g, "_")));
}

function isWantedProviderGameId(gameId: string) {
  return isWantedProviderProduct(gameId);
}

export function balanceSocialProviderServices<T extends { name: string; category: string }>(services: T[], limit = 120) {
  const buckets = new Map<string, T[]>(socialPlatformOrder.map((platform) => [platform, []]));
  const fallback: T[] = [];
  for (const service of services) {
    const text = `${service.category} ${service.name}`.toLowerCase();
    const platform = socialPlatformOrder.find((candidate) => text.includes(candidate));
    if (platform) buckets.get(platform)?.push(service);
    else fallback.push(service);
  }
  const balanced: T[] = [];
  for (let index = 0; balanced.length < limit; index += 1) {
    let added = false;
    for (const platform of socialPlatformOrder) {
      const service = buckets.get(platform)?.[index];
      if (service && balanced.length < limit) { balanced.push(service); added = true; }
    }
    if (!added) break;
  }
  return [...balanced, ...fallback].slice(0, limit);
}

export type FzrProviderSyncSnapshot =
  | { status: "ready"; games: Array<{ providerGameId: string; name: string; logoUrl?: string; requiredFields: z.infer<typeof providerFieldSchema>[]; offers: Array<{ providerOfferId: string; name: string; priceUsd: string }> }> }
  | { status: "unavailable"; games: [] }
  | { status: "error"; games: [] };

export function getProviderCatalogStatus() {
  const endpointConfigured = Boolean(process.env.FZR_CARDS_API_BASE_URL);
  const credentialConfigured = Boolean(process.env.FZR_CARDS_API_KEY);
  const smmEndpointConfigured = Boolean(process.env.SMMGLOB_API_URL);
  const smmCredentialConfigured = Boolean(process.env.SMMGLOB_API_KEY);
  return { configured: endpointConfigured && credentialConfigured, endpointConfigured, credentialConfigured, smmConfigured: smmEndpointConfigured && smmCredentialConfigured, smmEndpointConfigured, smmCredentialConfigured };
}

class FzrRequestError extends Error {
  constructor(readonly status: number) { super(`FZR Cards request failed (${status})`); }
}

async function fzrRequest(path: string, init: RequestInit = {}) {
  const baseUrl = process.env.FZR_CARDS_API_BASE_URL;
  const apiKey = await resolveProviderCredential("fazercards", process.env.FZR_CARDS_API_KEY);
  if (!baseUrl || !apiKey) return null;
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "X-API-Key": apiKey, ...init.headers }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new FzrRequestError(response.status);
  return response.json();
}

// Retries transient provider failures (rate limits, 5xx, network/timeout) with a short
// backoff. Without this, a single 429/timeout among the hundreds of concurrent per-game
// offer requests during a catalog sync would abort the entire sync and import nothing.
async function fzrRequestWithRetry(path: string, attempts = 3): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fzrRequest(path);
    } catch (error) {
      lastError = error;
      const status = error instanceof FzrRequestError ? error.status : 0;
      // Do not retry deterministic client errors other than 429 rate limiting.
      if (status && status !== 429 && status < 500) throw error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function providerAvailability() {
  const now = Date.now();
  if (providerAvailabilitySnapshot && now < providerAvailabilityRetryAt) return providerAvailabilitySnapshot;
  try {
    // Use the primary ZURS ledger when it exists. Appwrite remains a backward-
    // compatible fallback for deployments where the primary database is absent.
    const { getPrimaryProviderAvailability } = await import("./db");
    const availability = await getPrimaryProviderAvailability() ?? (isAppwriteStoreConfigured() ? await getAppwriteProviderAvailability() : { hiddenGameIds: [], hiddenSmmServiceIds: [], activeGameIds: undefined });
    providerAvailabilitySnapshot = availability;
    providerAvailabilityRetryAt = now + 60_000;
    return availability;
  } catch {
    // Keep the last known restrictions where possible and back off retrying when
    // Appwrite has exhausted its read allowance. This keeps provider catalogs browsable.
    providerAvailabilitySnapshot ??= { hiddenGameIds: [], hiddenSmmServiceIds: [], activeGameIds: undefined };
    providerAvailabilityRetryAt = now + 5 * 60_000;
    return providerAvailabilitySnapshot;
  }
}

async function smmGlobRequest(action: string, parameters: Record<string, string> = {}) {
  const configuredUrl = process.env.SMMGLOB_API_URL?.trim();
  const baseUrl = configuredUrl ? `${configuredUrl.replace(/\/+$/, "").replace(/\/api\/v2$/, "")}/api/v2` : null;
  const apiKey = process.env.SMMGLOB_API_KEY;
  if (!baseUrl || !apiKey) return null;
  const body = new URLSearchParams({ key: apiKey, action, ...parameters });
  const response = await fetch(baseUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`SMMGlob catalog request failed (${response.status})`);
  return response.json();
}

function providerFields(fields: z.infer<typeof fzrOffersSchema>["fields"]) {
  return fields.map((field) => ({ key: field.key, label: field.label, placeholder: field.placeholder, required: field.required ?? true, kind: /number|numeric|digit/i.test(field.type ?? "") ? "number" as const : "text" as const }));
}

export function providerPackageRecordId(categoryId: string, offerId: string) {
  const source = `fzr_cards:${categoryId}:${offerId}`;
  return `fzr-offer-${createHash("sha256").update(source).digest("hex").slice(0, 40)}`;
}

export async function resolveLiveProviderOffer(packageId: string) {
  const variantIds: string[] = [...freeFireFamilyVariantIds];
  try {
    const catalog = await fetchFzrTopupCatalog();
    if (catalog.status === "ready") {
      for (const item of catalog.items) {
        if (/^free_fire(?:_|$)/i.test(item.category_id) && !variantIds.includes(item.category_id)) variantIds.push(item.category_id);
      }
    }
  } catch { /* Use the known Free Fire routes even if the catalog page is down. */ }
  for (const categoryId of variantIds) {
    try {
      const response = await fzrRequest(`/api/v2/topups/offers?category_id=${encodeURIComponent(categoryId)}&include_ui=1`);
      const payload = fzrOffersSchema.safeParse(response);
      if (!payload.success) continue;
      for (const offer of payload.data.offers) {
        if (!offer.offer_id) continue;
        if (providerPackageRecordId(categoryId, offer.offer_id) !== packageId) continue;
        const fields = providerFields(payload.data.fields);
        return {
          categoryId,
          offerId: offer.offer_id,
          name: offer.name,
          priceUsd: offer.price_usd,
          requiresZone: fields.some((field) => /zone|server|region/i.test(field.key)),
          gameName: payload.data.name ?? "Free Fire",
        };
      }
    } catch { /* Try the next Free Fire route. */ }
  }
  return null;
}

const ADMIN_CATALOG_CACHE_MS = 20_000;
let adminCatalogCache: { expiresAt: number; value: Promise<{ games: Array<{ id: string; packages: Array<{ id: string; amountLabel: string; priceUsd: string; isActive: boolean; providerSource?: string | null }> }> }> } | null = null;

async function adminCatalogForStorefront() {
  const now = Date.now();
  if (adminCatalogCache && now < adminCatalogCache.expiresAt) return adminCatalogCache.value;
  const { getAdminCatalog } = await import("./db");
  const value = getAdminCatalog();
  adminCatalogCache = { expiresAt: now + ADMIN_CATALOG_CACHE_MS, value };
  return value;
}

const FZR_OFFERS_CACHE_MS = 45_000;
const fzrOffersCache = new Map<string, { expiresAt: number; value: unknown }>();
const fzrOffersInFlight = new Map<string, Promise<unknown>>();

async function fzrOffersByCategory(categoryId: string) {
  const cached = fzrOffersCache.get(categoryId);
  if (cached && Date.now() < cached.expiresAt) return cached.value;
  const inflight = fzrOffersInFlight.get(categoryId);
  if (inflight) return inflight;
  const request = fzrRequest(`/api/v2/topups/offers?category_id=${encodeURIComponent(categoryId)}&include_ui=1`)
    .then((value) => {
      if (value) fzrOffersCache.set(categoryId, { expiresAt: Date.now() + FZR_OFFERS_CACHE_MS, value });
      return value;
    })
    .finally(() => {
      if (fzrOffersInFlight.get(categoryId) === request) fzrOffersInFlight.delete(categoryId);
    });
  fzrOffersInFlight.set(categoryId, request);
  return request;
}

async function providerPackages(categoryId: string, offers: z.infer<typeof fzrOffersSchema>["offers"]) {
  const livePackages = offers.filter((offer) => Boolean(offer.offer_id)).map((offer) => ({ id: providerPackageRecordId(categoryId, offer.offer_id!), label: offer.name, amountLabel: offer.name, priceLabel: `$${Number(offer.price_usd).toFixed(2)}`, provider: "FZR Cards", paymentMethods: ["khqr", "bank"] as ("khqr" | "bank")[] }));
  try {
    const adminCatalog = await adminCatalogForStorefront();
    const productId = `fzr-game-${createHash("sha256").update(categoryId).digest("hex").slice(0, 40)}`;
    const product = adminCatalog.games.find((item) => item.id === productId || item.packages.some((pkg: { providerSource?: string | null }) => String(pkg.providerSource ?? "").startsWith(`fzr_cards:${categoryId}:`)));
    if (!product) return regularMobileLegendsPackages(categoryId, applyShopPriceLadder(livePackages));
    const activePackages = product.packages.filter((item: { isActive: boolean }) => item.isActive);
    const activeById = new Map<string, { id: string; amountLabel: string; priceUsd: string }>(activePackages.map((item: { id: string; amountLabel: string; priceUsd: string }) => [item.id, item]));
    const matchedLivePackages = livePackages.flatMap((item) => {
      const catalogItem = activeById.get(item.id);
      return catalogItem ? [{ ...item, label: catalogItem.amountLabel, amountLabel: catalogItem.amountLabel, priceLabel: `$${Number(catalogItem.priceUsd).toFixed(2)}` }] : [];
    });
    if (matchedLivePackages.length) return regularMobileLegendsPackages(categoryId, applyShopPriceLadder(matchedLivePackages));
    // If the live offer response uses a temporarily different shape, expose the
    // already-synchronized active package IDs so checkout still receives rows
    // that the order validator can resolve.
    return regularMobileLegendsPackages(categoryId, applyShopPriceLadder(activePackages.map((item: { id: string; amountLabel: string; priceUsd: string }) => ({ id: item.id, label: item.amountLabel, amountLabel: item.amountLabel, priceLabel: `$${Number(item.priceUsd).toFixed(2)}`, provider: "FZR Cards", paymentMethods: ["khqr", "bank"] as ("khqr" | "bank")[] }))));
  } catch {
    return [];
  }
}

export function filterProviderPackagesByActiveIds<T extends { id: string }>(packages: T[], activeIds: string[] | null) {
  return activeIds === null ? packages : packages.filter((item) => activeIds.includes(item.id));
}

async function filterOrderableProviderPackages<T extends { id: string }>(packages: T[]) {
  const activeIds = await getActiveProviderPackageIds(packages.map((item) => item.id));
  return filterProviderPackagesByActiveIds(packages, activeIds);
}

function providerGameRegion(name: string, note?: string) {
  const source = `${name}\n${note ?? ""}`;
  const notedRegion = source.match(/(?:^|\n)\s*region\s*:\s*([^\n]+)/i)?.[1]?.trim();
  if (notedRegion) return notedRegion;
  const bracketedRegion = name.match(/\(([^)]+)\)\s*$/)?.[1]?.trim();
  return bracketedRegion || "Global";
}

type FzrTopupItem = z.infer<typeof fzrTopupsSchema>["items"][number];
type FzrTopupCatalog = { status: "ready"; items: FzrTopupItem[]; legacyPublicIds: string[] } | { status: "unavailable" | "error"; items: []; legacyPublicIds: [] };
const FZR_TOPUP_CATALOG_CACHE_MS = 60_000;
let fzrTopupCatalogCache: { expiresAt: number; value: Extract<FzrTopupCatalog, { status: "ready" }> } | null = null;
let fzrTopupCatalogInFlight: Promise<FzrTopupCatalog> | null = null;

async function fetchFzrTopupCatalogUncached(): Promise<FzrTopupCatalog> {
  try {
    const firstResponse = await fzrRequest("/api/v2/topups");
    if (!firstResponse) return { status: "unavailable", items: [], legacyPublicIds: [] };
    const firstPayload = fzrTopupsSchema.safeParse(firstResponse);
    if (!firstPayload.success) return { status: "error", items: [], legacyPublicIds: [] };

    const legacyPublicIds = firstPayload.data.items.map((item) => item.category_id);
    const items = [...firstPayload.data.items];
    const knownIds = new Set(legacyPublicIds);
    const seenCursors = new Set<string>();
    let cursor = firstPayload.data.meta?.next_cursor ?? null;

    for (let page = 0; cursor && page < 20 && !seenCursors.has(cursor); page += 1) {
      seenCursors.add(cursor);
      const query = new URLSearchParams({ limit: "100", cursor });
      const response = await fzrRequest(`/api/v2/topups?${query.toString()}`);
      if (!response) return { status: "unavailable", items: [], legacyPublicIds: [] };
      const payload = fzrTopupsSchema.safeParse(response);
      if (!payload.success) return { status: "error", items: [], legacyPublicIds: [] };
      for (const item of payload.data.items) {
        if (!knownIds.has(item.category_id)) {
          knownIds.add(item.category_id);
          items.push(item);
        }
      }
      cursor = payload.data.meta?.next_cursor ?? null;
    }

    return { status: "ready", items, legacyPublicIds };
  } catch { return { status: "error", items: [], legacyPublicIds: [] }; }
}

async function fetchFzrTopupCatalog(): Promise<FzrTopupCatalog> {
  const now = Date.now();
  if (fzrTopupCatalogCache && now < fzrTopupCatalogCache.expiresAt) return fzrTopupCatalogCache.value;
  if (fzrTopupCatalogInFlight) return fzrTopupCatalogInFlight;
  const request = fetchFzrTopupCatalogUncached();
  fzrTopupCatalogInFlight = request;
  try {
    const catalog = await request;
    if (catalog.status === "ready") fzrTopupCatalogCache = { expiresAt: Date.now() + FZR_TOPUP_CATALOG_CACHE_MS, value: catalog };
    return catalog;
  } finally {
    if (fzrTopupCatalogInFlight === request) fzrTopupCatalogInFlight = null;
  }
}

export function resetProviderCatalogCacheForTests() {
  fzrTopupCatalogCache = null;
  fzrTopupCatalogInFlight = null;
  providerAvailabilitySnapshot = null;
  providerAvailabilityRetryAt = 0;
  adminCatalogCache = null;
}

/**
 * Drops the storefront's cached projection of the admin catalogue.
 *
 * The sale price a shopper sees and the amount the KHQR worker will accept both
 * come from `gamePackages.priceUsd`. That projection is memoized for
 * `ADMIN_CATALOG_CACHE_MS`, so without this the storefront could keep serving
 * the previous amount for up to 20 seconds after the owner saves a new one.
 * Called by every admin price write; only the catalogue view is dropped (the
 * provider cost caches are left alone, so no extra provider traffic is caused).
 */
export function invalidateProviderStorefrontCaches() {
  adminCatalogCache = null;
}

/** Initial storefront baseline from the owner-approved public catalog before the Admin allowlist was persisted. */
export const initialApprovedPublicGameIds = [
  "8_ball_pool",
  "eafc_mobile_kh",
  "frag_pro_shooter",
  "free_fire_bd",
  "free_fire_cis",
  "free_fire_latam",
  "free_fire_mena",
  "free_fire_my_sg",
  "free_fire_sg",
  "honor_of_kings",
  "magic_chess_gogo_global",
  "mobile_legends_global",
  "mobile_legends_promo",
  "mobile_legends_special",
  "pubg_mobile_auto",
  "pubg_mobile_fast",
] as const;

export const mobileLegendsFamilyGameId = "mobile_legends";
const mobileLegendsFamilyVariantIds = ["mobile_legends_global", "mobile_legends_promo", "mobile_legends_special"] as const;
export const freeFireFamilyGameId = "free_fire";
const freeFireFamilyVariantIds = ["free_fire_my_sg", "free_fire_sg", "free_fire_bd", "free_fire_cis", "free_fire_latam", "free_fire_mena"] as const;
export const pubgMobileFamilyGameId = "pubg_mobile";
const pubgMobileFamilyVariantIds = ["pubg_mobile_auto", "pubg_mobile_fast"] as const;

function isMobileLegendsFamilyGame(gameId: string) {
  return gameId.trim().toLowerCase() === mobileLegendsFamilyGameId;
}

function regularMobileLegendsPackages<T extends { id?: string; label?: string; amountLabel?: string; name?: string }>(gameId: string, packages: T[]) {
  const filtered = isMobileLegendsAdventureGame(gameId)
    ? packages
    : isMobileLegendsFamilyGame(gameId) || isRegularMobileLegendsVariant(gameId)
      ? withoutMlbbAdventurePackages(packages)
      : packages;
  return keepCheapestEquivalentPackages(filtered.map((item) => ({
    ...item,
    id: item.id ?? "",
    label: item.label ?? item.amountLabel ?? item.name ?? "",
    amountLabel: item.amountLabel ?? item.label ?? item.name ?? "",
  }))) as T[];
}

function isRegularMobileLegendsFamilyVariant(game: { id: string; name?: string }) {
  return game.id !== mobileLegendsFamilyGameId && isRegularMobileLegendsVariant(game.id, game.name);
}

function mobileLegendsAccountFields(fields: z.infer<typeof providerFieldSchema>[] = []) {
  const player = fields.find((field) => /(?:player|user|account|uid|\bid\b)/i.test(`${field.key} ${field.label}`) && !/(?:server|zone)/i.test(`${field.key} ${field.label}`));
  const server = fields.find((field) => /(?:server|zone)/i.test(`${field.key} ${field.label}`));
  return [
    { key: player?.key ?? "player_id", label: player?.label ?? "Player ID", placeholder: player?.placeholder || "User ID", required: true, kind: "text" as const },
    { key: server?.key ?? "server_id", label: "Server ID", placeholder: server?.placeholder || "Zone ID", required: true, kind: "text" as const },
  ];
}

function isFreeFireFamilyGame(gameId: string) {
  return gameId.trim().toLowerCase() === freeFireFamilyGameId;
}

function isFreeFireGame(gameId: string) {
  return /^free_fire(?:_|$)/i.test(gameId.trim());
}

function freeFireIdentityFields(fields: z.infer<typeof providerFieldSchema>[]) {
  const withoutZone = fields.filter((field) => !/(?:server|zone)/i.test(`${field.key} ${field.label}`));
  const normalized = withoutZone.map((field) => (
    /(?:player|user|account|uid|\bid\b)/i.test(`${field.key} ${field.label}`)
      ? { ...field, required: true, kind: "text" as const, placeholder: field.placeholder || "UID Free Fire" }
      : field
  ));
  if (normalized.some((field) => /(?:player|user|account|uid|\bid\b)/i.test(`${field.key} ${field.label}`))) return normalized;
  return [{ key: "player_id", label: "Player ID", placeholder: "UID Free Fire", required: true, kind: "text" as const }];
}

function isPubgMobileFamilyGame(gameId: string) {
  return gameId.trim().toLowerCase() === pubgMobileFamilyGameId;
}

function publicProviderGameIds(availability: Awaited<ReturnType<typeof providerAvailability>>) {
  const approvedIds = availability.activeGameIds?.length ? availability.activeGameIds : initialApprovedPublicGameIds;
  return new Set(approvedIds.filter((id) => isWantedProviderGameId(id) && !availability.hiddenGameIds.includes(id)));
}

function asProviderGames(items: FzrTopupItem[]) {
  return items.filter((item) => {
    const text = `${item.category_id} ${item.name} ${item.note ?? ""}`;
    return isWantedProviderProduct(text) && !isThailandProviderProduct(text);
  }).map((item) => ({ id: item.category_id, name: item.name, region: providerGameRegion(item.name, item.note), provider: "FZR Cards", requiredFields: [] }));
}

/** During a transient FZR outage, preserve only the owner-approved public IDs from the persisted catalog. */
export function cachedPublicProviderGames(catalog: AppwriteProviderCatalog, availability: Awaited<ReturnType<typeof providerAvailability>>) {
  const activeIds = publicProviderGameIds(availability);
  const hiddenIds = new Set(availability.hiddenGameIds);
  return catalog.games.flatMap((game) => {
    const providerId = game.providerSourceId?.trim();
    const name = game.titleEn?.trim() || game.titleKh?.trim();
    if (!providerId || !name || !(isWantedProviderGameId(providerId) || (isBuiltInProviderGameId(providerId) || isTelegramProviderProduct(`${providerId} ${name}`))) || !(activeIds.has(providerId) || (isBuiltInProviderGameId(providerId) || isTelegramProviderProduct(`${providerId} ${name}`))) || hiddenIds.has(providerId) || isThailandProviderProduct(`${providerId} ${name}`)) return [];
    return [{ id: providerId, name, region: providerGameRegion(name), provider: "FZR Cards" as const, requiredFields: [] }];
  });
}

/**
 * Keep owner inventory operable during a temporary FZR read outage. The list is
 * composed solely of previously synchronized provider records, and mutations
 * still use their original provider source IDs.
 */
export function cachedProviderAvailabilityGames(catalog: AppwriteProviderCatalog, availability: Awaited<ReturnType<typeof providerAvailability>>) {
  const activeIds = publicProviderGameIds(availability);
  const hiddenIds = new Set(availability.hiddenGameIds);
  return catalog.games.flatMap((game) => {
    const providerId = game.providerSourceId?.trim();
    const name = game.titleEn?.trim() || game.titleKh?.trim();
    if (!providerId || !name || !isWantedProviderGameId(providerId) || isThailandProviderProduct(`${providerId} ${name}`)) return [];
    return [{ id: providerId, name, isActive: activeIds.has(providerId) && !hiddenIds.has(providerId) }];
  });
}

async function cachedPublicProviderGamesDuringOutage(availability: Awaited<ReturnType<typeof providerAvailability>>) {
  if (!publicProviderGameIds(availability).size) return [];
  try {
    const appwriteGames = cachedPublicProviderGames(await getAppwriteProviderCatalog(), availability);
    if (appwriteGames.length) return appwriteGames;
  } catch { /* Fall through to the primary SQL catalog. */ }
  try {
    const { getGameCatalog } = await import("./db");
    const activeIds = publicProviderGameIds(availability);
    const hiddenIds = new Set(availability.hiddenGameIds);
    const catalog = await getGameCatalog();
    return catalog.flatMap((game) => {
      const providerId = game.packages.map((item) => String(item.providerSource ?? "").match(/^fzr_cards:([^:]+):/)?.[1]).find(Boolean);
      const name = game.titleEn?.trim() || game.titleKh?.trim();
      if (!providerId || !name || !(isWantedProviderGameId(providerId) || (isBuiltInProviderGameId(providerId) || isTelegramProviderProduct(`${providerId} ${name}`))) || !(activeIds.has(providerId) || (isBuiltInProviderGameId(providerId) || isTelegramProviderProduct(`${providerId} ${name}`))) || hiddenIds.has(providerId) || isThailandProviderProduct(`${providerId} ${name}`)) return [];
      return [{ id: providerId, name, region: providerGameRegion(name), provider: "FZR Cards" as const, requiredFields: [] }];
    });
  } catch { return []; }
}

async function cachedProviderGameDetails(gameId: string, includeInactive = false): Promise<Extract<ProviderGameDetailsResponse, { status: "ready" }> | null> {
  try {
    const { getGameCatalog } = await import("./db");
    const catalog = await getGameCatalog();
    const product = catalog.find((game) => game.packages.some((item) => String(item.providerSource ?? "").startsWith(`fzr_cards:${gameId}:`)));
    if (!product) return null;
    const packages = applyShopPriceLadder(product.packages.filter((item) => includeInactive || item.isActive).map((item) => ({ id: item.id, label: item.amountLabel, amountLabel: item.amountLabel, priceLabel: `$${Number(item.priceUsd).toFixed(2)}`, provider: "FZR Cards", paymentMethods: ["khqr", "bank"] as ("khqr" | "bank")[] })));
    if (!packages.length) return null;
    // A Telegram top-up asks for one @username and never for a server/zone.
    const telegramService = isTelegramProviderProduct(`${gameId} ${product.titleEn ?? ""} ${product.titleKh ?? ""}`);
    const requiredFields = telegramService
      ? [telegramUsernameField()]
      : gameId === robloxRobuxGameId || /roblox|robux/i.test(`${gameId} ${product.titleEn ?? ""}`)
        ? robloxAccountFields()
        : isMobileLegendsGame(gameId)
        ? mobileLegendsAccountFields()
        : [{ key: "player_id", label: "Player ID", placeholder: "Enter Player ID", required: true, kind: "text" as const }, ...(product.requiresZone ? [{ key: "server_id", label: "Server ID", placeholder: "Enter Server ID", required: true, kind: "text" as const }] : [])];
    return { status: "ready", game: { id: gameId, name: product.titleEn || product.titleKh, region: providerGameRegion(product.titleEn || product.titleKh), provider: "FZR Cards", requiredFields }, packages };
  } catch { return null; }
}

export async function fetchProviderGames(options: { includeInactive?: boolean } = {}): Promise<ProviderGameResponse> {
  if (!process.env.FZR_CARDS_API_BASE_URL || !(await resolveProviderCredential("fazercards", process.env.FZR_CARDS_API_KEY))) {
    if (!options.includeInactive) {
      const cachedGames = await cachedPublicProviderGamesDuringOutage(await providerAvailability());
      if (cachedGames.length) return { status: "ready", games: cachedGames };
    }
    return { status: "unavailable", games: [] };
  }
  // The Telegram quotes come from their own endpoint family, so they are fetched
  // alongside the /topups catalog and survive a /topups outage.
  const [catalog, availability, telegramGames] = await Promise.all([fetchFzrTopupCatalog(), providerAvailability(), telegramStorefrontGames()]);
  if (catalog.status !== "ready") {
    if (!options.includeInactive) {
      const cachedGames = await cachedPublicProviderGamesDuringOutage(availability);
      const outageGames = [...telegramGames, ...cachedGames.filter((game) => !isBuiltInProviderGameId(game.id))];
      if (outageGames.length) return { status: "ready", games: outageGames };
    }
    if (telegramGames.length) return { status: "ready", games: telegramGames };
    return { status: catalog.status, games: [] };
  }
  const games = [...telegramGames, ...asProviderGames(catalog.items).filter((game) => !isBuiltInProviderGameId(game.id))];
  if (options.includeInactive) return { status: "ready", games };
  const activeIds = publicProviderGameIds(availability);
  // Games stay allowlist-driven, but the Telegram service is auto-approved: its
  // provider category id is not in the historical baseline list, so requiring an
  // explicit allowlist entry would keep it permanently invisible. The owner still
  // controls it the normal way, by hiding it in Admin.
  const livePublicGames = games.filter((game) => (activeIds.has(game.id) || isTelegramProviderProduct(`${game.id} ${game.name}`)) && !availability.hiddenGameIds.includes(game.id));
  // Admin visibility is the source of truth. If the provider live response omits a previously synced category, keep that approved game visible from the persisted catalog.
  const cachedPublicGames = await cachedPublicProviderGamesDuringOutage(availability);
  const merged = new Map<string, (typeof livePublicGames)[number]>(cachedPublicGames.map((game) => [game.id, game as (typeof livePublicGames)[number]]));
  for (const game of livePublicGames) merged.set(game.id, game);
  return { status: "ready", games: Array.from(merged.values()) };
}

export async function fetchProviderGameDetails(gameId: string, options: { includeInactive?: boolean } = {}): Promise<ProviderGameDetailsResponse> {
  try {
    // Telegram is quoted from /telegram/*, never from /topups/offers, so it has to
    // be resolved before every category-id allowlist gate below.
    if (isBuiltInProviderGameId(gameId)) return await telegramProviderGameDetails(gameId);
    if (!isWantedProviderGameId(gameId)) return { status: "unavailable", game: null, packages: [] };
    const availableGames = await fetchProviderGames({ includeInactive: options.includeInactive });
    if (availableGames.status !== "ready") return { status: availableGames.status === "error" ? "error" : "unavailable", game: null, packages: [] };
    if (isMobileLegendsFamilyGame(gameId)) {
      const activeVariants = availableGames.games.filter((game) => isRegularMobileLegendsFamilyVariant(game)).map((game) => game.id);
      if (!activeVariants.length) return { status: "unavailable", game: null, packages: [] };
      const syncedPackages = options.includeInactive ? await getAdminSyncedProviderPackages(activeVariants) : await getPublicSyncedProviderPackages(activeVariants);
      if (syncedPackages?.length) {
        const primary = availableGames.games.find((game) => game.id === "mobile_legends_global") ?? availableGames.games.find((game) => activeVariants.includes(game.id))!;
        return { status: "ready", game: { ...primary, id: mobileLegendsFamilyGameId, name: "Mobile Legends", requiredFields: mobileLegendsAccountFields(primary.requiredFields) }, packages: regularMobileLegendsPackages(mobileLegendsFamilyGameId, syncedPackages) };
      }
      const variantDetails = await Promise.all(activeVariants.map((variantId) => fetchProviderGameDetails(variantId, options)));
      const readyVariants = variantDetails.filter((details): details is Extract<ProviderGameDetailsResponse, { status: "ready" }> => details.status === "ready");
      if (!readyVariants.length) return { status: variantDetails.some((details) => details.status === "error") ? "error" : "unavailable", game: null, packages: [] };
      const primary = readyVariants.find((details) => details.game.id === "mobile_legends_global") ?? readyVariants[0]!;
      return {
        status: "ready",
        game: { ...primary.game, id: mobileLegendsFamilyGameId, name: "Mobile Legends", requiredFields: mobileLegendsAccountFields(primary.game.requiredFields) },
        packages: regularMobileLegendsPackages(mobileLegendsFamilyGameId, applyShopPriceLadder(readyVariants.flatMap((details) => details.packages))),
      };
    }
    if (isFreeFireFamilyGame(gameId)) {
      // FazerCards publishes Free Fire by regional fulfillment route. Present all
      // owner-enabled routes as a single Free Fire game while leaving each offer's
      // original provider category and package ID untouched.
      const activeVariants = availableGames.games.filter((game) => game.id !== freeFireFamilyGameId && /^free_fire(?:_|$)/i.test(game.id)).map((game) => game.id);
      if (!activeVariants.length) return { status: "unavailable", game: null, packages: [] };
      const syncedPackages = options.includeInactive ? await getAdminSyncedProviderPackages(activeVariants) : await getPublicSyncedProviderPackages(activeVariants);
      if (syncedPackages?.length) {
        const primary = availableGames.games.find((game) => game.id === "free_fire_my_sg") ?? availableGames.games.find((game) => activeVariants.includes(game.id))!;
        return { status: "ready", game: { ...primary, id: freeFireFamilyGameId, name: "Free Fire", requiredFields: freeFireIdentityFields(primary.requiredFields) }, packages: syncedPackages };
      }
      const variantDetails = await Promise.all(activeVariants.map((variantId) => fetchProviderGameDetails(variantId, options)));
      const readyVariants = variantDetails.filter((details): details is Extract<ProviderGameDetailsResponse, { status: "ready" }> => details.status === "ready");
      if (!readyVariants.length) return { status: variantDetails.some((details) => details.status === "error") ? "error" : "unavailable", game: null, packages: [] };
      const primary = readyVariants.find((details) => details.game.id === "free_fire_my_sg") ?? readyVariants[0]!;
      return {
        status: "ready",
        game: { ...primary.game, id: freeFireFamilyGameId, name: "Free Fire", requiredFields: freeFireIdentityFields(primary.game.requiredFields) },
        packages: applyShopPriceLadder(readyVariants.flatMap((details) => details.packages)),
      };
    }
    if (isPubgMobileFamilyGame(gameId)) {
      const activeVariants = availableGames.games.filter((game) => game.id !== pubgMobileFamilyGameId && /^pubg_mobile(?:_|$)/i.test(game.id)).map((game) => game.id);
      if (!activeVariants.length) return { status: "unavailable", game: null, packages: [] };
      const syncedPackages = options.includeInactive ? await getAdminSyncedProviderPackages(activeVariants) : await getPublicSyncedProviderPackages(activeVariants);
      if (syncedPackages?.length) {
        const primary = availableGames.games.find((game) => game.id === "pubg_mobile_auto") ?? availableGames.games.find((game) => activeVariants.includes(game.id))!;
        return { status: "ready", game: { ...primary, id: pubgMobileFamilyGameId, name: "PUBG Mobile" }, packages: syncedPackages };
      }
      const variantDetails = await Promise.all(activeVariants.map((variantId) => fetchProviderGameDetails(variantId, options)));
      const readyVariants = variantDetails.filter((details): details is Extract<ProviderGameDetailsResponse, { status: "ready" }> => details.status === "ready");
      if (!readyVariants.length) return { status: variantDetails.some((details) => details.status === "error") ? "error" : "unavailable", game: null, packages: [] };
      const primary = readyVariants.find((details) => details.game.id === "pubg_mobile_auto") ?? readyVariants[0]!;
      return {
        status: "ready",
        game: { ...primary.game, id: pubgMobileFamilyGameId, name: "PUBG Mobile" },
        packages: applyShopPriceLadder(readyVariants.flatMap((details) => details.packages)),
      };
    }
    if (!availableGames.games.some((game) => game.id === gameId)) return { status: "unavailable", game: null, packages: [] };
    const response = await fzrOffersByCategory(gameId);
    if (!response) return (await cachedProviderGameDetails(gameId, options.includeInactive)) ?? { status: "unavailable", game: null, packages: [] };
    const payload = fzrOffersSchema.safeParse(response);
    // Only treat an unparseable response as an error. The provider sometimes echoes a
    // normalized category_id, so we key off the requested gameId instead of requiring an
    // exact match (which previously dropped valid packages on the storefront).
    if (!payload.success) return (await cachedProviderGameDetails(gameId, options.includeInactive)) ?? { status: "error", game: null, packages: [] };
    const resolvedName = payload.data.name ?? gameId;
    if (isThailandProviderProduct(`${gameId} ${resolvedName}`)) return { status: "unavailable", game: null, packages: [] };
    const fields = providerFields(payload.data.fields);
    const livePackages = await providerPackages(gameId, payload.data.offers);
    // If the live response parsed but produced no usable packages (e.g. an ID-verified game that
    // returns an unexpected empty shape), fall back to the last successfully synced packages so
    // the storefront never regresses to empty.
    if (!livePackages.length) {
      const cached = await cachedProviderGameDetails(gameId, options.includeInactive);
      if (cached && cached.status === "ready" && cached.packages.length) return cached;
    }
    return { status: "ready", game: { id: gameId, name: resolvedName, region: providerGameRegion(resolvedName), logoUrl: payload.data.imageurl, provider: "FZR Cards", requiredFields: /^free_fire(?:_|$)/i.test(gameId) ? freeFireIdentityFields(fields) : isMobileLegendsGame(gameId) ? mobileLegendsAccountFields(fields) : fields }, packages: regularMobileLegendsPackages(gameId, livePackages) as z.infer<typeof providerPackageSchema>[] };
  } catch {
    return (await cachedProviderGameDetails(gameId, options.includeInactive)) ?? { status: "error", game: null, packages: [] };
  }
}

/** Public browsing exposes only package labels and prices from active provider catalog entries; it never accepts a customer identity or initiates an order. */
export async function fetchPublicProviderPackagePreview(gameId: string): Promise<ProviderPackageResponse> {
  if (!isWantedProviderGameId(gameId) && !isBuiltInProviderGameId(gameId)) return { status: "unavailable", packages: [] };
  const providerGameIds = await providerGameIdVariants(gameId);
  const syncedPackages = await getPublicSyncedProviderPackages(providerGameIds);
  if (syncedPackages?.length) return { status: "ready", packages: regularMobileLegendsPackages(gameId, syncedPackages) };
  const details = await fetchProviderGameDetails(gameId);
  if (details.status === "ready") {
    const packages = await filterOrderableProviderPackages(details.packages);
    if (packages.length) return { status: "ready", packages: regularMobileLegendsPackages(gameId, packages) };
  }
  return { status: details.status, packages: [] };
}

/** Admin-only callers can additionally inspect authorized inactive package UI without supplying a customer identity. */
export async function fetchProviderPreviewPackages(gameId: string): Promise<ProviderPackageResponse> {
  if (!isWantedProviderGameId(gameId) && !isBuiltInProviderGameId(gameId)) return { status: "unavailable", packages: [] };
  const details = await fetchProviderGameDetails(gameId, { includeInactive: true });
  if (details.status === "ready" && details.packages.length) return { status: "ready", packages: regularMobileLegendsPackages(gameId, details.packages) };
  const providerGameIds = await providerGameIdVariants(gameId);
  const fallbackPackages = await getAdminSyncedProviderPackages(providerGameIds);
  if (fallbackPackages?.length) return { status: "ready", packages: regularMobileLegendsPackages(gameId, fallbackPackages) };
  return { status: details.status, packages: [] };
}

function hasProviderIdentityField(fields: Record<string, string>) {
  return Object.keys(fields).some((key) => {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    return /^(?:player|user|account|game|zone|server|uid)(?:id|number)?$/.test(normalized) || normalized === "id";
  });
}

async function providerGameIdVariants(gameId: string): Promise<string[]> {
  const normalizedGameId = gameId.trim().toLowerCase();
  const familyPattern =
    normalizedGameId === mobileLegendsFamilyGameId
      ? /^mobile_legends(?:_|$)/i
      : normalizedGameId === freeFireFamilyGameId
        ? /^free_fire(?:_|$)/i
        : normalizedGameId === pubgMobileFamilyGameId
          ? /^pubg_mobile(?:_|$)/i
          : null;
  if (!familyPattern) return [gameId];
  // Match every synced variant for this family (e.g. mobile_legends_global,
  // mobile_legends_id, mobile_legends_ph...) instead of a fixed hard-coded list,
  // so all public packages surface even when the provider adds new region IDs.
  const variants = (await getProviderAvailabilityCatalog()).games
    .filter((game) => game.id !== normalizedGameId && familyPattern.test(game.id) && !isMobileLegendsAdventureGame(game.id, game.name))
    .map((game) => game.id);
  if (variants.length) return variants;
  if (normalizedGameId === mobileLegendsFamilyGameId) return [...mobileLegendsFamilyVariantIds];
  if (normalizedGameId === freeFireFamilyGameId) return [...freeFireFamilyVariantIds];
  if (normalizedGameId === pubgMobileFamilyGameId) return [...pubgMobileFamilyVariantIds];
  return [];
}

export async function fetchProviderPackages(input: ProviderPackageRequest): Promise<ProviderPackageResponse> {
  if (!isWantedProviderGameId(input.gameId) && !isBuiltInProviderGameId(input.gameId)) return { status: "unavailable", packages: [] };
  const providerConfigured = Boolean(process.env.FZR_CARDS_API_BASE_URL) && Boolean(await resolveProviderCredential("fazercards", process.env.FZR_CARDS_API_KEY));
  if (!hasProviderIdentityField(input.fields)) {
    if (providerConfigured) {
      const details = await fetchProviderGameDetails(input.gameId);
      if (details.status === "ready" && details.packages.length) return { status: "ready", packages: regularMobileLegendsPackages(input.gameId, details.packages) };
    }
    const fallbackPackages = await getPublicSyncedProviderPackages(await providerGameIdVariants(input.gameId));
    if (fallbackPackages?.length) return { status: "ready", packages: regularMobileLegendsPackages(input.gameId, fallbackPackages) };
    return { status: "unavailable", packages: [] };
  }
  if (!providerConfigured) return { status: "unavailable", packages: [] };
  const identity = await validateProviderPlayerIdentity(input);
  if (identity.status === "unavailable") return { status: "unavailable", packages: [] };
  if (identity.status === "error") return { status: "error", packages: [] };
  if (identity.status !== "verified" && !(identity.status === "not_supported" && input.idAccuracyConfirmed)) return { status: "verification_required", packages: [] };
  const syncedPackages = await getPublicSyncedProviderPackages(await providerGameIdVariants(input.gameId));
  if (syncedPackages?.length) return { status: "ready", packages: regularMobileLegendsPackages(input.gameId, syncedPackages) };
  const details = await fetchProviderGameDetails(input.gameId);
  if (details.status === "ready") {
    const orderablePackages = await filterOrderableProviderPackages(details.packages);
    if (orderablePackages.length) return { status: "ready", packages: regularMobileLegendsPackages(input.gameId, orderablePackages) };
  }
  const fallbackPackages = await getPublicSyncedProviderPackages(await providerGameIdVariants(input.gameId));
  if (fallbackPackages?.length) return { status: "ready", packages: regularMobileLegendsPackages(input.gameId, fallbackPackages) };
  return { status: details.status === "ready" ? "unavailable" : details.status, packages: [] };
}

const fzrPlayerIdentitySchema = z.object({
  ok: z.literal(true),
  category_id: z.string().trim().min(1).max(120),
  valid: z.boolean(),
  player_name: z.preprocess((value) => (typeof value === "string" && !value.trim() ? null : value), z.string().trim().min(1).max(180).nullable()),
  player_id: z.string().trim().min(1).max(180).nullable().optional(),
  region: z.string().trim().min(1).max(120).nullable().optional(),
});

const isanPlayerNameSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const row = raw as Record<string, unknown>;
  return { ...row, name: row.name ?? row.nickname ?? row.username ?? row.player_name };
}, z.object({ success: z.literal(true), name: z.string().trim().min(1).max(180), country: z.string().trim().min(1).max(120).optional() }));
const eightBallPoolPlayerNameSchema = z.object({ status: z.literal(true), nickname: z.string().trim().min(1).max(180) });
const bridgePlayerNameSchema = z.object({ success: z.literal(true), username: z.string().trim().min(1).max(180) });

function mobileLegendsIdentityFields(fields: Record<string, string>) {
  const playerId = fields.player_id ?? fields.user_id ?? fields.id ?? "";
  const serverId = fields.server_id ?? fields.zone_id ?? fields.server ?? "";
  if (!/^\d{4,20}$/.test(playerId.trim()) || !/^\d{1,12}$/.test(serverId.trim())) return null;
  return { playerId: playerId.trim(), serverId: serverId.trim() };
}

function isMobileLegendsGame(gameId: string) {
  return /^mobile[_-]legends(?:[_-]|$)/i.test(gameId);
}

function isHonorOfKingsGame(gameId: string) {
  return /^honor_of_kings(?:_|$)/i.test(gameId);
}

function isPubgMobileGame(gameId: string) {
  return /^pubg_mobile(?:_|$)/i.test(gameId);
}

function isBloodStrikeGame(gameId: string) {
  return /^blood_strike(?:_|$)/i.test(gameId);
}

function isMagicChessGame(gameId: string) {
  return /^magic_chess(?:_|$)/i.test(gameId);
}

function fzrValidateIdCategory(gameId: string) {
  if (isFreeFireGame(gameId)) return "free_fire";
  return null;
}

async function validateWithFzrPlayerIdentity(input: ProviderPackageRequest, playerId: string): Promise<ProviderPlayerIdentityResponse | null> {
  const categoryId = fzrValidateIdCategory(input.gameId);
  if (!categoryId) return null;
  try {
    const payload = await fzrRequest("/api/v2/topups/validate-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId, fields: { player_id: playerId, user_id: playerId } }),
    });
    if (!payload) return emptyIdentity("unavailable");
    const parsed = fzrPlayerIdentitySchema.safeParse(payload);
    if (!parsed.success) return emptyIdentity("unavailable");
    if (!parsed.data.valid) return emptyIdentity("invalid");
    return {
      status: "verified",
      playerName: parsed.data.player_name ?? `UID ${playerId}`,
      playerId,
      region: parsed.data.region ?? "Global",
    };
  } catch (error) {
    if (error instanceof FzrRequestError && (error.status === 400 || error.status === 404 || error.status === 422)) return emptyIdentity("invalid");
    return emptyIdentity("unavailable");
  }
}

type OwnerApprovedFreeIdentityRequest = { kind: "isan" | "eight_ball_pool"; url: string; playerId: string } | { kind: "invalid" };

function numericAccountId(raw: string, minDigits = 4, maxDigits = 20) {
  const compact = raw.replace(/\D/g, "");
  if (compact.length >= minDigits && compact.length <= maxDigits) return compact;
  const match = raw.match(new RegExp(`\\d{${minDigits},${maxDigits}}`));
  return match?.[0] ?? "";
}

function readNumericAccountId(fields: Record<string, string>, keys: string[], minDigits = 4, maxDigits = 20) {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value !== "string") continue;
    const id = numericAccountId(value, minDigits, maxDigits);
    if (id) return id;
  }
  for (const [key, value] of Object.entries(fields)) {
    if (!/(?:player|user|account|uid|\bid\b|server|zone)/i.test(key)) continue;
    if (keys.some((item) => /(?:server|zone)/i.test(item)) !== /(?:server|zone)/i.test(key)) continue;
    const id = numericAccountId(value, minDigits, maxDigits);
    if (id) return id;
  }
  return "";
}

function ownerApprovedFreeIdentityRequest(input: ProviderPackageRequest): OwnerApprovedFreeIdentityRequest | null {
  const gameId = input.gameId.trim().toLowerCase();
  const game = isFreeFireGame(gameId) ? "ff" as const
    : isMobileLegendsGame(gameId) ? "ml" as const
      : /^magic_chess(?:_|$)/.test(gameId) ? "mcgg" as const
        : /^call_of_duty(?:_|$)/.test(gameId) ? "cod" as const
          : /^arena_of_valor(?:_|$)/.test(gameId) ? "aov" as const
            : /^8_ball_pool(?:_|$)/.test(gameId) ? "eight_ball_pool" as const
              : null;
  if (!game) return null;
  const playerId = readNumericAccountId(input.fields, ["player_id", "user_id", "account_id", "id", "uid", "userid"]);
  const serverId = readNumericAccountId(input.fields, ["server_id", "zone_id", "server"], 1, 12);
  if (!playerId) return { kind: "invalid" };
  const isanUrl = (game: "ff" | "ml" | "mcgg" | "cod" | "aov", requiresServer = false) => {
    if (requiresServer && !serverId) return { kind: "invalid" } as const;
    const query = new URLSearchParams({ id: playerId });
    if (requiresServer) query.set("server", serverId);
    return { kind: "isan" as const, url: `https://api.isan.eu.org/nickname/${game}?${query.toString()}`, playerId };
  };
  if (game === "ff") return isanUrl("ff");
  if (game === "ml") return isanUrl("ml", true);
  if (game === "mcgg") return isanUrl("mcgg", true);
  if (game === "cod") return isanUrl("cod");
  if (game === "aov") return isanUrl("aov");
  if (game === "eight_ball_pool") {
    const query = new URLSearchParams({ type_name: "eight_ball_pool", userId: playerId, zoneId: "" });
    return { kind: "eight_ball_pool", url: `https://api-cek-id-game-ten.vercel.app/api/check-id-game?${query.toString()}`, playerId };
  }
  return null;
}

async function validateWithOwnerApprovedFreeApi(input: ProviderPackageRequest): Promise<ProviderPlayerIdentityResponse | null> {
  const request = ownerApprovedFreeIdentityRequest(input);
  if (!request) return null;
  if (request.kind === "invalid") return emptyIdentity("invalid");
  try {
    const response = await fetch(request.url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; ZURS.me Check-ID)" },
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await response.json().catch(() => null);
    if (request.kind === "isan") {
      const success = isanPlayerNameSchema.safeParse(payload);
      if (response.ok && success.success) return { status: "verified", playerName: success.data.name, playerId: request.playerId, region: success.data.country ?? "Global" };
      if (response.ok && payload && typeof payload === "object" && "success" in payload && (payload as { success?: unknown }).success === false) return emptyIdentity("invalid");
      if (response.ok && payload && typeof payload === "object" && "success" in payload && (payload as { success?: unknown }).success === true) {
        // Isan often confirms KH Free Fire IDs with success:true but no nickname.
        if (isFreeFireGame(input.gameId)) {
          const providerIdentity = await validateWithFzrPlayerIdentity(input, request.playerId);
          if (providerIdentity) return providerIdentity;
        }
        return emptyIdentity("invalid");
      }
    } else {
      const success = eightBallPoolPlayerNameSchema.safeParse(payload);
      if (response.ok && success.success) return { status: "verified", playerName: success.data.nickname, playerId: request.playerId, region: "Global" };
      if (response.ok && payload && typeof payload === "object" && "status" in payload && (payload as { status?: unknown }).status === false) return emptyIdentity("invalid");
      if (response.ok && payload && typeof payload === "object" && "status" in payload && (payload as { status?: unknown }).status === true) return emptyIdentity("invalid");
    }
  } catch { /* A public free API is optional; the existing ID-accuracy confirmation handles unsupported checks. */ }
  return emptyIdentity("unavailable");
}

function authorizedPlayerBridgeEndpoint() {
  const rawUrl = process.env.HEROKU_BRIDGE_URL?.trim();
  const bridgeKey = process.env.HEROKU_BRIDGE_API_KEY?.trim();
  if (!rawUrl || !bridgeKey) return null;
  try {
    const baseUrl = new URL(rawUrl);
    if (baseUrl.protocol !== "https:") return null;
    return { url: new URL("/api/check-player", baseUrl).toString(), bridgeKey };
  } catch { return null; }
}

function authorizedBridgeGame(input: ProviderPackageRequest) {
  const gameId = input.gameId.trim().toLowerCase();
  if (isMobileLegendsGame(gameId)) return { bridgeGame: "mobile-legends", requiresServer: true } as const;
  if (isHonorOfKingsGame(gameId)) return { bridgeGame: "honor-of-kings", requiresServer: false } as const;
  if (isPubgMobileGame(gameId)) return { bridgeGame: "pubg-mobile", requiresServer: false } as const;
  if (isBloodStrikeGame(gameId)) return { bridgeGame: "blood-strike", requiresServer: false } as const;
  if (isMagicChessGame(gameId)) return { bridgeGame: "magic-chess", requiresServer: true } as const;
  return null;
}

function bridgeIdentityFields(fields: Record<string, string>, requiresServer: boolean) {
  const playerId = (fields.player_id ?? fields.user_id ?? fields.account_id ?? fields.id ?? "").trim();
  const serverId = (fields.server_id ?? fields.zone_id ?? fields.server ?? "").trim();
  if (!/^\d{4,20}$/.test(playerId)) return null;
  if (requiresServer && !/^\d{1,12}$/.test(serverId)) return null;
  return { playerId, serverId: serverId || null };
}

function logAuthorizedBridgeOutcome(outcome: "unconfigured" | "timeout" | "request_failed" | "unavailable_response", responseStatus?: number) {
  const status = typeof responseStatus === "number" ? ` status=${responseStatus}` : "";
  console.warn(`[Check-ID] authorized bridge ${outcome}${status}`);
}

async function validateWithAuthorizedPlayerBridge(input: ProviderPackageRequest): Promise<ProviderPlayerIdentityResponse | null> {
  const game = authorizedBridgeGame(input);
  if (!game) return null;
  const identityFields = bridgeIdentityFields(input.fields, game.requiresServer);
  const bridge = authorizedPlayerBridgeEndpoint();
  if (!identityFields) return emptyIdentity("invalid");
  if (!bridge) {
    logAuthorizedBridgeOutcome("unconfigured");
    return null;
  }
  try {
    const body = { userId: identityFields.playerId, game: game.bridgeGame, ...(identityFields.serverId ? { zoneId: identityFields.serverId } : {}) };
    const response = await fetch(bridge.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bridge-key": bridge.bridgeKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    const payload = await response.json().catch(() => null);
    const success = bridgePlayerNameSchema.safeParse(payload);
    if (response.ok && success.success) return { status: "verified", playerName: success.data.username, playerId: identityFields.playerId, region: "Global" };
    if (response.status === 400 || response.status === 404 || (payload && typeof payload === "object" && "success" in payload && (payload as { success?: unknown }).success === false)) return emptyIdentity("invalid");
    logAuthorizedBridgeOutcome("unavailable_response", response.status);
  } catch (error) {
    logAuthorizedBridgeOutcome(error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "request_failed");
  }
  return emptyIdentity("unavailable");
}

function emptyIdentity(status: Extract<ProviderPlayerIdentityResponse, { status: "invalid" | "not_supported" | "unavailable" | "error" }> ["status"]): ProviderPlayerIdentityResponse {
  return { status, playerName: null, playerId: null, region: null };
}

/**
 * Round 9: Telegram handles are verified against the PUBLIC t.me preview page,
 * which publishes only a display name and a profile picture. There is no upstream
 * ID-check API for Stars or Premium, so this is the only thing standing between a
 * mistyped handle and a paid delivery to a stranger.
 */
async function validateTelegramHandleIdentity(input: ProviderPackageRequest): Promise<ProviderPlayerIdentityResponse> {
  const raw = Object.entries(input.fields).find(([key]) => /user[\s_-]*name|telegram|handle/i.test(key))?.[1] ?? "";
  if (!raw.trim()) return emptyIdentity("invalid");
  const { lookupTelegramProfile } = await import("./telegramIdentity");
  const result = await lookupTelegramProfile(raw);
  if (result.status === "unavailable") return emptyIdentity("unavailable");
  if (result.status === "invalid") return emptyIdentity("invalid");
  return { status: "verified", playerName: result.profile.displayName, playerId: `@${result.profile.handle}`, region: "Telegram", photoUrl: result.profile.photoUrl };
}

const robloxUsernameLookupSchema = z.object({
  data: z.array(z.object({
    requestedUsername: z.string().optional(),
    id: z.number(),
    name: z.string().min(1),
    displayName: z.string().min(1).optional(),
  })).optional(),
});

export function readRobloxUsername(fields: Record<string, string>) {
  const raw = (fields.username ?? fields.user_name ?? fields.player_id ?? "").trim().replace(/^@+/, "");
  return /^[A-Za-z0-9_]{3,20}$/.test(raw) ? raw : null;
}

async function validateRobloxUsernameIdentity(input: ProviderPackageRequest): Promise<ProviderPlayerIdentityResponse> {
  const username = readRobloxUsername(input.fields);
  if (!username) return emptyIdentity("invalid");
  try {
    const response = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "ZURS.me Check-ID" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => null);
    const parsed = robloxUsernameLookupSchema.safeParse(payload);
    const hit = parsed.success
      ? parsed.data.data?.find((row) => row.name.toLowerCase() === username.toLowerCase() || row.requestedUsername?.toLowerCase() === username.toLowerCase())
      : undefined;
    if (hit) return { status: "verified", playerName: hit.displayName || hit.name, playerId: hit.name, region: "Roblox" };
    if (response.ok) return emptyIdentity("invalid");
  } catch {
    /* Public lookup is best-effort. */
  }
  return emptyIdentity("not_supported");
}

export async function validateProviderPlayerIdentity(input: ProviderPackageRequest): Promise<ProviderPlayerIdentityResponse> {
  if (isTelegramServiceGameId(input.gameId)) return await validateTelegramHandleIdentity(input);
  if (/roblox|robux/i.test(input.gameId)) return await validateRobloxUsernameIdentity(input);
  const freeApiResult = await validateWithOwnerApprovedFreeApi(input);
  if (freeApiResult && freeApiResult.status !== "unavailable") return freeApiResult;
  if (isFreeFireGame(input.gameId)) {
    const playerId = readNumericAccountId(input.fields, ["player_id", "user_id", "account_id", "id", "uid", "userid"]);
    const providerIdentity = playerId ? await validateWithFzrPlayerIdentity(input, playerId) : emptyIdentity("invalid");
    if (providerIdentity && providerIdentity.status !== "unavailable") return providerIdentity;
    const bridgeResult = await validateWithAuthorizedPlayerBridge(input);
    if (bridgeResult) return bridgeResult;
    if (providerIdentity) return providerIdentity;
  }
  const bridgeResult = await validateWithAuthorizedPlayerBridge(input);
  if (bridgeResult) return bridgeResult;
  if (freeApiResult) return freeApiResult;
  return authorizedBridgeGame(input) ? emptyIdentity("unavailable") : emptyIdentity("not_supported");
}

export async function fetchSmmProviderServices(options: { includeHidden?: boolean } = {}): Promise<SmmProviderCatalogResponse> {
  try {
    const response = await smmGlobRequest("services");
    if (!response) return { status: "unavailable", services: [] };
    const availability = options.includeHidden ? null : await providerAvailability();
    const payload = z.array(z.unknown()).max(20_000).safeParse(response);
    if (!payload.success) return { status: "error", services: [] };
    const hidden = new Set(availability?.hiddenSmmServiceIds ?? []);
    const services = balanceSocialProviderServices(payload.data.map((item) => smmGlobServiceSchema.safeParse(item)).filter((item): item is z.ZodSafeParseSuccess<z.infer<typeof smmGlobServiceSchema>> => item.success).map((item) => item.data).filter((service) => /(facebook|instagram|tiktok|youtube|telegram)/i.test(`${service.category} ${service.name}`) && !isThailandProviderProduct(`${service.category} ${service.name}`) && !hidden.has(service.service)));
    return { status: "ready", services: services.map((service) => ({ providerServiceId: service.service, name: service.name, category: service.category, serviceType: service.type, rateUsdPerThousand: Number(service.rate).toFixed(4), min: service.min, max: service.max, refill: Boolean(service.refill), cancel: Boolean(service.cancel), dripfeed: Boolean(service.dripfeed) })) };
  } catch { return { status: "error", services: [] }; }
}

async function cachedProviderAvailabilityGamesDuringOutage(availability: Awaited<ReturnType<typeof providerAvailability>>) {
  try {
    const appwriteGames = cachedProviderAvailabilityGames(await getAppwriteProviderCatalog(), availability);
    if (appwriteGames.length) return appwriteGames;
  } catch { /* Fall through to the primary SQL catalog. */ }
  try {
    const { getGameCatalog } = await import("./db");
    const activeIds = publicProviderGameIds(availability);
    const hiddenIds = new Set(availability.hiddenGameIds);
    const catalog = await getGameCatalog();
    return catalog.flatMap((game) => {
      const providerId = game.packages.map((item) => String(item.providerSource ?? "").match(/^fzr_cards:([^:]+):/)?.[1]).find(Boolean);
      const name = game.titleEn?.trim() || game.titleKh?.trim();
      if (!providerId || !name || !isWantedProviderGameId(providerId) || isThailandProviderProduct(`${providerId} ${name}`)) return [];
      return [{ id: providerId, name, isActive: activeIds.has(providerId) && !hiddenIds.has(providerId) }];
    });
  } catch { return []; }
}

export async function getProviderAvailabilityCatalog(): Promise<ProviderAvailabilityCatalog> {
  const [catalog, smmResponse, availability] = await Promise.all([fetchFzrTopupCatalog(), fetchSmmProviderServices({ includeHidden: true }), providerAvailability()]);
  const activeGames = catalog.status === "ready" ? publicProviderGameIds(availability) : new Set<string>();
  const hiddenSmm = new Set(availability.hiddenSmmServiceIds);
  const fallbackGames = catalog.status === "ready" ? null : await cachedProviderAvailabilityGamesDuringOutage(availability);
  // Telegram is not in the /topups category list, so it is appended explicitly or
  // the owner would never see a row to switch it on or off.
  const telegramRows = (await fetchBuiltInProviderGames()).map((game) => ({ id: game.providerGameId, name: game.name, isActive: !availability.hiddenGameIds.includes(game.providerGameId) }));
  return {
    games: [
      ...telegramRows,
      ...(catalog.status === "ready"
        ? asProviderGames(catalog.items).map((game) => ({ id: game.id, name: game.name, isActive: activeGames.has(game.id) && !availability.hiddenGameIds.includes(game.id) }))
        : fallbackGames ?? []).filter((game) => !isBuiltInProviderGameId(game.id)),
    ],
    smm: smmResponse.status === "ready" ? smmResponse.services.map((service) => ({ id: service.providerServiceId, name: service.name, category: service.category, isActive: !hiddenSmm.has(service.providerServiceId) })) : [],
  };
}

export async function setProviderAvailability(input: { kind: "game" | "smm"; providerId: string; isActive: boolean; updatedByUserId?: number }) {
  const persist = async (payload: { kind: "game" | "smm"; providerId: string; isActive: boolean; legacyActiveGameIds?: string[] }) => {
    const { setPrimaryProviderAvailability } = await import("./db");
    const primary = await setPrimaryProviderAvailability({ ...payload, updatedByUserId: input.updatedByUserId });
    if (primary) return primary;
    if (!isAppwriteStoreConfigured()) throw new Error("Provider availability control is not configured");
    return updateAppwriteProviderAvailability(payload);
  };
  if (input.kind !== "game") {
    const next = await persist(input);
    providerAvailabilitySnapshot = next;
    providerAvailabilityRetryAt = Date.now() + 60_000;
    return next;
  }
  const [catalog, availability] = await Promise.all([fetchFzrTopupCatalog(), providerAvailability()]);
  const validGameIds = catalog.status === "ready"
    ? new Set(asProviderGames(catalog.items).map((game) => game.id))
    : new Set((await cachedProviderAvailabilityGamesDuringOutage(availability)).map((game) => game.id));
  // Same reason as above: the Telegram ids are valid targets even though they can
  // never appear in the /topups category list this check is built from.
  (await fetchBuiltInProviderGames()).forEach((game) => validGameIds.add(game.providerGameId));
  if (!validGameIds.size) throw new Error("No synchronized FZR Cards catalog is available for this change");
  if (!validGameIds.has(input.providerId)) throw new Error("Selected game is not available from the synchronized FZR Cards catalog");
  const legacyActiveGameIds = availability.activeGameIds ?? initialApprovedPublicGameIds.filter((id) => !availability.hiddenGameIds.includes(id));
  const next = await persist({ ...input, legacyActiveGameIds });
  // Availability is read by both the admin inventory and the public storefront.
  // Update the bounded cache immediately after a confirmed write so neither view
  // rolls back to the pre-save state while waiting for the 60-second read cache.
  providerAvailabilitySnapshot = next;
  providerAvailabilityRetryAt = Date.now() + 60_000;
  return next;
}

const smmGlobOrderSchema = z.object({ order: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1).max(120)) });

export async function submitSmmProviderOrder(input: { providerServiceId: string; target: string; quantity: number }): Promise<{ status: "submitted"; providerOrderId: string } | { status: "unavailable" } | { status: "error" }> {
  try {
    if (!/^\d{1,80}$/.test(input.providerServiceId) || !input.target.trim() || !Number.isInteger(input.quantity) || input.quantity < 1) return { status: "error" };
    const response = await smmGlobRequest("add", { service: input.providerServiceId, link: input.target.trim(), quantity: String(input.quantity) });
    if (!response) return { status: "unavailable" };
    const payload = smmGlobOrderSchema.safeParse(response);
    if (!payload.success) return { status: "error" };
    return { status: "submitted", providerOrderId: payload.data.order };
  } catch { return { status: "error" }; }
}

// ---------------------------------------------------------------------------
// FZR Cards top-up ORDER submission (delivery).
//
// The catalog/offers endpoints only READ inventory. Placing a real top-up uses
// POST /api/v2/topups/order. Without this call a PAID order is never delivered
// to the player's game account (the exact bug: money taken, no diamonds).
// The order endpoint accepts category_id, offer_id, and a nested fields object
// matching the dynamic field keys returned by the offers endpoint. The response
// is parsed tolerantly so the documented order.id (and compatible envelopes)
// still yields a provider order id.
// ---------------------------------------------------------------------------
function coerceFzrOrderPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const record: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  for (const key of ["data", "result", "order", "payload", "topup"]) {
    const nested = record[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) Object.assign(record, nested as Record<string, unknown>);
  }
  const orderId = [record.order_id, record.orderId, record.id, record.reference, record.ref, record.txn_id, record.transaction_id, record.trx_id, record.order].find((value) => typeof value === "string" || typeof value === "number");
  if (orderId !== undefined) record.order_id = orderId;
  const status = [record.status, record.state].find((value) => typeof value === "string" || typeof value === "number");
  if (status !== undefined) record.status = status;
  return record;
}

const fzrTopupOrderSchema = z.preprocess(coerceFzrOrderPayload, z.object({
  ok: z.unknown().optional(),
  order_id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1).max(180)),
  status: z.union([z.string(), z.number()]).transform(String).optional(),
}));

export async function submitFzrTopupOrder(input: { categoryId: string; offerId: string; playerId: string; serverId: string | null; password?: string | null; idempotencyKey?: string | null; existingOrderId?: string | null }): Promise<{ status: "submitted"; providerOrderId: string } | { status: "unavailable" } | { status: "error" }> {
  try {
    if (!input.categoryId.trim() || !input.offerId.trim() || !input.playerId.trim()) return { status: "error" };
    // Telegram Stars / Premium are NOT sold through /topups/order. FazerCards
    // fulfils them from a dedicated endpoint family keyed by @username plus a
    // quantity (Stars) or a month count (Premium). Posting them to /topups/order
    // is rejected, which would mean a PAID order is never delivered.
    const builtInCategoryId = input.categoryId.trim().toLowerCase();
    if (isTelegramServiceGameId(builtInCategoryId)) return await submitTelegramProviderOrder({ categoryId: builtInCategoryId, offerId: input.offerId.trim(), username: input.playerId });
    // Robux is fulfilled by an operator through /manual-services/order + chat, so
    // it must NOT be posted to /topups/order. The operator logs in with username
    // and password from the storefront form, delivered via the order chat thread.
    if (builtInCategoryId === robloxRobuxGameId || /^manual_/.test(input.offerId.trim()) || /roblox|robux/i.test(builtInCategoryId)) {
      return await submitRobloxProviderOrder({
        categoryId: builtInCategoryId,
        offerId: input.offerId.trim(),
        username: input.playerId,
        password: input.password ?? "",
        idempotencyKey: input.idempotencyKey,
        existingOrderId: input.existingOrderId,
      });
    }
    const fields: Record<string, string> = { player_id: input.playerId.trim() };
    if (input.serverId && input.serverId.trim()) fields.server_id = input.serverId.trim();
    const body: Record<string, unknown> = { category_id: input.categoryId.trim(), offer_id: input.offerId.trim(), fields };
    const response = await fzrRequest("/api/v2/topups/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response) return { status: "unavailable" };
    const parsed = fzrTopupOrderSchema.safeParse(response);
    if (!parsed.success) {
      console.warn(`[fzr-order] ${input.categoryId}/${input.offerId}: unexpected response keys=${Object.keys((response ?? {}) as Record<string, unknown>).join(",")} raw=${JSON.stringify(response).slice(0, 400)}`);
      return { status: "error" };
    }
    return { status: "submitted", providerOrderId: parsed.data.order_id };
  } catch (error) {
    const status = error instanceof FzrRequestError ? error.status : 0;
    console.warn(`[fzr-order] ${input.categoryId}/${input.offerId}: request failed status=${status} ${(error as Error)?.message ?? String(error)}`);
    // Deterministic 4xx (except 429) => surface as error so the order is flagged
    // for manual review; everything else is a transient outage the owner retries.
    return status && status !== 429 && status < 500 ? { status: "error" } : { status: "unavailable" };
  }
}

/**
 * Telegram fulfilment. The offer id carries the quantity (stars_100) or the plan
 * length (premium_12), so a paid order can be replayed to the provider without any
 * extra bookkeeping.
 */
async function submitTelegramProviderOrder(input: { categoryId: string; offerId: string; username: string }): Promise<{ status: "submitted"; providerOrderId: string } | { status: "unavailable" } | { status: "error" }> {
  const username = normalizeTelegramUsername(input.username);
  // Telegram handles are 5-32 characters. Reject before the provider call so a bad
  // handle is flagged for manual review instead of silently failing after payment.
  if (username.length < 5 || username.length > 32) return { status: "error" };
  const starsMatch = /^stars_(\d{1,6})$/.exec(input.offerId);
  const premiumMatch = /^premium_(\d{1,2})$/.exec(input.offerId);
  const path = starsMatch ? "/api/v2/telegram/stars/buy" : "/api/v2/telegram/premium/buy";
  const body = starsMatch
    ? { telegram_username: `@${username}`, quantity: Number(starsMatch[1]) }
    : premiumMatch
      ? { telegram_username: `@${username}`, months: Number(premiumMatch[1]) }
      : null;
  if (!body) return { status: "error" };
  try {
    const response = await fzrRequest(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response) return { status: "unavailable" };
    const parsed = fzrTopupOrderSchema.safeParse(response);
    if (!parsed.success) {
      console.warn(`[telegram-order] ${input.categoryId}/${input.offerId}: unexpected response keys=${Object.keys((response ?? {}) as Record<string, unknown>).join(",")} raw=${JSON.stringify(response).slice(0, 400)}`);
      return { status: "error" };
    }
    return { status: "submitted", providerOrderId: parsed.data.order_id };
  } catch (error) {
    const status = error instanceof FzrRequestError ? error.status : 0;
    console.warn(`[telegram-order] ${input.categoryId}/${input.offerId}: request failed status=${status} ${(error as Error)?.message ?? String(error)}`);
    return status && status !== 429 && status < 500 ? { status: "error" } : { status: "unavailable" };
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const output: R[] = [];
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

export async function fetchFzrProviderSyncSnapshot(): Promise<FzrProviderSyncSnapshot> {
  try {
    // Use the SAME paginated catalog the availability list uses, so the sync covers every
    // game across all pages, not just the first /api/v2/topups page.
    const catalog = await fetchFzrTopupCatalog();
    if (catalog.status !== "ready") {
      // Telegram does not depend on the /topups catalog, so it must still import
      // when that catalog is unavailable.
      const telegramOnly = await fetchBuiltInProviderGames();
      return telegramOnly.length ? { status: "ready", games: telegramOnly } : { status: catalog.status, games: [] };
    }
    // Owner curation: only sync the wanted game families. This focuses the store on the products
    // we actually sell AND slashes offer requests from ~600 to a few dozen, which removes the
    // rate-limiting that was silently emptying the catalog.
    const items = catalog.items.filter((item) => {
      const text = `${item.category_id} ${item.name} ${item.note ?? ""}`;
      return isWantedProviderProduct(text) && !isThailandProviderProduct(text);
    });
    let skipped = 0;
    const details = await mapWithConcurrency(items, 6, async (item) => {
      // Per-item isolation: one game's failed/rate-limited/timeout offer request (or an
      // unparseable response) must skip ONLY that game and never abort the whole sync.
      try {
        const offerResponse = await fzrRequestWithRetry(`/api/v2/topups/offers?category_id=${encodeURIComponent(item.category_id)}&include_ui=1`);
        if (!offerResponse) { console.warn(`[fzr-sync] ${item.category_id}: empty HTTP response`); skipped += 1; return null; }
        const offers = fzrOffersSchema.safeParse(offerResponse);
        if (!offers.success) {
          // Diagnostic: log the raw shape so ID-verified games that ship an unexpected structure
          // can be mapped precisely (visible in Vercel function logs during a sync run).
          console.warn(`[fzr-sync] ${item.category_id}: offers parse failed keys=${Object.keys((offerResponse ?? {}) as Record<string, unknown>).join(",")} raw=${JSON.stringify(offerResponse).slice(0, 500)}`);
          skipped += 1;
          return null;
        }
        const mapped = offers.data.offers.filter((offer) => Boolean(offer.offer_id)).map((offer) => ({ providerOfferId: offer.offer_id!, name: offer.name, priceUsd: Number(offer.price_usd).toFixed(2) }));
        if (!mapped.length) {
          console.warn(`[fzr-sync] ${item.category_id}: 0 usable offers keys=${Object.keys((offerResponse ?? {}) as Record<string, unknown>).join(",")} raw=${JSON.stringify(offerResponse).slice(0, 500)}`);
          skipped += 1;
          return null;
        }
        // Key the imported game by the REQUESTED category id so a normalized/echoed
        // category_id in the response never drops the game.
        return { providerGameId: item.category_id, name: offers.data.name || item.name, logoUrl: offers.data.imageurl, requiredFields: providerFields(offers.data.fields), offers: mapped };
      } catch (error) {
        console.warn(`[fzr-sync] ${item.category_id}: offer request threw ${(error as Error)?.message ?? String(error)}`);
        skipped += 1;
        return null;
      }
    });
    const games = details.filter((game): game is NonNullable<typeof game> => game !== null);
    // Importing Telegram through the normal sync is what gives it real catalog rows,
    // which is what makes admin price + margin, KHQR checkout and order fulfilment work.
    const telegramGames = await fetchBuiltInProviderGames();
    console.info(`[fzr-sync] wanted=${items.length} imported=${games.length} skipped=${skipped} telegram=${telegramGames.length}`);
    return { status: "ready", games: [...telegramGames, ...games] };
  } catch { return { status: "error", games: [] }; }
}
