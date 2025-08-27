CREATE TABLE IF NOT EXISTS `jobs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `company` text NOT NULL,
  `logo` text,
  `location` text NOT NULL,
  `employment_type` text,
  `seniority` text,
  `salary` text,
  `description` text,
  `tags_json` text,
  `active` integer NOT NULL DEFAULT 1,
  `created_at` integer NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS `job_applications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `job_id` integer NOT NULL,
  `email` text NOT NULL,
  `note` text,
  `created_at` integer NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`)
);

CREATE INDEX IF NOT EXISTS `idx_job_active_created` ON `jobs` (`active`, `created_at` DESC);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_application_unique` ON `job_applications` (`job_id`, `email`);


