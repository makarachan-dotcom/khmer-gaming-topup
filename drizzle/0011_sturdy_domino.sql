CREATE TABLE `order_status_events` (
	`id` varchar(64) NOT NULL,
	`orderId` varchar(64) NOT NULL,
	`eventType` varchar(48) NOT NULL,
	`status` varchar(48) NOT NULL,
	`actorType` enum('system','customer','admin','provider') NOT NULL,
	`messageKh` varchar(500) NOT NULL,
	`providerReference` varchar(180),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_status_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_support_tickets` (
	`id` varchar(64) NOT NULL,
	`ticketNumber` varchar(48) NOT NULL,
	`orderId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`subject` varchar(180) NOT NULL,
	`message` text NOT NULL,
	`status` enum('open','reviewing','resolved','closed') NOT NULL DEFAULT 'open',
	`adminReply` text,
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_support_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_support_tickets_ticketNumber_unique` UNIQUE(`ticketNumber`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `trackingCode` varchar(48);--> statement-breakpoint
UPDATE `orders` SET `trackingCode` = CONCAT('ZRS-', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 18))) WHERE `trackingCode` IS NULL;--> statement-breakpoint
ALTER TABLE `orders` MODIFY `trackingCode` varchar(48) NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_trackingCode_unique` UNIQUE(`trackingCode`);--> statement-breakpoint
CREATE INDEX `order_status_events_order_idx` ON `order_status_events` (`orderId`);--> statement-breakpoint
CREATE INDEX `order_status_events_created_idx` ON `order_status_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `order_support_tickets_order_idx` ON `order_support_tickets` (`orderId`);--> statement-breakpoint
CREATE INDEX `order_support_tickets_user_idx` ON `order_support_tickets` (`userId`);--> statement-breakpoint
CREATE INDEX `order_support_tickets_status_idx` ON `order_support_tickets` (`status`);
