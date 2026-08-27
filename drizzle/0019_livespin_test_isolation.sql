ALTER TABLE `live_spin_events` ADD COLUMN `isTest` boolean NOT NULL DEFAULT false AFTER `status`;
--> statement-breakpoint
ALTER TABLE `live_spin_tickets` ADD COLUMN `isTest` boolean NOT NULL DEFAULT false AFTER `status`;
