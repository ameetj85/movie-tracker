CREATE TABLE `viewings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`movie_id` integer NOT NULL,
	`watched_on` text NOT NULL,
	`note` text,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `viewings_movie_id_idx` ON `viewings` (`movie_id`);--> statement-breakpoint
CREATE INDEX `viewings_watched_on_idx` ON `viewings` (`watched_on`);--> statement-breakpoint
ALTER TABLE `copies` ADD `upc` text;--> statement-breakpoint
CREATE INDEX `copies_upc_idx` ON `copies` (`upc`);--> statement-breakpoint
ALTER TABLE `movies` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `movies` ADD `tmdb_collection_id` integer;--> statement-breakpoint
ALTER TABLE `movies` ADD `tmdb_collection_name` text;--> statement-breakpoint
CREATE INDEX `movies_tmdb_collection_idx` ON `movies` (`tmdb_collection_id`);