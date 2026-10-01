RENAME TABLE `admin_test_order_audits` TO `admin_purchase_audits`;--> statement-breakpoint
ALTER TABLE `admin_purchase_audits` ADD COLUMN `realPriceUsd` decimal(10,2) NULL;--> statement-breakpoint
