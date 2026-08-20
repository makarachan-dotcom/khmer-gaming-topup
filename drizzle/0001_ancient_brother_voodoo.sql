CREATE TABLE `game_packages` (
	`id` varchar(64) NOT NULL,
	`productId` varchar(64) NOT NULL,
	`amountLabel` varchar(64) NOT NULL,
	`priceUsd` decimal(10,2) NOT NULL,
	`featured` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_products` (
	`id` varchar(64) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`titleKh` varchar(160) NOT NULL,
	`titleEn` varchar(160) NOT NULL,
	`currencyLabel` varchar(48) NOT NULL,
	`iconLabel` varchar(12) NOT NULL,
	`accent` varchar(32) NOT NULL,
	`requiresZone` boolean NOT NULL DEFAULT true,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_contacts` (
	`id` varchar(64) NOT NULL,
	`listingId` varchar(64) NOT NULL,
	`initiatorUserId` int NOT NULL,
	`message` text NOT NULL,
	`status` enum('requested','accepted','declined','closed') NOT NULL DEFAULT 'requested',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_listings` (
	`id` varchar(64) NOT NULL,
	`sellerUserId` int NOT NULL,
	`listingType` enum('sale','swap','wanted') NOT NULL,
	`status` enum('draft','pending','approved','rejected','closed') NOT NULL DEFAULT 'pending',
	`game` varchar(120) NOT NULL,
	`title` varchar(180) NOT NULL,
	`rankLevel` varchar(180) NOT NULL,
	`priceUsd` decimal(10,2),
	`description` text NOT NULL,
	`contactMethod` varchar(180) NOT NULL,
	`screenshots` json NOT NULL,
	`reviewNote` text,
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_listings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(64) NOT NULL,
	`orderNumber` varchar(48) NOT NULL,
	`userId` int NOT NULL,
	`orderType` enum('topup','smm') NOT NULL,
	`status` enum('pending','awaiting_payment','paid','delivered','failed','expired','refunded') NOT NULL DEFAULT 'pending',
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`subtotal` decimal(10,2) NOT NULL,
	`productName` varchar(180) NOT NULL,
	`details` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `payment_transactions` (
	`id` varchar(64) NOT NULL,
	`orderId` varchar(64) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`providerTransactionId` varchar(160),
	`providerRequestId` varchar(160),
	`status` enum('pending','paid','failed','expired','refunded') NOT NULL DEFAULT 'pending',
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`checkoutUrl` text,
	`callbackPayload` json,
	`expiresAt` timestamp,
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_provider_transaction_unique` UNIQUE(`provider`,`providerTransactionId`)
);
--> statement-breakpoint
CREATE TABLE `saved_player_ids` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`gameProductId` varchar(64) NOT NULL,
	`playerId` varchar(128) NOT NULL,
	`zoneId` varchar(128),
	`label` varchar(80),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_player_ids_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_content` (
	`id` varchar(64) NOT NULL,
	`contentKey` varchar(100) NOT NULL,
	`titleKh` varchar(240),
	`bodyKh` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_content_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_content_contentKey_unique` UNIQUE(`contentKey`)
);
--> statement-breakpoint
CREATE TABLE `smm_services` (
	`id` varchar(64) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`platform` varchar(48) NOT NULL,
	`serviceType` varchar(48) NOT NULL,
	`titleKh` varchar(160) NOT NULL,
	`titleEn` varchar(160) NOT NULL,
	`descriptionKh` text NOT NULL,
	`iconLabel` varchar(12) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smm_services_id` PRIMARY KEY(`id`),
	CONSTRAINT `smm_services_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `smm_tiers` (
	`id` varchar(64) NOT NULL,
	`serviceId` varchar(64) NOT NULL,
	`quantity` int NOT NULL,
	`priceUsd` decimal(10,2) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smm_tiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
CREATE INDEX `game_packages_product_idx` ON `game_packages` (`productId`);--> statement-breakpoint
CREATE INDEX `marketplace_contacts_listing_idx` ON `marketplace_contacts` (`listingId`);--> statement-breakpoint
CREATE INDEX `marketplace_contacts_user_idx` ON `marketplace_contacts` (`initiatorUserId`);--> statement-breakpoint
CREATE INDEX `marketplace_status_idx` ON `marketplace_listings` (`status`);--> statement-breakpoint
CREATE INDEX `marketplace_game_idx` ON `marketplace_listings` (`game`);--> statement-breakpoint
CREATE INDEX `marketplace_seller_idx` ON `marketplace_listings` (`sellerUserId`);--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`userId`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `payment_transactions_order_idx` ON `payment_transactions` (`orderId`);--> statement-breakpoint
CREATE INDEX `saved_player_ids_user_idx` ON `saved_player_ids` (`userId`);--> statement-breakpoint
CREATE INDEX `smm_tiers_service_idx` ON `smm_tiers` (`serviceId`);