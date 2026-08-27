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

export const customerWallets = mysqlTable("customer_wallets", {
  userId: int("userId").primaryKey(),
  balanceKhr: decimal("balanceKhr", { precision: 14, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const walletTopups = mysqlTable("wallet_topups", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  referenceCode: varchar("referenceCode", { length: 48 }).notNull().unique(),
  provider: varchar("provider", { length: 64 }).default("bakong_khqr").notNull(),
  providerRequestId: varchar("providerRequestId", { length: 160 }).notNull().unique(),
  providerTransactionId: varchar("providerTransactionId", { length: 160 }),
  status: mysqlEnum("status", ["pending", "paid", "expired", "failed"]).default("pending").notNull(),
  amountKhr: decimal("amountKhr", { precision: 14, scale: 2 }).notNull(),
  paymentPayload: json("paymentPayload").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  paidAt: timestamp("paidAt"),
  creditedAt: timestamp("creditedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("wallet_topups_user_idx").on(table.userId), index("wallet_topups_status_idx").on(table.status)]);

export const adminRoleAudits = mysqlTable("admin_role_audits", {
  id: varchar("id", { length: 64 }).primaryKey(),
  actorUserId: int("actorUserId").notNull(),
  targetUserId: int("targetUserId").notNull(),
  previousRole: mysqlEnum("previousRole", ["user", "admin"]).notNull(),
  nextRole: mysqlEnum("nextRole", ["user", "admin"]).notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("admin_role_audits_target_idx").on(table.targetUserId), index("admin_role_audits_actor_idx").on(table.actorUserId)]);

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
  providerAuthorized: boolean("providerAuthorized").default(false).notNull(),
  providerSource: varchar("providerSource", { length: 160 }),
  basePriceUsd: decimal("basePriceUsd", { precision: 10, scale: 2 }).default("0.00").notNull(),
  profitMarginPercent: decimal("profitMarginPercent", { precision: 6, scale: 2 }).default("0.00").notNull(),
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
  providerAuthorized: boolean("providerAuthorized").default(false).notNull(),
  providerSource: varchar("providerSource", { length: 160 }),
  basePriceUsd: decimal("basePriceUsd", { precision: 10, scale: 2 }).default("0.00").notNull(),
  profitMarginPercent: decimal("profitMarginPercent", { precision: 6, scale: 2 }).default("0.00").notNull(),
  priceUsd: decimal("priceUsd", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("smm_tiers_service_idx").on(table.serviceId)]);

export const orders = mysqlTable("orders", {
  id: varchar("id", { length: 64 }).primaryKey(),
  orderNumber: varchar("orderNumber", { length: 48 }).notNull().unique(),
  trackingCode: varchar("trackingCode", { length: 48 }).notNull().unique(),
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

export const orderStatusEvents = mysqlTable("order_status_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  orderId: varchar("orderId", { length: 64 }).notNull(),
  eventType: varchar("eventType", { length: 48 }).notNull(),
  status: varchar("status", { length: 48 }).notNull(),
  actorType: mysqlEnum("actorType", ["system", "customer", "admin", "provider"]).notNull(),
  messageKh: varchar("messageKh", { length: 500 }).notNull(),
  providerReference: varchar("providerReference", { length: 180 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("order_status_events_order_idx").on(table.orderId), index("order_status_events_created_idx").on(table.createdAt)]);

export const orderSupportTickets = mysqlTable("order_support_tickets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  ticketNumber: varchar("ticketNumber", { length: 48 }).notNull().unique(),
  orderId: varchar("orderId", { length: 64 }).notNull(),
  userId: int("userId").notNull(),
  subject: varchar("subject", { length: 180 }).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["open", "reviewing", "resolved", "closed"]).default("open").notNull(),
  adminReply: text("adminReply"),
  reviewedByUserId: int("reviewedByUserId"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("order_support_tickets_order_idx").on(table.orderId), index("order_support_tickets_user_idx").on(table.userId), index("order_support_tickets_status_idx").on(table.status)]);

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
  status: mysqlEnum("status", ["draft", "pending", "approved", "rejected", "closed", "sold"]).default("pending").notNull(),
  game: varchar("game", { length: 120 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  rankLevel: varchar("rankLevel", { length: 180 }).notNull(),
  priceUsd: decimal("priceUsd", { precision: 10, scale: 2 }),
  description: text("description").notNull(),
  contactMethod: varchar("contactMethod", { length: 180 }).notNull(),
  telegramUsername: varchar("telegramUsername", { length: 80 }),
  screenshots: json("screenshots").notNull(),
  soldAt: timestamp("soldAt"),
  cleanupAt: timestamp("cleanupAt"),
  reviewNote: text("reviewNote"),
  reviewedByUserId: int("reviewedByUserId"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("marketplace_status_idx").on(table.status), index("marketplace_game_idx").on(table.game), index("marketplace_seller_idx").on(table.sellerUserId)]);

export const marketplaceFavorites = mysqlTable("marketplace_favorites", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  listingId: varchar("listingId", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("marketplace_favorites_user_listing_unique").on(table.userId, table.listingId), index("marketplace_favorites_user_idx").on(table.userId), index("marketplace_favorites_listing_idx").on(table.listingId)]);

export const marketplaceVerifications = mysqlTable("marketplace_verifications", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "manual_review"]).default("pending").notNull(),
  providerSessionId: varchar("providerSessionId", { length: 180 }),
  providerDecision: mysqlEnum("providerDecision", ["pending", "pass", "fail", "review"]).default("pending").notNull(),
  autoApprovalEligible: boolean("autoApprovalEligible").default(false).notNull(),
  documentType: varchar("documentType", { length: 80 }),
  locationCountry: varchar("locationCountry", { length: 2 }),
  locationAccuracyMeters: int("locationAccuracyMeters"),
  networkRisk: mysqlEnum("networkRisk", ["unknown", "low", "medium", "high"]).default("unknown").notNull(),
  verificationNote: text("verificationNote"),
  reviewedByUserId: int("reviewedByUserId"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("marketplace_verification_user_idx").on(table.userId), index("marketplace_verification_status_idx").on(table.status), uniqueIndex("marketplace_provider_session_unique").on(table.providerSessionId)]);

export const marketplaceVerificationEvidence = mysqlTable("marketplace_verification_evidence", {
  id: varchar("id", { length: 64 }).primaryKey(),
  verificationId: varchar("verificationId", { length: 64 }).notNull(),
  userId: int("userId").notNull(),
  evidenceType: mysqlEnum("evidenceType", ["national_id_front", "national_id_back", "selfie_liveness", "location_attestation"]).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  byteSize: int("byteSize").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("verification_evidence_verification_idx").on(table.verificationId), index("verification_evidence_user_idx").on(table.userId)]);

export const marketplaceEvidenceAccessLogs = mysqlTable("marketplace_evidence_access_logs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  evidenceId: varchar("evidenceId", { length: 64 }).notNull(),
  adminUserId: int("adminUserId").notNull(),
  action: mysqlEnum("action", ["view", "download_denied", "case_review"]).notNull(),
  reason: varchar("reason", { length: 500 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("evidence_access_evidence_idx").on(table.evidenceId), index("evidence_access_admin_idx").on(table.adminUserId)]);

export const marketplaceFraudReports = mysqlTable("marketplace_fraud_reports", {
  id: varchar("id", { length: 64 }).primaryKey(),
  listingId: varchar("listingId", { length: 64 }).notNull(),
  reporterUserId: int("reporterUserId").notNull(),
  details: text("details").notNull(),
  status: mysqlEnum("status", ["received", "reviewing", "resolved", "closed"]).default("received").notNull(),
  adminNote: text("adminNote"),
  reviewedByUserId: int("reviewedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("fraud_report_listing_idx").on(table.listingId), index("fraud_report_status_idx").on(table.status)]);

export const marketplaceDisclosureRequests = mysqlTable("marketplace_disclosure_requests", {
  id: varchar("id", { length: 64 }).primaryKey(),
  fraudReportId: varchar("fraudReportId", { length: 64 }).notNull(),
  requestBasis: varchar("requestBasis", { length: 500 }).notNull(),
  status: mysqlEnum("status", ["submitted", "under_review", "approved", "rejected"]).default("submitted").notNull(),
  reviewedByUserId: int("reviewedByUserId"),
  reviewNote: text("reviewNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("disclosure_request_fraud_idx").on(table.fraudReportId), index("disclosure_request_status_idx").on(table.status)]);

export const marketplaceContacts = mysqlTable("marketplace_contacts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  listingId: varchar("listingId", { length: 64 }).notNull(),
  initiatorUserId: int("initiatorUserId").notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["requested", "accepted", "declined", "closed"]).default("requested").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("marketplace_contacts_listing_idx").on(table.listingId), index("marketplace_contacts_user_idx").on(table.initiatorUserId)]);

export const gmailSenderConnections = mysqlTable("gmail_sender_connections", {
  id: varchar("id", { length: 64 }).primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  senderEmail: varchar("senderEmail", { length: 320 }).notNull(),
  encryptedRefreshToken: text("encryptedRefreshToken").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("gmail_sender_owner_unique").on(table.ownerUserId), uniqueIndex("gmail_sender_email_unique").on(table.senderEmail)]);

export const welcomeEmailDeliveries = mysqlTable("welcome_email_deliveries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  recipientUserId: int("recipientUserId").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  senderConnectionId: varchar("senderConnectionId", { length: 64 }).notNull(),
  providerMessageId: varchar("providerMessageId", { length: 180 }),
  status: mysqlEnum("status", ["sent", "failed"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("welcome_email_recipient_unique").on(table.recipientUserId), index("welcome_email_sender_idx").on(table.senderConnectionId)]);

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

export const providerPackageArtworkOverrides = mysqlTable("provider_package_artwork_overrides", {
  id: varchar("id", { length: 64 }).primaryKey(),
  gameId: varchar("gameId", { length: 120 }).notNull(),
  offerId: varchar("offerId", { length: 180 }).notNull(),
  mediaUrl: varchar("mediaUrl", { length: 2048 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }),
  updatedByUserId: int("updatedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("provider_package_artwork_unique").on(table.gameId, table.offerId), index("provider_package_artwork_game_idx").on(table.gameId)]);

export const providerPackageArtworkAudits = mysqlTable("provider_package_artwork_audits", {
  id: varchar("id", { length: 64 }).primaryKey(),
  gameId: varchar("gameId", { length: 120 }).notNull(),
  offerId: varchar("offerId", { length: 180 }).notNull(),
  action: mysqlEnum("action", ["set", "reset"]).notNull(),
  previousMediaUrl: varchar("previousMediaUrl", { length: 2048 }),
  nextMediaUrl: varchar("nextMediaUrl", { length: 2048 }),
  actorUserId: int("actorUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("provider_package_artwork_audit_offer_idx").on(table.gameId, table.offerId), index("provider_package_artwork_audit_actor_idx").on(table.actorUserId)]);

export const providerCredentialVersions = mysqlTable("provider_credential_versions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  provider: mysqlEnum("provider", ["fazercards", "bakong"]).notNull(),
  envelopeVersion: int("envelopeVersion").default(1).notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: varchar("iv", { length: 64 }).notNull(),
  authTag: varchar("authTag", { length: 64 }).notNull(),
  state: mysqlEnum("state", ["active", "superseded"]).default("active").notNull(),
  validationStatus: mysqlEnum("validationStatus", ["validated"]).default("validated").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  activatedAt: timestamp("activatedAt").defaultNow().notNull(),
  supersededAt: timestamp("supersededAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("provider_credential_version_active_idx").on(table.provider, table.state), index("provider_credential_version_actor_idx").on(table.createdByUserId), index("provider_credential_version_created_idx").on(table.createdAt)]);

export const providerCredentialAudits = mysqlTable("provider_credential_audits", {
  id: varchar("id", { length: 64 }).primaryKey(),
  provider: mysqlEnum("provider", ["fazercards", "bakong"]).notNull(),
  action: mysqlEnum("action", ["activate", "rollback_to_version", "rollback_to_env", "validation_rejected"]).notNull(),
  fromVersionId: varchar("fromVersionId", { length: 64 }),
  toVersionId: varchar("toVersionId", { length: 64 }),
  actorUserId: int("actorUserId").notNull(),
  reason: varchar("reason", { length: 240 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("provider_credential_audit_provider_idx").on(table.provider, table.createdAt), index("provider_credential_audit_actor_idx").on(table.actorUserId)]);

export const liveSpinEvents = mysqlTable("live_spin_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  weekKey: varchar("weekKey", { length: 16 }).notNull().unique(),
  status: mysqlEnum("status", ["draft", "announced", "locked", "waiting", "live", "winner_revealed", "prize_countdown", "prize_revealed", "ended", "skipped"]).default("draft").notNull(),
  isTest: boolean("isTest").default(false).notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  announcementStartsAt: timestamp("announcementStartsAt"),
  entryCutoffAt: timestamp("entryCutoffAt").notNull(),
  lobbyStartsAt: timestamp("lobbyStartsAt"),
  liveStartedAt: timestamp("liveStartedAt"),
  winnerRevealedAt: timestamp("winnerRevealedAt"),
  prizeCountdownStartedAt: timestamp("prizeCountdownStartedAt"),
  prizeRevealedAt: timestamp("prizeRevealedAt"),
  endedAt: timestamp("endedAt"),
  minParticipantCount: int("minParticipantCount").default(100).notNull(),
  lockedParticipantCount: int("lockedParticipantCount").default(0).notNull(),
  lockedEntryCount: int("lockedEntryCount").default(0).notNull(),
  adMediaUrl: varchar("adMediaUrl", { length: 2048 }),
  adDurationSeconds: int("adDurationSeconds").default(0).notNull(),
  winnerSpoilerSeconds: int("winnerSpoilerSeconds").default(5).notNull(),
  prizeCountdownSeconds: int("prizeCountdownSeconds").default(5).notNull(),
  fairnessCommitmentHash: varchar("fairnessCommitmentHash", { length: 128 }),
  encryptedFairnessSeed: text("encryptedFairnessSeed"),
  participantSnapshotHash: varchar("participantSnapshotHash", { length: 128 }),
  participantSnapshotAt: timestamp("participantSnapshotAt"),
  revealedFairnessSeed: varchar("revealedFairnessSeed", { length: 256 }),
  skippedReason: text("skippedReason"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("live_spin_events_status_schedule_idx").on(table.status, table.scheduledAt)]);

export const liveSpinQualifiedOrders = mysqlTable("live_spin_qualified_orders", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  orderId: varchar("orderId", { length: 64 }).notNull().unique(),
  weekKey: varchar("weekKey", { length: 16 }).notNull(),
  qualifiedAt: timestamp("qualifiedAt").defaultNow().notNull(),
}, (table) => [index("live_spin_qualified_orders_user_week_idx").on(table.userId, table.weekKey), index("live_spin_qualified_orders_week_idx").on(table.weekKey)]);

export const liveSpinTickets = mysqlTable("live_spin_tickets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  earnedWeekKey: varchar("earnedWeekKey", { length: 16 }).notNull(),
  sequenceInWeek: int("sequenceInWeek").notNull(),
  status: mysqlEnum("status", ["active", "locked", "used", "void"]).default("active").notNull(),
  isTest: boolean("isTest").default(false).notNull(),
  eventId: varchar("eventId", { length: 64 }),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  voidedAt: timestamp("voidedAt"),
  voidReason: varchar("voidReason", { length: 500 }),
}, (table) => [uniqueIndex("live_spin_tickets_user_week_sequence_unique").on(table.userId, table.earnedWeekKey, table.sequenceInWeek), index("live_spin_tickets_event_status_idx").on(table.eventId, table.status), index("live_spin_tickets_user_status_idx").on(table.userId, table.status)]);

export const liveSpinEntries = mysqlTable("live_spin_entries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  eventId: varchar("eventId", { length: 64 }).notNull(),
  ticketId: varchar("ticketId", { length: 64 }).notNull(),
  userId: int("userId").notNull(),
  displayAlias: varchar("displayAlias", { length: 80 }).notNull(),
  entryIndex: int("entryIndex").notNull(),
  status: mysqlEnum("status", ["locked", "winner", "disqualified"]).default("locked").notNull(),
  lockedAt: timestamp("lockedAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("live_spin_entries_event_ticket_unique").on(table.eventId, table.ticketId), uniqueIndex("live_spin_entries_event_index_unique").on(table.eventId, table.entryIndex), index("live_spin_entries_event_user_idx").on(table.eventId, table.userId)]);

export const liveSpinPrizeTiers = mysqlTable("live_spin_prize_tiers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  eventId: varchar("eventId", { length: 64 }).notNull(),
  tierNumber: int("tierNumber").notNull(),
  nameKh: varchar("nameKh", { length: 180 }).notNull(),
  valueLabel: varchar("valueLabel", { length: 180 }).notNull(),
  descriptionKh: varchar("descriptionKh", { length: 500 }),
  mediaUrl: varchar("mediaUrl", { length: 2048 }),
  isGrandPrize: boolean("isGrandPrize").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("live_spin_prize_tiers_event_tier_unique").on(table.eventId, table.tierNumber), index("live_spin_prize_tiers_event_active_idx").on(table.eventId, table.isActive)]);

export const liveSpinResults = mysqlTable("live_spin_results", {
  id: varchar("id", { length: 64 }).primaryKey(),
  eventId: varchar("eventId", { length: 64 }).notNull().unique(),
  winnerEntryId: varchar("winnerEntryId", { length: 64 }).notNull().unique(),
  prizeTierId: varchar("prizeTierId", { length: 64 }).notNull(),
  winnerIndex: int("winnerIndex").notNull(),
  prizeIndex: int("prizeIndex").notNull(),
  selectionProofHash: varchar("selectionProofHash", { length: 128 }).notNull(),
  awardedAt: timestamp("awardedAt").defaultNow().notNull(),
}, (table) => [index("live_spin_results_prize_idx").on(table.prizeTierId)]);

export const liveSpinAuditLogs = mysqlTable("live_spin_audit_logs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  eventId: varchar("eventId", { length: 64 }),
  actorUserId: int("actorUserId"),
  actorType: mysqlEnum("actorType", ["system", "owner"]).notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  details: json("details").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("live_spin_audit_event_created_idx").on(table.eventId, table.createdAt), index("live_spin_audit_actor_created_idx").on(table.actorUserId, table.createdAt)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
