import { ENV } from "./_core/env";

/**
 * Twilio WhatsApp Notification Helper — Prime Rewards
 *
 * Official sender: whatsapp:+15559682683 ("Prime Rewards" business profile)
 * Account SID / Auth Token sourced exclusively from environment variables.
 *
 * Features:
 *  - Duplicate-send prevention (checks whatsapp_logs before sending)
 *  - Exponential-backoff retry (max 3 attempts, stored in whatsapp_logs.retryCount)
 *  - Full delivery logging (sent / failed / retrying)
 *  - Bilingual messages (Arabic + English)
 */

export interface WhatsAppResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

export interface WhatsAppTemplateParams {
  toPhone: string;
  templateName: string;
  templateParams: Record<string, string>;
  customerId?: number;
  invoiceId?: number;
}

// ─── Core Send ────────────────────────────────────────────────────────────────

/**
 * Normalise a phone number to E.164 format (+965XXXXXXXX).
 * Handles: +965XXXXXXXX, 00965XXXXXXXX, 965XXXXXXXX, 0XXXXXXXX, XXXXXXXX
 * Removes spaces, dashes, and parentheses.
 */
export function normalisePhone(raw: string): string {
  if (!raw) return "";
  
  // Remove spaces, dashes, parentheses
  let p = raw.replace(/[\s\-()]/g, "");
  
  // Remove leading +
  if (p.startsWith("+")) {
    p = p.slice(1);
  }
  
  // Remove leading 00
  if (p.startsWith("00")) {
    p = p.slice(2);
  }
  
  // Remove leading 0 (local format)
  if (p.startsWith("0") && !p.startsWith("965")) {
    p = p.slice(1);
  }
  
  // If doesn't start with 965, add it
  if (!p.startsWith("965")) {
    p = "965" + p;
  }
  
  // Return in E.164 format
  return "+" + p;
}

/**
 * Send a WhatsApp template message via the official Twilio Messaging Service.
 * Uses TWILIO_MESSAGING_SERVICE_SID for production delivery.
 * 
 * Template: reward_test (approved template for QB payment notifications)
 * Params: {{1}} = customer name, {{2}} = points earned, {{3}} = invoice number
 */
export async function sendWhatsAppTemplate(
  toPhone: string,
  templateName: string,
  templateParams: Record<string, string>
): Promise<WhatsAppResult> {
  const sid = ENV.twilioAccountSid;
  const token = ENV.twilioAuthToken;
  const messagingServiceSid = ENV.twilioMessagingServiceSid;

  if (!sid || !token || !messagingServiceSid) {
    console.warn("[WhatsApp] Twilio credentials not configured — skipping");
    return { success: false, error: "Twilio not configured" };
  }

  const normalised = normalisePhone(toPhone);
  const to = normalised.startsWith("whatsapp:") ? normalised : `whatsapp:${normalised}`;

  try {
    const credentials = Buffer.from(`${sid}:${token}`).toString("base64");
    
    // Build template body with Messaging Service SID
    const bodyParams = new URLSearchParams({
      MessagingServiceSid: messagingServiceSid,
      To: to,
      ContentSid: templateName, // Twilio template SID or name (reward_test)
    });
    
    // Add template parameters
    Object.entries(templateParams).forEach(([key, value], index) => {
      bodyParams.append(`ContentVariables`, JSON.stringify({ [index + 1]: value }));
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: bodyParams.toString(),
      }
    );

    const data = await response.json() as { sid?: string; error_message?: string; status?: string };

    if (!response.ok) {
      console.error("[WhatsApp] Template send failed:", data.error_message);
      console.error("[WhatsApp] Full Twilio Response:", JSON.stringify(data));
      return { success: false, error: data.error_message ?? `HTTP ${response.status}` };
    }

    console.log(`[WhatsApp] Template '${templateName}' sent to ${normalised} via Messaging Service — SID: ${data.sid}`);
    console.log("[WhatsApp] Twilio Response:", JSON.stringify(data));
    return { success: true, messageSid: data.sid };
  } catch (err: any) {
    console.error("[WhatsApp] Network error:", err?.message);
    return { success: false, error: err?.message ?? "Network error" };
  }
}

/**
 * Send a WhatsApp message via the official Twilio Messaging Service using template format.
 * DEPRECATED: Use sendWhatsAppTemplate() instead.
 * This function now delegates to sendWhatsAppTemplate() to comply with Twilio's template-only requirement.
 */
export async function sendWhatsApp(
  toPhone: string,
  message: string
): Promise<WhatsAppResult> {
  console.warn("[WhatsApp] sendWhatsApp() is deprecated. Use sendWhatsAppTemplate() instead.");
  console.warn("[WhatsApp] Freeform messages are no longer supported. Using reward_test template.");
  
  // Delegate to template-based sending with reward_test template
  return sendWhatsAppTemplate(toPhone, "reward_test", {
    message: message,
  });
}

