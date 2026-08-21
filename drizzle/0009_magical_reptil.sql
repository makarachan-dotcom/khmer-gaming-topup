CREATE TABLE `admin_role_audits` (
	`id` varchar(64) NOT NULL,
	`actorUserId` int NOT NULL,
	`targetUserId` int NOT NULL,
	`previousRole` enum('user','admin') NOT NULL,
	`nextRole` enum('user','admin') NOT NULL,
	`reason` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_role_audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `admin_role_audits_target_idx` ON `admin_role_audits` (`targetUserId`);--> statement-breakpoint
CREATE INDEX `admin_role_audits_actor_idx` ON `admin_role_audits` (`actorUserId`);