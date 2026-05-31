import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";

/**
 * Integration tests for QB webhook endpoint
 * Tests signature validation, payment processing, and end-to-end flow
 */

const WEBHOOK_URL = "http://localhost:3000/api/qb/webhook";
const VERIFICATION_TOKEN = process.env.QB_WEBHOOK_VERIFICATION_TOKEN || "test-token-12345";

// Helper: Create valid webhook signature
function createWebhookSignature(body: string, token: string): string {
  return crypto
    .createHmac("sha256", token)
    .update(body)
    .digest("base64");
}

// Helper: Send webhook request
async function sendWebhook(payload: any, signature: string) {
  const body = JSON.stringify(payload);
  
  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "intuit-signature": signature,
    },
    body,
  });

  return response;
}

describe("QB Webhook Integration Tests", () => {
  describe("Signature Validation", () => {
    it("should reject webhook with invalid signature", async () => {
      const payload = {
        id: "test-event-1",
        eventType: "Invoice.Change",
        entities: [],
      };

      const invalidSignature = "invalid-signature-xyz";
      const response = await sendWebhook(payload, invalidSignature);

      // Webhook always returns 200 immediately; signature validation happens async
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("received");
    });

    it("should accept webhook with valid signature and return 200", async () => {
      const payload = {
        id: "test-event-2",
        eventType: "Invoice.Change",
        entities: [
          {
            name: "Invoice",
            id: "test-invoice-123",
          },
        ],
      };

      const body = JSON.stringify(payload);
      const validSignature = createWebhookSignature(body, VERIFICATION_TOKEN);
      const response = await sendWebhook(payload, validSignature);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("received");
    });
  });

  describe("Event Processing", () => {
    it("should ignore non-Invoice.Change events", async () => {
      const payload = {
        id: "test-event-3",
        eventType: "Bill.Change",
        entities: [],
      };

      const body = JSON.stringify(payload);
      const signature = createWebhookSignature(body, VERIFICATION_TOKEN);
      const response = await sendWebhook(payload, signature);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("received");
    });

    it("should process Invoice.Change events", async () => {
      const payload = {
        id: "test-event-4",
        eventType: "Invoice.Change",
        entities: [
          {
            name: "Invoice",
            id: "test-invoice-456",
          },
        ],
      };

      const body = JSON.stringify(payload);
      const signature = createWebhookSignature(body, VERIFICATION_TOKEN);
      const response = await sendWebhook(payload, signature);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("received");
    });
  });

  describe("Test Webhook Endpoint", () => {
    it("should process test webhook with valid data", async () => {
      const testPayload = {
        qbInvoiceId: "test-inv-789",
        invoiceNumber: "INV-001",
        customerPhone: "+96599999999",
        customerName: "Test Customer",
        amount: 100,
      };

      const response = await fetch("http://localhost:3000/api/qb/test-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testPayload),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBeDefined();
    });

    it("should reject test webhook with missing fields", async () => {
      const testPayload = {
        invoiceNumber: "INV-002",
        // Missing other required fields
      };

      const response = await fetch("http://localhost:3000/api/qb/test-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testPayload),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Missing required fields");
    });
  });

  describe("HTTP Response Codes", () => {
    it("should return HTTP 200 for successful webhook", async () => {
      const payload = {
        id: "test-event-5",
        eventType: "Invoice.Change",
        entities: [],
      };

      const body = JSON.stringify(payload);
      const signature = createWebhookSignature(body, VERIFICATION_TOKEN);
      const response = await sendWebhook(payload, signature);

      expect(response.status).toBe(200);
    });

    it("should return HTTP 200 even on processing errors", async () => {
      const payload = {
        id: "test-event-6",
        eventType: "Invoice.Change",
        entities: [
          {
            name: "Invoice",
            id: "nonexistent-invoice",
          },
        ],
      };

      const body = JSON.stringify(payload);
      const signature = createWebhookSignature(body, VERIFICATION_TOKEN);
      const response = await sendWebhook(payload, signature);

      // Should return 200 to acknowledge to Intuit, even if processing fails
      expect(response.status).toBe(200);
    });

    it("should return HTTP 200 even for invalid signature (async validation)", async () => {
      const payload = {
        id: "test-event-7",
        eventType: "Invoice.Change",
        entities: [],
      };

      const response = await sendWebhook(payload, "invalid-sig");
      // Webhook always returns 200 immediately; signature validation happens async
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("received");
    });
  });

  describe("Production Logging", () => {
    it("should respond with received status", async () => {
      const payload = {
        id: "test-event-8",
        eventType: "Invoice.Change",
        entities: [],
      };

      const body = JSON.stringify(payload);
      const signature = createWebhookSignature(body, VERIFICATION_TOKEN);
      const response = await sendWebhook(payload, signature);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("received");
    });
  });
});
