CREATE TABLE `account_favorites` (
	`account_key` text NOT NULL,
	`product_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`account_key`, `product_id`)
);
--> statement-breakpoint
CREATE TABLE `product_details` (
	`product_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `account_security` (
	`key` text PRIMARY KEY NOT NULL,
	`password_hash` text,
	`recovery_hash` text,
	`base_hash` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `store_content` (
	`id` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
