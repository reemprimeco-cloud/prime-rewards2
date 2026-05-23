import { and, desc, eq, gte, lt, lte, ne, or, sql, count, sum } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  customers,
  invoices,
  pointTransactions,
  rewards,
  redemptions,
  campaigns,
  badges,
  customerBadges,
  spinResults,
  notifications,
  fraudFlags,
  type Customer,
  type InsertCustomer,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ─────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Customers ─────────────────────────────────────────────────────────────────
export async function getCustomerByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.userId, userId)).limit(1);
  return result[0];
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result[0];
}

export async function createCustomer(data: InsertCustomer) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(customers).values(data);
  const result = await db.select().from(customers).where(eq(customers.userId, data.userId!)).limit(1);
  return result[0];
}

export async function updateCustomer(id: number, data: Partial<Customer>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function getAllCustomers(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ customer: customers, user: users })
    .from(customers)
    .leftJoin(users, eq(customers.userId, users.id))
    .orderBy(desc(customers.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getTotalCustomerCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: count() }).from(customers);
  return result[0]?.count ?? 0;
}

// ─── Tier Calculation ──────────────────────────────────────────────────────────
export function calculateTier(lifetimePoints: number): "Bronze" | "Silver" | "Gold" | "Platinum" {
  if (lifetimePoints >= 5000) return "Platinum";
  if (lifetimePoints >= 2000) return "Gold";
  if (lifetimePoints >= 500) return "Silver";
  return "Bronze";
}

export function getTierThresholds() {
  return { Bronze: 0, Silver: 500, Gold: 2000, Platinum: 5000 };
}

// ─── Points & Transactions ─────────────────────────────────────────────────────
export async function addPoints(
  customerId: number,
  points: number,
  type: "earn" | "redeem" | "expire" | "bonus" | "manual" | "referral",
  description: string,
  referenceId?: number,
  referenceType?: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  await db.insert(pointTransactions).values({
    customerId,
    points,
    type,
    description,
    referenceId,
    referenceType,
  });

  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error("Customer not found");

  const newTotal = Math.max(0, customer.totalPoints + points);
  const newLifetime = points > 0 ? customer.lifetimePoints + points : customer.lifetimePoints;
  const newTier = calculateTier(newLifetime);

  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 6);

  await db
    .update(customers)
    .set({
      totalPoints: newTotal,
      lifetimePoints: newLifetime,
      tier: newTier,
      lastActivityAt: new Date(),
      pointsExpiryDate: expiryDate,
    })
    .where(eq(customers.id, customerId));

  return { newTotal, newTier, tierChanged: newTier !== customer.tier };
}

export async function getTransactionHistory(customerId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(pointTransactions)
    .where(eq(pointTransactions.customerId, customerId))
    .orderBy(desc(pointTransactions.createdAt))
    .limit(limit);
}

// ─── Invoices ──────────────────────────────────────────────────────────────────
export async function submitInvoice(data: {
  customerId: number;
  invoiceNumber: string;
  invoiceAmount: number;
  campaignId?: number;
  source?: "manual" | "quickbooks" | "woocommerce";
  pendingReview?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Duplicate check
  const existing = await db
    .select()
    .from(invoices)
    .where(eq(invoices.invoiceNumber, data.invoiceNumber))
    .limit(1);
  if (existing.length > 0) {
    throw new Error("DUPLICATE_INVOICE");
  }

  // Rate limiting: max 5 invoices per day per customer
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const todayCount = await db
    .select({ count: count() })
    .from(invoices)
    .where(and(eq(invoices.customerId, data.customerId), gte(invoices.submittedAt, dayStart)));
  if ((todayCount[0]?.count ?? 0) >= 5) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }

  // Find active campaign
  const now = new Date();
  let multiplier = 1;
  let campaignId = data.campaignId;
  if (!campaignId) {
    const activeCampaign = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.isActive, true),
          lte(campaigns.startDate, now),
          gte(campaigns.endDate, now)
        )
      )
      .limit(1);
    if (activeCampaign[0]) {
      campaignId = activeCampaign[0].id;
      multiplier = activeCampaign[0].multiplier;
    }
  }

  // Points: 1 point per 10 currency units
  const basePoints = Math.floor(data.invoiceAmount / 10);
  const pointsEarned = Math.floor(basePoints * multiplier);

  await db.insert(invoices).values({
    customerId: data.customerId,
    invoiceNumber: data.invoiceNumber,
    invoiceAmount: String(data.invoiceAmount),
    pointsEarned,
    // Unpaid/partial invoices go to admin review queue; paid invoices are auto-approved
    // Both use "pending" status (admin reviews all invoices before awarding points)
    status: "pending",
    campaignId,
    multiplierApplied: multiplier,
    source: data.source ?? "manual",
  });

  const result = await db
    .select()
    .from(invoices)
    .where(eq(invoices.invoiceNumber, data.invoiceNumber))
    .limit(1);
  return result[0];
}

