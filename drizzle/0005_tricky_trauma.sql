CREATE TABLE `marketplace_disclosure_requests` (
	`id` varchar(64) NOT NULL,
	`fraudReportId` varchar(64) NOT NULL,
	`requestBasis` varchar(500) NOT NULL,
	`status` enum('submitted','under_review','approved','rejected') NOT NULL DEFAULT 'submitted',
	`reviewedByUserId` int,
	`reviewNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_disclosure_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_evidence_access_logs` (
	`id` varchar(64) NOT NULL,
	`evidenceId` varchar(64) NOT NULL,
	`adminUserId` int NOT NULL,
	`action` enum('view','download_denied','case_review') NOT NULL,
	`reason` varchar(500) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketplace_evidence_access_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_fraud_reports` (
	`id` varchar(64) NOT NULL,
	`listingId` varchar(64) NOT NULL,
	`reporterUserId` int NOT NULL,
	`details` text NOT NULL,
	`status` enum('received','reviewing','resolved','closed') NOT NULL DEFAULT 'received',
	`adminNote` text,
	`reviewedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_fraud_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_verification_evidence` (
	`id` varchar(64) NOT NULL,
	`verificationId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`evidenceType` enum('national_id_front','national_id_back','selfie_liveness','location_attestation') NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`byteSize` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketplace_verification_evidence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `marketplace_verifications` MODIFY COLUMN `status` enum('pending','approved','rejected','manual_review') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `marketplace_listings` ADD `telegramUsername` varchar(80);--> statement-breakpoint
ALTER TABLE `marketplace_listings` ADD `soldAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplace_listings` ADD `cleanupAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplace_verifications` ADD `providerDecision` enum('pending','pass','fail','review') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplace_verifications` ADD `autoApprovalEligible` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplace_verifications` ADD `locationAccuracyMeters` int;--> statement-breakpoint
ALTER TABLE `marketplace_verifications` ADD `networkRisk` enum('unknown','low','medium','high') DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
CREATE INDEX `disclosure_request_fraud_idx` ON `marketplace_disclosure_requests` (`fraudReportId`);--> statement-breakpoint
CREATE INDEX `disclosure_request_status_idx` ON `marketplace_disclosure_requests` (`status`);--> statement-breakpoint
CREATE INDEX `evidence_access_evidence_idx` ON `marketplace_evidence_access_logs` (`evidenceId`);--> statement-breakpoint
CREATE INDEX `evidence_access_admin_idx` ON `marketplace_evidence_access_logs` (`adminUserId`);--> statement-breakpoint
CREATE INDEX `fraud_report_listing_idx` ON `marketplace_fraud_reports` (`listingId`);--> statement-breakpoint
CREATE INDEX `fraud_report_status_idx` ON `marketplace_fraud_reports` (`status`);--> statement-breakpoint
CREATE INDEX `verification_evidence_verification_idx` ON `marketplace_verification_evidence` (`verificationId`);--> statement-breakpoint
CREATE INDEX `verification_evidence_user_idx` ON `marketplace_verification_evidence` (`userId`);