ALTER TABLE `game_packages` ADD `providerAuthorized` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `game_packages` ADD `providerSource` varchar(160);--> statement-breakpoint
ALTER TABLE `smm_tiers` ADD `providerAuthorized` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `smm_tiers` ADD `providerSource` varchar(160);