export async function getInvoicesByCustomer(customerId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(invoices)
    .where(eq(invoices.customerId, customerId))
    .orderBy(desc(invoices.submittedAt))
    .limit(limit);
}

export async function getAllInvoices(status?: string, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  const query = db
    .select({ invoice: invoices, customer: customers })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .orderBy(desc(invoices.submittedAt))
    .limit(limit)
    .offset(offset);
  return query;
}

export async function reviewInvoice(
  invoiceId: number,
  status: "approved" | "rejected" | "flagged",
  reviewedBy: number,
  rejectionReason?: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const invoice = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!invoice[0]) throw new Error("Invoice not found");

  await db
    .update(invoices)
    .set({ status, reviewedAt: new Date(), reviewedBy, rejectionReason })
    .where(eq(invoices.id, invoiceId));

  if (status === "approved") {
    const result = await addPoints(
      invoice[0].customerId,
      invoice[0].pointsEarned,
      "earn",
      `Invoice #${invoice[0].invoiceNumber} approved`,
      invoiceId,
      "invoice"
    );

    await createNotification(invoice[0].customerId, "points_added", "Points Added!", `${invoice[0].pointsEarned} points have been added to your account for invoice #${invoice[0].invoiceNumber}.`);

    // Check and award badges
    await checkAndAwardBadges(invoice[0].customerId);

    return result;
  }

  return null;
}

// ─── Rewards ───────────────────────────────────────────────────────────────────
export async function getActiveRewards() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db
    .select()
    .from(rewards)
    .where(
      and(
        eq(rewards.isActive, true),
        or(sql`${rewards.expirationDate} IS NULL`, gte(rewards.expirationDate, now))
      )
    )
    .orderBy(rewards.requiredPoints);
}

export async function redeemReward(customerId: number, rewardId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error("Customer not found");

  const reward = await db.select().from(rewards).where(eq(rewards.id, rewardId)).limit(1);
  if (!reward[0] || !reward[0].isActive) throw new Error("Reward not available");
  if (customer.totalPoints < reward[0].requiredPoints) throw new Error("INSUFFICIENT_POINTS");

  const couponCode = `PRM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  await db.insert(redemptions).values({
    customerId,
    rewardId,
    pointsSpent: reward[0].requiredPoints,
    couponCode,
  });

  await addPoints(customerId, -reward[0].requiredPoints, "redeem", `Redeemed: ${reward[0].name}`, rewardId, "reward");
  await createNotification(customerId, "reward_redeemed", "Reward Redeemed!", `You've successfully redeemed "${reward[0].name}". Your coupon code is: ${couponCode}`);

  return { couponCode, reward: reward[0] };
}

export async function getRedemptionsByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ redemption: redemptions, reward: rewards })
    .from(redemptions)
    .leftJoin(rewards, eq(redemptions.rewardId, rewards.id))
    .where(eq(redemptions.customerId, customerId))
    .orderBy(desc(redemptions.redeemedAt));
}

// ─── Campaigns ─────────────────────────────────────────────────────────────────
export async function getActiveCampaigns() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db
    .select()
    .from(campaigns)
    .where(
      and(eq(campaigns.isActive, true), lte(campaigns.startDate, now), gte(campaigns.endDate, now))
    )
    .orderBy(desc(campaigns.startDate));
}

export async function getAllCampaigns() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
}

// ─── Badges ────────────────────────────────────────────────────────────────────
export async function getAllBadges() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(badges).where(eq(badges.isActive, true));
}

export async function getCustomerBadges(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ customerBadge: customerBadges, badge: badges })
    .from(customerBadges)
    .leftJoin(badges, eq(customerBadges.badgeId, badges.id))
    .where(eq(customerBadges.customerId, customerId))
    .orderBy(desc(customerBadges.awardedAt));
}

