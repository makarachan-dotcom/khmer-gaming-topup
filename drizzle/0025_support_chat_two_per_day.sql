ALTER TABLE `support_chat_sessions` DROP INDEX `support_chat_sessions_user_day_unique`;--> statement-breakpoint
CREATE INDEX `support_chat_sessions_user_day_idx` ON `support_chat_sessions` (`userId`,`quotaDay`);
