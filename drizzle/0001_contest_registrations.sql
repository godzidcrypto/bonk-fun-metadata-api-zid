CREATE TABLE IF NOT EXISTS `contest_registrations` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `contest_id` text NOT NULL,
  `user_pubkey` text NOT NULL,
  `twitter` text NOT NULL,
  `profile_image_url` text NOT NULL,
  `wallet_address` text NOT NULL,
  `approved` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY (`user_pubkey`) REFERENCES `users`(`pubkey`)
);

CREATE INDEX IF NOT EXISTS `idx_contest_user` ON `contest_registrations` (`contest_id`, `user_pubkey`);

