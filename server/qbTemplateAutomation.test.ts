import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalisePhone } from "./whatsapp";

// Mock the database to prevent tests from writing to production
vi.mock("./db", () => ({
  getDb: vi.fn(async () => null), // Return null to prevent any database operations
}));

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

    it("should handle mixed spaces and dashes", () => {
      const result = normalisePhone("+965 5000-1234");
      expect(result).toBe("+96550001234");
    });

    it("should handle 0 prefix format", () => {
      const result = normalisePhone("050001234");
      expect(result).toBe("+96550001234");
    });

    it("should reject short phone (not 11 digits)", () => {
      const result = normalisePhone("123");
      expect(result).toBeNull();
    });

    it("should reject non-Kuwait phone numbers", () => {
      const result = normalisePhone("+1234567890");
      expect(result).toBeNull();
    });

    it("should handle phone with leading zeros", () => {
      const result = normalisePhone("0096550001234");
      expect(result).toBe("+96550001234");
    });

    it("should handle phone with plus and spaces", () => {
      const result = normalisePhone("+ 965 5000 1234");
      expect(result).toBe("+96550001234");
    });
  });
});
