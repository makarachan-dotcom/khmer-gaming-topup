CREATE TABLE `live_spin_audit_logs` (
	`id` varchar(64) NOT NULL,
	`eventId` varchar(64),
	`actorUserId` int,
	`actorType` enum('system','owner') NOT NULL,
	`action` varchar(120) NOT NULL,
	`details` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `live_spin_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `live_spin_entries` (
	`id` varchar(64) NOT NULL,
	`eventId` varchar(64) NOT NULL,
	`ticketId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`displayAlias` varchar(80) NOT NULL,
	`entryIndex` int NOT NULL,
	`status` enum('locked','winner','disqualified') NOT NULL DEFAULT 'locked',
	`lockedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `live_spin_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `live_spin_entries_eventId_ticketId_unique` UNIQUE(`eventId`,`ticketId`),
	CONSTRAINT `live_spin_entries_eventId_entryIndex_unique` UNIQUE(`eventId`,`entryIndex`)
);
--> statement-breakpoint
CREATE TABLE `live_spin_events` (
	`id` varchar(64) NOT NULL,
	`weekKey` varchar(16) NOT NULL,
	`status` enum('draft','announced','locked','waiting','live','winner_revealed','prize_revealed','ended','skipped') NOT NULL DEFAULT 'draft',
	`scheduledAt` timestamp NOT NULL,
	`announcementStartsAt` timestamp,
	`entryCutoffAt` timestamp NOT NULL,
	`lobbyStartsAt` timestamp,
	`liveStartedAt` timestamp,
	`endedAt` timestamp,
	`minParticipantCount` int NOT NULL DEFAULT 100,
	`lockedParticipantCount` int NOT NULL DEFAULT 0,
	`lockedEntryCount` int NOT NULL DEFAULT 0,
	`adMediaUrl` varchar(2048),
	`adDurationSeconds` int NOT NULL DEFAULT 0,
	`winnerSpoilerSeconds` int NOT NULL DEFAULT 5,
	`prizeCountdownSeconds` int NOT NULL DEFAULT 5,
	`fairnessCommitmentHash` varchar(128),
	`encryptedFairnessSeed` text,
	`participantSnapshotHash` varchar(128),
	`participantSnapshotAt` timestamp,
	`revealedFairnessSeed` varchar(256),
	`skippedReason` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `live_spin_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `live_spin_events_weekKey_unique` UNIQUE(`weekKey`)
);
--> statement-breakpoint
CREATE TABLE `live_spin_prize_tiers` (
	`id` varchar(64) NOT NULL,
	`eventId` varchar(64) NOT NULL,
	`tierNumber` int NOT NULL,
	`nameKh` varchar(180) NOT NULL,
	`valueLabel` varchar(180) NOT NULL,
	`descriptionKh` varchar(500),
	`mediaUrl` varchar(2048),
	`isGrandPrize` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `live_spin_prize_tiers_id` PRIMARY KEY(`id`),
	CONSTRAINT `live_spin_prize_tiers_eventId_tierNumber_unique` UNIQUE(`eventId`,`tierNumber`)
);
--> statement-breakpoint
CREATE TABLE `live_spin_qualified_orders` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`orderId` varchar(64) NOT NULL,
	`weekKey` varchar(16) NOT NULL,
	`qualifiedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `live_spin_qualified_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `live_spin_qualified_orders_orderId_unique` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `live_spin_results` (
	`id` varchar(64) NOT NULL,
	`eventId` varchar(64) NOT NULL,
	`winnerEntryId` varchar(64) NOT NULL,
	`prizeTierId` varchar(64) NOT NULL,
	`winnerIndex` int NOT NULL,
	`prizeIndex` int NOT NULL,
	`selectionProofHash` varchar(128) NOT NULL,
	`awardedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `live_spin_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `live_spin_results_eventId_unique` UNIQUE(`eventId`),
	CONSTRAINT `live_spin_results_winnerEntryId_unique` UNIQUE(`winnerEntryId`)
);
--> statement-breakpoint
CREATE TABLE `live_spin_tickets` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`earnedWeekKey` varchar(16) NOT NULL,
	`sequenceInWeek` int NOT NULL,
	`status` enum('active','locked','used','void') NOT NULL DEFAULT 'active',
	`eventId` varchar(64),
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`voidedAt` timestamp,
	`voidReason` varchar(500),
	CONSTRAINT `live_spin_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `live_spin_tickets_userId_earnedWeekKey_sequenceInWeek_unique` UNIQUE(`userId`,`earnedWeekKey`,`sequenceInWeek`)
);
--> statement-breakpoint
CREATE INDEX `live_spin_audit_event_created_idx` ON `live_spin_audit_logs` (`eventId`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `live_spin_audit_actor_created_idx` ON `live_spin_audit_logs` (`actorUserId`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `live_spin_entries_event_user_idx` ON `live_spin_entries` (`eventId`,`userId`);
--> statement-breakpoint
CREATE INDEX `live_spin_events_status_schedule_idx` ON `live_spin_events` (`status`,`scheduledAt`);
--> statement-breakpoint
CREATE INDEX `live_spin_prize_tiers_event_active_idx` ON `live_spin_prize_tiers` (`eventId`,`isActive`);
--> statement-breakpoint
CREATE INDEX `live_spin_qualified_orders_user_week_idx` ON `live_spin_qualified_orders` (`userId`,`weekKey`);
--> statement-breakpoint
CREATE INDEX `live_spin_qualified_orders_week_idx` ON `live_spin_qualified_orders` (`weekKey`);
--> statement-breakpoint
CREATE INDEX `live_spin_results_prize_idx` ON `live_spin_results` (`prizeTierId`);
--> statement-breakpoint
CREATE INDEX `live_spin_tickets_event_status_idx` ON `live_spin_tickets` (`eventId`,`status`);
--> statement-breakpoint
CREATE INDEX `live_spin_tickets_user_status_idx` ON `live_spin_tickets` (`userId`,`status`);
