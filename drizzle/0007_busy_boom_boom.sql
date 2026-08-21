CREATE TABLE `gmail_sender_connections` (
	`id` varchar(64) NOT NULL,
	`ownerUserId` int NOT NULL,
	`senderEmail` varchar(320) NOT NULL,
	`encryptedRefreshToken` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gmail_sender_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `gmail_sender_owner_unique` UNIQUE(`ownerUserId`),
	CONSTRAINT `gmail_sender_email_unique` UNIQUE(`senderEmail`)
);
--> statement-breakpoint
CREATE TABLE `welcome_email_deliveries` (
	`id` varchar(64) NOT NULL,
	`recipientUserId` int NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`senderConnectionId` varchar(64) NOT NULL,
	`providerMessageId` varchar(180),
	`status` enum('sent','failed') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `welcome_email_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `welcome_email_recipient_unique` UNIQUE(`recipientUserId`)
);
--> statement-breakpoint
CREATE INDEX `welcome_email_sender_idx` ON `welcome_email_deliveries` (`senderConnectionId`);