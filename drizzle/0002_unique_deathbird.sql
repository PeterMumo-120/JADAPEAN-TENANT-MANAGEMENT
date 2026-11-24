CREATE TABLE `payer_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`shortcode_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`payer_name` text,
	`masked_msisdn` text,
	`confirmed_count` integer DEFAULT 0 NOT NULL,
	`blocked` integer DEFAULT false NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`shortcode_id`) REFERENCES `shortcodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payer_alias_uq` ON `payer_aliases` (`shortcode_id`,`tenant_id`,`fingerprint`);--> statement-breakpoint
CREATE INDEX `payer_alias_lookup_idx` ON `payer_aliases` (`shortcode_id`,`fingerprint`);--> statement-breakpoint
ALTER TABLE `payments` ADD `match_method` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `match_reason` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `auto_tried` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shortcodes` ADD `match_mode` text DEFAULT 'strict' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `also_pays_from` text;