import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  bigint,
  float,
} from "drizzle-orm/mysql-core";

// ─── Core Auth User ────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Customer Profiles ─────────────────────────────────────────────────────────
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  businessName: varchar("businessName", { length: 255 }),
  totalPoints: int("totalPoints").default(0).notNull(),
  lifetimePoints: int("lifetimePoints").default(0).notNull(),
  tier: mysqlEnum("tier", ["Bronze", "Silver", "Gold", "Platinum"]).default("Bronze").notNull(),
  referralCode: varchar("referralCode", { length: 16 }).unique(),
  referredBy: int("referredBy"),
  pointsExpiryDate: timestamp("pointsExpiryDate"),
  lastActivityAt: timestamp("lastActivityAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ─── Invoices ──────────────────────────────────────────────────────────────────
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 64 }).notNull(),
  invoiceAmount: decimal("invoiceAmount", { precision: 10, scale: 2 }).notNull(),
  pointsEarned: int("pointsEarned").default(0).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "flagged"]).default("pending").notNull(),
  rejectionReason: text("rejectionReason"),
  campaignId: int("campaignId"),
  multiplierApplied: float("multiplierApplied").default(1).notNull(),
  source: mysqlEnum("source", ["manual", "quickbooks", "woocommerce"]).default("manual").notNull(),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: int("reviewedBy"),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ─── Point Transactions ────────────────────────────────────────────────────────
