import { ENV } from "./_core/env";

export interface WhatsAppResult {
  success: boolean;
  messageSid?: string;
  error?: string;
  twilioResponse?: Record<string, any>;
}

/**
 * Normalise any Kuwait phone variant to E.164 (+965XXXXXXXX).
 * Returns null for anything that cannot be resolved to a valid Kuwait number.
 *
 * Handles: 65068000 / 96565068000 / +96565068000 / 0096565068000
 */
export function normalisePhone(raw: string): string | null {
  if (!raw) return null;

  // Strip whatsapp: prefix if present
  let p = raw.replace(/^whatsapp:/i, "");

  // Remove all non-digits
  p = p.replace(/\D/g, "");

  // Remove leading 00
  if (p.startsWith("00")) p = p.slice(2);

  // If bare 8 digits, prepend 965
  if (p.length === 8) p = "965" + p;

  // Must be exactly 11 digits starting with 965
  if (!/^965\d{8}$/.test(p)) {
    console.error(`[WhatsApp] ❌ Invalid phone: "${raw}" → "${p}"`);
    return null;
  }

  return "+" + p;
}

/**
 * Send an approved Twilio WhatsApp template.
 * ContentVariables is sent as ONE JSON object — Twilio rejects multiple parameters.
 */
export async function sendWhatsAppTemplate(
  toPhone: string,
  contentSid: string,
  templateParams: Record<string, string>
): Promise<WhatsAppResult> {
  const accountSid = ENV.twilioAccountSid;
  const authToken  = ENV.twilioAuthToken;
  const msgSvcSid  = ENV.twilioMessagingServiceSid;

  console.log("=== WHATSAPP DEBUG ===");
  console.log("Customer Phone:", toPhone);
  console.log("MessagingServiceSid:", msgSvcSid);
  console.log("ContentSid:", contentSid);
  console.log("ContentVariables:", templateParams);
  console.log("======================");

  if (!accountSid || !authToken || !msgSvcSid) {
    console.warn("[WhatsApp] Twilio credentials not configured — skipping");
    console.warn("[WhatsApp] accountSid:", accountSid ? "SET" : "MISSING");
    console.warn("[WhatsApp] authToken:", authToken ? "SET" : "MISSING");
    console.warn("[WhatsApp] msgSvcSid:", msgSvcSid ? "SET" : "MISSING");
    return { success: false, error: "Twilio not configured" };
  }

  const normalised = normalisePhone(toPhone);
  if (!normalised) {
    return { success: false, error: `Invalid phone number: ${toPhone}` };
  }

  const to = `whatsapp:${normalised}`;

  // Map values to 1-indexed keys: { "1": v1, "2": v2, … }
  const vars: Record<string, string> = {};
  Object.values(templateParams).forEach((v, i) => { vars[String(i + 1)] = v; });

  const body = new URLSearchParams({
    MessagingServiceSid: msgSvcSid,
    To:                  to,
    ContentSid:          contentSid,
  });

  // Only add ContentVariables if there are actual variables
  if (Object.keys(vars).length > 0) {
    body.append("ContentVariables", JSON.stringify(vars));
  }

  console.log(`[WhatsApp] ═══ SENDING WHATSAPP TEMPLATE ═══`);
  console.log(`[WhatsApp] ContentSid: ${contentSid}`);
  console.log(`[WhatsApp] To: ${to}`);
  console.log(`[WhatsApp] Template Variables: ${JSON.stringify(vars)}`);
  console.log(`[WhatsApp] MessagingServiceSid: ${msgSvcSid}`);
  console.log(`[WhatsApp] Request Body: ${body.toString()}`);

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );

    const data = await res.json() as Record<string, any>;

    if (!res.ok) {
      console.error(`[WhatsApp] ═══ TWILIO ERROR ═══`);
      console.error(`[WhatsApp] Status: ${res.status}`);
      console.error(`[WhatsApp] Error Code: ${data.code}`);
      console.error(`[WhatsApp] Error Message: ${data.error_message}`);
      console.error(`[WhatsApp] Full Response: ${JSON.stringify(data)}`);
      return { success: false, error: data.error_message ?? `HTTP ${res.status}`, twilioResponse: data };
    }

    console.log(`[WhatsApp] ═══ SUCCESS ═══`);
    console.log(`[WhatsApp] Message SID: ${data.sid}`);
    console.log(`[WhatsApp] Status: ${data.status}`);
    console.log(`[WhatsApp] Full Response: ${JSON.stringify(data)}`);
    return { success: true, messageSid: data.sid, twilioResponse: data };
  } catch (err: any) {
    console.error(`[WhatsApp] Network error: ${err?.message}`);
    return { success: false, error: err?.message ?? "Network error" };
  }
}

