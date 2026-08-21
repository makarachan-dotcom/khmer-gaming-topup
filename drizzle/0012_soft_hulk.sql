CREATE TABLE `marketplace_favorites` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`listingId` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketplace_favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketplace_favorites_user_listing_unique` UNIQUE(`userId`,`listingId`)
);
--> statement-breakpoint
CREATE INDEX `marketplace_favorites_user_idx` ON `marketplace_favorites` (`userId`);--> statement-breakpoint
CREATE INDEX `marketplace_favorites_listing_idx` ON `marketplace_favorites` (`listingId`);