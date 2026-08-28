CREATE TABLE IF NOT EXISTS `payment_link_tokens` (
  `id` varchar(64) NOT NULL,
  `orderId` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `tokenHash` varchar(64) NOT NULL,
  `tokenPrefix` varchar(8) NOT NULL,
  `status` enum('issued','bound','qr_issued','paid','cancelled','expired') NOT NULL DEFAULT 'issued',
  `boundSessionHash` varchar(64),
  `boundDeviceHash` varchar(64),
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `payment_link_tokens_id` PRIMARY KEY(`id`),
  CONSTRAINT `payment_link_tokens_tokenHash_unique` UNIQUE(`tokenHash`),
  KEY `payment_link_tokens_order_idx` (`orderId`),
  KEY `payment_link_tokens_user_idx` (`userId`),
  KEY `payment_link_tokens_expiry_idx` (`expiresAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `payment_link_audits` (
  `id` varchar(64) NOT NULL,
  `paymentLinkId` varchar(64) NOT NULL,
  `orderId` varchar(64) NOT NULL,
  `tokenPrefix` varchar(8) NOT NULL,
  `event` enum('issued','bound','qr_issued','paid','cancelled','expired','blocked','gate_closed') NOT NULL,
  `ipHash` varchar(64),
  `detail` varchar(160),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `payment_link_audits_id` PRIMARY KEY(`id`),
  KEY `payment_link_audits_link_idx` (`paymentLinkId`),
  KEY `payment_link_audits_order_idx` (`orderId`),
  KEY `payment_link_audits_created_idx` (`createdAt`)
);
