ALTER TABLE `artist_applications` ADD `account_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_artist_applications_account` ON `artist_applications` (`account_id`);
--> statement-breakpoint
CREATE INDEX `idx_artist_applications_status` ON `artist_applications` (`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_artist_applications_one_active_account` ON `artist_applications` (`account_id`) WHERE `account_id` != '' AND `status` IN ('draft', 'received', 'reviewing', 'hold', 'approved');
