CREATE TABLE `shortcodes` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`type` text NOT NULL,
	`number` text NOT NULL,
	`env` text DEFAULT 'production' NOT NULL,
	`consumer_key` text,
	`consumer_secret_enc` text,
	`nominated_number` text,
	`active` integer DEFAULT true NOT NULL,
	`urls_registered_at` integer,
	`pull_registered_at` integer,
	`last_sync_at` integer,
	`last_sync_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shortcodes_number_unique` ON `shortcodes` (`number`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`national_id` text NOT NULL,
	`phone` text NOT NULL,
	`building_id` text NOT NULL,
	`house_no` text,
	`rent_amount` integer NOT NULL,
	`account_ref` text,
	`move_in_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`paid_through` text,
	`credit_balance` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_tenants`("id", "name", "national_id", "phone", "building_id", "house_no", "rent_amount", "account_ref", "move_in_date", "status", "paid_through", "credit_balance", "notes", "created_at", "updated_at") SELECT "id", "name", "national_id", "phone", "building_id", "house_no", "rent_amount", "account_ref", "move_in_date", "status", "paid_through", "credit_balance", "notes", "created_at", "updated_at" FROM `tenants`;--> statement-breakpoint
DROP TABLE `tenants`;--> statement-breakpoint
ALTER TABLE `__new_tenants` RENAME TO `tenants`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `tenants_building_idx` ON `tenants` (`building_id`);--> statement-breakpoint
CREATE INDEX `tenants_status_paid_idx` ON `tenants` (`status`,`paid_through`);--> statement-breakpoint
CREATE INDEX `tenants_phone_idx` ON `tenants` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_active_house_uq` ON `tenants` (`building_id`,`house_no`) WHERE status = 'active';--> statement-breakpoint
ALTER TABLE `buildings` ADD `shortcode_id` text REFERENCES shortcodes(id);--> statement-breakpoint
ALTER TABLE `buildings` ADD `archived_at` integer;--> statement-breakpoint
CREATE INDEX `buildings_shortcode_idx` ON `buildings` (`shortcode_id`);--> statement-breakpoint
ALTER TABLE `payments` ADD `shortcode_id` text REFERENCES shortcodes(id);--> statement-breakpoint
ALTER TABLE `payments` ADD `shortcode_number` text;--> statement-breakpoint
CREATE INDEX `payments_shortcode_idx` ON `payments` (`shortcode_id`);