// ─── Retry Helper ─────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = [2000, 5000, 10000]; // exponential backoff

/**
 * Send with automatic retry (up to MAX_RETRIES attempts).
 * Updates whatsapp_logs.retryCount and status on each attempt.
 */
export async function sendWhatsAppWithRetry(
  toPhone: string,
  message: string,
  logId?: number
): Promise<WhatsAppResult> {
  let lastResult: WhatsAppResult = { success: false, error: "Not attempted" };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS[attempt - 1] ?? 10000));
      // Update log status to retrying
      if (logId) {
        try {
          const { updateWhatsAppLog } = await import("./db");
          await updateWhatsAppLog(logId, { status: "retrying", retryCount: attempt });
        } catch {}
      }
    }

    // Use template-based sending instead of freeform messages
    lastResult = await sendWhatsAppTemplate(toPhone, "reward_test", { message });

    if (lastResult.success) {
      if (logId) {
        try {
          const { updateWhatsAppLog } = await import("./db");
          await updateWhatsAppLog(logId, {
            status: "sent",
            messageSid: lastResult.messageSid,
            retryCount: attempt,
          });
        } catch {}
      }
      return lastResult;
    }
  }

  // All retries exhausted
  if (logId) {
    try {
      const { updateWhatsAppLog } = await import("./db");
      await updateWhatsAppLog(logId, {
        status: "failed",
        errorMessage: lastResult.error,
        retryCount: MAX_RETRIES,
      });
    } catch {}
  }

  return lastResult;
}

// ─── Duplicate-Safe Send ──────────────────────────────────────────────────────

/**
 * Send a WhatsApp message only if no successful message of the same type
 * has already been sent for this invoice.
 *
 * Returns { skipped: true } if a duplicate is detected.
 */
export async function sendWhatsAppIfNotDuplicate(opts: {
  toPhone: string;
  message: string;
  customerId: number;
  messageType: "points_awarded" | "welcome" | "tier_upgrade" | "reward_redeemed" | "expiry_warning" | "spin_win" | "manual";
  invoiceId?: number;
}): Promise<WhatsAppResult & { skipped?: boolean }> {
  const { toPhone, message, customerId, messageType, invoiceId } = opts;

  // Check for existing successful send
  if (invoiceId) {
    try {
      const { getDb } = await import("./db");
      const { whatsappLogs } = await import("../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const existing = await db
          .select({ id: whatsappLogs.id, status: whatsappLogs.status })
          .from(whatsappLogs)
          .where(
            and(
              eq(whatsappLogs.invoiceId, invoiceId),
              eq(whatsappLogs.messageType, messageType)
            )
          )
          .limit(1);

        if (existing[0]?.status === "sent") {
          console.log(`[WhatsApp] Duplicate prevented — invoice ${invoiceId} already sent (log ${existing[0].id})`);
          return { success: true, skipped: true };
        }
      }
    } catch {}
  }

  // Log the pending message
  let logId: number | undefined;
  try {
    const { logWhatsApp } = await import("./db");
    const rawLogId = await logWhatsApp({
      customerId,
      phone: toPhone,
      messageType,
      messageBody: message,
      invoiceId,
      status: "pending",
    });
    if (rawLogId != null) logId = rawLogId;
  } catch {}

  // Send with retry
  const result = await sendWhatsAppWithRetry(toPhone, message, logId);
  return result;
}

// ─── Message Templates ────────────────────────────────────────────────────────

/** Welcome message sent when a customer first registers */
export function welcomeMessage(customerName: string, points: number): string {
  return [
    `🌟 *مرحباً بك في Prime Rewards!*`,
    `Welcome to Prime Rewards, ${customerName}!`,
    ``,
    `أنت الآن عضو في برنامج مكافآت PRIME Printing Co.`,
    `You are now a member of the PRIME Printing Co. loyalty program.`,
    ``,
    `💰 رصيدك الحالي: *${points} نقطة*`,
    `💰 Your current balance: *${points} points*`,
    ``,
    `ابدأ بتقديم فواتيرك لكسب النقاط واستبدالها بمكافآت رائعة!`,
    `Start submitting your invoices to earn points and redeem amazing rewards!`,
  ].join("\n");
}

/**
 * Points awarded message — sent automatically after invoice is approved.
 * Variables: customer name, earned points, invoice number, total points.
 */
