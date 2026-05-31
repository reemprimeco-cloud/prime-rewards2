import { describe, it, expect, vi } from "vitest";
import { processQbPaymentEvent, claimPendingRewards, processPendingWhatsAppQueue } from "./qbRewardsEngine";

// Mock the sendWhatsApp functions
vi.mock("./whatsapp", () => ({
  sendWhatsApp: vi.fn(async (phone: string, message: string) => {
    if (phone.includes("+965")) {
      return { success: true, messageSid: `SM_${Date.now()}` };
    }
    return { success: false, error: "Invalid phone" };
  }),
  sendWhatsAppTemplate: vi.fn(async (phone: string, templateName: string, params: Record<string, string>) => {
    if (phone.includes("+965")) {
      return { success: true, messageSid: `SM_${Date.now()}` };
    }
    return { success: false, error: "Invalid phone" };
  }),
  sendWhatsAppIfNotDuplicate: vi.fn(async (phone: string, message: string) => {
    return { success: true, messageSid: `SM_${Date.now()}` };
  }),
  sendWhatsAppWithRetry: vi.fn(async (phone: string, message: string) => {
    return { success: true, messageSid: `SM_${Date.now()}` };
  }),
}));

describe("QB Rewards Engine", () => {
  describe("processQbPaymentEvent", () => {
    it("should calculate points correctly (1 point per 10 KD)", async () => {
      const uniqueId = `calc-1-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: `test-invoice-${uniqueId}`,
        invoiceNumber: `INV-${uniqueId}`,
        customerPhone: "+96550001234",
        customerName: "Test Customer",
        amount: 100, // 100 KD = 10 points
      });

      expect(result.status).toBe("success");
      expect([result.pointsAdded, result.pointsPending]).toContain(10);
    }, { timeout: 15000 });

    it("should round down points correctly", async () => {
      const uniqueId = `calc-2-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: `test-invoice-${uniqueId}`,
        invoiceNumber: `INV-${uniqueId}`,
        customerPhone: "+96550002345",
        customerName: "Test Customer 2",
        amount: 95, // 95 KD = 9.5 → 9 points
      });

      expect(result.status).toBe("success");
      expect([result.pointsAdded, result.pointsPending]).toContain(9);
    }, { timeout: 15000 });

    it("should normalize Kuwait phone numbers", async () => {
      const uniqueId = `norm-3-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: `test-invoice-${uniqueId}`,
        invoiceNumber: `INV-${uniqueId}`,
        customerPhone: "96550003456", // without +
        customerName: "Test Customer 3",
        amount: 50,
      });

      expect(result.status).toBe("success");
    }, { timeout: 15000 });

    it("should reject invalid phone numbers", async () => {
      const uniqueId = `invalid-4-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: `test-invoice-${uniqueId}`,
        invoiceNumber: `INV-${uniqueId}`,
        customerPhone: "1234567890", // invalid
        customerName: "Test Customer 4",
        amount: 50,
      });

      expect(result.status).toBe("failed");
      expect(result.error).toContain("Invalid");
    }, { timeout: 15000 });

    it("should prevent duplicate processing", async () => {
      const uniqueId = `dup-${Date.now()}`;
      const eventData = {
        qbInvoiceId: `test-invoice-${uniqueId}`,
        invoiceNumber: `INV-${uniqueId}`,
        customerPhone: "+96550004567",
        customerName: "Test Customer DUP",
        amount: 50,
      };

      // First call
      const result1 = await processQbPaymentEvent(eventData);
      expect(result1.status).toBe("success");

      // Second call (should be skipped as duplicate)
      const result2 = await processQbPaymentEvent(eventData);
      expect(result2.status).toBe("duplicate");
    }, { timeout: 15000 });

    it("should create pending reward for unregistered customer", async () => {
      const phone = "+96550005678";
      const uniqueId = `pending-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: `test-invoice-${uniqueId}`,
        invoiceNumber: `INV-${uniqueId}`,
        customerPhone: phone,
        customerName: "Unregistered Customer",
        amount: 100,
      });

      expect(result.status).toBe("success");
      expect(result.customerId).toBeUndefined();
      expect([result.pointsAdded, result.pointsPending]).toContain(10);
    }, { timeout: 15000 });
  });

  describe("claimPendingRewards", () => {
    it("should handle no pending rewards gracefully", async () => {
      // Should not throw
      await expect(claimPendingRewards(999, "+96550007890")).resolves.not.toThrow();
    }, { timeout: 15000 });
  });

  describe("processPendingWhatsAppQueue", () => {
    it("should process pending WhatsApp queue without errors", async () => {
      // Process queue - should not throw
      await expect(processPendingWhatsAppQueue()).resolves.not.toThrow();
    }, { timeout: 15000 });

    it("should handle queue processing gracefully", async () => {
      // Process queue with no pending messages - should not throw
      await expect(processPendingWhatsAppQueue()).resolves.not.toThrow();
    }, { timeout: 15000 });
  });

  describe("Phone normalization", () => {
    it("should normalize +965 format", async () => {
      const uniqueId = `norm-965-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: `test-phone-1-${uniqueId}`,
        invoiceNumber: `INV-PHONE-1-${uniqueId}`,
        customerPhone: "+96550011234",
        customerName: "Test",
        amount: 50,
      });

      expect(result.status).toBe("success");
    }, { timeout: 15000 });

    it("should normalize 00965 format", async () => {
      const uniqueId = `norm-00965-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: `test-phone-2-${uniqueId}`,
        invoiceNumber: `INV-PHONE-2-${uniqueId}`,
        customerPhone: "0096550012345",
        customerName: "Test",
        amount: 50,
      });

      expect(result.status).toBe("success");
    }, { timeout: 15000 });

    it("should normalize 965 format", async () => {
      const uniqueId = `norm-965-only-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: `test-phone-3-${uniqueId}`,
        invoiceNumber: `INV-PHONE-3-${uniqueId}`,
        customerPhone: "96550013456",
        customerName: "Test",
        amount: 50,
      });

      expect(result.status).toBe("success");
    }, { timeout: 15000 });

    it("should reject non-Kuwait numbers", async () => {
      const uniqueId = `invalid-phone-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: `test-phone-invalid-${uniqueId}`,
        invoiceNumber: `INV-PHONE-INVALID-${uniqueId}`,
        customerPhone: "+11234567890", // US number
        customerName: "Test",
        amount: 50,
      });

      expect(["error", "failed"]).toContain(result.status);
    }, { timeout: 15000 });
  });
});
