CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_mint` text NOT NULL,
	`user_pubkey` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	FOREIGN KEY (`user_pubkey`) REFERENCES `users`(`pubkey`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`pubkey` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bio` text,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_pubkey_unique` ON `users` (`pubkey`);