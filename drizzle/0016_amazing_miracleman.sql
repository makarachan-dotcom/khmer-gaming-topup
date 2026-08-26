CREATE TABLE `provider_credential_audits` (
	`id` varchar(64) NOT NULL,
	`provider` enum('fazercards','bakong') NOT NULL,
	`action` enum('activate','rollback_to_version','rollback_to_env','validation_rejected') NOT NULL,
	`fromVersionId` varchar(64),
	`toVersionId` varchar(64),
	`actorUserId` int NOT NULL,
	`reason` varchar(240) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `provider_credential_audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `provider_credential_versions` (
	`id` varchar(64) NOT NULL,
	`provider` enum('fazercards','bakong') NOT NULL,
	`envelopeVersion` int NOT NULL DEFAULT 1,
	`ciphertext` text NOT NULL,
	`iv` varchar(64) NOT NULL,
	`authTag` varchar(64) NOT NULL,
	`state` enum('active','superseded') NOT NULL DEFAULT 'active',
	`validationStatus` enum('validated') NOT NULL DEFAULT 'validated',
	`createdByUserId` int NOT NULL,
	`activatedAt` timestamp NOT NULL DEFAULT (now()),
	`supersededAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `provider_credential_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `provider_credential_audit_provider_idx` ON `provider_credential_audits` (`provider`,`createdAt`);--> statement-breakpoint
CREATE INDEX `provider_credential_audit_actor_idx` ON `provider_credential_audits` (`actorUserId`);--> statement-breakpoint
CREATE INDEX `provider_credential_version_active_idx` ON `provider_credential_versions` (`provider`,`state`);--> statement-breakpoint
CREATE INDEX `provider_credential_version_actor_idx` ON `provider_credential_versions` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `provider_credential_version_created_idx` ON `provider_credential_versions` (`createdAt`);