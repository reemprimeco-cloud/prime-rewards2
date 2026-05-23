import { ENV } from "./_core/env";

/**
 * Twilio WhatsApp Notification Helper
 * Sends WhatsApp messages via Twilio for key loyalty events.
 * All messages are bilingual (Arabic + English) to match the app's language support.
 */

interface WhatsAppResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

/**
 * Send a WhatsApp message via Twilio.
 * Phone number must be in E.164 format: +96512345678
 */
export async function sendWhatsApp(
  toPhone: string,
  message: string
): Promise<WhatsAppResult> {
  const sid = ENV.twilioAccountSid;
  const token = ENV.twilioAuthToken;
  const from = ENV.twilioWhatsappFrom;

  if (!sid || !token || !from) {
    console.warn("[WhatsApp] Twilio credentials not configured — skipping notification");
    return { success: false, error: "Twilio not configured" };
  }

  // Normalize phone number — ensure it starts with + and has country code
  let normalizedPhone = toPhone.replace(/\s+/g, "").replace(/-/g, "");
  if (!normalizedPhone.startsWith("+")) {
    // Assume Kuwait (+965) if no country code
    normalizedPhone = "+965" + normalizedPhone.replace(/^0+/, "");
  }

  const to = `whatsapp:${normalizedPhone}`;

  try {
    const credentials = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({
      From: from,
      To: to,
      Body: message,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );

    const data = await response.json() as { sid?: string; error_message?: string; status?: string };

    if (!response.ok) {
      console.error("[WhatsApp] Send failed:", data.error_message);
      return { success: false, error: data.error_message ?? "Unknown error" };
    }

    console.log(`[WhatsApp] Sent to ${normalizedPhone} — SID: ${data.sid}`);
    return { success: true, messageSid: data.sid };
  } catch (err: any) {
    console.error("[WhatsApp] Network error:", err?.message);
    return { success: false, error: err?.message ?? "Network error" };
  }
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

/** Points awarded message — sent after invoice is approved */
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
    `💵 المبلغ: *${invoiceAmount.toFixed(3)} KD*`,
    `💵 Amount: *${invoiceAmount.toFixed(3)} KD*`,
    ``,
    `🎉 النقاط المكتسبة: *+${pointsEarned} نقطة*`,
    `🎉 Points Earned: *+${pointsEarned} points*`,
    ``,
    `💰 إجمالي نقاطك: *${totalPoints} نقطة*`,
    `💰 Total Points: *${totalPoints} points*`,
    ``,
    `استمر في التسوق لكسب المزيد من النقاط! 🚀`,
    `Keep shopping to earn more points! 🚀`,
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
    Bronze: "🥉",
    Silver: "🥈",
    Gold: "🥇",
    Platinum: "💎",
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
    `استمر في اللعب كل يوم لفرص أكبر! 🚀`,
    `Keep playing every day for bigger chances! 🚀`,
  ].filter(l => l !== undefined).join("\n");
}
