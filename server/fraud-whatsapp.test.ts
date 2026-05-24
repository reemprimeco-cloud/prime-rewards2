import { describe, it, expect } from "vitest";

// ─── Kuwait Phone Validation ───────────────────────────────────────────────────
function validateKuwaitPhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/\s|-/g, "");
  const kuwaitRegex = /^(\+965|00965|965)?[5692][0-9]{7}$/;
  return kuwaitRegex.test(cleaned);
}

describe("Kuwait Phone Validation", () => {
  it("accepts valid Kuwait mobile numbers", () => {
    expect(validateKuwaitPhone("+96555001234")).toBe(true);   // +965 + 5xxx
    expect(validateKuwaitPhone("96555001234")).toBe(true);    // 965 prefix
    expect(validateKuwaitPhone("0096555001234")).toBe(true);  // 00965 prefix
    expect(validateKuwaitPhone("55001234")).toBe(true);       // local format 5xxx
    expect(validateKuwaitPhone("99001234")).toBe(true);       // 9xxx
    expect(validateKuwaitPhone("65001234")).toBe(true);       // 6xxx
    expect(validateKuwaitPhone("25001234")).toBe(true);       // 2xxx (landline)
  });

  it("rejects invalid phone numbers", () => {
    expect(validateKuwaitPhone("")).toBe(false);
    expect(validateKuwaitPhone("12345678")).toBe(false);   // starts with 1
    expect(validateKuwaitPhone("+1234567890")).toBe(false); // US number
    expect(validateKuwaitPhone("abc")).toBe(false);
    expect(validateKuwaitPhone("+9651234")).toBe(false);   // too short
  });
});

// ─── Points Calculation ────────────────────────────────────────────────────────
function calculatePoints(amountKD: number): number {
  return Math.floor(amountKD / 10);
}

describe("Points Calculation (1 pt per 10 KD)", () => {
  it("calculates correct points for standard amounts", () => {
    expect(calculatePoints(10)).toBe(1);
    expect(calculatePoints(100)).toBe(10);
    expect(calculatePoints(150)).toBe(15);
    expect(calculatePoints(9.99)).toBe(0);   // below 10 KD = 0 points
    expect(calculatePoints(0)).toBe(0);
  });

  it("floors fractional points", () => {
    expect(calculatePoints(15)).toBe(1);   // 15/10 = 1.5 → 1
    expect(calculatePoints(19.99)).toBe(1);
    expect(calculatePoints(25.5)).toBe(2);
  });

  it("handles large invoice amounts", () => {
    expect(calculatePoints(1000)).toBe(100);
    expect(calculatePoints(5000)).toBe(500);
  });
});

// ─── Fraud Detection Logic ─────────────────────────────────────────────────────
function shouldAutoBlock(failedAttempts: number): boolean {
  return failedAttempts >= 10;
}

function shouldFlagAsSuspicious(failedAttempts: number): boolean {
  return failedAttempts >= 5;
}

describe("Fraud Detection Thresholds", () => {
  it("flags account as suspicious at 5+ failed attempts", () => {
    expect(shouldFlagAsSuspicious(4)).toBe(false);
    expect(shouldFlagAsSuspicious(5)).toBe(true);
    expect(shouldFlagAsSuspicious(9)).toBe(true);
  });

  it("auto-blocks account at 10+ failed attempts", () => {
    expect(shouldAutoBlock(9)).toBe(false);
    expect(shouldAutoBlock(10)).toBe(true);
    expect(shouldAutoBlock(15)).toBe(true);
  });
});

// ─── WhatsApp Log Status ───────────────────────────────────────────────────────
type WaStatus = "sent" | "failed" | "pending" | "retrying";

function canResend(status: WaStatus): boolean {
  return status === "failed" || status === "pending";
}

describe("WhatsApp Log Resend Logic", () => {
  it("allows resend for failed and pending messages", () => {
    expect(canResend("failed")).toBe(true);
    expect(canResend("pending")).toBe(true);
  });

  it("does not allow resend for sent or retrying messages", () => {
    expect(canResend("sent")).toBe(false);
    expect(canResend("retrying")).toBe(false);
  });
});

// ─── Tier Calculation ──────────────────────────────────────────────────────────
function calculateTier(lifetimePoints: number): string {
  if (lifetimePoints >= 2000) return "Platinum";
  if (lifetimePoints >= 1000) return "Gold";
  if (lifetimePoints >= 500) return "Silver";
  return "Bronze";
}