export async function checkAndAwardBadges(customerId: number) {
  const db = await getDb();
  if (!db) return;

  const customer = await getCustomerById(customerId);
  if (!customer) return;

  const allBadges = await getAllBadges();
  const existingBadges = await db
    .select()
    .from(customerBadges)
    .where(eq(customerBadges.customerId, customerId));
  const earnedBadgeIds = new Set(existingBadges.map((b) => b.badgeId));

  const orderCount = await db
    .select({ count: count() })
    .from(invoices)
    .where(and(eq(invoices.customerId, customerId), eq(invoices.status, "approved")));
  const approvedOrders = orderCount[0]?.count ?? 0;

  for (const badge of allBadges) {
    if (earnedBadgeIds.has(badge.id)) continue;

    let shouldAward = false;
    if (badge.requirementType === "order_count" && approvedOrders >= (badge.requirementValue ?? 0)) {
      shouldAward = true;
    } else if (badge.requirementType === "points_total" && customer.lifetimePoints >= (badge.requirementValue ?? 0)) {
      shouldAward = true;
    } else if (badge.requirementType === "tier_reached") {
      const tierOrder = { Bronze: 0, Silver: 1, Gold: 2, Platinum: 3 };
      const requiredTierOrder = badge.requirementValue ?? 0;
      if (tierOrder[customer.tier] >= requiredTierOrder) shouldAward = true;
    }

    if (shouldAward) {
      await db.insert(customerBadges).values({ customerId, badgeId: badge.id });
      await createNotification(customerId, "badge_earned", `Badge Earned: ${badge.name}!`, badge.description ?? `You've earned the ${badge.name} badge!`);
    }
  }
}

// ─── Spin Wheel ────────────────────────────────────────────────────────────────
export async function canSpinToday(customerId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const result = await db
    .select({ count: count() })
    .from(spinResults)
    .where(and(eq(spinResults.customerId, customerId), gte(spinResults.spunAt, dayStart)));
  return (result[0]?.count ?? 0) === 0;
}

export async function performSpin(customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const eligible = await canSpinToday(customerId);
  if (!eligible) throw new Error("ALREADY_SPUN_TODAY");

  const segments: Array<{ rewardType: "points" | "discount" | "free_delivery" | "free_design" | "double_points" | "no_win"; value: number; description: string; weight: number }> = [
    { rewardType: "points", value: 50, description: "50 Bonus Points!", weight: 25 },
    { rewardType: "points", value: 100, description: "100 Bonus Points!", weight: 15 },
    { rewardType: "points", value: 200, description: "200 Bonus Points!", weight: 8 },
    { rewardType: "discount", value: 10, description: "10% Discount Coupon", weight: 15 },
    { rewardType: "discount", value: 20, description: "20% Discount Coupon", weight: 8 },
    { rewardType: "free_delivery", value: 1, description: "Free Delivery!", weight: 10 },
    { rewardType: "free_design", value: 1, description: "Free Design Service!", weight: 7 },
    { rewardType: "double_points", value: 1, description: "Double Points on Next Order!", weight: 7 },
    { rewardType: "no_win", value: 0, description: "Better luck next time!", weight: 5 },
  ];

  const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;
  let chosen = segments[segments.length - 1];
  for (const segment of segments) {
    random -= segment.weight;
    if (random <= 0) { chosen = segment; break; }
  }

  await db.insert(spinResults).values({
    customerId,
    rewardType: chosen.rewardType,
    rewardValue: chosen.value,
    description: chosen.description,
  });

  if (chosen.rewardType === "points" && chosen.value > 0) {
    await addPoints(customerId, chosen.value, "bonus", `Spin & Win: ${chosen.description}`, undefined, "spin");
  }

  await createNotification(customerId, "spin_result", "Spin & Win Result!", `You won: ${chosen.description}`);

  const segmentIndex = segments.findIndex(s => s === chosen);
  return { ...chosen, segmentIndex };
}

// ─── Notifications ─────────────────────────────────────────────────────────────
export async function createNotification(
  customerId: number,
  type: "points_added" | "reward_redeemed" | "tier_upgraded" | "promotion" | "expiry_warning" | "badge_earned" | "spin_result",
  title: string,
  message: string
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values({ customerId, type, title, message });
}

export async function getNotifications(customerId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.customerId, customerId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markNotificationsRead(customerId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.customerId, customerId));
}

// ─── Fraud ─────────────────────────────────────────────────────────────────────
export async function getFraudFlags(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return db
      .select({ flag: fraudFlags, customer: customers })
      .from(fraudFlags)
      .leftJoin(customers, eq(fraudFlags.customerId, customers.id))
      .where(eq(fraudFlags.status, status as "open" | "reviewed" | "dismissed"))
      .orderBy(desc(fraudFlags.createdAt))
      .limit(200);
  }
  return db
    .select({ flag: fraudFlags, customer: customers })
    .from(fraudFlags)
    .leftJoin(customers, eq(fraudFlags.customerId, customers.id))
    .orderBy(desc(fraudFlags.createdAt))
    .limit(200);
}

