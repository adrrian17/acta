CREATE TABLE `task` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`due_date` text,
	`state` text DEFAULT 'open' NOT NULL,
	`state_before_trash` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`done_at` integer,
	`trashed_at` integer
);
--> statement-breakpoint
CREATE INDEX `task_state_dueDate_createdAt_id_idx` ON `task` (`state`,`due_date`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `task_state_doneAt_idx` ON `task` (`state`,`done_at`);--> statement-breakpoint
CREATE INDEX `task_state_trashedAt_idx` ON `task` (`state`,`trashed_at`);