export const pointTransactions = mysqlTable("point_transactions", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  points: int("points").notNull(), // positive = earn, negative = spend/expire
  type: mysqlEnum("type", ["earn", "redeem", "expire", "bonus", "manual", "referral"]).notNull(),
  description: text("description"),
  referenceId: int("referenceId"), // invoiceId or redemptionId
  referenceType: varchar("referenceType", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PointTransaction = typeof pointTransactions.$inferSelect;

// ─── Rewards ───────────────────────────────────────────────────────────────────
export const rewards = mysqlTable("rewards", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  requiredPoints: int("requiredPoints").notNull(),
  rewardType: mysqlEnum("rewardType", ["discount", "free_service", "merchandise", "free_delivery", "free_design", "double_points"]).notNull(),
  discountValue: decimal("discountValue", { precision: 10, scale: 2 }),
  stock: int("stock"), // null = unlimited
  expirationDate: timestamp("expirationDate"),
  isActive: boolean("isActive").default(true).notNull(),
  imageUrl: text("imageUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Reward = typeof rewards.$inferSelect;
export type InsertReward = typeof rewards.$inferInsert;

// ─── Redemptions ───────────────────────────────────────────────────────────────
export const redemptions = mysqlTable("redemptions", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  rewardId: int("rewardId").notNull(),
  pointsSpent: int("pointsSpent").notNull(),
  status: mysqlEnum("status", ["active", "used", "expired"]).default("active").notNull(),
  couponCode: varchar("couponCode", { length: 32 }),
  redeemedAt: timestamp("redeemedAt").defaultNow().notNull(),
  usedAt: timestamp("usedAt"),
});

export type Redemption = typeof redemptions.$inferSelect;

// ─── Campaigns ─────────────────────────────────────────────────────────────────
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  multiplier: float("multiplier").default(1).notNull(),
  bonusPoints: int("bonusPoints").default(0),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// ─── Badges / Achievements ─────────────────────────────────────────────────────
export const badges = mysqlTable("badges", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  description: text("description"),
  icon: varchar("icon", { length: 64 }), // lucide icon name
  color: varchar("color", { length: 16 }),
  requirementType: mysqlEnum("requirementType", ["order_count", "points_total", "tier_reached", "referral_count", "manual"]).notNull(),
  requirementValue: int("requirementValue").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Badge = typeof badges.$inferSelect;

export const customerBadges = mysqlTable("customer_badges", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  badgeId: int("badgeId").notNull(),
  awardedAt: timestamp("awardedAt").defaultNow().notNull(),
});

export type CustomerBadge = typeof customerBadges.$inferSelect;

// ─── Spin Wheel ────────────────────────────────────────────────────────────────
export const spinResults = mysqlTable("spin_results", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  rewardType: mysqlEnum("rewardType", ["points", "discount", "free_delivery", "free_design", "double_points", "no_win"]).notNull(),
  rewardValue: int("rewardValue").default(0),
  description: varchar("description", { length: 255 }),
  spunAt: timestamp("spunAt").defaultNow().notNull(),
});

export type SpinResult = typeof spinResults.$inferSelect;

// ─── Notifications ─────────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  type: mysqlEnum("type", ["points_added", "reward_redeemed", "tier_upgraded", "promotion", "expiry_warning", "badge_earned", "spin_result"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// ─── Fraud Flags ───────────────────────────────────────────────────────────────
export const fraudFlags = mysqlTable("fraud_flags", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  invoiceId: int("invoiceId"),
  reason: mysqlEnum("reason", ["duplicate_invoice", "excessive_submissions", "suspicious_amount", "manual_flag"]).notNull(),
  details: text("details"),
  status: mysqlEnum("status", ["open", "reviewed", "dismissed"]).default("open").notNull(),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FraudFlag = typeof fraudFlags.$inferSelect;

// ─── QuickBooks Settings ───────────────────────────────────────────────────────
export const qbSettings = mysqlTable("qb_settings", {
  id: int("id").autoincrement().primaryKey(),
  realmId: varchar("realmId", { length: 64 }).notNull().unique(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken").notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QBSettings = typeof qbSettings.$inferSelect;

// ─── WhatsApp Logs ─────────────────────────────────────────────────────────────
export const whatsappLogs = mysqlTable("whatsapp_logs", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId"),
  phone: varchar("phone", { length: 32 }).notNull(),
  messageType: mysqlEnum("messageType", ["points_awarded", "welcome", "tier_upgrade", "reward_redeemed", "expiry_warning", "spin_win", "manual"]).notNull(),
  messageBody: text("messageBody").notNull(),
  status: mysqlEnum("status", ["sent", "failed", "pending", "retrying"]).default("pending").notNull(),
  messageSid: varchar("messageSid", { length: 64 }),
  errorMessage: text("errorMessage"),
  retryCount: int("retryCount").default(0).notNull(),
  invoiceId: int("invoiceId"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WhatsappLog = typeof whatsappLogs.$inferSelect;
export type InsertWhatsappLog = typeof whatsappLogs.$inferInsert;

// ─── Failed Attempts ───────────────────────────────────────────────────────────
export const failedAttempts = mysqlTable("failed_attempts", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  attemptType: mysqlEnum("attemptType", ["invoice_not_found", "duplicate_invoice", "amount_mismatch", "phone_mismatch", "rate_limit"]).notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 64 }),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FailedAttempt = typeof failedAttempts.$inferSelect;
export type InsertFailedAttempt = typeof failedAttempts.$inferInsert;

// ─── Suspicious Accounts ──────────────────────────────────────────────────────
export const suspiciousAccounts = mysqlTable("suspicious_accounts", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().unique(),
  reason: text("reason").notNull(),
  failedAttemptCount: int("failedAttemptCount").default(0).notNull(),
  isBlocked: boolean("isBlocked").default(false).notNull(),
  blockedAt: timestamp("blockedAt"),
  blockedBy: int("blockedBy"),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: int("reviewedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SuspiciousAccount = typeof suspiciousAccounts.$inferSelect;
export type InsertSuspiciousAccount = typeof suspiciousAccounts.$inferInsert;

// ─── Pending Customers ─────────────────────────────────────────────────────────
export const pendingCustomers = mysqlTable("pending_customers", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 32 }).notNull().unique(),
  fullName: varchar("fullName", { length: 255 }),
  pendingPoints: int("pendingPoints").default(0).notNull(),
  invoiceNumbers: text("invoiceNumbers"), // JSON array of invoice numbers
  mergedToCustomerId: int("mergedToCustomerId"),
  mergedAt: timestamp("mergedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PendingCustomer = typeof pendingCustomers.$inferSelect;
export type InsertPendingCustomer = typeof pendingCustomers.$inferInsert;

// ─── Invoice Registry (Admin-managed source of truth) ─────────────────────────
// Admins add real invoices here. The auto-approval engine matches submitted
// invoices against this table using invoiceNumber + customerPhone.
export const invoiceRegistry = mysqlTable("invoice_registry", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNumber: varchar("invoiceNumber", { length: 64 }).notNull().unique(),
  customerPhone: varchar("customerPhone", { length: 32 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  invoiceDate: timestamp("invoiceDate"),
  customerName: varchar("customerName", { length: 255 }),
  notes: text("notes"),
  isUsed: boolean("isUsed").default(false).notNull(),
  usedAt: timestamp("usedAt"),
  usedByInvoiceId: int("usedByInvoiceId"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type InvoiceRegistry = typeof invoiceRegistry.$inferSelect;
export type InsertInvoiceRegistry = typeof invoiceRegistry.$inferInsert;


// ─── WhatsApp Messages (Twilio delivery tracking) ────────────────────────────
export const whatsappMessages = mysqlTable("whatsapp_messages", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  customerId: int("customerId").notNull(),
  customerPhone: varchar("customerPhone", { length: 32 }).notNull(),
  messageType: varchar("messageType", { length: 64 }).notNull(), // "invoice_approved"
  templateSid: varchar("templateSid", { length: 255 }),
  twilio_sid: varchar("twilio_sid", { length: 255 }), // Twilio message SID
  status: mysqlEnum("status", ["pending", "sent", "delivered", "failed", "retrying"]).default("pending").notNull(),
  retryCount: int("retryCount").default(0).notNull(),
  maxRetries: int("maxRetries").default(3).notNull(),
  errorMessage: text("errorMessage"),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = typeof whatsappMessages.$inferInsert;
