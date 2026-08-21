ALTER TABLE `game_packages` ADD `basePriceUsd` decimal(10,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `game_packages` ADD `profitMarginPercent` decimal(6,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `smm_tiers` ADD `basePriceUsd` decimal(10,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `smm_tiers` ADD `profitMarginPercent` decimal(6,2) DEFAULT '0.00' NOT NULL;