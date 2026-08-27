CREATE TABLE IF NOT EXISTS `provider_package_category_overrides` (
  `id` varchar(64) NOT NULL,
  `gameId` varchar(120) NOT NULL,
  `offerId` varchar(180) NOT NULL,
  `categoryLabel` varchar(80) NOT NULL,
  `updatedByUserId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `provider_package_category_overrides_id` PRIMARY KEY(`id`),
  CONSTRAINT `provider_package_category_unique` UNIQUE(`gameId`,`offerId`),
  KEY `provider_package_category_game_idx` (`gameId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `provider_package_category_audits` (
  `id` varchar(64) NOT NULL,
  `gameId` varchar(120) NOT NULL,
  `offerId` varchar(180) NOT NULL,
  `action` enum('set','reset') NOT NULL,
  `previousCategoryLabel` varchar(80),
  `nextCategoryLabel` varchar(80),
  `actorUserId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `provider_package_category_audits_id` PRIMARY KEY(`id`),
  KEY `provider_package_category_audit_offer_idx` (`gameId`,`offerId`),
  KEY `provider_package_category_audit_actor_idx` (`actorUserId`)
);
