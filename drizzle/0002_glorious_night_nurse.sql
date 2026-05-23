CREATE TABLE `qb_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`realmId` varchar(64) NOT NULL,
	`accessToken` text,
	`refreshToken` text NOT NULL,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `qb_settings_id` PRIMARY KEY(`id`)
);