/** Deprecated freeform sender — delegates to template */
export async function sendWhatsApp(toPhone: string, message: string): Promise<WhatsAppResult> {
  return sendWhatsAppTemplate(toPhone, "HXa2d8c4d852521f5ff648294c7dd28844", { message });
}

/** Retry wrapper used by sendWhatsAppIfNotDuplicate */
export async function sendWhatsAppWithRetry(
  toPhone: string,
  message: string,
  logId?: number
): Promise<WhatsAppResult> {
  const DELAYS = [2000, 5000, 10000];
  let last: WhatsAppResult = { success: false, error: "Not attempted" };

  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      await new Promise(r => setTimeout(r, DELAYS[i - 1]));
      if (logId) {
        const { updateWhatsAppLog } = await import("./db");
        await updateWhatsAppLog(logId, { status: "retrying", retryCount: i }).catch(() => {});
      }
    }
    last = await sendWhatsAppTemplate(toPhone, "HXa2d8c4d852521f5ff648294c7dd28844", { message });
    if (last.success) {
      if (logId) {
        const { updateWhatsAppLog } = await import("./db");
        await updateWhatsAppLog(logId, { status: "sent", messageSid: last.messageSid, retryCount: i }).catch(() => {});
      }
      return last;
    }
  }

  if (logId) {
    const { updateWhatsAppLog } = await import("./db");
    await updateWhatsAppLog(logId, { status: "failed", errorMessage: last.error, retryCount: 3 }).catch(() => {});
  }
  return last;
}

/** Duplicate-safe send */
export async function sendWhatsAppIfNotDuplicate(opts: {
  toPhone: string;
  message: string;
  customerId: number;
  messageType: "points_awarded" | "welcome" | "tier_upgrade" | "reward_redeemed" | "expiry_warning" | "spin_win" | "manual";
  invoiceId?: number;
}): Promise<WhatsAppResult & { skipped?: boolean }> {
  let logId: number | undefined;
  try {
    const { logWhatsApp } = await import("./db");
    const id = await logWhatsApp({
      customerId: opts.customerId,
      phone: opts.toPhone,
      messageType: opts.messageType,
      messageBody: opts.message,
      status: "pending",
      invoiceId: opts.invoiceId,
    });
    if (id != null) logId = id;
  } catch {}

  return sendWhatsAppWithRetry(opts.toPhone, opts.message, logId);
}

// ─── Message helpers ──────────────────────────────────────────────────────────

export function welcomeMessage(name: string, points: number): string {
  return `🌟 Welcome to Prime Rewards, ${name}!\n\nYour current balance: *${points} points*\n\nStart submitting invoices to earn rewards!`;
}

export function pointsAwardedMessage(name: string, earned: number, total: number, invoiceNum: string, amount: number): string {
  return `✅ Points Added!\n\nHello ${name},\n\nInvoice: ${invoiceNum}\nAmount: ${parseFloat(String(amount)).toFixed(3)} KD\nPoints Earned: +${earned}\nTotal Points: ${total}\n\n— Prime Rewards`;
}

export function rewardRedeemedMessage(name: string, reward: string, spent: number, remaining: number, code?: string): string {
  let msg = `🎁 Reward Redeemed!\n\nHello ${name},\n\nReward: ${reward}\nPoints Used: ${spent}\nRemaining: ${remaining}`;
  if (code) msg += `\n\nCoupon Code: *${code}*`;
  return msg;
}

export function tierUpgradeMessage(name: string, tier: string, tierAr: string): string {
  return `⭐ Tier Upgrade!\n\nCongratulations ${name}!\n\nYou have reached *${tier}* tier!\n\nEnjoy your new exclusive benefits.`;
}

export function pointsExpiryWarningMessage(name: string, points: number, days: number): string {
  return `⚠️ Points Expiry Warning\n\nHello ${name},\n\nYour *${points} points* will expire in *${days} days*.\n\nRedeem now!`;
}

export function spinWinMessage(name: string, prize: string, pointsWon?: number): string {
  let msg = `🎰 You Won!\n\nHello ${name},\n\nYou won: *${prize}*`;
  if (pointsWon) msg += `\n+${pointsWon} points added to your account!`;
  return msg;
}
