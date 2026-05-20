CREATE TABLE `developers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`api_key_hash` text NOT NULL,
	`api_key_preview` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `developers_email_unique` ON `developers` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `developers_api_key_hash_unique` ON `developers` (`api_key_hash`);--> statement-breakpoint
CREATE TABLE `tool_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`tool_id` text NOT NULL,
	`version` text NOT NULL,
	`spec` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tool_versions_tool_version_unique` ON `tool_versions` (`tool_id`,`version`);--> statement-breakpoint
CREATE TABLE `tools` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`owner_id` text,
	`visibility` text DEFAULT 'public' NOT NULL,
	`latest_version` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tools_slug_unique` ON `tools` (`slug`);--> statement-breakpoint
CREATE INDEX `tools_visibility_idx` ON `tools` (`visibility`);