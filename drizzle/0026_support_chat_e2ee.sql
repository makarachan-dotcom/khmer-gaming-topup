ALTER TABLE `support_chat_sessions` ADD COLUMN `customerPublicKey` text;--> statement-breakpoint
ALTER TABLE `support_chat_sessions` ADD COLUMN `adminPublicKey` text;--> statement-breakpoint
ALTER TABLE `support_chat_sessions` ADD COLUMN `encryption` enum('none','e2ee') NOT NULL DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `support_chat_messages` ADD COLUMN `encrypted` boolean NOT NULL DEFAULT false;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `support_chat_admin_keys` (
  `adminUserId` int NOT NULL,
  `adminName` varchar(140),
  `publicKeyJwk` text NOT NULL,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `support_chat_admin_keys_adminUserId` PRIMARY KEY(`adminUserId`)
);
