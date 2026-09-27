CREATE TABLE `artist_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`artist_name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`payload_json` text NOT NULL,
	`image_keys_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
