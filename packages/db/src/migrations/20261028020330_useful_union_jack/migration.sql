CREATE TABLE `note` (
	`id` text PRIMARY KEY,
	`content` text NOT NULL,
	`state` text DEFAULT 'timeline' NOT NULL,
	`state_before_trash` text,
	`pinned` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`trashed_at` integer
);
--> statement-breakpoint
CREATE TABLE `note_tag` (
	`note_id` text NOT NULL,
	`tag` text NOT NULL,
	CONSTRAINT `note_tag_pk` PRIMARY KEY(`note_id`, `tag`),
	CONSTRAINT `fk_note_tag_note_id_note_id_fk` FOREIGN KEY (`note_id`) REFERENCES `note`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `note_state_pinned_createdAt_id_idx` ON `note` (`state`,`pinned`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `note_state_trashedAt_idx` ON `note` (`state`,`trashed_at`);--> statement-breakpoint
CREATE INDEX `note_tag_tag_idx` ON `note_tag` (`tag`);