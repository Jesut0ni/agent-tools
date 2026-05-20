CREATE TABLE `invocations` (
	`id` text PRIMARY KEY NOT NULL,
	`tool_id` text NOT NULL,
	`tool_slug` text NOT NULL,
	`tool_owner_id` text,
	`caller_kind` text NOT NULL,
	`caller_id` text,
	`status` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`error_message` text,
	`called_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `invocations_owner_idx` ON `invocations` (`tool_owner_id`,`called_at`);--> statement-breakpoint
CREATE INDEX `invocations_caller_idx` ON `invocations` (`caller_id`,`called_at`);--> statement-breakpoint
CREATE INDEX `invocations_tool_idx` ON `invocations` (`tool_id`,`called_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_developers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`api_key_hash` text,
	`api_key_preview` text,
	`verified` integer DEFAULT false NOT NULL,
	`verification_token` text,
	`suspended` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_developers`("id", "email", "api_key_hash", "api_key_preview", "verified", "verification_token", "suspended", "created_at") SELECT "id", "email", "api_key_hash", "api_key_preview", 1, NULL, 0, "created_at" FROM `developers`;--> statement-breakpoint
DROP TABLE `developers`;--> statement-breakpoint
ALTER TABLE `__new_developers` RENAME TO `developers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `developers_email_unique` ON `developers` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `developers_api_key_hash_unique` ON `developers` (`api_key_hash`);--> statement-breakpoint
CREATE INDEX `developers_verification_token_idx` ON `developers` (`verification_token`);