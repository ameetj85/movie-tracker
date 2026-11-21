CREATE TABLE `copies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`movie_id` integer NOT NULL,
	`format` text NOT NULL,
	`edition` text,
	`purchase_date` text,
	`price_cents` integer,
	`condition` text,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `copies_movie_id_idx` ON `copies` (`movie_id`);--> statement-breakpoint
CREATE TABLE `movies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tmdb_id` integer,
	`title` text NOT NULL,
	`release_year` integer,
	`director` text,
	`cast` text,
	`genres` text,
	`poster_url` text,
	`synopsis` text,
	`runtime` integer,
	`is_wishlist` integer DEFAULT false NOT NULL,
	`watch_status` text DEFAULT 'unwatched' NOT NULL,
	`rating` integer,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `movies_title_idx` ON `movies` (`title`);--> statement-breakpoint
CREATE INDEX `movies_is_wishlist_idx` ON `movies` (`is_wishlist`);