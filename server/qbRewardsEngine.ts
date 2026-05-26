import { getDb } from "./db";
import { customers, qbPaymentSyncs, pendingRewards } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { sendWhatsApp } from "./whatsapp";

const POINTS_PER_10_KD = 1;

/**
 * Normalize Kuwait phone number to whatsapp format: whatsapp:+965XXXXXXXX
 */
export function normalizeKuwaitPhone(phone: string): string | null {
  if (!phone) return null;
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");
  
  // Handle various formats
  let normalized = digits;
  
  // If starts with 965 (country code), keep as is
  if (digits.startsWith("965")) {
    normalized = digits;
  }
  // If starts with 00965, remove leading 00
  else if (digits.startsWith("00965")) {
    normalized = digits.slice(2);
  }
  // If 8 digits (local format), add 965
  else if (digits.length === 8) {
    normalized = "965" + digits;
  }
  // If 10 digits starting with 0, replace 0 with 965
  else if (digits.length === 10 && digits.startsWith("0")) {
    normalized = "965" + digits.slice(1);
  }
  
  // Validate: must be 11 digits (965 + 8 digits)
  if (normalized.length !== 11 || !normalized.startsWith("965")) {
    return null;
  }
  
  return `whatsapp:+${normalized}`;
}

/**
 * Calculate reward points: 1 point per 10 KD (floor division)
 */
export function calculatePoints(amountKD: number): number {
  return Math.floor(amountKD / 10);
}

/**
 * Process QB payment event: check for duplicates, calculate points, send WhatsApp
 */
