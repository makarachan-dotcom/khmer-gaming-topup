CREATE TABLE IF NOT EXISTS `admin_test_order_audits` (
  `id` varchar(64) NOT NULL,
  `orderId` varchar(64) NOT NULL,
  `adminUserId` int NOT NULL,
  `packageId` varchar(64) NOT NULL,
  `packageName` varchar(180) NOT NULL,
  `playerId` varchar(128) NOT NULL,
  `priceUsd` decimal(10,2) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `admin_test_order_audits_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `admin_test_order_audits_order_idx` ON `admin_test_order_audits` (`orderId`);--> statement-breakpoint
CREATE INDEX `admin_test_order_audits_admin_idx` ON `admin_test_order_audits` (`adminUserId`,`createdAt`);
