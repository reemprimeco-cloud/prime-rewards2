-- Migration: QB pipeline tables
-- Run once against the production database before deploying the code patch.
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS `qb_payment_syncs` (
  `id`               int          AUTO_INCREMENT NOT NULL,
  `qbInvoiceId`      varchar(64)  NOT NULL,
  `invoiceNumber`    varchar(64),
  `customerPhone`    varchar(32),
  `customerName`     varchar(255),
  `amount`           varchar(32),
  `pointsCalculated` int          DEFAULT 0,
  `status`           enum('pending','success','failed','duplicate') NOT NULL DEFAULT 'pending',
  `customerId`       int,
  `errorMessage`     text,
  `processedAt`      timestamp    NULL,
  `createdAt`        timestamp    NOT NULL DEFAULT (now()),
  CONSTRAINT `qb_payment_syncs_id` PRIMARY KEY (`id`),
  CONSTRAINT `qb_payment_syncs_qbInvoiceId_unique` UNIQUE (`qbInvoiceId`)
);

CREATE TABLE IF NOT EXISTS `whatsapp_logs` (
  `id`           int         AUTO_INCREMENT NOT NULL,
  `customerId`   int,
  `phone`        varchar(32) NOT NULL,
  `messageType`  varchar(64) NOT NULL,
  `messageBody`  text,
  `status`       enum('pending','sent','failed','retrying') NOT NULL DEFAULT 'pending',
  `messageSid`   varchar(64),
  `errorMessage` text,
  `retryCount`   int         NOT NULL DEFAULT 0,
  `createdAt`    timestamp   NOT NULL DEFAULT (now()),
  CONSTRAINT `whatsapp_logs_id` PRIMARY KEY (`id`)
);
