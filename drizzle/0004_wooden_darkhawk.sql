CREATE TABLE `marketplace_verifications` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`providerSessionId` varchar(180),
	`documentType` varchar(80),
	`locationCountry` varchar(2),
	`verificationNote` text,
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_verifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketplace_provider_session_unique` UNIQUE(`providerSessionId`)
);
--> statement-breakpoint
CREATE INDEX `marketplace_verification_user_idx` ON `marketplace_verifications` (`userId`);--> statement-breakpoint
CREATE INDEX `marketplace_verification_status_idx` ON `marketplace_verifications` (`status`);