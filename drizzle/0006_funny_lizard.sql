CREATE TABLE `pending_rewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(32) NOT NULL,
	`customerName` varchar(255),
	`invoiceNumber` varchar(64) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`pointsEarned` int NOT NULL,
	`message` text,
	`status` enum('pending','claimed','expired') NOT NULL DEFAULT 'pending',
	`customerId` int,
	`claimedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pending_rewards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `qb_payment_syncs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`qbInvoiceId` varchar(255) NOT NULL,
	`invoiceNumber` varchar(64) NOT NULL,
	`customerPhone` varchar(32) NOT NULL,
	`customerName` varchar(255),
	`amount` decimal(10,2) NOT NULL,
	`pointsCalculated` int NOT NULL,
	`status` enum('pending','success','failed','duplicate') NOT NULL DEFAULT 'pending',
	`customerId` int,
	`errorMessage` text,
	`webhookEventId` varchar(255),
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `qb_payment_syncs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `qb_webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(255) NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`realmId` varchar(255) NOT NULL,
	`payload` json,
	`processed` boolean NOT NULL DEFAULT false,
	`processedAt` timestamp,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `qb_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `qb_webhook_events_eventId_unique` UNIQUE(`eventId`)
);
