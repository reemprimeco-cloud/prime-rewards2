import { getDb, logWhatsApp } from "./db";
import { customers, qbPaymentSyncs, pendingRewards, whatsappLogs } from "../drizzle/schema";
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

        // Send WhatsApp notification with logging
        const message = `Prime Rewards 💙\n\n${pointsCalculated} points were added to your account from invoice #${eventData.invoiceNumber}\n\nView your rewards:\nhttps://primerewds.com`;
        
        const whatsappResult = await sendWhatsApp(normalizedPhone, message);
        
        // Log the WhatsApp send
        if (whatsappResult.success) {
          await logWhatsApp({
            customerId,
            phone: normalizedPhone,
            messageBody: message,
            messageType: "points_awarded",
            status: "sent",
            messageSid: whatsappResult.messageSid,
          });
          console.log(`[QB Rewards] WhatsApp sent to ${normalizedPhone} - SID: ${whatsappResult.messageSid}`);
        } else {
          await logWhatsApp({
            customerId,
            phone: normalizedPhone,
            messageBody: message,
            messageType: "points_awarded",
            status: "failed",
            errorMessage: whatsappResult.error,
          });
          console.error(`[QB Rewards] WhatsApp send failed: ${whatsappResult.error}`);
        }

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
        
        // Send signup invitation WhatsApp
        const signupMessage = `Prime Rewards 💙\n\nYou earned ${pointsCalculated} points from your recent order.\n\nCreate your free account to view and redeem your rewards:\nhttps://primerewds.com`;
        const signupResult = await sendWhatsApp(normalizedPhone, signupMessage);
        
        // Log the signup invitation WhatsApp
        if (signupResult.success) {
          await logWhatsApp({
            phone: normalizedPhone,
            messageBody: signupMessage,
            messageType: "points_awarded",
            status: "sent",
            messageSid: signupResult.messageSid,
          });
          console.log(`[QB Rewards] Signup invitation sent to ${normalizedPhone} - SID: ${signupResult.messageSid}`);
        } else {
          await logWhatsApp({
            phone: normalizedPhone,
            messageBody: signupMessage,
            messageType: "points_awarded",
            status: "failed",
            errorMessage: signupResult.error,
          });
          console.error(`[QB Rewards] Signup invitation send failed: ${signupResult.error}`);
        }

        const pendingResult = await db.insert(pendingRewards).values({
          phone: normalizedPhone,
          pointsEarned: pointsCalculated,
          invoiceNumber: eventData.invoiceNumber,
          amount: eventData.amount.toString(),
          expiresAt,
          status: "pending",
          message: signupMessage,
        });

        // Mark sync as success
        await db
          .update(qbPaymentSyncs)
          .set({ status: "success", processedAt: new Date() })
          .where(eq(qbPaymentSyncs.id, syncId));

        console.log(`[QB Rewards] Pending reward created for ${normalizedPhone}: ${pointsCalculated} pts, WhatsApp sent: ${signupResult.success}`);
        return {
          status: "success",
          pendingRewardId: (pendingResult as any).insertId || 1,
          pointsPending: pointsCalculated,
        };
      } catch (error) {
        console.error(`[QB Rewards] Error creating pending reward:`, error);
        
        // Log the failed WhatsApp send
        const signupMsg = `Prime Rewards 💙\n\nYou earned ${pointsCalculated} points from your recent order.\n\nCreate your free account to view and redeem your rewards:\nhttps://primerewds.com`;
        try {
          await logWhatsApp({
            phone: normalizedPhone,
            messageBody: signupMsg,
            messageType: "points_awarded",
            status: "failed",
            errorMessage: String(error),
          });
        } catch (logErr) {
          console.error(`[QB Rewards] Failed to log WhatsApp error:`, logErr);
        }
        
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
    console.error("[QB Rewards] Unhandled error:", error);
    return { status: "failed", error: String(error) };
  }
}

/**
 * Process pending WhatsApp messages that failed or are stuck
 */
export async function processPendingWhatsAppQueue(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.error("[QB Rewards Queue] Database connection failed");
      return;
    }

    // Find all pending messages
    const pending = await db
      .select()
      .from(whatsappLogs)
      .where(eq(whatsappLogs.status, "pending"))
      .limit(10);

    for (const log of pending) {
      try {
        console.log(`[QB Rewards Queue] Retrying WhatsApp ${log.id} to ${log.phone}`);
        const result = await sendWhatsApp(log.phone, log.messageBody);

        if (result.success) {
          await db
            .update(whatsappLogs)
            .set({
              status: "sent",
              messageSid: result.messageSid,
              retryCount: (log.retryCount || 0) + 1,
            })
            .where(eq(whatsappLogs.id, log.id));
          console.log(`[QB Rewards Queue] WhatsApp ${log.id} sent successfully`);
        } else {
          const retryCount = (log.retryCount || 0) + 1;
          if (retryCount >= 3) {
            await db
              .update(whatsappLogs)
              .set({
                status: "failed",
                errorMessage: result.error,
                retryCount,
              })
              .where(eq(whatsappLogs.id, log.id));
            console.error(`[QB Rewards Queue] WhatsApp ${log.id} failed after ${retryCount} retries`);
          } else {
            await db
              .update(whatsappLogs)
              .set({
                status: "retrying",
                errorMessage: result.error,
                retryCount,
              })
              .where(eq(whatsappLogs.id, log.id));
            console.log(`[QB Rewards Queue] WhatsApp ${log.id} will retry (attempt ${retryCount})`);
          }
        }
      } catch (err) {
        console.error(`[QB Rewards Queue] Error processing WhatsApp ${log.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[QB Rewards Queue] Error processing pending messages:", err);
  }
}

/**
 * Claim pending rewards when customer signs up
 */
export async function claimPendingRewards(customerId: number, phone: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    // Find all pending rewards for this phone
    const pendingList = await db
      .select()
      .from(pendingRewards)
      .where(
        and(
          eq(pendingRewards.phone, phone),
          eq(pendingRewards.status, "pending")
        )
      );

    if (pendingList.length === 0) return;

    // Claim all pending rewards
    for (const pending of pendingList) {
      try {
        // Add points to customer
        const currentCustomer = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
        if (currentCustomer.length > 0) {
          const newTotal = (currentCustomer[0].totalPoints || 0) + pending.pointsEarned;
          await db.update(customers).set({ totalPoints: newTotal }).where(eq(customers.id, customerId));
        }

        // Mark pending reward as claimed
        await db
          .update(pendingRewards)
          .set({ status: "claimed", claimedAt: new Date(), customerId })
          .where(eq(pendingRewards.id, pending.id));

        console.log(`[QB Rewards] Claimed pending reward ${pending.id}: ${pending.pointsEarned} pts for customer ${customerId}`);
      } catch (err) {
        console.error(`[QB Rewards] Error claiming pending reward ${pending.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[QB Rewards] Error claiming pending rewards:", err);
  }
}
