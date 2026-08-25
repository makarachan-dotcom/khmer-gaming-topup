ALTER TABLE `customer_wallets` ADD `balanceUsd` decimal(14,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_transactions` ADD `manualCheckCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `wallet_topups` ADD `currency` varchar(8) DEFAULT 'KHR' NOT NULL;--> statement-breakpoint
ALTER TABLE `wallet_topups` ADD `manualCheckCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `wallet_topups` ADD `activeSessionKey` varchar(64);--> statement-breakpoint
ALTER TABLE `wallet_topups` ADD CONSTRAINT `wallet_topups_active_session_unique` UNIQUE(`activeSessionKey`);