export function pointsAwardedMessage(
  customerName: string,
  pointsEarned: number,
  totalPoints: number,
  invoiceNumber: string,
  invoiceAmount: number
): string {
  return [
    `✅ *تم إضافة النقاط! / Points Added!*`,
    ``,
    `مرحباً ${customerName}،`,
    `Hello ${customerName},`,
    ``,
    `🧾 الفاتورة رقم: *${invoiceNumber}*`,
    `🧾 Invoice No.: *${invoiceNumber}*`,
    `💵 المبلغ: *${parseFloat(String(invoiceAmount)).toFixed(3)} KD*`,
    `💵 Amount: *${parseFloat(String(invoiceAmount)).toFixed(3)} KD*`,
    ``,
    `🎉 النقاط المكتسبة: *+${pointsEarned} نقطة*`,
    `🎉 Points Earned: *+${pointsEarned} points*`,
    ``,
    `💰 إجمالي نقاطك: *${totalPoints} نقطة*`,
    `💰 Total Points: *${totalPoints} points*`,
    ``,
    `استمر في التسوق لكسب المزيد من النقاط! 🚀`,
    `Keep shopping to earn more points! 🚀`,
    ``,
    `— Prime Rewards · PRIME Printing Co.`,
  ].join("\n");
}

/** Reward redeemed message */
export function rewardRedeemedMessage(
  customerName: string,
  rewardName: string,
  pointsSpent: number,
  remainingPoints: number,
  couponCode?: string
): string {
  const lines = [
    `🎁 *تم استبدال المكافأة! / Reward Redeemed!*`,
    ``,
    `مرحباً ${customerName}،`,
    `Hello ${customerName},`,
    ``,
    `🏆 المكافأة: *${rewardName}*`,
    `🏆 Reward: *${rewardName}*`,
    `💸 النقاط المستخدمة: *${pointsSpent} نقطة*`,
    `💸 Points Used: *${pointsSpent} points*`,
    ``,
    `💰 نقاطك المتبقية: *${remainingPoints} نقطة*`,
    `💰 Remaining Points: *${remainingPoints} points*`,
  ];
  if (couponCode) {
    lines.push(``);
    lines.push(`🎟️ كود الخصم: *${couponCode}*`);
    lines.push(`🎟️ Coupon Code: *${couponCode}*`);
    lines.push(`احتفظ بهذا الكود واستخدمه في طلبك القادم!`);
    lines.push(`Keep this code and use it on your next order!`);
  }
  lines.push(``);
  lines.push(`شكراً لولائك لـ PRIME Printing Co.! 🌟`);
  lines.push(`Thank you for your loyalty to PRIME Printing Co.! 🌟`);
  return lines.join("\n");
}

/** Tier upgrade message */
export function tierUpgradeMessage(
  customerName: string,
  newTier: string,
  tierAr: string
): string {
  const tierEmojis: Record<string, string> = {
    Bronze: "🥉", Silver: "🥈", Gold: "🥇", Platinum: "💎",
  };
  const emoji = tierEmojis[newTier] ?? "⭐";
  return [
    `${emoji} *ترقية المستوى! / Tier Upgrade!*`,
    ``,
    `تهانينا ${customerName}! 🎉`,
    `Congratulations ${customerName}! 🎉`,
    ``,
    `لقد وصلت إلى مستوى *${tierAr}*!`,
    `You have reached *${newTier}* tier!`,
    ``,
    `استمتع بمزايا حصرية جديدة مع مستواك الجديد.`,
    `Enjoy exclusive new benefits with your new tier.`,
    ``,
    `شكراً لولائك لـ PRIME Printing Co.! 🌟`,
    `Thank you for your loyalty to PRIME Printing Co.! 🌟`,
  ].join("\n");
}

/** Points expiry warning */
export function pointsExpiryWarningMessage(
  customerName: string,
  points: number,
  daysLeft: number
): string {
  return [
    `⚠️ *تحذير انتهاء صلاحية النقاط / Points Expiry Warning*`,
    ``,
    `مرحباً ${customerName}،`,
    `Hello ${customerName},`,
    ``,
    `نقاطك البالغة *${points} نقطة* ستنتهي صلاحيتها خلال *${daysLeft} يوم*.`,
    `Your *${points} points* will expire in *${daysLeft} days*.`,
    ``,
    `استبدل نقاطك الآن قبل فوات الأوان!`,
    `Redeem your points now before they expire!`,
    ``,
    `🔗 primerewds-45ycshmd.manus.space`,
  ].join("\n");
}

/** Spin wheel win message */
export function spinWinMessage(
  customerName: string,
  prize: string,
  pointsWon?: number
): string {
  return [
    `🎰 *لقد فزت! / You Won!*`,
    ``,
    `مرحباً ${customerName}،`,
    `Hello ${customerName},`,
    ``,
    `🎉 لقد فزت في عجلة الحظ بـ: *${prize}*`,
    `🎉 You won on the Spin Wheel: *${prize}*`,
    pointsWon ? `\n💰 تمت إضافة *${pointsWon} نقطة* إلى حسابك!\n💰 *${pointsWon} points* have been added to your account!` : ``,
    ``,
    `— Prime Rewards · PRIME Printing Co.`,
  ].filter(l => l !== undefined).join("\n");
}
