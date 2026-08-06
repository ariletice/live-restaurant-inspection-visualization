CREATE TABLE `audience_votes` (
	`voter_id` text PRIMARY KEY NOT NULL,
	`season` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