describe("Tier Calculation", () => {
  it("assigns correct tier based on lifetime points", () => {
    expect(calculateTier(0)).toBe("Bronze");
    expect(calculateTier(499)).toBe("Bronze");
    expect(calculateTier(500)).toBe("Silver");
    expect(calculateTier(999)).toBe("Silver");
    expect(calculateTier(1000)).toBe("Gold");
    expect(calculateTier(1999)).toBe("Gold");
    expect(calculateTier(2000)).toBe("Platinum");
    expect(calculateTier(9999)).toBe("Platinum");
  });
});

// ─── Spin Wheel Eligibility ────────────────────────────────────────────────────
// Rules:
//   - Welcome spin: 1 free spin for brand-new users (totalSpinsUsed === 0)
//   - Invoice spins: 1 spin per every 5 approved invoices
//   - spinsRemaining = totalSpinsEarned - totalSpinsUsed
function calcSpinEligibility(totalSpinsUsed: number, approvedInvoiceCount: number) {
  const welcomeSpinEarned = 1;
  const invoiceSpinsEarned = Math.floor(approvedInvoiceCount / 5);
  const totalSpinsEarned = welcomeSpinEarned + invoiceSpinsEarned;
  const spinsRemaining = Math.max(0, totalSpinsEarned - totalSpinsUsed);
  const canSpin = spinsRemaining > 0;
  const lastMilestone = Math.floor(approvedInvoiceCount / 5) * 5;
  const nextUnlockAt = lastMilestone + 5;
  const isWelcomeSpin = totalSpinsUsed === 0;
  return { canSpin, spinsRemaining, totalSpinsEarned, isWelcomeSpin, nextUnlockAt };
}

describe("Spin Wheel Eligibility", () => {
  it("new user with 0 spins used gets welcome spin", () => {
    const e = calcSpinEligibility(0, 0);
    expect(e.canSpin).toBe(true);
    expect(e.isWelcomeSpin).toBe(true);
    expect(e.spinsRemaining).toBe(1);
  });

  it("after using welcome spin, wheel is locked until 5 approved invoices", () => {
    const e = calcSpinEligibility(1, 0);
    expect(e.canSpin).toBe(false);
    expect(e.spinsRemaining).toBe(0);
  });

  it("locked with 1-4 approved invoices after welcome spin used", () => {
    expect(calcSpinEligibility(1, 1).canSpin).toBe(false);
    expect(calcSpinEligibility(1, 4).canSpin).toBe(false);
  });

  it("unlocks at exactly 5 approved invoices", () => {
    const e = calcSpinEligibility(1, 5);
    expect(e.canSpin).toBe(true);
    expect(e.spinsRemaining).toBe(1);
  });

  it("unlocks again at 10 approved invoices", () => {
    const e = calcSpinEligibility(2, 10);
    expect(e.canSpin).toBe(true);
    expect(e.spinsRemaining).toBe(1);
  });

  it("accumulates multiple spins if not used", () => {
    // 15 approved invoices = 3 invoice spins + 1 welcome = 4 total; used 1
    const e = calcSpinEligibility(1, 15);
    expect(e.spinsRemaining).toBe(3);
    expect(e.canSpin).toBe(true);
  });

  it("nextUnlockAt is always the next multiple of 5", () => {
    expect(calcSpinEligibility(1, 0).nextUnlockAt).toBe(5);
    expect(calcSpinEligibility(1, 5).nextUnlockAt).toBe(10);
    expect(calcSpinEligibility(1, 7).nextUnlockAt).toBe(10);
    expect(calcSpinEligibility(1, 10).nextUnlockAt).toBe(15);
  });

  it("spinsRemaining never goes below 0", () => {
    // Edge case: more spins used than earned (data inconsistency)
    const e = calcSpinEligibility(99, 0);
    expect(e.spinsRemaining).toBe(0);
    expect(e.canSpin).toBe(false);
  });
});

// ─── WhatsApp Phone Normalisation ─────────────────────────────────────────────
function normalisePhone(raw: string): string {
  let p = raw.replace(/[\s\-()]/g, "");
  if (!p.startsWith("+")) {
    p = "+965" + p.replace(/^0+/, "");
  }
  return p;
}

