ALTER TABLE `live_spin_events` MODIFY COLUMN `status` enum('draft','announced','locked','waiting','live','winner_revealed','prize_countdown','prize_revealed','ended','skipped') NOT NULL DEFAULT 'draft';
--> statement-breakpoint
ALTER TABLE `live_spin_events` ADD COLUMN `winnerRevealedAt` timestamp NULL AFTER `liveStartedAt`;
--> statement-breakpoint
ALTER TABLE `live_spin_events` ADD COLUMN `prizeCountdownStartedAt` timestamp NULL AFTER `winnerRevealedAt`;
--> statement-breakpoint
ALTER TABLE `live_spin_events` ADD COLUMN `prizeRevealedAt` timestamp NULL AFTER `prizeCountdownStartedAt`;
