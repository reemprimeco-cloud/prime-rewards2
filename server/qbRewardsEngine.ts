import { getDb, logWhatsApp } from "./db";
import { customers, qbPaymentSyncs, pendingRewards, whatsappLogs } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { sendWhatsApp, sendWhatsAppTemplate, normalisePhone } from "./whatsapp";

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
  
  return `+${normalized}`;
}

/**
 * Calculate reward points: 1 point per 10 KD (floor division)
 */
export function calculatePoints(amountKD: number): number {
  return Math.floor(amountKD / 10);
}

/**
 * Process QB payment event: check for duplicates, calculate points, send WhatsApp
 * EXECUTION SOURCE: QB Webhook Handler
 * This function is ONLY called from POST /api/qb/webhook
 * Do NOT use for signup/test flows
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

    // EXECUTION SOURCE: QB Payment Flow
    console.log(`\n[QB Rewards] 🔵 EXECUTION SOURCE: QB Payment Webhook Handler`);
    console.log(`[QB Rewards]   - Handler: processQbPaymentEvent()`);
    console.log(`[QB Rewards]   - QB Invoice ID: ${eventData.qbInvoiceId}`);
    console.log(`[QB Rewards]   - QB Customer: ${eventData.customerName}`);
    console.log(`[QB Rewards]   - QB Phone: ${eventData.customerPhone}`);
    console.log(`[QB Rewards]   - QB Invoice Number: ${eventData.invoiceNumber}`);
    console.log(`[QB Rewards]   - QB Amount: ${eventData.amount}`);

    // Normalize phone
    const normalizedPhone = normalizeKuwaitPhone(eventData.customerPhone);
    if (!normalizedPhone) {
      console.error(`[QB Rewards] ❌ Invalid phone: ${eventData.customerPhone}`);
      console.error(`[QB Rewards]   Aborting - cannot send WhatsApp without valid phone`);
      return {
        status: "failed",
        error: "Invalid phone number format",
      };
    }
    console.log(`[QB Rewards] ✅ Phone normalized: ${normalizedPhone}`);

    // Check for duplicate: same QB invoice ID already processed
    console.log(`[QB Rewards] 🔍 Checking for duplicate QB invoice: ${eventData.qbInvoiceId}`);
    const existing = await db
      .select()
      .from(qbPaymentSyncs)
      .where(eq(qbPaymentSyncs.qbInvoiceId, eventData.qbInvoiceId))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[QB Rewards] ⚠️ DUPLICATE QB invoice already processed: ${eventData.qbInvoiceId}`);
      return {
        status: "duplicate",
        error: "QB invoice already processed",
      };
    }
    console.log(`[QB Rewards] ✅ No duplicate found - proceeding with payment processing`);

    // Calculate points
    const pointsCalculated = calculatePoints(eventData.amount);
    console.log(`[QB Rewards] 📊 Points calculated: ${pointsCalculated} (${eventData.amount} KD / 10)`);

    // Check if customer exists
    console.log(`[QB Rewards] 👤 Checking if customer exists in system...`);
    const customerRecord = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, normalizedPhone))
      .limit(1);

    const customerId = customerRecord.length > 0 ? customerRecord[0].id : null;
    if (customerId) {
      console.log(`[QB Rewards] ✅ Customer found in system: ID ${customerId}`);
    } else {
      console.log(`[QB Rewards] ℹ️ Customer NOT in system - will create pending reward`);
    }

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

        // Send WhatsApp template notification
        const whatsappResult = await sendWhatsAppTemplate(
          normalizedPhone,
          "reward_test",
          {
            customer_name: eventData.customerName || "Valued Customer",
            points_earned: String(pointsCalculated),
            invoice_number: eventData.invoiceNumber,
          }
        );
        
        // Log the WhatsApp send
        const templateMessage = `Template: reward_test | Customer: ${eventData.customerName} | Points: ${pointsCalculated} | Invoice: ${eventData.invoiceNumber}`;
        if (whatsappResult.success) {
          await logWhatsApp({
            customerId,
            phone: normalizedPhone,
            messageBody: templateMessage,
            messageType: "points_awarded",
            status: "sent",
            messageSid: whatsappResult.messageSid,
            invoiceId: eventData.qbInvoiceId ? parseInt(eventData.qbInvoiceId.replace(/\D/g, "")) || undefined : undefined,
          });
          console.log(`[QB Rewards] WhatsApp template sent to ${normalizedPhone} - SID: ${whatsappResult.messageSid}`);
        } else {
          await logWhatsApp({
            customerId,
            phone: normalizedPhone,
            messageBody: templateMessage,
            messageType: "points_awarded",
            status: "failed",
            errorMessage: whatsappResult.error,
            invoiceId: eventData.qbInvoiceId ? parseInt(eventData.qbInvoiceId.replace(/\D/g, "")) || undefined : undefined,
          });
          console.error(`[QB Rewards] WhatsApp template send failed: ${whatsappResult.error}`);
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
      // Customer doesn't exist: create pending reward and send signup invitation via template
      try {
        // Create pending reward
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90); // 90 days expiry
        
        // Send signup invitation WhatsApp template
        const signupResult = await sendWhatsAppTemplate(
          normalizedPhone,
          "reward_test",
          {
            customer_name: eventData.customerName || "Valued Customer",
            points_earned: String(pointsCalculated),
            invoice_number: eventData.invoiceNumber,
          }
        );
        
        // Log the signup invitation WhatsApp
        const templateMessage = `Template: reward_test (signup) | Customer: ${eventData.customerName} | Points: ${pointsCalculated} | Invoice: ${eventData.invoiceNumber}`;
        if (signupResult.success) {
          await logWhatsApp({
            phone: normalizedPhone,
            messageBody: templateMessage,
            messageType: "points_awarded",
            status: "sent",
            messageSid: signupResult.messageSid,
            invoiceId: eventData.qbInvoiceId ? parseInt(eventData.qbInvoiceId.replace(/\D/g, "")) || undefined : undefined,
          });
          console.log(`[QB Rewards] Signup template sent to ${normalizedPhone} - SID: ${signupResult.messageSid}`);
        } else {
          await logWhatsApp({
            phone: normalizedPhone,
            messageBody: templateMessage,
            messageType: "points_awarded",
            status: "failed",
            errorMessage: signupResult.error,
            invoiceId: eventData.qbInvoiceId ? parseInt(eventData.qbInvoiceId.replace(/\D/g, "")) || undefined : undefined,
          });
          console.error(`[QB Rewards] Signup template send failed: ${signupResult.error}`);
        }

        const pendingResult = await db.insert(pendingRewards).values({
          phone: normalizedPhone,
          pointsEarned: pointsCalculated,
          invoiceNumber: eventData.invoiceNumber,
          amount: eventData.amount.toString(),
          expiresAt,
          status: "pending",
          message: templateMessage,
        });

        // Mark sync as success
        await db
          .update(qbPaymentSyncs)
          .set({ status: "success", processedAt: new Date() })
          .where(eq(qbPaymentSyncs.id, syncId));

        console.log(`[QB Rewards] Pending reward created for ${normalizedPhone}: ${pointsCalculated} pts, WhatsApp template sent: ${signupResult.success}`);
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
        // Use template-based sending instead of freeform messages
        const result = await sendWhatsAppTemplate(log.phone, "reward_test", {
          message: log.messageBody,
        });

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
