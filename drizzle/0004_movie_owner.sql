ALTER TABLE `movies` ADD `user_id` integer REFERENCES users(id) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `movies_user_id_idx` ON `movies` (`user_id`);