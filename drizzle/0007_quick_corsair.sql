ALTER TABLE `whatsapp_logs` MODIFY COLUMN `status` enum('sent','failed','pending','retrying','delivered','read') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `whatsapp_logs` ADD `deliveredAt` timestamp;--> statement-breakpoint
ALTER TABLE `whatsapp_logs` ADD `twilioResponse` text;--> statement-breakpoint
ALTER TABLE `whatsapp_logs` ADD CONSTRAINT `whatsapp_logs_messageSid_unique` UNIQUE(`messageSid`);