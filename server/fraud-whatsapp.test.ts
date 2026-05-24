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
