CREATE TABLE `customer_wallets` (
	`userId` int NOT NULL,
	`balanceKhr` decimal(14,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_wallets_userId` PRIMARY KEY(`userId`)
);