export async function createFraudFlag(data: {
  customerId: number;
  invoiceId?: number;
  reason: "duplicate_invoice" | "excessive_submissions" | "suspicious_amount" | "manual_flag";
  details?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(fraudFlags).values(data);
}

export async function reviewFraudFlag(flagId: number, status: "reviewed" | "dismissed", reviewedBy: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(fraudFlags).set({ status, reviewedBy, reviewedAt: new Date() }).where(eq(fraudFlags.id, flagId));
}

// ─── Analytics ─────────────────────────────────────────────────────────────────
export async function getAdminAnalytics() {
  const db = await getDb();
  if (!db) return null;

  const [totalCustomers, totalRedemptions, totalInvoices, pendingInvoices, openFraudFlags] =
    await Promise.all([
      db.select({ count: count() }).from(customers),
      db.select({ count: count() }).from(redemptions),
      db.select({ count: count() }).from(invoices).where(eq(invoices.status, "approved")),
      db.select({ count: count() }).from(invoices).where(eq(invoices.status, "pending")),
      db.select({ count: count() }).from(fraudFlags).where(eq(fraudFlags.status, "open")),
    ]);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const activeCustomers = await db
    .select({ count: count() })
    .from(customers)
    .where(gte(customers.lastActivityAt, thirtyDaysAgo));

  const tierCounts = await db
    .select({ tier: customers.tier, count: count() })
    .from(customers)
    .groupBy(customers.tier);

  return {
    totalCustomers: totalCustomers[0]?.count ?? 0,
    activeCustomers: activeCustomers[0]?.count ?? 0,
    totalRedemptions: totalRedemptions[0]?.count ?? 0,
    approvedInvoices: totalInvoices[0]?.count ?? 0,
    pendingInvoices: pendingInvoices[0]?.count ?? 0,
    openFraudFlags: openFraudFlags[0]?.count ?? 0,
    tierCounts,
  };
}

// ─── Seed default badges ───────────────────────────────────────────────────────
export async function seedDefaultBadges() {
  const db = await getDb();
  if (!db) return;

  const defaultBadges = [
    { name: "First Order", description: "Submitted your first invoice!", icon: "Star", color: "#FFD700", requirementType: "order_count" as const, requirementValue: 1 },
    { name: "Loyal Customer", description: "Completed 10 approved orders.", icon: "Heart", color: "#E91E63", requirementType: "order_count" as const, requirementValue: 10 },
    { name: "Big Spender", description: "Earned 1,000 lifetime points.", icon: "Trophy", color: "#FF9800", requirementType: "points_total" as const, requirementValue: 1000 },
    { name: "5 Orders Completed", description: "Completed 5 approved orders.", icon: "CheckCircle", color: "#4CAF50", requirementType: "order_count" as const, requirementValue: 5 },
    { name: "VIP Customer", description: "Reached Gold tier or above.", icon: "Crown", color: "#9C27B0", requirementType: "tier_reached" as const, requirementValue: 2 },
    { name: "UV DTF Expert", description: "Earned 2,000 lifetime points.", icon: "Zap", color: "#2196F3", requirementType: "points_total" as const, requirementValue: 2000 },
    { name: "Top Customer", description: "Reached Platinum tier.", icon: "Award", color: "#1B2A5E", requirementType: "tier_reached" as const, requirementValue: 3 },
  ];

  for (const badge of defaultBadges) {
    try {
      await db.insert(badges).values(badge).onDuplicateKeyUpdate({ set: { description: badge.description } });
    } catch {}
  }
}

// ─── Seed default rewards ──────────────────────────────────────────────────────
export async function seedDefaultRewards() {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select({ count: count() }).from(rewards);
  if ((existing[0]?.count ?? 0) > 0) return;

  const defaultRewards = [
    { name: "10% Discount Coupon", description: "Get 10% off your next printing order.", requiredPoints: 100, rewardType: "discount" as const, discountValue: "10.00" },
    { name: "20% Discount Coupon", description: "Get 20% off your next printing order.", requiredPoints: 200, rewardType: "discount" as const, discountValue: "20.00" },
    { name: "Free Delivery", description: "Free delivery on your next order.", requiredPoints: 150, rewardType: "free_delivery" as const },
    { name: "Free Design Service", description: "One free design service for your order.", requiredPoints: 300, rewardType: "free_design" as const },
    { name: "Double Points Voucher", description: "Earn double points on your next invoice.", requiredPoints: 250, rewardType: "double_points" as const },
    { name: "Premium Print Package", description: "A premium printing package worth 500 AED.", requiredPoints: 500, rewardType: "free_service" as const },
  ];

  for (const reward of defaultRewards) {
    await db.insert(rewards).values(reward as any);
  }
}
