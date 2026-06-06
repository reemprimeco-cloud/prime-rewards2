import { getDb, logWhatsApp } from "./db";
import { customers, qbPaymentSyncs, pendingRewards, whatsappLogs } from "../drizzle/schema";
import { eq, and, like } from "drizzle-orm";
import { sendWhatsApp, sendWhatsAppTemplate, normalisePhone } from "./whatsapp";
import { ENV } from "./_core/env";

const POINTS_PER_10_KD = 1;

/**
 * Normalize Kuwait phone number to E.164: +965XXXXXXXX
 * Uses the canonical normalisePhone from whatsapp.ts as single source of truth.
 */
export function normalizeKuwaitPhone(phone: string): string | null {
  return normalisePhone(phone);
}

/**
 * Reduce ANY phone format to the canonical Kuwait local 8-digit number.
 * This is the key used for matching, so formatting (spaces, +965, 00965,
 * dashes) on either side never causes a miss.
 *   +965 506 55856 -> 50655856
 *   +96550655856   -> 50655856
 *   50655856       -> 50655856
 */
export function kuwaitLocal8(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits.slice(-8);
}

/**
 * Find a customer by phone, resilient to stored-format differences.
 * 1) Fast path: exact match on the normalized number.
 * 2) Fallback: match on the last 8 digits (handles any stored format).
 */
async function findCustomerByPhone(db: any, normalizedPhone: string) {
  let rows = await db
    .select()
    .from(customers)
    .where(eq(customers.phone, normalizedPhone))
    .limit(1);

  if (rows.length > 0) return rows;

  const local8 = kuwaitLocal8(normalizedPhone);
  if (!local8) return [];

  const candidates = await db
    .select()
    .from(customers)
    .where(like(customers.phone, `%${local8}`))
    .limit(25);

  const match = candidates.find((c: any) => kuwaitLocal8(c.phone) === local8);
  return match ? [match] : [];
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

    // Check if customer exists (resilient to stored phone format)
    console.log(`[QB Rewards] 👤 Checking if customer exists in system...`);
    const customerRecord = await findCustomerByPhone(db, normalizedPhone);

    const customerId = customerRecord.length > 0 ? customerRecord[0].id : null;
    if (customerId) {
      console.log(`[QB Rewards] ✅ Customer found in system: ID ${customerId} (matched on last 8 digits)`);
    } else {
      console.log(`[QB Rewards] ℹ️ Customer NOT in system - will create pending reward`);
    }

    // Log the sync attempt (with DB-level duplicate protection)
    let syncId: number;
    try {
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
      syncId = (syncResult as any).insertId || 1;
    } catch (dupErr: any) {
      // DB-level UNIQUE constraint violation on qbInvoiceId
      if (dupErr?.code === "ER_DUP_ENTRY" || dupErr?.message?.includes("Duplicate entry")) {
        console.error(`[QB Rewards] ❌ DB DUPLICATE: QB invoice ${eventData.qbInvoiceId} already exists`);
        return {
          status: "duplicate",
          error: "QB invoice already processed (DB constraint)",
        };
      }
      throw dupErr;
    }



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
          ENV.twilioRewardContentSid,
          {
            customer_name: eventData.customerName || "Valued Customer",
            points_earned: String(pointsCalculated),
            invoice_number: eventData.invoiceNumber,
          }
        );

        // Log the WhatsApp send (non-fatal — log errors but continue)
        const templateMessage = `Template: HXa2d8c4d852521f5ff648294c7dd28844 | Customer: ${eventData.customerName} | Points: ${pointsCalculated} | Invoice: ${eventData.invoiceNumber}`;
        try {
          if (whatsappResult.success) {
            await logWhatsApp({
              customerId,
              phone: normalizedPhone,
              messageBody: templateMessage,
              messageType: "points_awarded",
              status: "sent",
              messageSid: whatsappResult.messageSid,
              invoiceId: eventData.qbInvoiceId ? parseInt(eventData.qbInvoiceId.replace(/\D/g, "")) || undefined : undefined,
              twilioResponse: whatsappResult.twilioResponse,
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
              twilioResponse: whatsappResult.twilioResponse,
            });
            console.error(`[QB Rewards] WhatsApp template send failed: ${whatsappResult.error}`);
          }
        } catch (logErr: any) {
          console.warn(`[QB Rewards] Failed to log WhatsApp message: ${logErr?.message}`);
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
          ENV.twilioRewardContentSid,
          {
            customer_name: eventData.customerName || "Valued Customer",
            points_earned: String(pointsCalculated),
            invoice_number: eventData.invoiceNumber,
          }
        );

        // Log the signup invitation WhatsApp
        const templateMessage = `Template: HXa2d8c4d852521f5ff648294c7dd28844 (signup) | Customer: ${eventData.customerName} | Points: ${pointsCalculated} | Invoice: ${eventData.invoiceNumber}`;
        if (signupResult.success) {
          await logWhatsApp({
            phone: normalizedPhone,
            messageBody: templateMessage,
            messageType: "points_awarded",
            status: "sent",
            messageSid: signupResult.messageSid,
            invoiceId: eventData.qbInvoiceId ? parseInt(eventData.qbInvoiceId.replace(/\D/g, "")) || undefined : undefined,
            twilioResponse: signupResult.twilioResponse,
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
            twilioResponse: signupResult.twilioResponse,
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

        console.log(`[QB Rewards] Pending reward created for ${normalizedPhone}: ${pointsCalculated} pts`);
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
        const result = await sendWhatsAppTemplate(log.phone, ENV.twilioRewardContentSid, {
          message: log.messageBody,
        });

        if (result.success) {
          await db
            .update(whatsappLogs)
            .set({
              status: "sent",
              messageSid: result.messageSid,
              retryCount: (log.retryCount || 0) + 1,
              sentAt: new Date(),
              twilioResponse: result.twilioResponse ? JSON.stringify(result.twilioResponse) : null,
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
 * (resilient to stored phone format)
 */
export async function claimPendingRewards(customerId: number, phone: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const normalizedPhone = normalizeKuwaitPhone(phone) || phone;
    const local8 = kuwaitLocal8(phone);

    // Fast path: exact match on the normalized number
    let pendingList = await db
      .select()
      .from(pendingRewards)
      .where(
        and(
          eq(pendingRewards.phone, normalizedPhone),
          eq(pendingRewards.status, "pending")
        )
      );

    // Fallback: match on last 8 digits (handles any stored format)
    if (pendingList.length === 0 && local8) {
      const candidates = await db
        .select()
        .from(pendingRewards)
        .where(
          and(
            like(pendingRewards.phone, `%${local8}`),
            eq(pendingRewards.status, "pending")
          )
        )
        .limit(50);
      pendingList = candidates.filter((p: any) => kuwaitLocal8(p.phone) === local8);
    }

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
