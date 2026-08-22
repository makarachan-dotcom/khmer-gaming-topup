CREATE TABLE `wallet_topups` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`referenceCode` varchar(48) NOT NULL,
	`provider` varchar(64) NOT NULL DEFAULT 'bakong_khqr',
	`providerRequestId` varchar(160) NOT NULL,
	`providerTransactionId` varchar(160),
	`status` enum('pending','paid','expired','failed') NOT NULL DEFAULT 'pending',
	`amountKhr` decimal(14,2) NOT NULL,
	`paymentPayload` json NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`paidAt` timestamp,
	`creditedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallet_topups_id` PRIMARY KEY(`id`),
	CONSTRAINT `wallet_topups_referenceCode_unique` UNIQUE(`referenceCode`),
	CONSTRAINT `wallet_topups_providerRequestId_unique` UNIQUE(`providerRequestId`)
);
--> statement-breakpoint
CREATE INDEX `wallet_topups_user_idx` ON `wallet_topups` (`userId`);--> statement-breakpoint
CREATE INDEX `wallet_topups_status_idx` ON `wallet_topups` (`status`);