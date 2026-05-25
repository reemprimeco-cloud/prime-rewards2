CREATE TABLE `failed_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int,
	`ipAddress` varchar(64),
	`attemptType` enum('invoice_not_found','duplicate_invoice','amount_mismatch','phone_mismatch','rate_limit') NOT NULL,
	`invoiceNumber` varchar(64),
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `failed_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoice_registry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceNumber` varchar(64) NOT NULL,
	`customerPhone` varchar(32) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`invoiceDate` timestamp,
	`customerName` varchar(255),
	`notes` text,
	`isUsed` boolean NOT NULL DEFAULT false,
	`usedAt` timestamp,
	`usedByInvoiceId` int,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoice_registry_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoice_registry_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `pending_customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(32) NOT NULL,
	`fullName` varchar(255),
	`pendingPoints` int NOT NULL DEFAULT 0,
	`invoiceNumbers` text,
	`mergedToCustomerId` int,
	`mergedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pending_customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `pending_customers_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `suspicious_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`reason` text NOT NULL,
	`failedAttemptCount` int NOT NULL DEFAULT 0,
	`isBlocked` boolean NOT NULL DEFAULT false,
	`blockedAt` timestamp,
	`blockedBy` int,
	`reviewedAt` timestamp,
	`reviewedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suspicious_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `suspicious_accounts_customerId_unique` UNIQUE(`customerId`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int,
	`phone` varchar(32) NOT NULL,
	`messageType` enum('points_awarded','welcome','tier_upgrade','reward_redeemed','expiry_warning','spin_win','manual') NOT NULL,
	`messageBody` text NOT NULL,
	`status` enum('sent','failed','pending','retrying') NOT NULL DEFAULT 'pending',
	`messageSid` varchar(64),
	`errorMessage` text,
	`retryCount` int NOT NULL DEFAULT 0,
	`invoiceId` int,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`customerId` int NOT NULL,
	`customerPhone` varchar(32) NOT NULL,
	`messageType` varchar(64) NOT NULL,
	`templateSid` varchar(255),
	`twilio_sid` varchar(255),
	`status` enum('pending','sent','delivered','failed','retrying') NOT NULL DEFAULT 'pending',
	`retryCount` int NOT NULL DEFAULT 0,
	`maxRetries` int NOT NULL DEFAULT 3,
	`errorMessage` text,
	`sentAt` timestamp,
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_messages_id` PRIMARY KEY(`id`)
);
