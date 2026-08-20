import { boolean, decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  displayName: varchar("displayName", { length: 140 }),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const gameProducts = mysqlTable("game_products", {
  id: varchar("id", { length: 64 }).primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  titleKh: varchar("titleKh", { length: 160 }).notNull(),
  titleEn: varchar("titleEn", { length: 160 }).notNull(),
  currencyLabel: varchar("currencyLabel", { length: 48 }).notNull(),
  iconLabel: varchar("iconLabel", { length: 12 }).notNull(),
  accent: varchar("accent", { length: 32 }).notNull(),
  requiresZone: boolean("requiresZone").default(true).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const gamePackages = mysqlTable("game_packages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  productId: varchar("productId", { length: 64 }).notNull(),
  amountLabel: varchar("amountLabel", { length: 64 }).notNull(),
  priceUsd: decimal("priceUsd", { precision: 10, scale: 2 }).notNull(),
  featured: boolean("featured").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("game_packages_product_idx").on(table.productId)]);

export const smmServices = mysqlTable("smm_services", {
  id: varchar("id", { length: 64 }).primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  platform: varchar("platform", { length: 48 }).notNull(),
  serviceType: varchar("serviceType", { length: 48 }).notNull(),
  titleKh: varchar("titleKh", { length: 160 }).notNull(),
  titleEn: varchar("titleEn", { length: 160 }).notNull(),
  descriptionKh: text("descriptionKh").notNull(),
  iconLabel: varchar("iconLabel", { length: 12 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const smmTiers = mysqlTable("smm_tiers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  serviceId: varchar("serviceId", { length: 64 }).notNull(),
  quantity: int("quantity").notNull(),
  priceUsd: decimal("priceUsd", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("smm_tiers_service_idx").on(table.serviceId)]);

export const orders = mysqlTable("orders", {
  id: varchar("id", { length: 64 }).primaryKey(),
  orderNumber: varchar("orderNumber", { length: 48 }).notNull().unique(),
  userId: int("userId").notNull(),
  orderType: mysqlEnum("orderType", ["topup", "smm"]).notNull(),
  status: mysqlEnum("status", ["pending", "awaiting_payment", "paid", "delivered", "failed", "expired", "refunded"]).default("pending").notNull(),
  currency: varchar("currency", { length: 8 }).default("USD").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  productName: varchar("productName", { length: 180 }).notNull(),
  details: json("details").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("orders_user_idx").on(table.userId), index("orders_status_idx").on(table.status)]);

export const savedPlayerIds = mysqlTable("saved_player_ids", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  gameProductId: varchar("gameProductId", { length: 64 }).notNull(),
  playerId: varchar("playerId", { length: 128 }).notNull(),
  zoneId: varchar("zoneId", { length: 128 }),
  label: varchar("label", { length: 80 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("saved_player_ids_user_idx").on(table.userId)]);

export const marketplaceListings = mysqlTable("marketplace_listings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sellerUserId: int("sellerUserId").notNull(),
  listingType: mysqlEnum("listingType", ["sale", "swap", "wanted"]).notNull(),
  status: mysqlEnum("status", ["draft", "pending", "approved", "rejected", "closed"]).default("pending").notNull(),
  game: varchar("game", { length: 120 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  rankLevel: varchar("rankLevel", { length: 180 }).notNull(),
  priceUsd: decimal("priceUsd", { precision: 10, scale: 2 }),
  description: text("description").notNull(),
  contactMethod: varchar("contactMethod", { length: 180 }).notNull(),
  screenshots: json("screenshots").notNull(),
  reviewNote: text("reviewNote"),
  reviewedByUserId: int("reviewedByUserId"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("marketplace_status_idx").on(table.status), index("marketplace_game_idx").on(table.game), index("marketplace_seller_idx").on(table.sellerUserId)]);

export const marketplaceVerifications = mysqlTable("marketplace_verifications", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  providerSessionId: varchar("providerSessionId", { length: 180 }),
  documentType: varchar("documentType", { length: 80 }),
  locationCountry: varchar("locationCountry", { length: 2 }),
  verificationNote: text("verificationNote"),
  reviewedByUserId: int("reviewedByUserId"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("marketplace_verification_user_idx").on(table.userId), index("marketplace_verification_status_idx").on(table.status), uniqueIndex("marketplace_provider_session_unique").on(table.providerSessionId)]);

export const marketplaceContacts = mysqlTable("marketplace_contacts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  listingId: varchar("listingId", { length: 64 }).notNull(),
  initiatorUserId: int("initiatorUserId").notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["requested", "accepted", "declined", "closed"]).default("requested").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("marketplace_contacts_listing_idx").on(table.listingId), index("marketplace_contacts_user_idx").on(table.initiatorUserId)]);

export const paymentTransactions = mysqlTable("payment_transactions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  orderId: varchar("orderId", { length: 64 }).notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  providerTransactionId: varchar("providerTransactionId", { length: 160 }),
  providerRequestId: varchar("providerRequestId", { length: 160 }),
  status: mysqlEnum("status", ["pending", "paid", "failed", "expired", "refunded"]).default("pending").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD").notNull(),
  checkoutUrl: text("checkoutUrl"),
  callbackPayload: json("callbackPayload"),
  expiresAt: timestamp("expiresAt"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("payment_transactions_order_idx").on(table.orderId), uniqueIndex("payment_provider_transaction_unique").on(table.provider, table.providerTransactionId)]);

export const siteContent = mysqlTable("site_content", {
  id: varchar("id", { length: 64 }).primaryKey(),
  contentKey: varchar("contentKey", { length: 100 }).notNull().unique(),
  titleKh: varchar("titleKh", { length: 240 }),
  bodyKh: text("bodyKh"),
  mediaUrl: varchar("mediaUrl", { length: 2048 }),
  isActive: boolean("isActive").default(true).notNull(),
  updatedByUserId: int("updatedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
