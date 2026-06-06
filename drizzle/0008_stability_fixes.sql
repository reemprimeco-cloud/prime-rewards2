-- Migration: 0008_stability_fixes
-- Purpose: Add database-level duplicate protection and improve status tracking
-- Date: 2026-06-06

-- ─── Fix 1: QB Invoice Duplicate Protection ──────────────────────────────────
-- Add UNIQUE constraint on qbInvoiceId to prevent duplicate processing at DB level
ALTER TABLE qb_payment_syncs ADD CONSTRAINT uk_qb_payment_syncs_qbInvoiceId UNIQUE (qbInvoiceId);

-- ─── Fix 2: Pending Rewards Duplicate Protection ───────────────────────────
-- Add UNIQUE constraint on (phone, invoiceNumber) to prevent duplicate pending rewards
ALTER TABLE pending_rewards ADD CONSTRAINT uk_pending_rewards_phone_invoice UNIQUE (phone, invoiceNumber);

-- ─── Fix 3: Twilio Status Tracking Enhancement ────────────────────────────
-- Expand whatsapp_logs status enum to include all Twilio statuses
ALTER TABLE whatsapp_logs MODIFY COLUMN status ENUM('sent', 'failed', 'pending', 'retrying', 'queued', 'delivered', 'read', 'undelivered') DEFAULT 'pending' NOT NULL;

-- ─── Fix 4: Add index for faster lookups ──────────────────────────────────
-- Speed up customer lookups by phone
CREATE INDEX idx_customers_phone ON customers(phone);

-- Speed up WhatsApp log lookups by messageSid (already has unique constraint, but explicit index helps)
CREATE INDEX idx_whatsapp_logs_messageSid ON whatsapp_logs(messageSid);

-- Speed up QB payment syncs lookups by qbInvoiceId (now unique, but index helps)
CREATE INDEX idx_qb_payment_syncs_qbInvoiceId ON qb_payment_syncs(qbInvoiceId);