export async function processQbPaymentEvent(eventData: {
  qbInvoiceId: string;
  invoiceNumber: string;
  customerPhone: string;
  customerName?: string;
  amount: number;
  webhookEventId?: string;
}) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    // Normalize phone
    const normalizedPhone = normalizeKuwaitPhone(eventData.customerPhone);
    if (!normalizedPhone) {
      console.error(`[QB Rewards] Invalid phone: ${eventData.customerPhone}`);
      return {
        status: "failed",
        error: "Invalid phone number format",
      };
    }

    // Check for duplicate: same QB invoice ID already processed
    const existing = await db
      .select()
      .from(qbPaymentSyncs)
      .where(eq(qbPaymentSyncs.qbInvoiceId, eventData.qbInvoiceId))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[QB Rewards] Duplicate QB invoice: ${eventData.qbInvoiceId}`);
      return {
        status: "duplicate",
        error: "QB invoice already processed",
      };
    }

    // Calculate points
    const pointsCalculated = calculatePoints(eventData.amount);

    // Check if customer exists
    const customerRecord = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, normalizedPhone))
      .limit(1);

    const customerId = customerRecord.length > 0 ? customerRecord[0].id : null;

    // Log the sync attempt
    const syncResult = await db.insert(qbPaymentSyncs).values({
      qbInvoiceId: eventData.qbInvoiceId,
      invoiceNumber: eventData.invoiceNumber,
      customerPhone: normalizedPhone,
      customerName: eventData.customerName,
      amount: eventData.amount.toString(),
      pointsCalculated,
      status: "pending",
      customerId,
      webhookEventId: eventData.webhookEventId,
    });

    const syncId = (syncResult as any).insertId || 1;

    if (customerId) {
      // Customer exists: auto-add points and send WhatsApp
      try {
        // Add points to customer
        const currentCustomer = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
        if (currentCustomer.length > 0) {
          const newTotal = (currentCustomer[0].totalPoints || 0) + pointsCalculated;
          await db.update(customers).set({ totalPoints: newTotal }).where(eq(customers.id, customerId));
        }

        // Send WhatsApp notification
        const message = `Prime Rewards 💙\n\n${pointsCalculated} points were added to your account from invoice #${eventData.invoiceNumber}\n\nView your rewards:\nhttps://primerewds.com`;
        
        await sendWhatsApp(normalizedPhone, message);

        // Mark sync as success
        await db
          .update(qbPaymentSyncs)
          .set({ status: "success", processedAt: new Date() })
          .where(eq(qbPaymentSyncs.id, syncId));

        console.log(`[QB Rewards] Points added to customer ${customerId}: ${pointsCalculated} pts`);
        return { status: "success", customerId, pointsAdded: pointsCalculated };
      } catch (error) {
        console.error(`[QB Rewards] Error adding points to customer ${customerId}:`, error);
        await db
          .update(qbPaymentSyncs)
          .set({
            status: "failed",
            errorMessage: String(error),
            processedAt: new Date(),
          })
          .where(eq(qbPaymentSyncs.id, syncId));
        return { status: "failed", error: String(error) };
      }
    } else {
      // Customer doesn't exist: create pending reward and send signup invitation
      try {
        // Create pending reward
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90); // 90 days expiry

        const pendingResult = await db.insert(pendingRewards).values({
          phone: normalizedPhone,
          customerName: eventData.customerName,
          invoiceNumber: eventData.invoiceNumber,
          amount: eventData.amount.toString(),
          pointsEarned: pointsCalculated,
          status: "pending",
          expiresAt,
        });

        // Send signup invitation WhatsApp
        const message = `Prime Rewards 💙\n\nYou earned ${pointsCalculated} points from your recent order.\n\nCreate your free account to view and redeem your rewards:\nhttps://primerewds.com`;

        await sendWhatsApp(normalizedPhone, message);

        // Mark sync as success
        await db
          .update(qbPaymentSyncs)
          .set({ status: "success", processedAt: new Date() })
          .where(eq(qbPaymentSyncs.id, syncId));

        console.log(`[QB Rewards] Pending reward created: ${pointsCalculated} pts for ${normalizedPhone}`);
        return {
          status: "success",
          pendingRewardId: (pendingResult as any).insertId || 1,
          pointsPending: pointsCalculated,
        };
      } catch (error) {
        console.error(`[QB Rewards] Error creating pending reward:`, error);
        await db
          .update(qbPaymentSyncs)
          .set({
            status: "failed",
            errorMessage: String(error),
            processedAt: new Date(),
          })
          .where(eq(qbPaymentSyncs.id, syncId));
        return { status: "failed", error: String(error) };
      }
    }
  } catch (error) {
    console.error(`[QB Rewards] Unexpected error:`, error);
    return { status: "failed", error: String(error) };
  }
}

/**
 * Claim pending rewards when customer signs up
 */
export async function claimPendingRewards(customerId: number, phone: string) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const normalizedPhone = normalizeKuwaitPhone(phone);
    if (!normalizedPhone) return;

    // Find all pending rewards for this phone
    const pendingList = await db
      .select()
      .from(pendingRewards)
      .where(
        and(
          eq(pendingRewards.phone, normalizedPhone),
          eq(pendingRewards.status, "pending")
        )
      );

    if (pendingList.length === 0) return;

    let totalPointsClaimed = 0;

    for (const pending of pendingList) {
      // Add points to customer
      totalPointsClaimed += pending.pointsEarned;

      // Mark as claimed
      await db
        .update(pendingRewards)
        .set({
          status: "claimed",
          customerId,
          claimedAt: new Date(),
        })
        .where(eq(pendingRewards.id, pending.id));
    }

    // Update customer points
    if (totalPointsClaimed > 0) {
      const currentCustomer = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (currentCustomer.length > 0) {
        const newTotal = (currentCustomer[0].totalPoints || 0) + totalPointsClaimed;
        await db.update(customers).set({ totalPoints: newTotal }).where(eq(customers.id, customerId));
      }
    }

    console.log(`[QB Rewards] Claimed ${totalPointsClaimed} pending points for customer ${customerId}`);
  } catch (error) {
    console.error(`[QB Rewards] Error claiming pending rewards:`, error);
  }
}