describe("WhatsApp Phone Normalisation", () => {
  it("leaves E.164 numbers unchanged", () => {
    expect(normalisePhone("+96555001234")).toBe("+96555001234");
    expect(normalisePhone("+15559682683")).toBe("+15559682683");
  });

  it("adds +965 prefix to bare Kuwait numbers", () => {
    expect(normalisePhone("55001234")).toBe("+96555001234");
    expect(normalisePhone("99001234")).toBe("+96599001234");
  });

  it("strips spaces and dashes", () => {
    expect(normalisePhone("+965 5500 1234")).toBe("+96555001234");
    expect(normalisePhone("+965-5500-1234")).toBe("+96555001234");
  });

  it("strips leading zeros before adding prefix", () => {
    expect(normalisePhone("055001234")).toBe("+96555001234");
  });
});

// ─── Duplicate Send Prevention ────────────────────────────────────────────────
type WaLog = { invoiceId: number | null; messageType: string; status: string };

function isDuplicateSend(
  logs: WaLog[],
  invoiceId: number,
  messageType: string
): boolean {
  return logs.some(
    (l) => l.invoiceId === invoiceId && l.messageType === messageType && l.status === "sent"
  );
}

describe("WhatsApp Duplicate Send Prevention", () => {
  it("detects an already-sent message for the same invoice", () => {
    const logs: WaLog[] = [
      { invoiceId: 42, messageType: "points_awarded", status: "sent" },
    ];
    expect(isDuplicateSend(logs, 42, "points_awarded")).toBe(true);
  });

  it("allows send if previous attempt failed", () => {
    const logs: WaLog[] = [
      { invoiceId: 42, messageType: "points_awarded", status: "failed" },
    ];
    expect(isDuplicateSend(logs, 42, "points_awarded")).toBe(false);
  });

  it("allows send for a different invoice", () => {
    const logs: WaLog[] = [
      { invoiceId: 42, messageType: "points_awarded", status: "sent" },
    ];
    expect(isDuplicateSend(logs, 99, "points_awarded")).toBe(false);
  });

  it("allows send for a different message type on the same invoice", () => {
    const logs: WaLog[] = [
      { invoiceId: 42, messageType: "welcome", status: "sent" },
    ];
    expect(isDuplicateSend(logs, 42, "points_awarded")).toBe(false);
  });

  it("returns false when no logs exist", () => {
    expect(isDuplicateSend([], 42, "points_awarded")).toBe(false);
  });
});

// ─── Points Awarded Message Variables ─────────────────────────────────────────
function buildPointsMessage(
  customerName: string,
  pointsEarned: number,
  totalPoints: number,
  invoiceNumber: string
): string {
  return [
    `Hello ${customerName},`,
    `Invoice No.: ${invoiceNumber}`,
    `Points Earned: +${pointsEarned} points`,
    `Total Points: ${totalPoints} points`,
  ].join("\n");
}

describe("Points Awarded Message Template Variables", () => {
  it("includes all four required variables", () => {
    const msg = buildPointsMessage("Ahmed Al-Rashidi", 15, 120, "INV-2024-001");
    expect(msg).toContain("Ahmed Al-Rashidi");
    expect(msg).toContain("+15 points");
    expect(msg).toContain("INV-2024-001");
    expect(msg).toContain("120 points");
  });

  it("handles zero earned points gracefully", () => {
    const msg = buildPointsMessage("Sara", 0, 50, "INV-001");
    expect(msg).toContain("+0 points");
    expect(msg).toContain("50 points");
  });
});

// ─── Twilio Credential Validation ─────────────────────────────────────────────
// Validates that the configured Twilio credentials are accepted by the API.
// Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to be set in the environment.
describe("Twilio Credential Validation", () => {
  it("authenticates successfully against the Twilio API", async () => {
    const sid   = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;

    if (!sid || !token) {
      // Skip gracefully in environments without credentials
      console.warn("[Test] Twilio credentials not set — skipping live validation");
      return;
    }

    const credentials = Buffer.from(`${sid}:${token}`).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,
      { headers: { Authorization: `Basic ${credentials}` } }
    );

    expect(response.status).toBe(200);
    const data = await response.json() as { sid?: string; status?: string };
    expect(data.sid).toBe(sid);
    expect(data.status).toBe("active");
  }, 10000); // 10s timeout for network call
});
