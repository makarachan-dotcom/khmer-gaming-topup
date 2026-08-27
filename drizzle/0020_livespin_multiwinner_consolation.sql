ALTER TABLE `live_spin_events` ADD COLUMN `spinEnabled` boolean NOT NULL DEFAULT true AFTER `isTest`;
--> statement-breakpoint
ALTER TABLE `live_spin_events` ADD COLUMN `winnerCount` int NOT NULL DEFAULT 3 AFTER `spinEnabled`;
--> statement-breakpoint
ALTER TABLE `live_spin_events` ADD COLUMN `consolationGiftCount` int NOT NULL DEFAULT 10 AFTER `winnerCount`;
--> statement-breakpoint
ALTER TABLE `live_spin_events` ADD COLUMN `settingsSnapshotHash` varchar(128) AFTER `consolationGiftCount`;
--> statement-breakpoint
ALTER TABLE `live_spin_results`
  DROP INDEX `live_spin_results_eventId_unique`,
  ADD COLUMN `winnerRank` int NOT NULL DEFAULT 1 AFTER `eventId`,
  ADD CONSTRAINT `live_spin_results_eventId_winnerRank_unique` UNIQUE(`eventId`,`winnerRank`);
--> statement-breakpoint
CREATE TABLE `live_spin_connection_sessions` (
  `id` varchar(64) NOT NULL,
  `eventId` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `consentedAt` timestamp NOT NULL,
  `startedAt` timestamp NOT NULL,
  `lastSeenAt` timestamp NOT NULL,
  `endedAt` timestamp,
  CONSTRAINT `live_spin_connection_sessions_id` PRIMARY KEY(`id`),
  CONSTRAINT `live_spin_connection_sessions_eventId_userId_unique` UNIQUE(`eventId`,`userId`)
);
--> statement-breakpoint
CREATE INDEX `live_spin_connection_sessions_event_user_idx` ON `live_spin_connection_sessions` (`eventId`,`userId`);
--> statement-breakpoint
CREATE INDEX `live_spin_connection_sessions_event_last_seen_idx` ON `live_spin_connection_sessions` (`eventId`,`lastSeenAt`);
--> statement-breakpoint
CREATE TABLE `live_spin_consolation_gifts` (
  `id` varchar(64) NOT NULL,
  `eventId` varchar(64) NOT NULL,
  `slotNumber` int NOT NULL,
  `nameKh` varchar(180) NOT NULL,
  `valueLabel` varchar(180) NOT NULL,
  `descriptionKh` varchar(500),
  `mediaUrl` varchar(2048),
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `live_spin_consolation_gifts_id` PRIMARY KEY(`id`),
  CONSTRAINT `live_spin_consolation_gifts_eventId_slotNumber_unique` UNIQUE(`eventId`,`slotNumber`)
);
--> statement-breakpoint
CREATE TABLE `live_spin_consolation_results` (
  `id` varchar(64) NOT NULL,
  `eventId` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `giftId` varchar(64),
  `rank` int NOT NULL,
  `connectionDurationSeconds` int NOT NULL,
  `connectionSnapshotHash` varchar(128) NOT NULL,
  `selectionProofHash` varchar(128) NOT NULL,
  `awardedAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `live_spin_consolation_results_id` PRIMARY KEY(`id`),
  CONSTRAINT `live_spin_consolation_results_eventId_rank_unique` UNIQUE(`eventId`,`rank`),
  CONSTRAINT `live_spin_consolation_results_eventId_userId_unique` UNIQUE(`eventId`,`userId`)
);
