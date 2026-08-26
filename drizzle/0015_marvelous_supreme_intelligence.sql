CREATE TABLE `provider_package_artwork_audits` (
	`id` varchar(64) NOT NULL,
	`gameId` varchar(120) NOT NULL,
	`offerId` varchar(180) NOT NULL,
	`action` enum('set','reset') NOT NULL,
	`previousMediaUrl` varchar(2048),
	`nextMediaUrl` varchar(2048),
	`actorUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `provider_package_artwork_audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `provider_package_artwork_overrides` (
	`id` varchar(64) NOT NULL,
	`gameId` varchar(120) NOT NULL,
	`offerId` varchar(180) NOT NULL,
	`mediaUrl` varchar(2048) NOT NULL,
	`storageKey` varchar(512),
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_package_artwork_overrides_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_package_artwork_unique` UNIQUE(`gameId`,`offerId`)
);
--> statement-breakpoint
CREATE INDEX `provider_package_artwork_audit_offer_idx` ON `provider_package_artwork_audits` (`gameId`,`offerId`);--> statement-breakpoint
CREATE INDEX `provider_package_artwork_audit_actor_idx` ON `provider_package_artwork_audits` (`actorUserId`);--> statement-breakpoint
CREATE INDEX `provider_package_artwork_game_idx` ON `provider_package_artwork_overrides` (`gameId`);