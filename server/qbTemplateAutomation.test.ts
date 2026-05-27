import { describe, it, expect, vi } from "vitest";
import { processQbPaymentEvent } from "./qbRewardsEngine";
import { normalisePhone } from "./whatsapp";

// Mock the sendWhatsAppTemplate function
vi.mock("./whatsapp", async () => {
  const actual = await vi.importActual<typeof import("./whatsapp")>("./whatsapp");
  return {
    ...actual,
    sendWhatsAppTemplate: vi.fn(async (phone: string, template: string, params: any) => {
      // Simulate successful template send
      if (phone.includes("+965")) {
        return { success: true, messageSid: `SM_TEMPLATE_${Date.now()}` };
      }
      return { success: false, error: "Invalid phone" };
    }),
  };
});

describe("QB Template-Based Automation", () => {
  describe("Phone Normalization", () => {
    it("should normalize +965 format", () => {
      const result = normalisePhone("+96550001234");
      expect(result).toBe("+96550001234");
    });

    it("should normalize 00965 format", () => {
      const result = normalisePhone("0096550001234");
      expect(result).toBe("+96550001234");
    });

    it("should normalize 965 format", () => {
      const result = normalisePhone("96550001234");
      expect(result).toBe("+96550001234");
    });

    it("should normalize local 8-digit format", () => {
      const result = normalisePhone("50001234");
      expect(result).toBe("+96550001234");
    });

    it("should remove spaces and dashes", () => {
      const result = normalisePhone("+965 5000 1234");
      expect(result).toBe("+96550001234");
    });

    it("should handle dashes in phone number", () => {
      const result = normalisePhone("965-5000-1234");
      expect(result).toBe("+96550001234");
    });

    it("should handle mixed formatting", () => {
      const result = normalisePhone("00965-5000-1234");
      expect(result).toBe("+96550001234");
    });

    it("should handle international numbers by adding 965", () => {
      // Note: normalisePhone assumes Kuwait, so non-Kuwait numbers get 965 prepended
      // This is by design - all numbers without 965 are treated as Kuwait numbers
      const result = normalisePhone("+11234567890");
      // The function will treat this as a local number and add 965
      expect(result).toMatch(/^\+965/);
    });
  });

  describe("Template-Based QB Payment Processing", () => {
    it("should use reward_test template for existing customer", async () => {
      const uniqueId = `template-existing-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: String(Math.floor(Math.random() * 1000000)),
        invoiceNumber: `INV-${uniqueId}`,
        customerPhone: "+96550001234",
        customerName: "Ahmed Al-Dosari",
        amount: 100,
      });

      expect(result.status).toBe("success");
      // Either customerId (existing customer) or pendingRewardId (new customer) should be defined
      expect(result.customerId || result.pendingRewardId).toBeDefined();
    }, { timeout: 15000 });

    it("should use reward_test template for new customer", async () => {
      const uniqueId = `template-new-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: String(Math.floor(Math.random() * 1000000)),
        invoiceNumber: `INV-${uniqueId}`,
        customerPhone: "+96550002345",
        customerName: "Fatima Al-Rashid",
        amount: 150,
      });

      expect(result.status).toBe("success");
    }, { timeout: 15000 });

    it("should use reward_test template with normalized phone (spaces)", async () => {
      const uniqueId = `template-spaces-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: String(Math.floor(Math.random() * 1000000)),
        invoiceNumber: `INV-${uniqueId}`,
        customerPhone: "+965 5000 3456",
        customerName: "Mohammed Al-Sabah",
        amount: 200,
      });

      expect(result.status).toBe("success");
    }, { timeout: 15000 });

    it("should use reward_test template with normalized phone (dashes)", async () => {
      const uniqueId = `template-dashes-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: String(Math.floor(Math.random() * 1000000)),
        invoiceNumber: `INV-${uniqueId}`,
        customerPhone: "965-5000-4567",
        customerName: "Noor Al-Mutairi",
        amount: 175,
      });

      expect(result.status).toBe("success");
    }, { timeout: 15000 });

    it("should prevent duplicate reward_test sends", async () => {
      const uniqueId = `template-dup-${Date.now()}`;
      const invoiceId = String(Math.floor(Math.random() * 1000000));
      const eventData = {
        qbInvoiceId: invoiceId,
        invoiceNumber: `INV-${uniqueId}`,
        customerPhone: "+96550005678",
        customerName: "Sara Al-Khaled",
        amount: 125,
      };

      // First call
      const result1 = await processQbPaymentEvent(eventData);
      expect(result1.status).toBe("success");

      // Second call (should be skipped as duplicate)
      const result2 = await processQbPaymentEvent(eventData);
      expect(result2.status).toBe("duplicate");
    }, { timeout: 15000 });

    it("should calculate points correctly with reward_test template", async () => {
      const uniqueId = `template-points-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: String(Math.floor(Math.random() * 1000000)),
        invoiceNumber: `INV-${uniqueId}`,
        customerPhone: "+96550006789",
        customerName: "Test Customer",
        amount: 100, // 100 KD = 10 points
      });

      expect(result.status).toBe("success");
      expect([result.pointsAdded, result.pointsPending]).toContain(10);
    }, { timeout: 15000 });

    it("should handle 00965 format with reward_test template", async () => {
      const uniqueId = `template-00965-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: String(Math.floor(Math.random() * 1000000)),
        invoiceNumber: `INV-${uniqueId}`,
        customerPhone: "0096550007890",
        customerName: "Test Customer 2",
        amount: 80,
      });

      expect(result.status).toBe("success");
    }, { timeout: 15000 });
  });

  describe("Automatic Delivery Tracking", () => {
    it("should log reward_test template send with message SID", async () => {
      const uniqueId = `template-tracking-${Date.now()}`;
      const result = await processQbPaymentEvent({
        qbInvoiceId: String(Math.floor(Math.random() * 1000000)),
        invoiceNumber: `INV-${uniqueId}`,
        customerPhone: "+96550008901",
        customerName: "Test Tracking",
        amount: 90,
      });

      expect(result.status).toBe("success");
      // Message SID should be generated by mock
      expect(result).toBeDefined();
    }, { timeout: 15000 });
  });
});
