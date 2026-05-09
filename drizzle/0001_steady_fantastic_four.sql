CREATE TABLE `badges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`icon` varchar(64),
	`color` varchar(16),
	`requirementType` enum('order_count','points_total','tier_reached','referral_count','manual') NOT NULL,
	`requirementValue` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `badges_id` PRIMARY KEY(`id`),
	CONSTRAINT `badges_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`multiplier` float NOT NULL DEFAULT 1,
	`bonusPoints` int DEFAULT 0,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_badges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`badgeId` int NOT NULL,
	`awardedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_badges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`phone` varchar(32),
	`businessName` varchar(255),
	`totalPoints` int NOT NULL DEFAULT 0,
	`lifetimePoints` int NOT NULL DEFAULT 0,
	`tier` enum('Bronze','Silver','Gold','Platinum') NOT NULL DEFAULT 'Bronze',
	`referralCode` varchar(16),
	`referredBy` int,
	`pointsExpiryDate` timestamp,
	`lastActivityAt` timestamp DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `customers_referralCode_unique` UNIQUE(`referralCode`)
);
--> statement-breakpoint
CREATE TABLE `fraud_flags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`invoiceId` int,
	`reason` enum('duplicate_invoice','excessive_submissions','suspicious_amount','manual_flag') NOT NULL,
	`details` text,
	`status` enum('open','reviewed','dismissed') NOT NULL DEFAULT 'open',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fraud_flags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`invoiceNumber` varchar(64) NOT NULL,
	`invoiceAmount` decimal(10,2) NOT NULL,
	`pointsEarned` int NOT NULL DEFAULT 0,
	`status` enum('pending','approved','rejected','flagged') NOT NULL DEFAULT 'pending',
	`rejectionReason` text,
	`campaignId` int,
	`multiplierApplied` float NOT NULL DEFAULT 1,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	`reviewedBy` int,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`type` enum('points_added','reward_redeemed','tier_upgraded','promotion','expiry_warning','badge_earned','spin_result') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `point_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`points` int NOT NULL,
	`type` enum('earn','redeem','expire','bonus','manual','referral') NOT NULL,
	`description` text,
	`referenceId` int,
	`referenceType` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `point_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`rewardId` int NOT NULL,
	`pointsSpent` int NOT NULL,
	`status` enum('active','used','expired') NOT NULL DEFAULT 'active',
	`couponCode` varchar(32),
	`redeemedAt` timestamp NOT NULL DEFAULT (now()),
	`usedAt` timestamp,
	CONSTRAINT `redemptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`requiredPoints` int NOT NULL,
	`rewardType` enum('discount','free_service','merchandise','free_delivery','free_design','double_points') NOT NULL,
	`discountValue` decimal(10,2),
	`stock` int,
	`expirationDate` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`imageUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rewards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spin_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`rewardType` enum('points','discount','free_delivery','free_design','double_points','no_win') NOT NULL,
	`rewardValue` int DEFAULT 0,
	`description` varchar(255),
	`spunAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spin_results_id` PRIMARY KEY(`id`)
);
